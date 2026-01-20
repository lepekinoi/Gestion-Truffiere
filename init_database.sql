--
-- Base de données Gestion Truffière - Fichier d'initialisation
-- Généré le: 20/01/2026
-- Fichier minimal pour Docker / nouveau projet
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Extensions PostgreSQL
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

--
-- Types ENUM
--

CREATE TYPE public.conservation_type AS ENUM (
    'Frais',
    'Surgelé',
    'Séché'
);

CREATE TYPE public.maturite_truffe AS ENUM (
    'Blanc',
    'Gris',
    'Noir'
);

CREATE TYPE public.qualite_truffe AS ENUM (
    'Extra',
    '1ère',
    '2e'
);

CREATE TYPE public.statut_commande_achat AS ENUM (
    'En attente',
    'Confirmée',
    'Expédiée',
    'Livrée',
    'Réceptionnée',
    'Annulée'
);

CREATE TYPE public.statut_fournisseur_truffe AS ENUM (
    'Actif',
    'Inactif',
    'Suspendu'
);

CREATE TYPE public.statut_paiement_achat AS ENUM (
    'En attente',
    'Partiellement payée',
    'Payée'
);

CREATE TYPE public.statut_reception_achat AS ENUM (
    'Acceptée',
    'Rejetée',
    'Partielle'
);

--
-- Fonctions
--

