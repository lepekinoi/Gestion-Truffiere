--
-- Base de données Gestion Truffière - Fichier d'initialisation complet
-- Généré le 27 janvier 2026
-- Fichier minimal pour Docker - nouveau projet
-- Contient TOUS les éléments système obligatoires (types, énums, fonctions, tables)
-- AVEC compte administrateur
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
-- Fonctions PostgreSQL
--

CREATE FUNCTION public.check_account_lock(p_email character varying) RETURNS TABLE(is_locked boolean, locked_until timestamp without time zone, attempts integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_user RECORD;
    v_recent_failures INTEGER;
BEGIN
    SELECT u.locked_until, u.failed_login_attempts
    INTO v_user
    FROM public.users u
    WHERE u.email = p_email;

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
    DELETE FROM public.refresh_tokens
    WHERE expires_at < NOW() - INTERVAL '30 days';

    DELETE FROM public.password_reset_tokens
    WHERE expires_at < NOW() - INTERVAL '7 days';

    DELETE FROM public.user_sessions
    WHERE expires_at < NOW() - INTERVAL '7 days';

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
    UPDATE public.users
    SET failed_login_attempts = failed_login_attempts + 1
    WHERE email = p_email
    RETURNING failed_login_attempts INTO v_failures;

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
    UPDATE refresh_tokens
    SET revoked = TRUE,
        revoked_at = NOW(),
        revoked_reason = p_reason
    WHERE id = p_token_id
      AND revoked = FALSE;

    GET DIAGNOSTICS v_revoked_count = ROW_COUNT;

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
-- Tables système
--

CREATE SEQUENCE public.users_id_seq AS integer START WITH 1 INCREMENT BY 1;

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
    CONSTRAINT users_role_check CHECK ((role)::text = ANY (ARRAY[('admin'::character varying)::text, ('user'::character varying)::text, ('readonly'::character varying)::text]))
);

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

CREATE SEQUENCE public.parametres_id_seq AS integer START WITH 1 INCREMENT BY 1;