CREATE FUNCTION public.check_account_lock(p_email character varying) RETURNS TABLE(is_locked boolean, locked_until timestamp without time zone, attempts integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_user RECORD;
    v_recent_failures INTEGER;
BEGIN
    -- Récupérer l'utilisateur
    SELECT u.locked_until, u.failed_login_attempts
    INTO v_user
    FROM public.users u
    WHERE u.email = p_email;
    
    -- Compter les échecs récents (15 dernières minutes)
    SELECT COUNT(*) INTO v_recent_failures
    FROM public.login_attempts
    WHERE email = p_email
    AND success = false
    AND attempted_at > NOW() - INTERVAL '15 minutes';
    
    RETURN QUERY SELECT 
        (v_user.locked_until IS NOT NULL AND v_user.locked_until > NOW()) AS is_locked,
        v_user.locked_until,
        COALESCE(v_recent_failures, 0)::INTEGER AS attempts;
END;
$$;

CREATE FUNCTION public.cleanup_expired_refresh_tokens(p_days_old integer DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens
    WHERE (expires_at < NOW() - INTERVAL '1 day' * p_days_old)
       OR (revoked = TRUE AND revoked_at < NOW() - INTERVAL '1 day' * p_days_old);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$;

CREATE FUNCTION public.cleanup_expired_tokens() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Supprimer les refresh tokens expirés depuis plus de 30 jours
    DELETE FROM public.refresh_tokens 
    WHERE expires_at < NOW() - INTERVAL '30 days';
    
    -- Supprimer les tokens de reset expirés depuis plus de 7 jours
    DELETE FROM public.password_reset_tokens 
    WHERE expires_at < NOW() - INTERVAL '7 days';
    
    -- Supprimer les sessions expirées depuis plus de 7 jours
    DELETE FROM public.user_sessions 
    WHERE expires_at < NOW() - INTERVAL '7 days';
    
    -- Supprimer les tentatives de login de plus de 90 jours
    DELETE FROM public.login_attempts 
    WHERE attempted_at < NOW() - INTERVAL '90 days';
END;
$$;

CREATE FUNCTION public.detect_token_reuse(p_token_hash character varying) RETURNS TABLE(is_reused boolean, user_id integer, token_id integer, last_used timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rt.revoked OR rt.expires_at < NOW() as is_reused,
        rt.user_id,
        rt.id as token_id,
        rt.last_used_at
    FROM refresh_tokens rt
    WHERE rt.token_hash = p_token_hash;
END;
$$;

CREATE FUNCTION public.get_consommation_eau(p_date_debut date, p_date_fin date, p_parcelle_id integer DEFAULT NULL::integer) RETURNS TABLE(parcelle_nom character varying, volume_total_m3 numeric, nb_irrigations bigint, volume_moyen_m3 numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.nom,
        COALESCE(SUM(id.volume_eau_m3), 0)::DECIMAL as volume_total,
        COUNT(i.id),
        COALESCE(AVG(id.volume_eau_m3), 0)::DECIMAL as volume_moyen
    FROM interventions i
    JOIN intervention_details id ON i.id = id.intervention_id
    JOIN parcelles p ON i.parcelle_id = p.id
    WHERE i.type_intervention_id = (SELECT id FROM types_intervention WHERE nom = 'Irrigation')
    AND i.date_realisee BETWEEN p_date_debut AND p_date_fin
    AND (p_parcelle_id IS NULL OR i.parcelle_id = p_parcelle_id)
    GROUP BY p.nom
    ORDER BY volume_total DESC;
END;
$$;

CREATE FUNCTION public.increment_login_failures(p_email character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_failures INTEGER;
BEGIN
    -- Incrémenter le compteur
    UPDATE public.users 
    SET failed_login_attempts = failed_login_attempts + 1
    WHERE email = p_email
    RETURNING failed_login_attempts INTO v_failures;
    
    -- Verrouiller le compte après 5 échecs
    IF v_failures >= 5 THEN
        UPDATE public.users 
        SET locked_until = NOW() + INTERVAL '15 minutes'
        WHERE email = p_email;
    END IF;
END;
$$;

CREATE FUNCTION public.log_historique() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO historique (table_name, record_id, action, old_data)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO historique (table_name, record_id, action, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO historique (table_name, record_id, action, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW));
        RETURN NEW;
    END IF;
END;
$$;

CREATE FUNCTION public.reset_login_failures(p_user_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE public.users 
    SET 
        failed_login_attempts = 0,
        locked_until = NULL,
        last_login = NOW()
    WHERE id = p_user_id;
END;
$$;

CREATE FUNCTION public.revoke_token_chain(p_token_id integer, p_reason character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_revoked_count INTEGER := 0;
    v_child_count INTEGER := 0;
BEGIN
    -- Révoquer le token actuel
    UPDATE refresh_tokens
    SET revoked = TRUE,
        revoked_at = NOW(),
        revoked_reason = p_reason
    WHERE id = p_token_id
      AND revoked = FALSE;
    
    GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
    
    -- Révoquer tous les tokens enfants (récursif)
    WITH RECURSIVE token_tree AS (
        SELECT id FROM refresh_tokens WHERE parent_token_id = p_token_id
        UNION ALL
        SELECT rt.id FROM refresh_tokens rt
        INNER JOIN token_tree tt ON rt.parent_token_id = tt.id
    )
    UPDATE refresh_tokens
    SET revoked = TRUE,
        revoked_at = NOW(),
        revoked_reason = p_reason || '_chain'
    WHERE id IN (SELECT id FROM token_tree)
      AND revoked = FALSE;
    
    GET DIAGNOSTICS v_child_count = ROW_COUNT;
    
    RETURN v_revoked_count + v_child_count;
END;
$$;

CREATE FUNCTION public.update_intervention_details_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_token_last_used() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.last_used_at = NOW();
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

--
-- Tables
--

-- Table: users
CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    nom character varying(100) NOT NULL,
    prenom character varying(100),
    role character varying(50) DEFAULT 'user'::character varying,
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    last_login timestamp without time zone,
    password_changed_at timestamp without time zone,
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY[('admin'::character varying)::text, ('user'::character varying)::text, ('readonly'::character varying)::text])))
);

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

-- Table: parametres
CREATE SEQUENCE public.parametres_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.parametres (
    id integer NOT NULL,
    cle character varying(100) NOT NULL,
    valeur jsonb NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.parametres_id_seq OWNED BY public.parametres.id;

-- Table: preferences_utilisateur
CREATE SEQUENCE public.preferences_utilisateur_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.preferences_utilisateur (
    id integer NOT NULL,
    user_id character varying(100) DEFAULT 'default'::character varying,
    colonnes_affichees jsonb DEFAULT '{}'::jsonb,
    colonnes_export jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.preferences_utilisateur_id_seq OWNED BY public.preferences_utilisateur.id;

-- Table: refresh_tokens
CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(255) NOT NULL,
    device_info character varying(255),
    ip_address character varying(45),
    expires_at timestamp without time zone NOT NULL,
    revoked boolean DEFAULT false,
    revoked_at timestamp without time zone,
    revoked_reason character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    parent_token_id integer,
    rotation_count integer DEFAULT 0 NOT NULL,
    user_agent text,
    last_used_at timestamp without time zone,
    CONSTRAINT rotation_count_limit CHECK ((rotation_count <= 10)),
    CONSTRAINT rotation_count_positive CHECK ((rotation_count >= 0))
);

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;

-- Table: password_reset_tokens
CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;

-- Table: user_sessions
CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    session_id character varying(255) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    device_type character varying(50),
    last_activity timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;

-- Table: login_attempts
CREATE SEQUENCE public.login_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.login_attempts (
    id integer NOT NULL,
    email character varying(255),
    ip_address character varying(45),
    user_agent text,
    success boolean NOT NULL,
    failure_reason character varying(100),
    attempted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.login_attempts_id_seq OWNED BY public.login_attempts.id;

-- Table: historique
CREATE SEQUENCE public.historique_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.historique (
    id integer NOT NULL,
    table_name character varying(50) NOT NULL,
    record_id integer NOT NULL,
    action character varying(20) NOT NULL,
    old_data jsonb,
    new_data jsonb,
    user_name character varying(100),
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.historique_id_seq OWNED BY public.historique.id;

-- Table: types_intervention
CREATE SEQUENCE public.types_intervention_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.types_intervention (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    description text,
    couleur character varying(7)
);

ALTER SEQUENCE public.types_intervention_id_seq OWNED BY public.types_intervention.id;

-- Table: amendements_ref
CREATE SEQUENCE public.amendements_ref_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.amendements_ref (
    id integer NOT NULL,
    nom character varying(150) NOT NULL,
    type_amendement character varying(50),
    composition text,
    dose_recommandee_ha character varying(50),
    utilisable_bio boolean DEFAULT false,
    effet_principal text,
    precautions text,
    actif boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.amendements_ref_id_seq OWNED BY public.amendements_ref.id;

-- Table: produits_phyto
CREATE SEQUENCE public.produits_phyto_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.produits_phyto (
    id integer NOT NULL,
    nom_commercial character varying(150) NOT NULL,
    matiere_active character varying(255),
    numero_amm character varying(50),
    categorie character varying(50),
    fabricant character varying(100),
    dose_recommandee_ha character varying(50),
    dar_jours integer,
    znt_metres numeric(5,2),
    utilisable_bio boolean DEFAULT false,
    phrase_risque text,
    conseils_utilisation text,
    actif boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.produits_phyto_id_seq OWNED BY public.produits_phyto.id;

-- Table: parcelles
CREATE SEQUENCE public.parcelles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.parcelles (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    surface_ha numeric(10,2),
    geometrie public.geometry(Polygon,4326),
    type_sol character varying(100),
    ph_sol numeric(3,1),
    exposition character varying(50),
    date_creation timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text
);

ALTER SEQUENCE public.parcelles_id_seq OWNED BY public.parcelles.id;

-- Table: arbres
CREATE SEQUENCE public.arbres_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.arbres (
    id integer NOT NULL,
    parcelle_id integer,
    numero character varying(50) NOT NULL,
    espece character varying(100) NOT NULL,
    variete_truffe character varying(100),
    date_plantation date NOT NULL,
    "position" public.geometry(Point,4326),
    etat character varying(50) DEFAULT 'Bon'::character varying,
    circonference_cm numeric(5,1),
    hauteur_m numeric(4,1),
    date_derniere_taille date,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    latitude numeric(10,8),
    longitude numeric(11,8),
    deleted_at timestamp without time zone
);

ALTER SEQUENCE public.arbres_id_seq OWNED BY public.arbres.id;

-- Table: caveurs
CREATE SEQUENCE public.caveurs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.caveurs (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.caveurs_id_seq OWNED BY public.caveurs.id;

-- Table: chiens
CREATE SEQUENCE public.chiens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.chiens (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    race character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.chiens_id_seq OWNED BY public.chiens.id;

-- Table: clients
CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.clients (
    id integer NOT NULL,
    type character varying(20) NOT NULL,
    nom character varying(200) NOT NULL,
    prenom character varying(100),
    raison_sociale character varying(200),
    email character varying(150),
    telephone character varying(20),
    adresse text,
    code_postal character varying(10),
    ville character varying(100),
    pays character varying(100) DEFAULT 'France'::character varying,
    siret character varying(14),
    notes text,
    date_premier_achat date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;

-- Table: fournisseurs_truffes
CREATE SEQUENCE public.fournisseurs_truffes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.fournisseurs_truffes (
    id integer NOT NULL,
    nom character varying(200) NOT NULL,
    raison_sociale character varying(200),
    email character varying(150),
    telephone character varying(20),
    adresse text,
    code_postal character varying(10),
    ville character varying(100),
    pays character varying(100) DEFAULT 'France'::character varying,
    zone_production character varying(100),
    certifications character varying(255),
    statut public.statut_fournisseur_truffe DEFAULT 'Actif'::public.statut_fournisseur_truffe,
    contact_principal character varying(150),
    telephone_contact character varying(20),
    delai_livraison_jours integer,
    conditions_paiement character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);

ALTER SEQUENCE public.fournisseurs_truffes_id_seq OWNED BY public.fournisseurs_truffes.id;

-- Table: interventions
CREATE SEQUENCE public.interventions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.interventions (
    id integer NOT NULL,
    type_intervention_id integer,
    parcelle_id integer,
    arbre_id integer,
    date_prevue date NOT NULL,
    date_realisee date,
    duree_minutes integer,
    personnel character varying(200),
    description text,
    cout numeric(10,2),
    statut character varying(20) DEFAULT 'Planifié'::character varying,
    meteo character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.interventions_id_seq OWNED BY public.interventions.id;

-- Table: intervention_details
CREATE SEQUENCE public.intervention_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.intervention_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    volume_eau_m3 numeric(10,2),
    volume_eau_par_arbre_l numeric(10,2),
    methode_irrigation character varying(50),
    source_eau character varying(50),
    debit_l_h numeric(10,2),
    frequence_irrigation character varying(30),
    humidite_sol_avant numeric(5,2),
    humidite_sol_apres numeric(5,2),
    pression_bar numeric(5,2),
    categorie_traitement character varying(50),
    nom_commercial character varying(150),
    matiere_active character varying(255),
    numero_amm character varying(50),
    dose_produit_ha numeric(10,3),
    dose_produit_arbre numeric(10,3),
    concentration character varying(50),
    volume_bouillie_l numeric(10,2),
    surface_traitee_ha numeric(10,4),
    methode_application character varying(50),
    cible_traitement character varying(150),
    delai_avant_recolte_jours integer,
    conditions_application text,
    equipement_protection character varying(255),
    zone_non_traitee_m numeric(5,2),
    fabricant character varying(100),
    type_amendement character varying(50),
    nom_produit_amendement character varying(150),
    composition_npk character varying(50),
    composition_cao numeric(5,2),
    composition_mgo numeric(5,2),
    composition_autres text,
    dose_kg_ha numeric(10,2),
    dose_kg_arbre numeric(10,2),
    quantite_totale_kg numeric(10,2),
    ph_sol_avant numeric(4,2),
    ph_sol_apres numeric(4,2),
    methode_epandage character varying(50),
    incorporation boolean DEFAULT false,
    profondeur_incorporation_cm integer,
    origine_produit character varying(150),
    certification_bio boolean DEFAULT false,
    numero_lot character varying(100),
    type_taille character varying(50),
    intensite_taille character varying(30),
    hauteur_avant_cm integer,
    hauteur_apres_cm integer,
    diametre_couronne_avant_m numeric(5,2),
    diametre_couronne_apres_m numeric(5,2),
    branches_supprimees integer,
    diametre_max_coupe_cm integer,
    volume_residus_m3 numeric(10,2),
    destination_residus character varying(50),
    outils_taille character varying(200),
    desinfection_outils boolean DEFAULT false,
    produit_desinfection character varying(100),
    type_travail_sol character varying(50),
    profondeur_travail_cm integer,
    largeur_travail_m numeric(5,2),
    outil_travail_sol character varying(100),
    zone_travaillee character varying(50),
    distance_tronc_m numeric(5,2),
    etat_sol_avant character varying(30),
    enherbement_avant character varying(30),
    enherbement_apres character varying(30),
    presence_cailloux boolean DEFAULT false,
    type_observation character varying(50),
    etat_brule character varying(50),
    diametre_brule_m numeric(5,2),
    evolution_brule character varying(50),
    presence_ascomes boolean DEFAULT false,
    nombre_ascomes integer,
    indice_mycorhization character varying(30),
    symptomes_observes text,
    ravageurs_identifies character varying(255),
    degats_constates text,
    niveau_urgence character varying(30),
    preconisations text,
    type_paillage character varying(50),
    epaisseur_cm integer,
    surface_paillee_m2 numeric(10,2),
    quantite_paillage_m3 numeric(10,2),
    origine_paillage character varying(150),
    espece_plantee character varying(100),
    variete_plant character varying(100),
    fournisseur_plant character varying(150),
    type_mycorhization character varying(100),
    certification_plant character varying(100),
    numero_lot_plant character varying(100),
    taille_plant_cm integer,
    diametre_collet_mm integer,
    dimensions_trou_cm character varying(50),
    amendement_plantation text,
    tuteur boolean DEFAULT false,
    protection_gibier boolean DEFAULT false,
    type_protection character varying(100),
    arrosage_plantation_l integer,
    laboratoire character varying(150),
    reference_analyse character varying(100),
    profondeur_prelevement_cm integer,
    nombre_echantillons integer,
    resultats_ph numeric(4,2),
    resultats_calcaire_actif numeric(5,2),
    resultats_matiere_organique numeric(5,2),
    resultats_azote numeric(6,3),
    resultats_phosphore numeric(6,2),
    resultats_potassium numeric(6,2),
    resultats_cec numeric(6,2),
    interpretation text,
    type_piege character varying(50),
    cible_piegeage character varying(100),
    nombre_pieges integer,
    captures integer,
    densite_pieges_ha integer,
    date_releve date,
    action_suite character varying(255),
    type_inoculum character varying(100),
    espece_truffe_inoculation character varying(100),
    quantite_inoculum character varying(50),
    methode_inoculation character varying(100),
    fournisseur_inoculum character varying(150),
    photos_paths text,
    documents_paths text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.intervention_details_id_seq OWNED BY public.intervention_details.id;

-- Table: irrigation_details
CREATE SEQUENCE public.irrigation_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.irrigation_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    volume_eau_m3 numeric(10,2),
    volume_eau_par_arbre_l numeric(10,2),
    methode_irrigation character varying(50),
    source_eau character varying(50),
    debit_l_h numeric(10,2),
    pression_bar numeric(5,2),
    frequence_irrigation character varying(30),
    humidite_sol_avant numeric(5,2),
    humidite_sol_apres numeric(5,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.irrigation_details_id_seq OWNED BY public.irrigation_details.id;

-- Table: amendement_details
CREATE SEQUENCE public.amendement_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.amendement_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    type_amendement character varying(50),
    nom_produit_amendement character varying(150),
    origine_produit character varying(150),
    numero_lot character varying(100),
    certification_bio boolean DEFAULT false,
    composition_npk character varying(50),
    composition_cao numeric(5,2),
    composition_mgo numeric(5,2),
    composition_autres text,
    dose_kg_ha numeric(10,2),
    dose_kg_arbre numeric(10,2),
    quantite_totale_kg numeric(10,2),
    methode_epandage character varying(50),
    incorporation boolean DEFAULT false,
    profondeur_incorporation_cm integer,
    ph_sol_avant numeric(4,2),
    ph_sol_apres numeric(4,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.amendement_details_id_seq OWNED BY public.amendement_details.id;

-- Table: analyse_sol_details
CREATE SEQUENCE public.analyse_sol_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.analyse_sol_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    profondeur_prelevement_cm integer,
    nombre_echantillons integer,
    laboratoire character varying(150),
    reference_analyse character varying(100),
    resultats_ph numeric(4,2),
    resultats_calcaire_actif numeric(5,2),
    resultats_matiere_organique numeric(5,2),
    resultats_azote numeric(6,3),
    resultats_phosphore numeric(6,2),
    resultats_potassium numeric(6,2),
    resultats_cec numeric(6,2),
    interpretation text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.analyse_sol_details_id_seq OWNED BY public.analyse_sol_details.id;

-- Table: traitement_phyto_details
CREATE SEQUENCE public.traitement_phyto_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.traitement_phyto_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    categorie_traitement character varying(50),
    nom_commercial character varying(150),
    matiere_active character varying(255),
    numero_amm character varying(50),
    fabricant character varying(100),
    dose_produit_ha numeric(10,3),
    dose_produit_arbre numeric(10,3),
    concentration character varying(50),
    volume_bouillie_l numeric(10,2),
    surface_traitee_ha numeric(10,4),
    methode_application character varying(50),
    cible_traitement character varying(150),
    delai_avant_recolte_jours integer,
    zone_non_traitee_m numeric(5,2),
    equipement_protection character varying(255),
    conditions_application text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.traitement_phyto_details_id_seq OWNED BY public.traitement_phyto_details.id;

-- Table: taille_details
CREATE SEQUENCE public.taille_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.taille_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    type_taille character varying(50),
    intensite_taille character varying(30),
    hauteur_avant_cm integer,
    hauteur_apres_cm integer,
    diametre_couronne_avant_m numeric(5,2),
    diametre_couronne_apres_m numeric(5,2),
    branches_supprimees integer,
    diametre_max_coupe_cm integer,
    volume_residus_m3 numeric(10,2),
    destination_residus character varying(50),
    outils_taille character varying(200),
    desinfection_outils boolean DEFAULT false,
    produit_desinfection character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.taille_details_id_seq OWNED BY public.taille_details.id;

-- Table: travail_sol_details
CREATE SEQUENCE public.travail_sol_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.travail_sol_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    type_travail_sol character varying(50),
    outil_travail_sol character varying(100),
    zone_travaillee character varying(50),
    profondeur_travail_cm integer,
    largeur_travail_m numeric(5,2),
    distance_tronc_m numeric(5,2),
    etat_sol_avant character varying(30),
    enherbement_avant character varying(30),
    enherbement_apres character varying(30),
    presence_cailloux boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.travail_sol_details_id_seq OWNED BY public.travail_sol_details.id;

-- Table: observation_details
CREATE SEQUENCE public.observation_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.observation_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    type_observation character varying(50),
    niveau_urgence character varying(30),
    etat_brule character varying(50),
    diametre_brule_m numeric(5,2),
    evolution_brule character varying(50),
    presence_ascomes boolean DEFAULT false,
    nombre_ascomes integer,
    indice_mycorhization character varying(30),
    symptomes_observes text,
    ravageurs_identifies character varying(255),
    degats_constates text,
    preconisations text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.observation_details_id_seq OWNED BY public.observation_details.id;

-- Table: paillage_details
CREATE SEQUENCE public.paillage_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.paillage_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    type_paillage character varying(50),
    epaisseur_cm integer,
    surface_paillee_m2 numeric(10,2),
    quantite_paillage_m3 numeric(10,2),
    origine_paillage character varying(150),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.paillage_details_id_seq OWNED BY public.paillage_details.id;

-- Table: piegeage_details
CREATE SEQUENCE public.piegeage_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.piegeage_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    type_piege character varying(50),
    cible_piegeage character varying(100),
    nombre_pieges integer,
    densite_pieges_ha integer,
    date_releve date,
    captures integer,
    action_suite character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.piegeage_details_id_seq OWNED BY public.piegeage_details.id;

-- Table: plantation_details
CREATE SEQUENCE public.plantation_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.plantation_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    espece_plantee character varying(100),
    variete_plant character varying(100),
    type_mycorhization character varying(100),
    fournisseur_plant character varying(150),
    certification_plant character varying(100),
    numero_lot_plant character varying(100),
    taille_plant_cm integer,
    diametre_collet_mm integer,
    dimensions_trou_cm character varying(50),
    amendement_plantation text,
    arrosage_plantation_l integer,
    tuteur boolean DEFAULT false,
    protection_gibier boolean DEFAULT false,
    type_protection character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.plantation_details_id_seq OWNED BY public.plantation_details.id;

-- Table: inoculation_details
CREATE SEQUENCE public.inoculation_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.inoculation_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    type_inoculum character varying(100),
    espece_truffe_inoculation character varying(100),
    quantite_inoculum character varying(50),
    methode_inoculation character varying(100),
    fournisseur_inoculum character varying(150),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.inoculation_details_id_seq OWNED BY public.inoculation_details.id;

-- Table: recoltes
CREATE SEQUENCE public.recoltes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.recoltes (
    id integer NOT NULL,
    parcelle_id integer,
    arbre_id integer,
    date_recolte date NOT NULL,
    poids_grammes numeric(10,2) NOT NULL,
    qualite character varying(50),
    calibre character varying(50),
    maturite character varying(50),
    profondeur_cm integer,
    caveur character varying(100),
    chien character varying(100),
    conditions_meteo character varying(200),
    temperature_sol numeric(4,1),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    exposition character varying(20)
);

ALTER SEQUENCE public.recoltes_id_seq OWNED BY public.recoltes.id;

-- Table: commandes
CREATE SEQUENCE public.commandes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.commandes (
    id integer NOT NULL,
    client_id integer,
    numero_commande character varying(50),
    date_commande date DEFAULT CURRENT_DATE NOT NULL,
    date_livraison_demandee date,
    poids_grammes numeric(10,2),
    calibre character varying(50),
    qualite character varying(50),
    maturite character varying(50),
    prix_unitaire_kg numeric(10,2),
    montant_total numeric(10,2),
    statut character varying(30) DEFAULT 'En attente'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.commandes_id_seq OWNED BY public.commandes.id;

-- Table: ventes
CREATE SEQUENCE public.ventes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.ventes (
    id integer NOT NULL,
    client_id integer,
    recolte_id integer,
    date_vente date NOT NULL,
    quantite_grammes numeric(10,2) NOT NULL,
    prix_unitaire_kg numeric(10,2) NOT NULL,
    montant_total numeric(10,2) NOT NULL,
    mode_paiement character varying(50),
    statut character varying(20) DEFAULT 'En attente'::character varying,
    numero_facture character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    commande_id integer
);

ALTER SEQUENCE public.ventes_id_seq OWNED BY public.ventes.id;

-- Table: contacts_fournisseurs_truffes
CREATE SEQUENCE public.contacts_fournisseurs_truffes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.contacts_fournisseurs_truffes (
    id integer NOT NULL,
    fournisseur_id integer NOT NULL,
    nom character varying(150) NOT NULL,
    titre_poste character varying(100),
    email character varying(150),
    telephone character varying(20),
    est_principal boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.contacts_fournisseurs_truffes_id_seq OWNED BY public.contacts_fournisseurs_truffes.id;

-- Table: commandes_achat_truffes
CREATE SEQUENCE public.commandes_achat_truffes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.commandes_achat_truffes (
    id integer NOT NULL,
    fournisseur_id integer NOT NULL,
    numero_commande character varying(50) NOT NULL,
    date_commande date DEFAULT CURRENT_DATE NOT NULL,
    date_livraison_prevue date,
    date_livraison_reelle date,
    montant_total numeric(12,2),
    statut public.statut_commande_achat DEFAULT 'En attente'::public.statut_commande_achat,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.commandes_achat_truffes_id_seq OWNED BY public.commandes_achat_truffes.id;

-- Table: lignes_commande_achat
CREATE SEQUENCE public.lignes_commande_achat_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.lignes_commande_achat (
    id integer NOT NULL,
    commande_id integer NOT NULL,
    calibre_mm integer NOT NULL,
    qualite public.qualite_truffe NOT NULL,
    maturite public.maturite_truffe NOT NULL,
    quantite_kg numeric(10,2) NOT NULL,
    prix_achat_kg numeric(10,2) NOT NULL,
    montant_ligne numeric(12,2) GENERATED ALWAYS AS ((quantite_kg * prix_achat_kg)) STORED,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.lignes_commande_achat_id_seq OWNED BY public.lignes_commande_achat.id;

-- Table: factures_achat_truffes
CREATE SEQUENCE public.factures_achat_truffes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.factures_achat_truffes (
    id integer NOT NULL,
    commande_id integer NOT NULL,
    fournisseur_id integer NOT NULL,
    numero_facture character varying(50) NOT NULL,
    date_facture date DEFAULT CURRENT_DATE NOT NULL,
    date_echeance date,
    montant_ht numeric(12,2) NOT NULL,
    taux_tva numeric(5,2) DEFAULT 20.00,
    montant_tva numeric(12,2),
    montant_ttc numeric(12,2),
    statut_paiement public.statut_paiement_achat DEFAULT 'En attente'::public.statut_paiement_achat,
    date_paiement date,
    mode_paiement character varying(50),
    reference_paiement character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.factures_achat_truffes_id_seq OWNED BY public.factures_achat_truffes.id;

-- Table: reception_achats
CREATE SEQUENCE public.reception_achats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.reception_achats (
    id integer NOT NULL,
    commande_id integer NOT NULL,
    date_reception date DEFAULT CURRENT_DATE NOT NULL,
    "quantite_reçue_kg" numeric(10,2) NOT NULL,
    controle_qualite public.statut_reception_achat DEFAULT 'Acceptée'::public.statut_reception_achat,
    observations text,
    responsable_reception character varying(150),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.reception_achats_id_seq OWNED BY public.reception_achats.id;

-- Table: stocks_truffes_achetees
CREATE SEQUENCE public.stocks_truffes_achetees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.stocks_truffes_achetees (
    id integer NOT NULL,
    ligne_commande_id integer NOT NULL,
    calibre_mm integer NOT NULL,
    qualite public.qualite_truffe NOT NULL,
    maturite public.maturite_truffe NOT NULL,
    quantite_kg_stock numeric(10,2) NOT NULL,
    conservation public.conservation_type DEFAULT 'Frais'::public.conservation_type,
    localisation_storage character varying(100),
    date_achat date NOT NULL,
    date_limite_consommation date,
    prix_achat_kg numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.stocks_truffes_achetees_id_seq OWNED BY public.stocks_truffes_achetees.id;

-- Table: evaluations_fournisseurs_truffes
CREATE SEQUENCE public.evaluations_fournisseurs_truffes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.evaluations_fournisseurs_truffes (
    id integer NOT NULL,
    fournisseur_id integer NOT NULL,
    date_evaluation date DEFAULT CURRENT_DATE NOT NULL,
    note_qualite integer,
    note_delai integer,
    note_prix integer,
    note_service integer,
    note_globale numeric(3,2) GENERATED ALWAYS AS (round((((((note_qualite + note_delai) + note_prix) + note_service))::numeric / 4.0), 2)) STORED,
    commentaires text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT evaluations_fournisseurs_truffes_note_delai_check CHECK (((note_delai >= 1) AND (note_delai <= 5))),
    CONSTRAINT evaluations_fournisseurs_truffes_note_prix_check CHECK (((note_prix >= 1) AND (note_prix <= 5))),
    CONSTRAINT evaluations_fournisseurs_truffes_note_qualite_check CHECK (((note_qualite >= 1) AND (note_qualite <= 5))),
    CONSTRAINT evaluations_fournisseurs_truffes_note_service_check CHECK (((note_service >= 1) AND (note_service <= 5)))
);

ALTER SEQUENCE public.evaluations_fournisseurs_truffes_id_seq OWNED BY public.evaluations_fournisseurs_truffes.id;

-- Table: analyse_marge_truffes
CREATE SEQUENCE public.analyse_marge_truffes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.analyse_marge_truffes (
    id integer NOT NULL,
    stock_achat_id integer NOT NULL,
    commande_vente_id integer,
    calibre_mm integer NOT NULL,
    qualite public.qualite_truffe NOT NULL,
    maturite public.maturite_truffe NOT NULL,
    prix_achat_kg numeric(10,2) NOT NULL,
    prix_vente_kg numeric(10,2),
    quantite_kg numeric(10,2),
    marge_kg numeric(10,2) GENERATED ALWAYS AS (
CASE
    WHEN (prix_vente_kg IS NOT NULL) THEN (prix_vente_kg - prix_achat_kg)
    ELSE NULL::numeric
END) STORED,
    pourcentage_marge numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN ((prix_vente_kg IS NOT NULL) AND (prix_vente_kg > (0)::numeric)) THEN round((((prix_vente_kg - prix_achat_kg) / prix_vente_kg) * (100)::numeric), 2)
    ELSE NULL::numeric
END) STORED,
    date_achat date NOT NULL,
    date_vente date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.analyse_marge_truffes_id_seq OWNED BY public.analyse_marge_truffes.id;

--
-- Contraintes de clés primaires
--


--
-- Contraintes de clés étrangères
--


--
-- Index
--

CREATE INDEX idx_amendement_intervention ON public.amendement_details USING btree (intervention_id);
CREATE INDEX idx_analyse_marge_calibre ON public.analyse_marge_truffes USING btree (calibre_mm);
CREATE INDEX idx_analyse_marge_date_achat ON public.analyse_marge_truffes USING btree (date_achat);
CREATE INDEX idx_analyse_sol_intervention ON public.analyse_sol_details USING btree (intervention_id);
CREATE INDEX idx_arbres_deleted_at ON public.arbres USING btree (deleted_at);
CREATE INDEX idx_arbres_parcelle ON public.arbres USING btree (parcelle_id);
CREATE INDEX idx_commandes_achat_date ON public.commandes_achat_truffes USING btree (date_commande);
CREATE INDEX idx_commandes_achat_fournisseur ON public.commandes_achat_truffes USING btree (fournisseur_id);
CREATE INDEX idx_commandes_achat_statut ON public.commandes_achat_truffes USING btree (statut);
CREATE INDEX idx_commandes_client ON public.commandes USING btree (client_id);
CREATE INDEX idx_commandes_date ON public.commandes USING btree (date_commande);
CREATE INDEX idx_commandes_statut ON public.commandes USING btree (statut);
CREATE INDEX idx_contacts_fournisseurs_truffes_id ON public.contacts_fournisseurs_truffes USING btree (fournisseur_id);
CREATE INDEX idx_evaluations_fournisseurs_truffes_fournisseur ON public.evaluations_fournisseurs_truffes USING btree (fournisseur_id);
CREATE INDEX idx_factures_achat_date ON public.factures_achat_truffes USING btree (date_facture);
CREATE INDEX idx_factures_achat_fournisseur ON public.factures_achat_truffes USING btree (fournisseur_id);
CREATE INDEX idx_factures_achat_statut ON public.factures_achat_truffes USING btree (statut_paiement);
CREATE INDEX idx_fournisseurs_truffes_statut ON public.fournisseurs_truffes USING btree (statut);
CREATE INDEX idx_fournisseurs_truffes_zone ON public.fournisseurs_truffes USING btree (zone_production);
CREATE INDEX idx_historique_table_record ON public.historique USING btree (table_name, record_id);
CREATE INDEX idx_inoculation_intervention ON public.inoculation_details USING btree (intervention_id);
CREATE INDEX idx_intervention_details_intervention_id ON public.intervention_details USING btree (intervention_id);
CREATE INDEX idx_interventions_arbre ON public.interventions USING btree (arbre_id);
CREATE INDEX idx_interventions_date ON public.interventions USING btree (date_prevue);
CREATE INDEX idx_interventions_parcelle ON public.interventions USING btree (parcelle_id);
CREATE INDEX idx_irrigation_intervention ON public.irrigation_details USING btree (intervention_id);
CREATE INDEX idx_lignes_calibre_qualite ON public.lignes_commande_achat USING btree (calibre_mm, qualite);
CREATE INDEX idx_lignes_commande_achat ON public.lignes_commande_achat USING btree (commande_id);
CREATE INDEX idx_login_attempts_attempted_at ON public.login_attempts USING btree (attempted_at);
CREATE INDEX idx_login_attempts_email ON public.login_attempts USING btree (email);
CREATE INDEX idx_login_attempts_ip ON public.login_attempts USING btree (ip_address);
CREATE INDEX idx_observation_intervention ON public.observation_details USING btree (intervention_id);
CREATE INDEX idx_paillage_intervention ON public.paillage_details USING btree (intervention_id);
CREATE INDEX idx_password_reset_token_hash ON public.password_reset_tokens USING btree (token_hash);
CREATE INDEX idx_password_reset_user_id ON public.password_reset_tokens USING btree (user_id);
CREATE INDEX idx_piegeage_intervention ON public.piegeage_details USING btree (intervention_id);
CREATE INDEX idx_plantation_intervention ON public.plantation_details USING btree (intervention_id);
CREATE INDEX idx_reception_achats_commande ON public.reception_achats USING btree (commande_id);
CREATE INDEX idx_reception_achats_date ON public.reception_achats USING btree (date_reception);
CREATE INDEX idx_recoltes_arbre ON public.recoltes USING btree (arbre_id);
CREATE INDEX idx_recoltes_date ON public.recoltes USING btree (date_recolte);
CREATE INDEX idx_recoltes_exposition ON public.recoltes USING btree (exposition);
CREATE INDEX idx_recoltes_parcelle ON public.recoltes USING btree (parcelle_id);
CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);
CREATE INDEX idx_refresh_tokens_parent ON public.refresh_tokens USING btree (parent_token_id);
CREATE INDEX idx_refresh_tokens_revoked ON public.refresh_tokens USING btree (revoked) WHERE (revoked = false);
CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);
CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);
CREATE INDEX idx_stocks_achetees_calibre ON public.stocks_truffes_achetees USING btree (calibre_mm);
CREATE INDEX idx_stocks_achetees_limite_consommation ON public.stocks_truffes_achetees USING btree (date_limite_consommation);
CREATE INDEX idx_stocks_achetees_localisation ON public.stocks_truffes_achetees USING btree (localisation_storage);
CREATE INDEX idx_stocks_achetees_qualite ON public.stocks_truffes_achetees USING btree (qualite);
CREATE INDEX idx_taille_intervention ON public.taille_details USING btree (intervention_id);
CREATE INDEX idx_traitement_intervention ON public.traitement_phyto_details USING btree (intervention_id);
CREATE INDEX idx_traitement_produit ON public.traitement_phyto_details USING btree (nom_commercial);
CREATE INDEX idx_travail_sol_intervention ON public.travail_sol_details USING btree (intervention_id);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);
CREATE INDEX idx_user_sessions_session_id ON public.user_sessions USING btree (session_id);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);
CREATE INDEX idx_users_role ON public.users USING btree (role);
CREATE INDEX idx_ventes_client ON public.ventes USING btree (client_id);
CREATE INDEX idx_ventes_commande_id ON public.ventes USING btree (commande_id);
CREATE INDEX idx_ventes_date ON public.ventes USING btree (date_vente);

--
-- Triggers
--

CREATE TRIGGER amendements_ref_historique AFTER INSERT OR DELETE OR UPDATE ON public.amendements_ref FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER amendements_ref_historique ON amendements_ref; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER amendements_ref_historique ON public.amendements_ref IS 'Audit trail pour les modifications sur les références d''amendements';

CREATE TRIGGER caveurs_historique AFTER INSERT OR DELETE OR UPDATE ON public.caveurs FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER caveurs_historique ON caveurs; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER caveurs_historique ON public.caveurs IS 'Audit trail pour les modifications sur les caveurs';

CREATE TRIGGER chiens_historique AFTER INSERT OR DELETE OR UPDATE ON public.chiens FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER chiens_historique ON chiens; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER chiens_historique ON public.chiens IS 'Audit trail pour les modifications sur les chiens truffiers';

CREATE TRIGGER clients_historique AFTER INSERT OR DELETE OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER clients_historique ON clients; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER clients_historique ON public.clients IS 'Audit trail pour les modifications sur les clients';

CREATE TRIGGER intervention_details_historique AFTER INSERT OR DELETE OR UPDATE ON public.intervention_details FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER intervention_details_historique ON intervention_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER intervention_details_historique ON public.intervention_details IS 'Audit trail pour les modifications sur les détails d''interventions';

CREATE TRIGGER parametres_historique AFTER INSERT OR DELETE OR UPDATE ON public.parametres FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER parametres_historique ON parametres; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER parametres_historique ON public.parametres IS 'Audit trail pour les modifications sur les paramètres système';

CREATE TRIGGER parcelles_historique AFTER INSERT OR DELETE OR UPDATE ON public.parcelles FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER parcelles_historique ON parcelles; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER parcelles_historique ON public.parcelles IS 'Audit trail pour les modifications sur les parcelles';

CREATE TRIGGER produits_phyto_historique AFTER INSERT OR DELETE OR UPDATE ON public.produits_phyto FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER produits_phyto_historique ON produits_phyto; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER produits_phyto_historique ON public.produits_phyto IS 'Audit trail pour les modifications sur les produits phytosanitaires';

CREATE TRIGGER types_intervention_historique AFTER INSERT OR DELETE OR UPDATE ON public.types_intervention FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER types_intervention_historique ON types_intervention; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER types_intervention_historique ON public.types_intervention IS 'Audit trail pour les modifications sur les types d''intervention';

CREATE TRIGGER ventes_historique AFTER INSERT OR DELETE OR UPDATE ON public.ventes FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: amendement_details amendement_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.amendement_details
    ADD CONSTRAINT amendement_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;

--
-- Données minimales obligatoires
--

-- Utilisateur administrateur par défaut
-- Email: admin@truffiere.local
-- Mot de passe: Admin123! (à changer immédiatement après la première connexion)
-- Hash bcrypt du mot de passe Admin123!

INSERT INTO public.users (id, email, password_hash, nom, prenom, role, is_active, email_verified, created_at, updated_at)
VALUES (
    1,
    'admin@truffiere.local',
    '$2b$10$rKZLvVxZxqxGx5F5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
    'Administrateur',
    'Système',
    'admin',
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Redémarrer la séquence users_id_seq
SELECT setval('public.users_id_seq', 1, true);

-- Types d'interventions de base

INSERT INTO public.types_intervention (id, nom, categorie, description, actif, created_at) VALUES
(1, 'Irrigation', 'Entretien', 'Arrosage des arbres truffiers', true, CURRENT_TIMESTAMP),
(2, 'Taille', 'Entretien', 'Taille des arbres', true, CURRENT_TIMESTAMP),
(3, 'Amendement', 'Sol', 'Apport d''amendements au sol', true, CURRENT_TIMESTAMP),
(4, 'Traitement phytosanitaire', 'Protection', 'Application de produits phytosanitaires', true, CURRENT_TIMESTAMP),
(5, 'Travail du sol', 'Sol', 'Travail mécanique du sol', true, CURRENT_TIMESTAMP),
(6, 'Observation', 'Monitoring', 'Observation de l''état des arbres et du brûlé', true, CURRENT_TIMESTAMP),
(7, 'Paillage', 'Entretien', 'Mise en place de paillage', true, CURRENT_TIMESTAMP),
(8, 'Plantation', 'Implantation', 'Plantation de nouveaux arbres', true, CURRENT_TIMESTAMP),
(9, 'Analyse de sol', 'Sol', 'Prélèvement et analyse du sol', true, CURRENT_TIMESTAMP),
(10, 'Piégeage', 'Protection', 'Mise en place de pièges', true, CURRENT_TIMESTAMP),
(11, 'Inoculation', 'Implantation', 'Inoculation mycorhizienne', true, CURRENT_TIMESTAMP);

-- Redémarrer la séquence types_intervention_id_seq
SELECT setval('public.types_intervention_id_seq', 11, true);

-- Amendements de référence (optionnel)

INSERT INTO public.amendements_ref (id, nom, type_amendement, composition, dose_recommandee_ha, utilisable_bio, effet_principal, actif, created_at) VALUES
(1, 'Fumier de cheval composté', 'Organique', 'Matière organique riche', '10-20 tonnes/ha', true, 'Amélioration structure et fertilité du sol', true, CURRENT_TIMESTAMP),
(2, 'Compost végétal', 'Organique', 'Matière organique végétale', '15-25 tonnes/ha', true, 'Apport de matière organique', true, CURRENT_TIMESTAMP),
(3, 'Chaux agricole', 'Minéral', 'Carbonate de calcium (CaCO3)', '1-3 tonnes/ha', true, 'Correction du pH acide', true, CURRENT_TIMESTAMP),
(4, 'Dolomie', 'Minéral', 'Carbonate de calcium et magnésium', '1-2 tonnes/ha', true, 'Correction pH et apport Mg', true, CURRENT_TIMESTAMP);

-- Redémarrer la séquence amendements_ref_id_seq
SELECT setval('public.amendements_ref_id_seq', 4, true);

--
-- Fin du fichier d'initialisation
--