CREATE TABLE public.parametres (
    id integer NOT NULL,
    cle character varying(100) NOT NULL,
    valeur jsonb NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.parametres_id_seq OWNED BY public.parametres.id;

CREATE SEQUENCE public.preferences_utilisateur_id_seq AS integer START WITH 1 INCREMENT BY 1;

CREATE TABLE public.preferences_utilisateur (
    id integer NOT NULL,
    user_id character varying(100) DEFAULT 'default'::character varying,
    colonnes_affichees jsonb DEFAULT '{}'::jsonb,
    colonnes_export jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.preferences_utilisateur_id_seq OWNED BY public.preferences_utilisateur.id;

CREATE SEQUENCE public.refresh_tokens_id_seq AS integer START WITH 1 INCREMENT BY 1;

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
    CONSTRAINT rotation_count_limit CHECK (rotation_count <= 10),
    CONSTRAINT rotation_count_positive CHECK (rotation_count >= 0)
);

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;

CREATE SEQUENCE public.password_reset_tokens_id_seq AS integer START WITH 1 INCREMENT BY 1;

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

CREATE SEQUENCE public.user_sessions_id_seq AS integer START WITH 1 INCREMENT BY 1;

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

CREATE SEQUENCE public.login_attempts_id_seq AS integer START WITH 1 INCREMENT BY 1;

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

CREATE SEQUENCE public.historique_id_seq AS integer START WITH 1 INCREMENT BY 1;

CREATE TABLE public.historique (
    id integer NOT NULL,
    table_name character varying(50) NOT NULL,
    record_id integer NOT NULL,
    action character varying(20) NOT NULL,
    old_data jsonb,
    new_data jsonb,
    user_name character varying(100),
    timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.historique_id_seq OWNED BY public.historique.id;

CREATE SEQUENCE public.types_intervention_id_seq AS integer START WITH 1 INCREMENT BY 1;

CREATE TABLE public.types_intervention (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    description text,
    couleur character varying(7)
);

ALTER SEQUENCE public.types_intervention_id_seq OWNED BY public.types_intervention.id;

CREATE SEQUENCE public.amendements_ref_id_seq AS integer START WITH 1 INCREMENT BY 1;

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

CREATE SEQUENCE public.produits_phyto_id_seq AS integer START WITH 1 INCREMENT BY 1;

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

--
-- Tables métier - Structure vide sans données
--

CREATE SEQUENCE public.parcelles_id_seq AS integer START WITH 1 INCREMENT BY 1;

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

CREATE SEQUENCE public.arbres_id_seq AS integer START WITH 1 INCREMENT BY 1;

CREATE TABLE public.arbres (
    id integer NOT NULL,
    parcelle_id integer,
    numero character varying(50) NOT NULL,
    espece character varying(100) NOT NULL,
    variete_truffe character varying(100),
    date_plantation date NOT NULL,
    position public.geometry(Point,4326),
    etat_sanitaire character varying(50) DEFAULT 'Bon'::character varying,
    circonference_cm numeric(5,1),
    hauteur_m numeric(4,1),
    date_derniere_taille date,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    latitude numeric(10,8),
    longitude numeric(11,8),
    deleted_at timestamp without time zone,
    porte_greffe character varying(100),
    rendement_estime numeric(10,2)
);

ALTER SEQUENCE public.arbres_id_seq OWNED BY public.arbres.id;

CREATE SEQUENCE public.caveurs_id_seq AS integer START WITH 1 INCREMENT BY 1;

CREATE TABLE public.caveurs (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.caveurs_id_seq OWNED BY public.caveurs.id;

CREATE SEQUENCE public.chiens_id_seq AS integer START WITH 1 INCREMENT BY 1;

CREATE TABLE public.chiens (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    race character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.chiens_id_seq OWNED BY public.chiens.id;

CREATE SEQUENCE public.clients_id_seq AS integer START WITH 1 INCREMENT BY 1;

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
    date_premiere_achat date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;

CREATE SEQUENCE public.fournisseurs_truffes_id_seq AS integer START WITH 1 INCREMENT BY 1;

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

CREATE SEQUENCE public.interventions_id_seq AS integer START WITH 1 INCREMENT BY 1;

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
    statut character varying(20) DEFAULT 'Planifiée'::character varying,
    meteo character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.interventions_id_seq OWNED BY public.interventions.id;

CREATE SEQUENCE public.intervention_details_id_seq AS integer START WITH 1 INCREMENT BY 1;

CREATE TABLE public.intervention_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    volume_eau_m3 numeric(10,2),
    volume_eau_par_arbre_l numeric(10,2),
    methode_irrigation character varying(50),
    source_eau character varying(50),
    debit_lh numeric(10,2),
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
    volume_bouille_l numeric(10,2),
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
    enherbage_avant character varying(30),
    enherbage_apres character varying(30),
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

CREATE SEQUENCE public.recoltes_id_seq AS integer START WITH 1 INCREMENT BY 1;

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

CREATE SEQUENCE public.commandes_id_seq AS integer START WITH 1 INCREMENT BY 1;

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

CREATE SEQUENCE public.ventes_id_seq AS integer START WITH 1 INCREMENT BY 1;

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

CREATE SEQUENCE public.commandes_achat_truffes_id_seq AS integer START WITH 1 INCREMENT BY 1;

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

CREATE SEQUENCE public.lignes_commande_achat_id_seq AS integer START WITH 1 INCREMENT BY 1;

CREATE TABLE public.lignes_commande_achat (
    id integer NOT NULL,
    commande_id integer NOT NULL,
    calibre_mm integer NOT NULL,
    qualite public.qualite_truffe NOT NULL,
    maturite public.maturite_truffe NOT NULL,
    quantite_kg numeric(10,2) NOT NULL,
    prix_achat_kg numeric(10,2) NOT NULL,
    montant_ligne numeric(12,2) GENERATED ALWAYS AS (quantite_kg * prix_achat_kg) STORED,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER SEQUENCE public.lignes_commande_achat_id_seq OWNED BY public.lignes_commande_achat.id;

CREATE SEQUENCE public.stocks_truffes_achetees_id_seq AS integer START WITH 1 INCREMENT BY 1;

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

--
-- Définir les valeurs par défaut
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.parametres ALTER COLUMN id SET DEFAULT nextval('public.parametres_id_seq'::regclass);
ALTER TABLE ONLY public.preferences_utilisateur ALTER COLUMN id SET DEFAULT nextval('public.preferences_utilisateur_id_seq'::regclass);
ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);
ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);
ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);
ALTER TABLE ONLY public.login_attempts ALTER COLUMN id SET DEFAULT nextval('public.login_attempts_id_seq'::regclass);
ALTER TABLE ONLY public.historique ALTER COLUMN id SET DEFAULT nextval('public.historique_id_seq'::regclass);
ALTER TABLE ONLY public.types_intervention ALTER COLUMN id SET DEFAULT nextval('public.types_intervention_id_seq'::regclass);
ALTER TABLE ONLY public.amendements_ref ALTER COLUMN id SET DEFAULT nextval('public.amendements_ref_id_seq'::regclass);
ALTER TABLE ONLY public.produits_phyto ALTER COLUMN id SET DEFAULT nextval('public.produits_phyto_id_seq'::regclass);
ALTER TABLE ONLY public.parcelles ALTER COLUMN id SET DEFAULT nextval('public.parcelles_id_seq'::regclass);
ALTER TABLE ONLY public.arbres ALTER COLUMN id SET DEFAULT nextval('public.arbres_id_seq'::regclass);
ALTER TABLE ONLY public.caveurs ALTER COLUMN id SET DEFAULT nextval('public.caveurs_id_seq'::regclass);
ALTER TABLE ONLY public.chiens ALTER COLUMN id SET DEFAULT nextval('public.chiens_id_seq'::regclass);
ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);
ALTER TABLE ONLY public.fournisseurs_truffes ALTER COLUMN id SET DEFAULT nextval('public.fournisseurs_truffes_id_seq'::regclass);
ALTER TABLE ONLY public.interventions ALTER COLUMN id SET DEFAULT nextval('public.interventions_id_seq'::regclass);
ALTER TABLE ONLY public.intervention_details ALTER COLUMN id SET DEFAULT nextval('public.intervention_details_id_seq'::regclass);
ALTER TABLE ONLY public.recoltes ALTER COLUMN id SET DEFAULT nextval('public.recoltes_id_seq'::regclass);
ALTER TABLE ONLY public.commandes ALTER COLUMN id SET DEFAULT nextval('public.commandes_id_seq'::regclass);
ALTER TABLE ONLY public.ventes ALTER COLUMN id SET DEFAULT nextval('public.ventes_id_seq'::regclass);
ALTER TABLE ONLY public.commandes_achat_truffes ALTER COLUMN id SET DEFAULT nextval('public.commandes_achat_truffes_id_seq'::regclass);
ALTER TABLE ONLY public.lignes_commande_achat ALTER COLUMN id SET DEFAULT nextval('public.lignes_commande_achat_id_seq'::regclass);
ALTER TABLE ONLY public.stocks_truffes_achetees ALTER COLUMN id SET DEFAULT nextval('public.stocks_truffes_achetees_id_seq'::regclass);

--
-- Contraintes de clés primaires
--

ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.parametres ADD CONSTRAINT parametres_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.parametres ADD CONSTRAINT parametres_cle_key UNIQUE (cle);
ALTER TABLE ONLY public.preferences_utilisateur ADD CONSTRAINT preferences_utilisateur_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.preferences_utilisateur ADD CONSTRAINT preferences_utilisateur_user_id_key UNIQUE (user_id);
ALTER TABLE ONLY public.refresh_tokens ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_sessions ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_sessions ADD CONSTRAINT user_sessions_session_id_key UNIQUE (session_id);
ALTER TABLE ONLY public.login_attempts ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.historique ADD CONSTRAINT historique_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.types_intervention ADD CONSTRAINT types_intervention_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.types_intervention ADD CONSTRAINT types_intervention_nom_key UNIQUE (nom);
ALTER TABLE ONLY public.amendements_ref ADD CONSTRAINT amendements_ref_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.produits_phyto ADD CONSTRAINT produits_phyto_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.parcelles ADD CONSTRAINT parcelles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.arbres ADD CONSTRAINT arbres_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.caveurs ADD CONSTRAINT caveurs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.chiens ADD CONSTRAINT chiens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.fournisseurs_truffes ADD CONSTRAINT fournisseurs_truffes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.interventions ADD CONSTRAINT interventions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.intervention_details ADD CONSTRAINT intervention_details_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.recoltes ADD CONSTRAINT recoltes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.commandes ADD CONSTRAINT commandes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.ventes ADD CONSTRAINT ventes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.commandes_achat_truffes ADD CONSTRAINT commandes_achat_truffes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.lignes_commande_achat ADD CONSTRAINT lignes_commande_achat_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.stocks_truffes_achetees ADD CONSTRAINT stocks_truffes_achetees_pkey PRIMARY KEY (id);

--
-- Contraintes de clés étrangères
--

ALTER TABLE ONLY public.refresh_tokens ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.arbres ADD CONSTRAINT arbres_parcelle_id_fkey FOREIGN KEY (parcelle_id) REFERENCES public.parcelles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.interventions ADD CONSTRAINT interventions_type_intervention_id_fkey FOREIGN KEY (type_intervention_id) REFERENCES public.types_intervention(id);
ALTER TABLE ONLY public.interventions ADD CONSTRAINT interventions_parcelle_id_fkey FOREIGN KEY (parcelle_id) REFERENCES public.parcelles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.interventions ADD CONSTRAINT interventions_arbre_id_fkey FOREIGN KEY (arbre_id) REFERENCES public.arbres(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.intervention_details ADD CONSTRAINT intervention_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.recoltes ADD CONSTRAINT recoltes_parcelle_id_fkey FOREIGN KEY (parcelle_id) REFERENCES public.parcelles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.recoltes ADD CONSTRAINT recoltes_arbre_id_fkey FOREIGN KEY (arbre_id) REFERENCES public.arbres(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.commandes ADD CONSTRAINT commandes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.ventes ADD CONSTRAINT ventes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.ventes ADD CONSTRAINT ventes_recolte_id_fkey FOREIGN KEY (recolte_id) REFERENCES public.recoltes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.ventes ADD CONSTRAINT ventes_commande_id_fkey FOREIGN KEY (commande_id) REFERENCES public.commandes(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.commandes_achat_truffes ADD CONSTRAINT commandes_achat_truffes_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs_truffes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lignes_commande_achat ADD CONSTRAINT lignes_commande_achat_commande_id_fkey FOREIGN KEY (commande_id) REFERENCES public.commandes_achat_truffes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.stocks_truffes_achetees ADD CONSTRAINT stocks_truffes_achetees_ligne_commande_id_fkey FOREIGN KEY (ligne_commande_id) REFERENCES public.lignes_commande_achat(id) ON DELETE CASCADE;

--
-- Index (système)
--

CREATE INDEX idx_login_attempts_email ON public.login_attempts USING btree (email);
CREATE INDEX idx_login_attempts_ip ON public.login_attempts USING btree (ip_address);
CREATE INDEX idx_login_attempts_attempted_at ON public.login_attempts USING btree (attempted_at);
CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);
CREATE INDEX idx_refresh_tokens_revoked ON public.refresh_tokens USING btree (revoked) WHERE revoked = false;
CREATE INDEX idx_refresh_tokens_parent ON public.refresh_tokens USING btree (parent_token_id);
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON public.password_reset_tokens USING btree (token_hash);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);
CREATE INDEX idx_user_sessions_session_id ON public.user_sessions USING btree (session_id);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);
CREATE INDEX idx_users_role ON public.users USING btree (role);
CREATE INDEX idx_historique_table_record ON public.historique USING btree (table_name, record_id);

--
-- Index (métier)
--

CREATE INDEX idx_arbres_parcelle ON public.arbres USING btree (parcelle_id);
CREATE INDEX idx_arbres_deleted_at ON public.arbres USING btree (deleted_at);
CREATE INDEX idx_interventions_parcelle ON public.interventions USING btree (parcelle_id);
CREATE INDEX idx_interventions_arbre ON public.interventions USING btree (arbre_id);
CREATE INDEX idx_interventions_date ON public.interventions USING btree (date_prevue);
CREATE INDEX idx_interventions_type ON public.interventions USING btree (type_intervention_id);
CREATE INDEX idx_intervention_details_intervention_id ON public.intervention_details USING btree (intervention_id);
CREATE INDEX idx_recoltes_parcelle ON public.recoltes USING btree (parcelle_id);
CREATE INDEX idx_recoltes_arbre ON public.recoltes USING btree (arbre_id);
CREATE INDEX idx_recoltes_date ON public.recoltes USING btree (date_recolte);
CREATE INDEX idx_recoltes_exposition ON public.recoltes USING btree (exposition);
CREATE INDEX idx_commandes_client ON public.commandes USING btree (client_id);
CREATE INDEX idx_commandes_date ON public.commandes USING btree (date_commande);
CREATE INDEX idx_commandes_statut ON public.commandes USING btree (statut);
CREATE INDEX idx_ventes_client ON public.ventes USING btree (client_id);
CREATE INDEX idx_ventes_date ON public.ventes USING btree (date_vente);
CREATE INDEX idx_ventes_commande_id ON public.ventes USING btree (commande_id);
CREATE INDEX idx_commandes_achat_fournisseur ON public.commandes_achat_truffes USING btree (fournisseur_id);
CREATE INDEX idx_commandes_achat_date ON public.commandes_achat_truffes USING btree (date_commande);
CREATE INDEX idx_commandes_achat_statut ON public.commandes_achat_truffes USING btree (statut);
CREATE INDEX idx_lignes_commande_achat ON public.lignes_commande_achat USING btree (commande_id);
CREATE INDEX idx_stocks_achetees_calibre ON public.stocks_truffes_achetees USING btree (calibre_mm);
CREATE INDEX idx_stocks_achetees_qualite ON public.stocks_truffes_achetees USING btree (qualite);
CREATE INDEX idx_stocks_achetees_limite_consommation ON public.stocks_truffes_achetees USING btree (date_limite_consommation);
CREATE INDEX idx_stocks_achetees_localisation ON public.stocks_truffes_achetees USING btree (localisation_storage);

--
-- Triggers (système et métier)
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER types_intervention_historique AFTER INSERT OR DELETE OR UPDATE ON public.types_intervention FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER amendements_ref_historique AFTER INSERT OR DELETE OR UPDATE ON public.amendements_ref FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER produits_phyto_historique AFTER INSERT OR DELETE OR UPDATE ON public.produits_phyto FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER parametres_historique AFTER INSERT OR DELETE OR UPDATE ON public.parametres FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER parcelles_historique AFTER INSERT OR DELETE OR UPDATE ON public.parcelles FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER arbres_historique AFTER INSERT OR DELETE OR UPDATE ON public.arbres FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER caveurs_historique AFTER INSERT OR DELETE OR UPDATE ON public.caveurs FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER chiens_historique AFTER INSERT OR DELETE OR UPDATE ON public.chiens FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER clients_historique AFTER INSERT OR DELETE OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER fournisseurs_truffes_historique AFTER INSERT OR DELETE OR UPDATE ON public.fournisseurs_truffes FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER interventions_historique AFTER INSERT OR DELETE OR UPDATE ON public.interventions FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER intervention_details_historique AFTER INSERT OR DELETE OR UPDATE ON public.intervention_details FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER recoltes_historique AFTER INSERT OR DELETE OR UPDATE ON public.recoltes FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER commandes_historique AFTER INSERT OR DELETE OR UPDATE ON public.commandes FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER ventes_historique AFTER INSERT OR DELETE OR UPDATE ON public.ventes FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER commandes_achat_truffes_historique AFTER INSERT OR DELETE OR UPDATE ON public.commandes_achat_truffes FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER lignes_commande_achat_historique AFTER INSERT OR DELETE OR UPDATE ON public.lignes_commande_achat FOR EACH ROW EXECUTE FUNCTION public.log_historique();
CREATE TRIGGER stocks_truffes_achetees_historique AFTER INSERT OR DELETE OR UPDATE ON public.stocks_truffes_achetees FOR EACH ROW EXECUTE FUNCTION public.log_historique();

--
-- Données minimales obligatoires pour le fonctionnement
--

-- Utilisateur administrateur par défaut
-- Email: admin@truffiere.local
-- Mot de passe: admin123 (À changer immédiatement après la première connexion)
INSERT INTO public.users (id, email, password_hash, nom, prenom, role, is_active, email_verified, created_at, updated_at) VALUES
(1, 'admin@truffiere.local', '$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu', 'Administrateur', 'Système', 'admin', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

SELECT pg_catalog.setval('public.users_id_seq', 1, true);

--
-- Types d'interventions obligatoires
--

INSERT INTO public.types_intervention (id, nom, description, couleur) VALUES
(1, 'Irrigation', 'Arrosage des arbres truffiers', '#3498db'),
(2, 'Taille', 'Taille des arbres', '#2ecc71'),
(3, 'Amendement', 'Apport d''amendements au sol', '#f39c12'),
(4, 'Traitement phytosanitaire', 'Application de produits phytosanitaires', '#e74c3c'),
(5, 'Travail du sol', 'Travail mécanique du sol', '#95a5a6'),
(6, 'Observation', 'Observation de l''état des arbres et du brûlé', '#9b59b6'),
(7, 'Paillage', 'Mise en place de paillage', '#1abc9c'),
(8, 'Plantation', 'Plantation de nouveaux arbres', '#34495e'),
(9, 'Analyse de sol', 'Prélèvement et analyse du sol', '#d35400'),
(10, 'Piégeage', 'Mise en place de pièges', '#c0392b'),
(11, 'Inoculation', 'Inoculation mycorhizienne', '#16a085');

SELECT pg_catalog.setval('public.types_intervention_id_seq', 11, true);

--
-- Amendements de référence (optionnel mais recommandé)
--

INSERT INTO public.amendements_ref (id, nom, type_amendement, composition, dose_recommandee_ha, utilisable_bio, effet_principal, actif, created_at) VALUES
(1, 'Fumier de cheval composté', 'Organique', 'Matière organique riche', '10-20 tonnes/ha', true, 'Amélioration structure et fertilité du sol', true, CURRENT_TIMESTAMP),
(2, 'Compost végétal', 'Organique', 'Matière organique végétale', '15-25 tonnes/ha', true, 'Apport de matière organique', true, CURRENT_TIMESTAMP),
(3, 'Chaux agricole', 'Minéral', 'Carbonate de calcium (CaCO3)', '1-3 tonnes/ha', true, 'Correction du pH acide', true, CURRENT_TIMESTAMP),
(4, 'Dolomie', 'Minéral', 'Carbonate de calcium et magnésium', '1-2 tonnes/ha', true, 'Correction pH et apport Mg', true, CURRENT_TIMESTAMP);

SELECT pg_catalog.setval('public.amendements_ref_id_seq', 4, true);

--
-- Produits phytosanitaires autorisés
--

INSERT INTO public.produits_phyto (id, nom_commercial, matiere_active, numero_amm, categorie, fabricant, dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio, actif, created_at) VALUES
(1, 'Bouillie bordelaise', 'Sulfate de cuivre', '11500001', 'Fongicide', 'Divers', '10-15 kg', 21, 5.00, true, true, CURRENT_TIMESTAMP),
(2, 'Soufre mouillable', 'Soufre', '11500002', 'Fongicide', 'Divers', '5-10 kg', 5, 0.00, true, true, CURRENT_TIMESTAMP),
(3, 'Huile de neem', 'Azadirachtine', '11500003', 'Insecticide', 'Divers', '2-3 L', 3, 0.00, true, true, CURRENT_TIMESTAMP),
(4, 'Bacillus thuringiensis', 'Bt', '11500004', 'Insecticide', 'Divers', '0.5-1 kg', 0, 0.00, true, true, CURRENT_TIMESTAMP),
(5, 'Pyrèthre naturel', 'Pyréthrines', '11500005', 'Insecticide', 'Divers', '0.5-1 L', 2, 0.00, true, true, CURRENT_TIMESTAMP);

SELECT pg_catalog.setval('public.produits_phyto_id_seq', 5, true);

--
-- Fin du fichier d'initialisation
--
