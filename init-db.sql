--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4 (Debian 16.4-1.pgdg110+2)
-- Dumped by pg_dump version 16.4 (Debian 16.4-1.pgdg110+2)

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
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: unstuffed1004
--

CREATE SCHEMA IF NOT EXISTS tiger;


ALTER SCHEMA tiger OWNER TO unstuffed1004;

--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: unstuffed1004
--

CREATE SCHEMA IF NOT EXISTS tiger_data;


ALTER SCHEMA tiger_data OWNER TO unstuffed1004;

--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: unstuffed1004
--

CREATE SCHEMA IF NOT EXISTS topology;


ALTER SCHEMA topology OWNER TO unstuffed1004;

--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: unstuffed1004
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: EXTENSION fuzzystrmatch; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_tiger_geocoder; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder WITH SCHEMA tiger;


--
-- Name: EXTENSION postgis_tiger_geocoder; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_tiger_geocoder IS 'PostGIS tiger geocoder and reverse geocoder';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- Name: check_account_lock(character varying); Type: FUNCTION; Schema: public; Owner: unstuffed1004
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


ALTER FUNCTION public.check_account_lock(p_email character varying) OWNER TO unstuffed1004;

--
-- Name: cleanup_expired_tokens(); Type: FUNCTION; Schema: public; Owner: unstuffed1004
--

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


ALTER FUNCTION public.cleanup_expired_tokens() OWNER TO unstuffed1004;

--
-- Name: FUNCTION cleanup_expired_tokens(); Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON FUNCTION public.cleanup_expired_tokens() IS 'Nettoie les tokens et sessions expirés';


--
-- Name: get_consommation_eau(date, date, integer); Type: FUNCTION; Schema: public; Owner: unstuffed1004
--

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


ALTER FUNCTION public.get_consommation_eau(p_date_debut date, p_date_fin date, p_parcelle_id integer) OWNER TO unstuffed1004;

--
-- Name: increment_login_failures(character varying); Type: FUNCTION; Schema: public; Owner: unstuffed1004
--

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


ALTER FUNCTION public.increment_login_failures(p_email character varying) OWNER TO unstuffed1004;

--
-- Name: log_historique(); Type: FUNCTION; Schema: public; Owner: unstuffed1004
--

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


ALTER FUNCTION public.log_historique() OWNER TO unstuffed1004;

--
-- Name: reset_login_failures(integer); Type: FUNCTION; Schema: public; Owner: unstuffed1004
--

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


ALTER FUNCTION public.reset_login_failures(p_user_id integer) OWNER TO unstuffed1004;

--
-- Name: update_intervention_details_timestamp(); Type: FUNCTION; Schema: public; Owner: unstuffed1004
--

CREATE FUNCTION public.update_intervention_details_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_intervention_details_timestamp() OWNER TO unstuffed1004;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: unstuffed1004
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO unstuffed1004;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: amendements_ref; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.amendements_ref OWNER TO unstuffed1004;

--
-- Name: amendements_ref_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.amendements_ref_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.amendements_ref_id_seq OWNER TO unstuffed1004;

--
-- Name: amendements_ref_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.amendements_ref_id_seq OWNED BY public.amendements_ref.id;


--
-- Name: arbres; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.arbres OWNER TO unstuffed1004;

--
-- Name: COLUMN arbres.deleted_at; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.arbres.deleted_at IS 'Date de suppression (soft delete) - NULL si l''arbre est actif';


--
-- Name: arbres_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.arbres_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.arbres_id_seq OWNER TO unstuffed1004;

--
-- Name: arbres_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.arbres_id_seq OWNED BY public.arbres.id;


--
-- Name: caveurs; Type: TABLE; Schema: public; Owner: unstuffed1004
--

CREATE TABLE public.caveurs (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.caveurs OWNER TO unstuffed1004;

--
-- Name: caveurs_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.caveurs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.caveurs_id_seq OWNER TO unstuffed1004;

--
-- Name: caveurs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.caveurs_id_seq OWNED BY public.caveurs.id;


--
-- Name: chiens; Type: TABLE; Schema: public; Owner: unstuffed1004
--

CREATE TABLE public.chiens (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    race character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chiens OWNER TO unstuffed1004;

--
-- Name: chiens_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.chiens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chiens_id_seq OWNER TO unstuffed1004;

--
-- Name: chiens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.chiens_id_seq OWNED BY public.chiens.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.clients OWNER TO unstuffed1004;

--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clients_id_seq OWNER TO unstuffed1004;

--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: commandes; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.commandes OWNER TO unstuffed1004;

--
-- Name: commandes_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.commandes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.commandes_id_seq OWNER TO unstuffed1004;

--
-- Name: commandes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.commandes_id_seq OWNED BY public.commandes.id;


--
-- Name: historique; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.historique OWNER TO unstuffed1004;

--
-- Name: historique_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.historique_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.historique_id_seq OWNER TO unstuffed1004;

--
-- Name: historique_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.historique_id_seq OWNED BY public.historique.id;


--
-- Name: intervention_details; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.intervention_details OWNER TO unstuffed1004;

--
-- Name: TABLE intervention_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.intervention_details IS 'Détails spécifiques par type d''intervention pour la trufficulture';


--
-- Name: COLUMN intervention_details.volume_eau_m3; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.intervention_details.volume_eau_m3 IS 'Volume d''eau apporté en mètres cubes';


--
-- Name: COLUMN intervention_details.matiere_active; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.intervention_details.matiere_active IS 'Molécule(s) active(s) du produit phytosanitaire';


--
-- Name: COLUMN intervention_details.delai_avant_recolte_jours; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.intervention_details.delai_avant_recolte_jours IS 'DAR - Délai légal avant récolte après traitement';


--
-- Name: COLUMN intervention_details.zone_non_traitee_m; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.intervention_details.zone_non_traitee_m IS 'ZNT - Distance minimale des cours d''eau';


--
-- Name: COLUMN intervention_details.certification_bio; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.intervention_details.certification_bio IS 'Produit utilisable en agriculture biologique';


--
-- Name: COLUMN intervention_details.etat_brule; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.intervention_details.etat_brule IS 'État du brûlé (zone sans végétation autour de l''arbre mycorhizé)';


--
-- Name: COLUMN intervention_details.indice_mycorhization; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.intervention_details.indice_mycorhization IS 'Estimation du taux de mycorhization des racines';


--
-- Name: intervention_details_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.intervention_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.intervention_details_id_seq OWNER TO unstuffed1004;

--
-- Name: intervention_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.intervention_details_id_seq OWNED BY public.intervention_details.id;


--
-- Name: interventions; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.interventions OWNER TO unstuffed1004;

--
-- Name: interventions_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.interventions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.interventions_id_seq OWNER TO unstuffed1004;

--
-- Name: interventions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.interventions_id_seq OWNED BY public.interventions.id;


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: unstuffed1004
--

CREATE TABLE public.login_attempts (
    id integer NOT NULL,
    email character varying(255),
    ip_address character varying(45),
    user_agent text,
    success boolean NOT NULL,
    failure_reason character varying(100),
    attempted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.login_attempts OWNER TO unstuffed1004;

--
-- Name: TABLE login_attempts; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.login_attempts IS 'Journal des tentatives de connexion pour détection de brute force';


--
-- Name: COLUMN login_attempts.failure_reason; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.login_attempts.failure_reason IS 'Raison échec: invalid_email, invalid_password, account_locked, account_inactive';


--
-- Name: login_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.login_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.login_attempts_id_seq OWNER TO unstuffed1004;

--
-- Name: login_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.login_attempts_id_seq OWNED BY public.login_attempts.id;


--
-- Name: parametres; Type: TABLE; Schema: public; Owner: unstuffed1004
--

CREATE TABLE public.parametres (
    id integer NOT NULL,
    cle character varying(100) NOT NULL,
    valeur jsonb NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.parametres OWNER TO unstuffed1004;

--
-- Name: parametres_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.parametres_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.parametres_id_seq OWNER TO unstuffed1004;

--
-- Name: parametres_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.parametres_id_seq OWNED BY public.parametres.id;


--
-- Name: parcelles; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.parcelles OWNER TO unstuffed1004;

--
-- Name: parcelles_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.parcelles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.parcelles_id_seq OWNER TO unstuffed1004;

--
-- Name: parcelles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.parcelles_id_seq OWNED BY public.parcelles.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: unstuffed1004
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.password_reset_tokens OWNER TO unstuffed1004;

--
-- Name: TABLE password_reset_tokens; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.password_reset_tokens IS 'Tokens temporaires pour réinitialisation de mot de passe';


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO unstuffed1004;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: preferences_utilisateur; Type: TABLE; Schema: public; Owner: unstuffed1004
--

CREATE TABLE public.preferences_utilisateur (
    id integer NOT NULL,
    user_id character varying(100) DEFAULT 'default'::character varying,
    colonnes_affichees jsonb DEFAULT '{}'::jsonb,
    colonnes_export jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.preferences_utilisateur OWNER TO unstuffed1004;

--
-- Name: preferences_utilisateur_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.preferences_utilisateur_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.preferences_utilisateur_id_seq OWNER TO unstuffed1004;

--
-- Name: preferences_utilisateur_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.preferences_utilisateur_id_seq OWNED BY public.preferences_utilisateur.id;


--
-- Name: produits_phyto; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.produits_phyto OWNER TO unstuffed1004;

--
-- Name: produits_phyto_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.produits_phyto_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.produits_phyto_id_seq OWNER TO unstuffed1004;

--
-- Name: produits_phyto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.produits_phyto_id_seq OWNED BY public.produits_phyto.id;


--
-- Name: recoltes; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.recoltes OWNER TO unstuffed1004;

--
-- Name: COLUMN recoltes.calibre; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.recoltes.calibre IS 'Calibre de la truffe (Petit, Moyen, Gros, Très gros)';


--
-- Name: COLUMN recoltes.maturite; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.recoltes.maturite IS 'Niveau de maturité (Immature, À point, Mature, Très mature)';


--
-- Name: COLUMN recoltes.conditions_meteo; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.recoltes.conditions_meteo IS 'Conditions météo lors de la récolte';


--
-- Name: COLUMN recoltes.exposition; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.recoltes.exposition IS 'Position de la truffe par rapport à l''arbre (Nord, Nord-Est, Est, Sud-Est, Sud, Sud-Ouest, Ouest, Nord-Ouest)';


--
-- Name: recoltes_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.recoltes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recoltes_id_seq OWNER TO unstuffed1004;

--
-- Name: recoltes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.recoltes_id_seq OWNED BY public.recoltes.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.refresh_tokens OWNER TO unstuffed1004;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.refresh_tokens IS 'Tokens de rafraîchissement pour maintenir les sessions utilisateur';


--
-- Name: COLUMN refresh_tokens.token_hash; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.refresh_tokens.token_hash IS 'Hash du token (jamais stocker le token en clair)';


--
-- Name: COLUMN refresh_tokens.revoked_reason; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.refresh_tokens.revoked_reason IS 'Raison de révocation: logout, security, expired, admin';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.refresh_tokens_id_seq OWNER TO unstuffed1004;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: stats_production_arbre; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.stats_production_arbre AS
 SELECT a.id,
    a.numero,
    a.espece,
    p.nom AS parcelle,
    count(r.id) AS nombre_recoltes,
    sum(r.poids_grammes) AS poids_total_g,
    round(avg(r.poids_grammes), 2) AS poids_moyen_g
   FROM ((public.arbres a
     LEFT JOIN public.parcelles p ON ((a.parcelle_id = p.id)))
     LEFT JOIN public.recoltes r ON ((a.id = r.arbre_id)))
  GROUP BY a.id, a.numero, a.espece, p.nom
  ORDER BY (sum(r.poids_grammes)) DESC;


ALTER VIEW public.stats_production_arbre OWNER TO unstuffed1004;

--
-- Name: stats_production_parcelle; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.stats_production_parcelle AS
 SELECT p.id,
    p.nom AS parcelle,
    EXTRACT(year FROM r.date_recolte) AS annee,
    count(r.id) AS nombre_recoltes,
    sum(r.poids_grammes) AS poids_total_g,
    round(avg(r.poids_grammes), 2) AS poids_moyen_g
   FROM (public.parcelles p
     LEFT JOIN public.recoltes r ON ((p.id = r.parcelle_id)))
  GROUP BY p.id, p.nom, (EXTRACT(year FROM r.date_recolte))
  ORDER BY (EXTRACT(year FROM r.date_recolte)) DESC, (sum(r.poids_grammes)) DESC;


ALTER VIEW public.stats_production_parcelle OWNER TO unstuffed1004;

--
-- Name: ventes; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.ventes OWNER TO unstuffed1004;

--
-- Name: COLUMN ventes.commande_id; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.ventes.commande_id IS 'Lien vers la commande d''origine si créée depuis une livraison';


--
-- Name: stats_ventes; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.stats_ventes AS
 SELECT EXTRACT(year FROM date_vente) AS annee,
    EXTRACT(month FROM date_vente) AS mois,
    count(id) AS nombre_ventes,
    sum(quantite_grammes) AS quantite_vendue_g,
    sum(montant_total) AS chiffre_affaires,
    round(avg(prix_unitaire_kg), 2) AS prix_moyen_kg
   FROM public.ventes v
  WHERE ((statut)::text = 'Payée'::text)
  GROUP BY (EXTRACT(year FROM date_vente)), (EXTRACT(month FROM date_vente))
  ORDER BY (EXTRACT(year FROM date_vente)) DESC, (EXTRACT(month FROM date_vente)) DESC;


ALTER VIEW public.stats_ventes OWNER TO unstuffed1004;

--
-- Name: types_intervention; Type: TABLE; Schema: public; Owner: unstuffed1004
--

CREATE TABLE public.types_intervention (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    description text,
    couleur character varying(7)
);


ALTER TABLE public.types_intervention OWNER TO unstuffed1004;

--
-- Name: types_intervention_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.types_intervention_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.types_intervention_id_seq OWNER TO unstuffed1004;

--
-- Name: types_intervention_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.types_intervention_id_seq OWNED BY public.types_intervention.id;


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.user_sessions OWNER TO unstuffed1004;

--
-- Name: TABLE user_sessions; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.user_sessions IS 'Sessions actives des utilisateurs pour gestion multi-appareils';


--
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_sessions_id_seq OWNER TO unstuffed1004;

--
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.users OWNER TO unstuffed1004;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.users IS 'Table des utilisateurs de l''application';


--
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.users.role IS 'Rôle: admin (tout accès), user (lecture/écriture), readonly (lecture seule)';


--
-- Name: COLUMN users.locked_until; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.users.locked_until IS 'Date jusqu''à laquelle le compte est verrouillé (protection brute force)';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO unstuffed1004;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: v_interventions_completes; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.v_interventions_completes AS
 SELECT i.id,
    i.type_intervention_id,
    i.parcelle_id,
    i.arbre_id,
    i.date_prevue,
    i.date_realisee,
    i.duree_minutes,
    i.personnel,
    i.description,
    i.cout,
    i.statut,
    i.meteo,
    i.notes,
    i.created_at,
    i.updated_at,
    t.nom AS type_nom,
    t.couleur AS type_couleur,
    p.nom AS parcelle_nom,
    a.numero AS arbre_numero,
    a.espece AS arbre_espece,
    id.volume_eau_m3,
    id.methode_irrigation,
    id.nom_commercial AS produit_traitement,
    id.matiere_active,
    id.dose_produit_ha,
    id.type_amendement,
    id.nom_produit_amendement,
    id.dose_kg_ha AS dose_amendement_ha,
    id.type_taille,
    id.intensite_taille,
    id.type_travail_sol,
    id.profondeur_travail_cm,
    id.type_observation,
    id.etat_brule,
    id.niveau_urgence
   FROM ((((public.interventions i
     LEFT JOIN public.types_intervention t ON ((i.type_intervention_id = t.id)))
     LEFT JOIN public.parcelles p ON ((i.parcelle_id = p.id)))
     LEFT JOIN public.arbres a ON ((i.arbre_id = a.id)))
     LEFT JOIN public.intervention_details id ON ((i.id = id.intervention_id)));


ALTER VIEW public.v_interventions_completes OWNER TO unstuffed1004;

--
-- Name: v_irrigations; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.v_irrigations AS
 SELECT i.id,
    i.date_prevue,
    i.date_realisee,
    p.nom AS parcelle,
    a.numero AS arbre,
    id.volume_eau_m3,
    id.volume_eau_par_arbre_l,
    id.methode_irrigation,
    id.source_eau,
    id.debit_l_h,
    id.humidite_sol_avant,
    id.humidite_sol_apres,
    i.duree_minutes,
    i.personnel,
    i.meteo
   FROM (((public.interventions i
     JOIN public.intervention_details id ON ((i.id = id.intervention_id)))
     LEFT JOIN public.parcelles p ON ((i.parcelle_id = p.id)))
     LEFT JOIN public.arbres a ON ((i.arbre_id = a.id)))
  WHERE (i.type_intervention_id = ( SELECT types_intervention.id
           FROM public.types_intervention
          WHERE ((types_intervention.nom)::text = 'Irrigation'::text)))
  ORDER BY i.date_realisee DESC;


ALTER VIEW public.v_irrigations OWNER TO unstuffed1004;

--
-- Name: v_traitements_phyto; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.v_traitements_phyto AS
 SELECT i.id,
    i.date_prevue,
    i.date_realisee,
    p.nom AS parcelle,
    a.numero AS arbre,
    id.nom_commercial,
    id.matiere_active,
    id.numero_amm,
    id.dose_produit_ha,
    id.volume_bouillie_l,
    id.surface_traitee_ha,
    id.methode_application,
    id.cible_traitement,
    id.delai_avant_recolte_jours,
    i.personnel,
    i.notes
   FROM (((public.interventions i
     JOIN public.intervention_details id ON ((i.id = id.intervention_id)))
     LEFT JOIN public.parcelles p ON ((i.parcelle_id = p.id)))
     LEFT JOIN public.arbres a ON ((i.arbre_id = a.id)))
  WHERE (i.type_intervention_id = ( SELECT types_intervention.id
           FROM public.types_intervention
          WHERE ((types_intervention.nom)::text = 'Traitement'::text)))
  ORDER BY i.date_realisee DESC;


ALTER VIEW public.v_traitements_phyto OWNER TO unstuffed1004;

--
-- Name: v_user_stats; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.v_user_stats AS
 SELECT u.id,
    u.email,
    u.nom,
    u.prenom,
    u.role,
    u.is_active,
    u.last_login,
    u.created_at,
    count(DISTINCT rt.id) FILTER (WHERE ((rt.revoked = false) AND (rt.expires_at > now()))) AS active_sessions,
    count(DISTINCT la.id) FILTER (WHERE ((la.success = false) AND (la.attempted_at > (now() - '24:00:00'::interval)))) AS failed_attempts_24h
   FROM ((public.users u
     LEFT JOIN public.refresh_tokens rt ON ((u.id = rt.user_id)))
     LEFT JOIN public.login_attempts la ON (((u.email)::text = (la.email)::text)))
  GROUP BY u.id, u.email, u.nom, u.prenom, u.role, u.is_active, u.last_login, u.created_at;


ALTER VIEW public.v_user_stats OWNER TO unstuffed1004;

--
-- Name: VIEW v_user_stats; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON VIEW public.v_user_stats IS 'Vue consolidée des statistiques utilisateurs';


--
-- Name: ventes_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.ventes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ventes_id_seq OWNER TO unstuffed1004;

--
-- Name: ventes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.ventes_id_seq OWNED BY public.ventes.id;


--
-- Name: amendements_ref id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.amendements_ref ALTER COLUMN id SET DEFAULT nextval('public.amendements_ref_id_seq'::regclass);


--
-- Name: arbres id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.arbres ALTER COLUMN id SET DEFAULT nextval('public.arbres_id_seq'::regclass);


--
-- Name: caveurs id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.caveurs ALTER COLUMN id SET DEFAULT nextval('public.caveurs_id_seq'::regclass);


--
-- Name: chiens id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.chiens ALTER COLUMN id SET DEFAULT nextval('public.chiens_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: commandes id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.commandes ALTER COLUMN id SET DEFAULT nextval('public.commandes_id_seq'::regclass);


--
-- Name: historique id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.historique ALTER COLUMN id SET DEFAULT nextval('public.historique_id_seq'::regclass);


--
-- Name: intervention_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.intervention_details ALTER COLUMN id SET DEFAULT nextval('public.intervention_details_id_seq'::regclass);


--
-- Name: interventions id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.interventions ALTER COLUMN id SET DEFAULT nextval('public.interventions_id_seq'::regclass);


--
-- Name: login_attempts id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.login_attempts ALTER COLUMN id SET DEFAULT nextval('public.login_attempts_id_seq'::regclass);


--
-- Name: parametres id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.parametres ALTER COLUMN id SET DEFAULT nextval('public.parametres_id_seq'::regclass);


--
-- Name: parcelles id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.parcelles ALTER COLUMN id SET DEFAULT nextval('public.parcelles_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: preferences_utilisateur id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.preferences_utilisateur ALTER COLUMN id SET DEFAULT nextval('public.preferences_utilisateur_id_seq'::regclass);


--
-- Name: produits_phyto id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.produits_phyto ALTER COLUMN id SET DEFAULT nextval('public.produits_phyto_id_seq'::regclass);


--
-- Name: recoltes id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.recoltes ALTER COLUMN id SET DEFAULT nextval('public.recoltes_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: types_intervention id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.types_intervention ALTER COLUMN id SET DEFAULT nextval('public.types_intervention_id_seq'::regclass);


--
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: ventes id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.ventes ALTER COLUMN id SET DEFAULT nextval('public.ventes_id_seq'::regclass);


--
-- Data for Name: amendements_ref; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.amendements_ref (id, nom, type_amendement, composition, dose_recommandee_ha, utilisable_bio, effet_principal, precautions, actif, created_at) FROM stdin;
1	Calcaire broyé	Calcique	CaCO3 > 90%	1000-3000 kg	t	Remontée du pH, apport calcium	\N	t	2026-01-03 18:09:46.28507
2	Dolomie	Calcique	CaMg(CO3)2	500-1500 kg	t	Apport calcium et magnésium	\N	t	2026-01-03 18:09:46.28507
3	Chaux vive	Calcique	CaO > 90%	200-500 kg	t	Remontée rapide du pH	\N	t	2026-01-03 18:09:46.28507
4	Lithothamne	Calcique	CaCO3 + oligoéléments	300-500 kg	t	Amendement calcique marin	\N	t	2026-01-03 18:09:46.28507
5	Compost	Organique	Variable	5000-15000 kg	t	Apport matière organique	\N	t	2026-01-03 18:09:46.28507
6	Fumier composté	Organique	N-P-K variable	10000-30000 kg	t	Fertilisation organique	\N	t	2026-01-03 18:09:46.28507
7	BRF	Organique	Carbone, lignine	50-100 m³	t	Stimulation vie du sol	\N	t	2026-01-03 18:09:46.28507
8	Cendre de bois	Minéral	K2O 5-10%, CaO 25-50%	200-500 kg	t	Apport potasse et calcium	\N	t	2026-01-03 18:09:46.28507
\.


--
-- Data for Name: arbres; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.arbres (id, parcelle_id, numero, espece, variete_truffe, date_plantation, "position", etat, circonference_cm, hauteur_m, date_derniere_taille, notes, created_at, updated_at, latitude, longitude, deleted_at) FROM stdin;
9	2	MOJE-A-03	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	3A	2026-01-03 00:36:07.266863	2026-01-03 00:36:07.266863	46.14000208	-0.16842753	\N
12	2	MOJE-A-04	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	4A	2026-01-03 00:36:07.352586	2026-01-03 00:36:07.352586	46.13996491	-0.16845703	\N
18	2	MOJE-A-06	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	6A	2026-01-03 00:36:07.451657	2026-01-03 00:36:07.451657	46.13986083	-0.16853213	\N
22	2	MOJE-A-07	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	7A	2026-01-03 00:36:07.516987	2026-01-03 00:36:07.516987	46.13980879	-0.16856432	\N
26	2	MOJE-A-08	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	8A	2026-01-03 00:36:07.587509	2026-01-03 00:36:07.587509	46.13976047	-0.16859919	\N
31	2	MOJE-A-09	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	9A	2026-01-03 00:36:07.683823	2026-01-03 00:36:07.683823	46.13971401	-0.16863942	\N
36	2	MOJE-A-10	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	10A	2026-01-03 00:36:07.766612	2026-01-03 00:36:07.766612	46.13966383	-0.16866893	\N
41	2	MOJE-A-11	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	11A	2026-01-03 00:36:07.850183	2026-01-03 00:36:07.850183	46.13962294	-0.16871452	\N
53	2	MOJE-A-13	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	13A	2026-01-03 00:36:08.05085	2026-01-03 00:36:08.05085	46.13952630	-0.16878426	\N
60	2	MOJE-A-14	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	14A	2026-01-03 00:36:08.169072	2026-01-03 00:36:08.169072	46.13947798	-0.16881645	\N
67	2	MOJE-A-15	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	15A	2026-01-03 00:36:08.281514	2026-01-03 00:36:08.281514	46.13942780	-0.16884863	\N
8	2	MOJE-B-02	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	2B	2026-01-03 00:36:07.24792	2026-01-03 00:36:07.24792	46.14002438	-0.16831487	\N
10	2	MOJE-B-03	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	3B	2026-01-03 00:36:07.302523	2026-01-03 00:36:07.302523	46.13997048	-0.16835243	\N
13	2	MOJE-B-04	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	4B	2026-01-03 00:36:07.369563	2026-01-03 00:36:07.369563	46.13992030	-0.16838998	\N
16	2	MOJE-B-05	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	5B	2026-01-03 00:36:07.41845	2026-01-03 00:36:07.41845	46.13988127	-0.16842216	\N
19	2	MOJE-B-06	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	6B	2026-01-03 00:36:07.468131	2026-01-03 00:36:07.468131	46.13983109	-0.16846240	\N
23	2	MOJE-B-07	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	7B	2026-01-03 00:36:07.533994	2026-01-03 00:36:07.533994	46.13978091	-0.16849190	\N
27	2	MOJE-B-08	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	8B	2026-01-03 00:36:07.605655	2026-01-03 00:36:07.605655	46.13973631	-0.16852945	\N
32	2	MOJE-B-09	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	9B	2026-01-03 00:36:07.699173	2026-01-03 00:36:07.699173	46.13968427	-0.16856700	\N
48	2	MOJE-B-12	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	12B	2026-01-03 00:36:07.96755	2026-01-03 00:36:07.96755	46.13953745	-0.16867161	\N
54	2	MOJE-B-13	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	13B	2026-01-03 00:36:08.06802	2026-01-03 00:36:08.06802	46.13949470	-0.16871452	\N
61	2	MOJE-B-14	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	14B	2026-01-03 00:36:08.18404	2026-01-03 00:36:08.18404	46.13943895	-0.16874939	\N
68	2	MOJE-B-15	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	15B	2026-01-03 00:36:08.297129	2026-01-03 00:36:08.297129	46.13939806	-0.16878158	\N
6	2	MOJE-A-01	Chêne pubescent (P)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	1A	2026-01-03 00:36:07.180145	2026-01-03 00:36:07.180145	46.14010244	-0.16834974	\N
24	2	MOJE-C-07	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	7C	2026-01-03 00:36:07.550193	2026-01-03 00:36:07.550193	46.13975118	-0.16843557	\N
28	2	MOJE-C-08	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	8C	2026-01-03 00:36:07.623718	2026-01-03 00:36:07.623718	46.13970100	-0.16846508	\N
33	2	MOJE-C-09	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	9C	2026-01-03 00:36:07.714637	2026-01-03 00:36:07.714637	46.13965454	-0.16849995	\N
38	2	MOJE-C-10	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	10C	2026-01-03 00:36:07.800713	2026-01-03 00:36:07.800713	46.13961179	-0.16853750	\N
49	2	MOJE-C-12	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	12C	2026-01-03 00:36:07.983638	2026-01-03 00:36:07.983638	46.13951329	-0.16861260	\N
55	2	MOJE-C-13	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	13C	2026-01-03 00:36:08.085529	2026-01-03 00:36:08.085529	46.13946497	-0.16864479	\N
62	2	MOJE-C-14	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	14C	2026-01-03 00:36:08.200581	2026-01-03 00:36:08.200581	46.13941665	-0.16867697	\N
69	2	MOJE-C-15	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	15C	2026-01-03 00:36:08.31268	2026-01-03 00:36:08.31268	46.13936461	-0.16871721	\N
46	2	MOJE-F-11	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	11F	2026-01-03 00:36:07.934618	2026-01-03 00:36:07.934618	46.13947169	-0.16837399	\N
25	2	MOJE-D-07	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	7D	2026-01-03 00:36:07.567546	2026-01-03 00:36:07.567546	46.13972330	-0.16836047	\N
34	2	MOJE-D-09	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	9D	2026-01-03 00:36:07.733463	2026-01-03 00:36:07.733463	46.13962294	-0.16844094	\N
44	2	MOJE-D-11	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	11D	2026-01-03 00:36:07.90158	2026-01-03 00:36:07.90158	46.13952630	-0.16851336	\N
50	2	MOJE-D-12	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	12D	2026-01-03 00:36:08.001243	2026-01-03 00:36:08.001243	46.13947798	-0.16854823	\N
70	2	MOJE-D-15	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	15D	2026-01-03 00:36:08.328594	2026-01-03 00:36:08.328594	46.13933416	-0.16865026	\N
30	2	MOJE-E-08	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	8E	2026-01-03 00:36:07.662342	2026-01-03 00:36:07.662342	46.13964267	-0.16833376	\N
35	2	MOJE-E-09	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	9E	2026-01-03 00:36:07.750154	2026-01-03 00:36:07.750154	46.13959992	-0.16837399	\N
40	2	MOJE-E-10	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	10E	2026-01-03 00:36:07.833583	2026-01-03 00:36:07.833583	46.13954975	-0.16840618	\N
45	2	MOJE-E-11	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	11E	2026-01-03 00:36:07.917072	2026-01-03 00:36:07.917072	46.13949771	-0.16844373	\N
51	2	MOJE-E-12	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	12E	2026-01-03 00:36:08.018196	2026-01-03 00:36:08.018196	46.13945124	-0.16847592	\N
64	2	MOJE-E-14	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	14E	2026-01-03 00:36:08.231598	2026-01-03 00:36:08.231598	46.13934903	-0.16855102	\N
52	2	MOJE-F-12	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	12F	2026-01-03 00:36:08.035159	2026-01-03 00:36:08.035159	46.13942151	-0.16841155	\N
58	2	MOJE-F-13	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	13F	2026-01-03 00:36:08.135624	2026-01-03 00:36:08.135624	46.13937319	-0.16845178	\N
65	2	MOJE-F-14	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	14F	2026-01-03 00:36:08.247118	2026-01-03 00:36:08.247118	46.13932115	-0.16848665	\N
20	2	MOJE-C-06	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	6C	2026-01-03 00:36:07.484641	2026-01-03 00:36:07.484641	46.13980322	-0.16840339	\N
59	2	MOJE-G-13	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	13G	2026-01-03 00:36:08.152572	2026-01-03 00:36:08.152572	46.13934531	-0.16838204	\N
14	2	MOJE-C-04	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	4C	2026-01-03 00:36:07.38727	2026-01-03 00:36:07.38727	46.13989614	-0.16832829	\N
21	2	MOJE-D-06	Chêne pubescent (P)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	6D	2026-01-03 00:36:07.501079	2026-01-03 00:36:07.501079	46.13976976	-0.16832829	\N
7	2	MOJE-A-02	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	2A	2026-01-03 00:36:07.230983	2026-01-03 00:36:07.230983	46.14005040	-0.16837925	\N
115	2	MOJE-A-20	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	20A	2026-01-03 00:36:09.111185	2026-01-03 00:36:09.111185	46.13918061	-0.16902566	\N
127	2	MOJE-A-21	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21A	2026-01-03 00:36:09.312211	2026-01-03 00:36:09.312211	46.13913601	-0.16906053	\N
140	2	MOJE-A-22	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22A	2026-01-03 00:36:09.529651	2026-01-03 00:36:09.529651	46.13908583	-0.16909271	\N
85	2	MOJE-B-17	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	17B	2026-01-03 00:36:08.585132	2026-01-03 00:36:08.585132	46.13929770	-0.16885132	\N
95	2	MOJE-B-18	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	18B	2026-01-03 00:36:08.748288	2026-01-03 00:36:08.748288	46.13924752	-0.16887814	\N
116	2	MOJE-B-20	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	20B	2026-01-03 00:36:09.127775	2026-01-03 00:36:09.127775	46.13915274	-0.16894788	\N
128	2	MOJE-B-21	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21B	2026-01-03 00:36:09.330081	2026-01-03 00:36:09.330081	46.13910441	-0.16898543	\N
86	2	MOJE-C-17	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	17C	2026-01-03 00:36:08.602286	2026-01-03 00:36:08.602286	46.13926239	-0.16878963	\N
117	2	MOJE-C-20	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	20C	2026-01-03 00:36:09.144636	2026-01-03 00:36:09.144636	46.13912300	-0.16888350	\N
129	2	MOJE-C-21	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21C	2026-01-03 00:36:09.345173	2026-01-03 00:36:09.345173	46.13907840	-0.16892374	\N
72	2	MOJE-F-15	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	15F	2026-01-03 00:36:08.360138	2026-01-03 00:36:08.360138	46.13927283	-0.16851883	\N
78	2	MOJE-D-16	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	16D	2026-01-03 00:36:08.461123	2026-01-03 00:36:08.461123	46.13928212	-0.16868781	\N
87	2	MOJE-D-17	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	17D	2026-01-03 00:36:08.618106	2026-01-03 00:36:08.618106	46.13923194	-0.16873073	\N
97	2	MOJE-D-18	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	18D	2026-01-03 00:36:08.781414	2026-01-03 00:36:08.781414	46.13918919	-0.16875219	\N
107	2	MOJE-D-19	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	19D	2026-01-03 00:36:08.977188	2026-01-03 00:36:08.977188	46.13913529	-0.16880047	\N
130	2	MOJE-D-21	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21D	2026-01-03 00:36:09.361637	2026-01-03 00:36:09.361637	46.13904423	-0.16885947	\N
71	2	MOJE-E-15	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	15E	2026-01-03 00:36:08.344203	2026-01-03 00:36:08.344203	46.13930256	-0.16858857	\N
79	2	MOJE-E-16	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	16E	2026-01-03 00:36:08.479695	2026-01-03 00:36:08.479695	46.13925982	-0.16862344	\N
88	2	MOJE-E-17	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	17E	2026-01-03 00:36:08.634015	2026-01-03 00:36:08.634015	46.13920778	-0.16865294	\N
98	2	MOJE-E-18	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	18E	2026-01-03 00:36:08.801387	2026-01-03 00:36:08.801387	46.13916131	-0.16867977	\N
131	2	MOJE-E-21	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21E	2026-01-03 00:36:09.378705	2026-01-03 00:36:09.378705	46.13902007	-0.16880047	\N
80	2	MOJE-F-16	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	16F	2026-01-03 00:36:08.49666	2026-01-03 00:36:08.49666	46.13922636	-0.16855102	\N
89	2	MOJE-F-17	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	17F	2026-01-03 00:36:08.650269	2026-01-03 00:36:08.650269	46.13917804	-0.16859394	\N
120	2	MOJE-F-20	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	20F	2026-01-03 00:36:09.194139	2026-01-03 00:36:09.194139	46.13903865	-0.16869854	\N
132	2	MOJE-F-21	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21F	2026-01-03 00:36:09.39747	2026-01-03 00:36:09.39747	46.13899033	-0.16873073	\N
83	2	MOJE-I-16	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	16I	2026-01-03 00:36:08.55029	2026-01-03 00:36:08.55029	46.13914459	-0.16837131	\N
73	2	MOJE-G-15	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	15G	2026-01-03 00:36:08.37917	2026-01-03 00:36:08.37917	46.13924681	-0.16845446	\N
81	2	MOJE-G-16	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	16G	2026-01-03 00:36:08.513895	2026-01-03 00:36:08.513895	46.13919848	-0.16848933	\N
90	2	MOJE-G-17	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	17G	2026-01-03 00:36:08.667679	2026-01-03 00:36:08.667679	46.13914645	-0.16852956	\N
100	2	MOJE-G-18	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	18G	2026-01-03 00:36:08.85664	2026-01-03 00:36:08.85664	46.13909812	-0.16855638	\N
121	2	MOJE-G-20	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	20G	2026-01-03 00:36:09.212152	2026-01-03 00:36:09.212152	46.13900520	-0.16862612	\N
133	2	MOJE-G-21	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21G	2026-01-03 00:36:09.412718	2026-01-03 00:36:09.412718	46.13895873	-0.16866367	\N
74	2	MOJE-H-15	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	15H	2026-01-03 00:36:08.397188	2026-01-03 00:36:08.397188	46.13922636	-0.16839545	\N
82	2	MOJE-H-16	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	16H	2026-01-03 00:36:08.532669	2026-01-03 00:36:08.532669	46.13917432	-0.16842764	\N
91	2	MOJE-H-17	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	17H	2026-01-03 00:36:08.684139	2026-01-03 00:36:08.684139	46.13912043	-0.16846519	\N
111	2	MOJE-H-19	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	19H	2026-01-03 00:36:09.045684	2026-01-03 00:36:09.045684	46.13902378	-0.16852420	\N
122	2	MOJE-H-20	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	20H	2026-01-03 00:36:09.228702	2026-01-03 00:36:09.228702	46.13897732	-0.16856711	\N
92	2	MOJE-I-17	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	17I	2026-01-03 00:36:08.700658	2026-01-03 00:36:08.700658	46.13908883	-0.16839545	\N
123	2	MOJE-I-20	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	20I	2026-01-03 00:36:09.246772	2026-01-03 00:36:09.246772	46.13895316	-0.16850274	\N
135	2	MOJE-I-21	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21I	2026-01-03 00:36:09.446129	2026-01-03 00:36:09.446129	46.13890670	-0.16853493	\N
126	2	MOJE-L-20	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	20L	2026-01-03 00:36:09.295757	2026-01-03 00:36:09.295757	46.13885837	-0.16829621	\N
93	2	MOJE-J-17	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	17J	2026-01-03 00:36:08.716149	2026-01-03 00:36:08.716149	46.13906095	-0.16833913	\N
103	2	MOJE-J-18	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	18J	2026-01-03 00:36:08.913693	2026-01-03 00:36:08.913693	46.13901263	-0.16836058	\N
113	2	MOJE-J-19	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	19J	2026-01-03 00:36:09.078848	2026-01-03 00:36:09.078848	46.13896989	-0.16840082	\N
136	2	MOJE-J-21	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21J	2026-01-03 00:36:09.460645	2026-01-03 00:36:09.460645	46.13887696	-0.16847055	\N
114	2	MOJE-K-19	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	19K	2026-01-03 00:36:09.095678	2026-01-03 00:36:09.095678	46.13894015	-0.16833108	\N
125	2	MOJE-K-20	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	20K	2026-01-03 00:36:09.280024	2026-01-03 00:36:09.280024	46.13889554	-0.16836327	\N
137	2	MOJE-K-21	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21K	2026-01-03 00:36:09.479671	2026-01-03 00:36:09.479671	46.13884351	-0.16840082	\N
138	2	MOJE-L-21	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21L	2026-01-03 00:36:09.496414	2026-01-03 00:36:09.496414	46.13881191	-0.16833376	\N
77	2	MOJE-C-16	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	16C	2026-01-03 00:36:08.444153	2026-01-03 00:36:08.444153	46.13931443	-0.16875207	\N
84	2	MOJE-A-17	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	17A	2026-01-03 00:36:08.567557	2026-01-03 00:36:08.567557	46.13932930	-0.16892374	\N
94	2	MOJE-A-18	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	18A	2026-01-03 00:36:08.732198	2026-01-03 00:36:08.732198	46.13927540	-0.16895324	\N
141	2	MOJE-B-22	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22B	2026-01-03 00:36:09.546772	2026-01-03 00:36:09.546772	46.13905609	-0.16901493	\N
155	2	MOJE-B-23	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23B	2026-01-03 00:36:09.777649	2026-01-03 00:36:09.777649	46.13900777	-0.16904980	\N
170	2	MOJE-B-24	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24B	2026-01-03 00:36:10.027208	2026-01-03 00:36:10.027208	46.13895759	-0.16908735	\N
203	2	MOJE-B-26	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26B	2026-01-03 00:36:10.583214	2026-01-03 00:36:10.583214	46.13886652	-0.16914099	\N
171	2	MOJE-C-24	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24C	2026-01-03 00:36:10.044825	2026-01-03 00:36:10.044825	46.13893343	-0.16901493	\N
187	2	MOJE-C-25	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25C	2026-01-03 00:36:10.312794	2026-01-03 00:36:10.312794	46.13888139	-0.16904443	\N
204	2	MOJE-C-26	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26C	2026-01-03 00:36:10.600168	2026-01-03 00:36:10.600168	46.13883493	-0.16907662	\N
145	2	MOJE-F-22	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22F	2026-01-03 00:36:09.6122	2026-01-03 00:36:09.6122	46.13894572	-0.16876291	\N
143	2	MOJE-D-22	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22D	2026-01-03 00:36:09.580138	2026-01-03 00:36:09.580138	46.13900148	-0.16889703	\N
188	2	MOJE-D-25	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25D	2026-01-03 00:36:10.329558	2026-01-03 00:36:10.329558	46.13884908	-0.16898017	\N
205	2	MOJE-D-26	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26D	2026-01-03 00:36:10.615646	2026-01-03 00:36:10.615646	46.13880448	-0.16901504	\N
144	2	MOJE-E-22	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22E	2026-01-03 00:36:09.59616	2026-01-03 00:36:09.59616	46.13897174	-0.16882997	\N
158	2	MOJE-E-23	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23E	2026-01-03 00:36:09.827705	2026-01-03 00:36:09.827705	46.13891971	-0.16886216	\N
173	2	MOJE-E-24	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24E	2026-01-03 00:36:10.077244	2026-01-03 00:36:10.077244	46.13886952	-0.16888630	\N
189	2	MOJE-E-25	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25E	2026-01-03 00:36:10.348339	2026-01-03 00:36:10.348339	46.13882306	-0.16892117	\N
159	2	MOJE-F-23	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23F	2026-01-03 00:36:09.843792	2026-01-03 00:36:09.843792	46.13889740	-0.16879778	\N
174	2	MOJE-F-24	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24F	2026-01-03 00:36:10.094691	2026-01-03 00:36:10.094691	46.13885094	-0.16882729	\N
190	2	MOJE-F-25	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25F	2026-01-03 00:36:10.364977	2026-01-03 00:36:10.364977	46.13879890	-0.16885411	\N
207	2	MOJE-F-26	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26F	2026-01-03 00:36:10.646839	2026-01-03 00:36:10.646839	46.13875244	-0.16888361	\N
148	2	MOJE-I-22	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22I	2026-01-03 00:36:09.66116	2026-01-03 00:36:09.66116	46.13885651	-0.16857248	\N
175	2	MOJE-G-24	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24G	2026-01-03 00:36:10.111814	2026-01-03 00:36:10.111814	46.13881377	-0.16876023	\N
191	2	MOJE-G-25	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25G	2026-01-03 00:36:10.383039	2026-01-03 00:36:10.383039	46.13876916	-0.16878705	\N
208	2	MOJE-G-26	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26G	2026-01-03 00:36:10.662654	2026-01-03 00:36:10.662654	46.13872456	-0.16881388	\N
147	2	MOJE-H-22	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22H	2026-01-03 00:36:09.645178	2026-01-03 00:36:09.645178	46.13888625	-0.16862612	\N
192	2	MOJE-H-25	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25H	2026-01-03 00:36:10.40165	2026-01-03 00:36:10.40165	46.13874314	-0.16872268	\N
209	2	MOJE-H-26	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26H	2026-01-03 00:36:10.684797	2026-01-03 00:36:10.684797	46.13869854	-0.16874682	\N
162	2	MOJE-I-23	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23I	2026-01-03 00:36:09.894199	2026-01-03 00:36:09.894199	46.13881377	-0.16859125	\N
177	2	MOJE-I-24	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24I	2026-01-03 00:36:10.146229	2026-01-03 00:36:10.146229	46.13875615	-0.16863149	\N
193	2	MOJE-I-25	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25I	2026-01-03 00:36:10.418198	2026-01-03 00:36:10.418198	46.13870969	-0.16865831	\N
165	2	MOJE-L-23	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23L	2026-01-03 00:36:09.944549	2026-01-03 00:36:09.944549	46.13871712	-0.16840082	\N
149	2	MOJE-J-22	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22J	2026-01-03 00:36:09.677829	2026-01-03 00:36:09.677829	46.13882492	-0.16849738	\N
163	2	MOJE-J-23	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23J	2026-01-03 00:36:09.911137	2026-01-03 00:36:09.911137	46.13877474	-0.16852956	\N
178	2	MOJE-J-24	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24J	2026-01-03 00:36:10.162013	2026-01-03 00:36:10.162013	46.13872270	-0.16856711	\N
194	2	MOJE-J-25	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25J	2026-01-03 00:36:10.433068	2026-01-03 00:36:10.433068	46.13867995	-0.16859662	\N
150	2	MOJE-K-22	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22K	2026-01-03 00:36:09.694352	2026-01-03 00:36:09.694352	46.13879704	-0.16843300	\N
179	2	MOJE-K-24	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24K	2026-01-03 00:36:10.177384	2026-01-03 00:36:10.177384	46.13869296	-0.16849738	\N
195	2	MOJE-K-25	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25K	2026-01-03 00:36:10.44793	2026-01-03 00:36:10.44793	46.13865022	-0.16852956	\N
180	2	MOJE-L-24	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24L	2026-01-03 00:36:10.195198	2026-01-03 00:36:10.195198	46.13866509	-0.16843300	\N
168	2	MOJE-O-23	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23O	2026-01-03 00:36:09.993007	2026-01-03 00:36:09.993007	46.13862977	-0.16820770	\N
166	2	MOJE-M-23	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23M	2026-01-03 00:36:09.960118	2026-01-03 00:36:09.960118	46.13869110	-0.16833644	\N
181	2	MOJE-M-24	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24M	2026-01-03 00:36:10.210573	2026-01-03 00:36:10.210573	46.13863535	-0.16836595	\N
197	2	MOJE-M-25	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25M	2026-01-03 00:36:10.480127	2026-01-03 00:36:10.480127	46.13859818	-0.16839813	\N
153	2	MOJE-N-22	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22N	2026-01-03 00:36:09.744108	2026-01-03 00:36:09.744108	46.13870411	-0.16822916	\N
167	2	MOJE-N-23	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23N	2026-01-03 00:36:09.977143	2026-01-03 00:36:09.977143	46.13866137	-0.16827475	\N
198	2	MOJE-N-25	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25N	2026-01-03 00:36:10.497171	2026-01-03 00:36:10.497171	46.13856101	-0.16833376	\N
183	2	MOJE-O-24	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24O	2026-01-03 00:36:10.244724	2026-01-03 00:36:10.244724	46.13857773	-0.16823720	\N
199	2	MOJE-O-25	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25O	2026-01-03 00:36:10.514371	2026-01-03 00:36:10.514371	46.13853313	-0.16825866	\N
184	2	MOJE-P-24	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24P	2026-01-03 00:36:10.26185	2026-01-03 00:36:10.26185	46.13854614	-0.16816746	\N
200	2	MOJE-P-25	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25P	2026-01-03 00:36:10.530969	2026-01-03 00:36:10.530969	46.13849967	-0.16819965	\N
142	2	MOJE-C-22	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22C	2026-01-03 00:36:09.564689	2026-01-03 00:36:09.564689	46.13903193	-0.16895056	\N
169	2	MOJE-A-24	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24A	2026-01-03 00:36:10.009837	2026-01-03 00:36:10.009837	46.13898733	-0.16915977	\N
185	2	MOJE-A-25	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25A	2026-01-03 00:36:10.278491	2026-01-03 00:36:10.278491	46.13893715	-0.16918927	\N
246	1	CHET-D-02	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	D2	2026-01-03 00:36:11.329792	2026-01-03 00:36:11.329792	46.15670001	-0.15441835	\N
248	1	CHET-D-04	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	D4	2026-01-03 00:36:11.369607	2026-01-03 00:36:11.369607	46.15667400	-0.15425742	\N
250	1	CHET-E-02	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	E2	2026-01-03 00:36:11.40004	2026-01-03 00:36:11.40004	46.15665357	-0.15445322	\N
243	1	CHET-C-02	Charmes (C)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	C2	2026-01-03 00:36:11.26971	2026-01-03 00:36:11.26971	46.15674646	-0.15436739	\N
241	1	CHET-B-02	Chêne pubescent (P)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	B2	2026-01-03 00:36:11.230197	2026-01-03 00:36:11.230197	46.15680777	-0.15432984	\N
251	1	CHET-E-03	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	E3	2026-01-03 00:36:11.415194	2026-01-03 00:36:11.415194	46.15664428	-0.15437812	\N
252	1	CHET-E-04	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	E4	2026-01-03 00:36:11.430436	2026-01-03 00:36:11.430436	46.15662384	-0.15430301	\N
253	1	CHET-E-05	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	E5	2026-01-03 00:36:11.446423	2026-01-03 00:36:11.446423	46.15661641	-0.15422791	\N
254	1	CHET-F-01	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	F1	2026-01-03 00:36:11.462993	2026-01-03 00:36:11.462993	46.15662198	-0.15458196	\N
256	1	CHET-F-03	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	F3	2026-01-03 00:36:11.496191	2026-01-03 00:36:11.496191	46.15659225	-0.15443176	\N
258	1	CHET-F-05	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	F5	2026-01-03 00:36:11.529519	2026-01-03 00:36:11.529519	46.15656996	-0.15427351	\N
259	1	CHET-F-06	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	F6	2026-01-03 00:36:11.547072	2026-01-03 00:36:11.547072	46.15656067	-0.15420109	\N
260	1	CHET-G-01	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	G1	2026-01-03 00:36:11.563278	2026-01-03 00:36:11.563278	46.15657182	-0.15463293	\N
261	1	CHET-G-02	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	G2	2026-01-03 00:36:11.581269	2026-01-03 00:36:11.581269	46.15656067	-0.15454710	\N
263	1	CHET-G-04	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	G4	2026-01-03 00:36:11.613589	2026-01-03 00:36:11.613589	46.15653466	-0.15438884	\N
264	1	CHET-G-05	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	G5	2026-01-03 00:36:11.629272	2026-01-03 00:36:11.629272	46.15652165	-0.15432179	\N
220	2	MOJE-A-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27A	2026-01-03 00:36:10.874546	2026-01-03 00:36:10.874546	46.13884794	-0.16924560	\N
266	1	CHET-G-07	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	G7	2026-01-03 00:36:11.661663	2026-01-03 00:36:11.661663	46.15649193	-0.15416622	\N
267	1	CHET-G-08	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	G8	2026-01-03 00:36:11.677278	2026-01-03 00:36:11.677278	46.15648078	-0.15409380	\N
269	1	CHET-H-02	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	H2	2026-01-03 00:36:11.711208	2026-01-03 00:36:11.711208	46.15651794	-0.15459538	\N
271	1	CHET-H-04	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	H4	2026-01-03 00:36:11.743139	2026-01-03 00:36:11.743139	46.15649193	-0.15444249	\N
272	1	CHET-H-05	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	H5	2026-01-03 00:36:11.760194	2026-01-03 00:36:11.760194	46.15647520	-0.15436202	\N
273	1	CHET-H-06	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	H6	2026-01-03 00:36:11.776681	2026-01-03 00:36:11.776681	46.15646591	-0.15428424	\N
274	1	CHET-H-07	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	H7	2026-01-03 00:36:11.793134	2026-01-03 00:36:11.793134	46.15644919	-0.15420914	\N
276	1	CHET-H-09	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	H9	2026-01-03 00:36:11.827064	2026-01-03 00:36:11.827064	46.15642876	-0.15406162	\N
278	1	CHET-I-02	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	I2	2026-01-03 00:36:11.860525	2026-01-03 00:36:11.860525	46.15647892	-0.15463829	\N
279	1	CHET-I-03	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	I3	2026-01-03 00:36:11.876708	2026-01-03 00:36:11.876708	46.15646220	-0.15456855	\N
280	1	CHET-I-04	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	I4	2026-01-03 00:36:11.893539	2026-01-03 00:36:11.893539	46.15645105	-0.15449345	\N
265	1	CHET-G-06	Chênes Cerris (Cé)	Tuber melanosporum	2025-11-01	\N	Bon	\N	2.5	\N	G6	2026-01-03 00:36:11.644702	2026-01-03 00:36:11.644702	46.15650679	-0.15423864	\N
225	2	MOJE-F-27	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27F	2026-01-03 00:36:10.962663	2026-01-03 00:36:10.962663	46.13870411	-0.16892385	\N
223	2	MOJE-D-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27D	2026-01-03 00:36:10.927978	2026-01-03 00:36:10.927978	46.13875801	-0.16904723	\N
240	1	CHET-B-01	Chêne pubescent (P)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	B1	2026-01-03 00:36:11.209792	2026-01-03 00:36:11.209792	46.15681149	-0.15440494	\N
224	2	MOJE-E-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27E	2026-01-03 00:36:10.945605	2026-01-03 00:36:10.945605	46.13873385	-0.16898017	\N
228	2	MOJE-I-27	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27I	2026-01-03 00:36:11.01014	2026-01-03 00:36:11.01014	46.13861676	-0.16872268	\N
226	2	MOJE-G-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27G	2026-01-03 00:36:10.97819	2026-01-03 00:36:10.97819	46.13867624	-0.16885411	\N
213	2	MOJE-L-26	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26L	2026-01-03 00:36:10.750917	2026-01-03 00:36:10.750917	46.13857773	-0.16849201	\N
211	2	MOJE-J-26	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26J	2026-01-03 00:36:10.717631	2026-01-03 00:36:10.717631	46.13863535	-0.16862612	\N
229	2	MOJE-J-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27J	2026-01-03 00:36:11.026167	2026-01-03 00:36:11.026167	46.13858331	-0.16865563	\N
230	2	MOJE-K-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27K	2026-01-03 00:36:11.044704	2026-01-03 00:36:11.044704	46.13855357	-0.16859125	\N
216	2	MOJE-O-26	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26O	2026-01-03 00:36:10.801981	2026-01-03 00:36:10.801981	46.13848852	-0.16829085	\N
214	2	MOJE-M-26	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26M	2026-01-03 00:36:10.768303	2026-01-03 00:36:10.768303	46.13854614	-0.16842496	\N
215	2	MOJE-N-26	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26N	2026-01-03 00:36:10.784765	2026-01-03 00:36:10.784765	46.13851826	-0.16835790	\N
233	2	MOJE-N-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27N	2026-01-03 00:36:11.094251	2026-01-03 00:36:11.094251	46.13847180	-0.16839545	\N
219	2	MOJE-R-26	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26R	2026-01-03 00:36:10.856806	2026-01-03 00:36:10.856806	46.13840861	-0.16808968	\N
217	2	MOJE-P-26	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26P	2026-01-03 00:36:10.819369	2026-01-03 00:36:10.819369	46.13845879	-0.16822647	\N
235	2	MOJE-P-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27P	2026-01-03 00:36:11.127751	2026-01-03 00:36:11.127751	46.13840489	-0.16825866	\N
218	2	MOJE-Q-26	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26Q	2026-01-03 00:36:10.83734	2026-01-03 00:36:10.83734	46.13843277	-0.16815942	\N
236	2	MOJE-Q-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27Q	2026-01-03 00:36:11.143841	2026-01-03 00:36:11.143841	46.13838073	-0.16819965	\N
237	2	MOJE-R-27	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27R	2026-01-03 00:36:11.16083	2026-01-03 00:36:11.16083	46.13835471	-0.16812991	\N
222	2	MOJE-C-27	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27C	2026-01-03 00:36:10.912047	2026-01-03 00:36:10.912047	46.13879218	-0.16911954	\N
245	1	CHET-D-01	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	D1	2026-01-03 00:36:11.309079	2026-01-03 00:36:11.309079	46.15671488	-0.15448540	\N
244	1	CHET-C-03	Chêne pubescent (P)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	C3	2026-01-03 00:36:11.285042	2026-01-03 00:36:11.285042	46.15673717	-0.15428156	\N
286	1	CHET-I-10	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	I10	2026-01-03 00:36:12.000185	2026-01-03 00:36:12.000185	46.15636930	-0.15402406	\N
287	1	CHET-I-11	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	I11	2026-01-03 00:36:12.029447	2026-01-03 00:36:12.029447	46.15635815	-0.15394896	\N
289	1	CHET-J-02	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	J2	2026-01-03 00:36:12.060719	2026-01-03 00:36:12.060719	46.15642876	-0.15467852	\N
290	1	CHET-J-03	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	J3	2026-01-03 00:36:12.077578	2026-01-03 00:36:12.077578	46.15641575	-0.15460074	\N
292	1	CHET-J-05	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	J5	2026-01-03 00:36:12.109615	2026-01-03 00:36:12.109615	46.15639717	-0.15445322	\N
293	1	CHET-J-06	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	J6	2026-01-03 00:36:12.126155	2026-01-03 00:36:12.126155	46.15638231	-0.15437275	\N
294	1	CHET-J-07	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	J7	2026-01-03 00:36:12.14371	2026-01-03 00:36:12.14371	46.15637302	-0.15429765	\N
295	1	CHET-J-08	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	J8	2026-01-03 00:36:12.160676	2026-01-03 00:36:12.160676	46.15635630	-0.15421987	\N
298	1	CHET-J-11	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	J11	2026-01-03 00:36:12.211331	2026-01-03 00:36:12.211331	46.15631728	-0.15399724	\N
299	1	CHET-J-12	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	J12	2026-01-03 00:36:12.228179	2026-01-03 00:36:12.228179	46.15630427	-0.15392482	\N
300	1	CHET-K-01	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K1	2026-01-03 00:36:12.243738	2026-01-03 00:36:12.243738	46.15640646	-0.15479386	\N
301	1	CHET-K-02	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K2	2026-01-03 00:36:12.260185	2026-01-03 00:36:12.260185	46.15639345	-0.15472412	\N
302	1	CHET-K-03	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K3	2026-01-03 00:36:12.277209	2026-01-03 00:36:12.277209	46.15637488	-0.15464634	\N
303	1	CHET-K-04	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K4	2026-01-03 00:36:12.293761	2026-01-03 00:36:12.293761	46.15636187	-0.15457124	\N
305	1	CHET-K-06	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K6	2026-01-03 00:36:12.3283	2026-01-03 00:36:12.3283	46.15634143	-0.15441030	\N
306	1	CHET-K-07	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K7	2026-01-03 00:36:12.344094	2026-01-03 00:36:12.344094	46.15632657	-0.15433520	\N
307	1	CHET-K-08	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K8	2026-01-03 00:36:12.361416	2026-01-03 00:36:12.361416	46.15631170	-0.15426010	\N
308	1	CHET-K-09	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K9	2026-01-03 00:36:12.377414	2026-01-03 00:36:12.377414	46.15630056	-0.15418500	\N
309	1	CHET-K-10	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K10	2026-01-03 00:36:12.394608	2026-01-03 00:36:12.394608	46.15628941	-0.15410721	\N
312	1	CHET-K-13	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K13	2026-01-03 00:36:12.444203	2026-01-03 00:36:12.444203	46.15624482	-0.15390068	\N
313	1	CHET-K-14	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K14	2026-01-03 00:36:12.460569	2026-01-03 00:36:12.460569	46.15623739	-0.15381753	\N
314	1	CHET-L-01	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L1	2026-01-03 00:36:12.477166	2026-01-03 00:36:12.477166	46.15636187	-0.15484482	\N
315	1	CHET-L-02	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L2	2026-01-03 00:36:12.493598	2026-01-03 00:36:12.493598	46.15634886	-0.15477240	\N
318	1	CHET-L-05	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L5	2026-01-03 00:36:12.547193	2026-01-03 00:36:12.547193	46.15630799	-0.15454173	\N
319	1	CHET-L-06	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L6	2026-01-03 00:36:12.564561	2026-01-03 00:36:12.564561	46.15629684	-0.15446395	\N
320	1	CHET-L-07	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L7	2026-01-03 00:36:12.580461	2026-01-03 00:36:12.580461	46.15628198	-0.15438884	\N
321	1	CHET-L-08	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L8	2026-01-03 00:36:12.595486	2026-01-03 00:36:12.595486	46.15627083	-0.15430838	\N
322	1	CHET-L-09	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L9	2026-01-03 00:36:12.610764	2026-01-03 00:36:12.610764	46.15625597	-0.15423864	\N
323	1	CHET-L-10	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L10	2026-01-03 00:36:12.627525	2026-01-03 00:36:12.627525	46.15624110	-0.15416622	\N
325	1	CHET-L-12	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L12	2026-01-03 00:36:12.661227	2026-01-03 00:36:12.661227	46.15621323	-0.15400797	\N
326	1	CHET-L-13	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L13	2026-01-03 00:36:12.676773	2026-01-03 00:36:12.676773	46.15620394	-0.15393555	\N
327	1	CHET-L-14	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L14	2026-01-03 00:36:12.694245	2026-01-03 00:36:12.694245	46.15619465	-0.15385777	\N
328	1	CHET-L-15	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L15	2026-01-03 00:36:12.71065	2026-01-03 00:36:12.71065	46.15618722	-0.15379071	\N
329	1	CHET-L-16	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L16	2026-01-03 00:36:12.727637	2026-01-03 00:36:12.727637	46.15616864	-0.15370756	\N
331	1	CHET-M-02	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M2	2026-01-03 00:36:12.762102	2026-01-03 00:36:12.762102	46.15630056	-0.15480191	\N
332	1	CHET-M-03	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M3	2026-01-03 00:36:12.778184	2026-01-03 00:36:12.778184	46.15629870	-0.15473753	\N
334	1	CHET-M-05	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M5	2026-01-03 00:36:12.810236	2026-01-03 00:36:12.810236	46.15626711	-0.15457660	\N
335	1	CHET-M-06	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M6	2026-01-03 00:36:12.827122	2026-01-03 00:36:12.827122	46.15625225	-0.15450686	\N
338	1	CHET-M-09	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M9	2026-01-03 00:36:12.87678	2026-01-03 00:36:12.87678	46.15621881	-0.15427619	\N
339	1	CHET-M-10	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M10	2026-01-03 00:36:12.89367	2026-01-03 00:36:12.89367	46.15620394	-0.15420645	\N
340	1	CHET-M-11	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M11	2026-01-03 00:36:12.910699	2026-01-03 00:36:12.910699	46.15618908	-0.15413135	\N
341	1	CHET-M-12	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M12	2026-01-03 00:36:12.927721	2026-01-03 00:36:12.927721	46.15617793	-0.15405893	\N
342	1	CHET-M-13	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M13	2026-01-03 00:36:12.944956	2026-01-03 00:36:12.944956	46.15615935	-0.15398383	\N
344	1	CHET-M-15	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M15	2026-01-03 00:36:12.978425	2026-01-03 00:36:12.978425	46.15613334	-0.15382826	\N
345	1	CHET-M-16	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M16	2026-01-03 00:36:12.994991	2026-01-03 00:36:12.994991	46.15612219	-0.15375853	\N
346	1	CHET-M-17	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M17	2026-01-03 00:36:13.010581	2026-01-03 00:36:13.010581	46.15611290	-0.15368074	\N
347	1	CHET-N-01	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N1	2026-01-03 00:36:13.028202	2026-01-03 00:36:13.028202	46.15628012	-0.15493065	\N
348	1	CHET-N-02	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N2	2026-01-03 00:36:13.045605	2026-01-03 00:36:13.045605	46.15626711	-0.15485287	\N
349	1	CHET-N-03	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N3	2026-01-03 00:36:13.061595	2026-01-03 00:36:13.061595	46.15624853	-0.15478581	\N
282	1	CHET-I-06	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	I6	2026-01-03 00:36:11.927089	2026-01-03 00:36:11.927089	46.15642132	-0.15433252	\N
283	1	CHET-I-07	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	I7	2026-01-03 00:36:11.943673	2026-01-03 00:36:11.943673	46.15641018	-0.15424937	\N
285	1	CHET-I-09	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	I9	2026-01-03 00:36:11.978167	2026-01-03 00:36:11.978167	46.15638045	-0.15409917	\N
354	1	CHET-N-08	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N8	2026-01-03 00:36:13.145051	2026-01-03 00:36:13.145051	46.15618165	-0.15439957	\N
355	1	CHET-N-09	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N9	2026-01-03 00:36:13.162152	2026-01-03 00:36:13.162152	46.15617050	-0.15431911	\N
356	1	CHET-N-10	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N10	2026-01-03 00:36:13.179058	2026-01-03 00:36:13.179058	46.15615564	-0.15424401	\N
357	1	CHET-N-11	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N11	2026-01-03 00:36:13.195026	2026-01-03 00:36:13.195026	46.15614821	-0.15417963	\N
358	1	CHET-N-12	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N12	2026-01-03 00:36:13.211954	2026-01-03 00:36:13.211954	46.15612963	-0.15410453	\N
359	1	CHET-N-13	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N13	2026-01-03 00:36:13.228355	2026-01-03 00:36:13.228355	46.15611476	-0.15401602	\N
360	1	CHET-N-14	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N14	2026-01-03 00:36:13.245275	2026-01-03 00:36:13.245275	46.15610176	-0.15393823	\N
361	1	CHET-N-15	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N15	2026-01-03 00:36:13.260443	2026-01-03 00:36:13.260443	46.15608503	-0.15387386	\N
363	1	CHET-N-17	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N17	2026-01-03 00:36:13.294056	2026-01-03 00:36:13.294056	46.15606274	-0.15371829	\N
365	1	CHET-N-19	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N19	2026-01-03 00:36:13.331553	2026-01-03 00:36:13.331553	46.15602930	-0.15357882	\N
75	2	MOJE-A-16	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	16A	2026-01-03 00:36:08.413149	2026-01-03 00:36:08.413149	46.13936832	-0.16888082	\N
104	2	MOJE-A-19	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	19A	2026-01-03 00:36:08.929063	2026-01-03 00:36:08.929063	46.13922522	-0.16898811	\N
242	1	CHET-C-01	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	C1	2026-01-03 00:36:11.245398	2026-01-03 00:36:11.245398	46.15676318	-0.15443981	\N
154	2	MOJE-A-23	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23A	2026-01-03 00:36:09.760579	2026-01-03 00:36:09.760579	46.13903937	-0.16912490	\N
202	2	MOJE-A-26	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26A	2026-01-03 00:36:10.566091	2026-01-03 00:36:10.566091	46.13889440	-0.16921878	\N
255	1	CHET-F-02	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	F2	2026-01-03 00:36:11.479169	2026-01-03 00:36:11.479169	46.15660712	-0.15450954	\N
262	1	CHET-G-03	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	G3	2026-01-03 00:36:11.597209	2026-01-03 00:36:11.597209	46.15654952	-0.15446663	\N
275	1	CHET-H-08	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	H8	2026-01-03 00:36:11.810402	2026-01-03 00:36:11.810402	46.15643990	-0.15413940	\N
281	1	CHET-I-05	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	I5	2026-01-03 00:36:11.911364	2026-01-03 00:36:11.911364	46.15643619	-0.15441030	\N
284	1	CHET-I-08	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	I8	2026-01-03 00:36:11.961022	2026-01-03 00:36:11.961022	46.15639531	-0.15417427	\N
291	1	CHET-J-04	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	J4	2026-01-03 00:36:12.093673	2026-01-03 00:36:12.093673	46.15641203	-0.15453368	\N
297	1	CHET-J-10	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	J10	2026-01-03 00:36:12.195712	2026-01-03 00:36:12.195712	46.15632843	-0.15406698	\N
310	1	CHET-K-11	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K11	2026-01-03 00:36:12.411316	2026-01-03 00:36:12.411316	46.15627269	-0.15403479	\N
317	1	CHET-L-04	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L4	2026-01-03 00:36:12.529009	2026-01-03 00:36:12.529009	46.15631914	-0.15461415	\N
324	1	CHET-L-11	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L11	2026-01-03 00:36:12.643678	2026-01-03 00:36:12.643678	46.15623181	-0.15408307	\N
330	1	CHET-M-01	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M1	2026-01-03 00:36:12.744093	2026-01-03 00:36:12.744093	46.15631728	-0.15489042	\N
337	1	CHET-M-08	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M8	2026-01-03 00:36:12.860934	2026-01-03 00:36:12.860934	46.15622624	-0.15434861	\N
350	1	CHET-N-04	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N4	2026-01-03 00:36:13.07825	2026-01-03 00:36:13.07825	46.15623739	-0.15469998	\N
351	1	CHET-N-05	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N5	2026-01-03 00:36:13.095082	2026-01-03 00:36:13.095082	46.15622252	-0.15462488	\N
352	1	CHET-N-06	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N6	2026-01-03 00:36:13.111132	2026-01-03 00:36:13.111132	46.15620766	-0.15455246	\N
353	1	CHET-N-07	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N7	2026-01-03 00:36:13.128605	2026-01-03 00:36:13.128605	46.15619465	-0.15448272	\N
42	2	MOJE-B-11	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	11B	2026-01-03 00:36:07.869806	2026-01-03 00:36:07.869806	46.13959135	-0.16863674	\N
105	2	MOJE-B-19	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	19B	2026-01-03 00:36:08.945132	2026-01-03 00:36:08.945132	46.13920106	-0.16892105	\N
221	2	MOJE-B-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27B	2026-01-03 00:36:10.894025	2026-01-03 00:36:10.894025	46.13882006	-0.16917586	\N
43	2	MOJE-C-11	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	11C	2026-01-03 00:36:07.886215	2026-01-03 00:36:07.886215	46.13955789	-0.16857237	\N
106	2	MOJE-C-19	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	19C	2026-01-03 00:36:08.960172	2026-01-03 00:36:08.960172	46.13916760	-0.16885132	\N
156	2	MOJE-C-23	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23C	2026-01-03 00:36:09.796162	2026-01-03 00:36:09.796162	46.13897989	-0.16898274	\N
109	2	MOJE-F-19	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	19F	2026-01-03 00:36:09.011722	2026-01-03 00:36:09.011722	46.13908326	-0.16866367	\N
63	2	MOJE-D-14	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	14D	2026-01-03 00:36:08.216109	2026-01-03 00:36:08.216109	46.13937690	-0.16861271	\N
118	2	MOJE-D-20	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	20D	2026-01-03 00:36:09.161556	2026-01-03 00:36:09.161556	46.13909069	-0.16883802	\N
172	2	MOJE-D-24	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24D	2026-01-03 00:36:10.061806	2026-01-03 00:36:10.061806	46.13889369	-0.16895335	\N
57	2	MOJE-E-13	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	13E	2026-01-03 00:36:08.117637	2026-01-03 00:36:08.117637	46.13939921	-0.16850811	\N
206	2	MOJE-E-26	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26E	2026-01-03 00:36:10.631081	2026-01-03 00:36:10.631081	46.13877846	-0.16895067	\N
112	2	MOJE-I-19	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	19I	2026-01-03 00:36:09.061883	2026-01-03 00:36:09.061883	46.13899776	-0.16847055	\N
66	2	MOJE-G-14	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	14G	2026-01-03 00:36:08.2652	2026-01-03 00:36:08.2652	46.13930256	-0.16842764	\N
110	2	MOJE-G-19	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	19G	2026-01-03 00:36:09.027719	2026-01-03 00:36:09.027719	46.13905352	-0.16859125	\N
146	2	MOJE-G-22	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22G	2026-01-03 00:36:09.6278	2026-01-03 00:36:09.6278	46.13891599	-0.16870122	\N
101	2	MOJE-H-18	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	18H	2026-01-03 00:36:08.874704	2026-01-03 00:36:08.874704	46.13907025	-0.16849738	\N
227	2	MOJE-H-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27H	2026-01-03 00:36:10.995118	2026-01-03 00:36:10.995118	46.13864650	-0.16879510	\N
210	2	MOJE-I-26	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26I	2026-01-03 00:36:10.702187	2026-01-03 00:36:10.702187	46.13866880	-0.16869050	\N
17	2	MOJE-C-05	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	5C	2026-01-03 00:36:07.434489	2026-01-03 00:36:07.434489	46.13984968	-0.16836584	\N
249	1	CHET-E-01	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	E1	2026-01-03 00:36:11.384827	2026-01-03 00:36:11.384827	46.15666657	-0.15453368	\N
124	2	MOJE-J-20	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	20J	2026-01-03 00:36:09.263887	2026-01-03 00:36:09.263887	46.13892528	-0.16843837	\N
164	2	MOJE-K-23	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23K	2026-01-03 00:36:09.92738	2026-01-03 00:36:09.92738	46.13874686	-0.16846519	\N
139	2	MOJE-M-21	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21M	2026-01-03 00:36:09.513285	2026-01-03 00:36:09.513285	46.13878403	-0.16826939	\N
201	2	MOJE-Q-25	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25Q	2026-01-03 00:36:10.547681	2026-01-03 00:36:10.547681	46.13847551	-0.16812723	\N
231	2	MOJE-L-27	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27L	2026-01-03 00:36:11.061713	2026-01-03 00:36:11.061713	46.13852941	-0.16853224	\N
336	1	CHET-M-07	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M7	2026-01-03 00:36:12.843764	2026-01-03 00:36:12.843764	46.15624482	-0.15442640	\N
343	1	CHET-M-14	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M14	2026-01-03 00:36:12.960918	2026-01-03 00:36:12.960918	46.15614449	-0.15391141	\N
362	1	CHET-N-16	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N16	2026-01-03 00:36:13.276199	2026-01-03 00:36:13.276199	46.15607760	-0.15379876	\N
238	2	MOJE-S-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27S	2026-01-03 00:36:11.177627	2026-01-03 00:36:11.177627	46.13832497	-0.16806554	\N
196	2	MOJE-L-25	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25L	2026-01-03 00:36:10.463674	2026-01-03 00:36:10.463674	46.13862048	-0.16846251	\N
234	2	MOJE-O-27	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27O	2026-01-03 00:36:11.111667	2026-01-03 00:36:11.111667	46.13843091	-0.16832571	\N
364	1	CHET-N-18	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	N18	2026-01-03 00:36:13.314629	2026-01-03 00:36:13.314629	46.15604416	-0.15364856	\N
15	2	MOJE-A-05	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	5A	2026-01-03 00:36:07.402796	2026-01-03 00:36:07.402796	46.13990729	-0.16849726	\N
47	2	MOJE-A-12	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	12A	2026-01-03 00:36:07.950167	2026-01-03 00:36:07.950167	46.13957462	-0.16874671	\N
37	2	MOJE-B-10	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	10B	2026-01-03 00:36:07.783978	2026-01-03 00:36:07.783978	46.13963595	-0.16860455	\N
76	2	MOJE-B-16	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	16B	2026-01-03 00:36:08.429166	2026-01-03 00:36:08.429166	46.13934416	-0.16881376	\N
186	2	MOJE-B-25	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	25B	2026-01-03 00:36:10.296571	2026-01-03 00:36:10.296571	46.13890927	-0.16911417	\N
161	2	MOJE-H-23	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23H	2026-01-03 00:36:09.877575	2026-01-03 00:36:09.877575	46.13883607	-0.16866367	\N
176	2	MOJE-H-24	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24H	2026-01-03 00:36:10.127645	2026-01-03 00:36:10.127645	46.13878589	-0.16869586	\N
239	1	CHET-A-01	Chêne pubescent (P)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	A1	2026-01-03 00:36:11.194189	2026-01-03 00:36:11.194189	46.15685220	-0.15436060	\N
247	1	CHET-D-03	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	D3	2026-01-03 00:36:11.354035	2026-01-03 00:36:11.354035	46.15668701	-0.15434325	\N
257	1	CHET-F-04	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	F4	2026-01-03 00:36:11.512557	2026-01-03 00:36:11.512557	46.15658111	-0.15435129	\N
268	1	CHET-H-01	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	H1	2026-01-03 00:36:11.694182	2026-01-03 00:36:11.694182	46.15653094	-0.15467316	\N
270	1	CHET-H-03	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	H3	2026-01-03 00:36:11.727717	2026-01-03 00:36:11.727717	46.15650679	-0.15451759	\N
277	1	CHET-I-01	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	I1	2026-01-03 00:36:11.843836	2026-01-03 00:36:11.843836	46.15649007	-0.15471607	\N
288	1	CHET-J-01	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	J1	2026-01-03 00:36:12.044738	2026-01-03 00:36:12.044738	46.15644919	-0.15475363	\N
296	1	CHET-J-09	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	J9	2026-01-03 00:36:12.177156	2026-01-03 00:36:12.177156	46.15633957	-0.15414476	\N
304	1	CHET-K-05	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K5	2026-01-03 00:36:12.311848	2026-01-03 00:36:12.311848	46.15635072	-0.15448809	\N
311	1	CHET-K-12	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	K12	2026-01-03 00:36:12.427128	2026-01-03 00:36:12.427128	46.15625597	-0.15396506	\N
316	1	CHET-L-03	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	L3	2026-01-03 00:36:12.512711	2026-01-03 00:36:12.512711	46.15633772	-0.15469998	\N
333	1	CHET-M-04	Chênes vert (V)	Tuber melanosporum	2016-12-01	\N	Bon	\N	2.5	\N	M4	2026-01-03 00:36:12.794201	2026-01-03 00:36:12.794201	46.15628569	-0.15465707	\N
366	1	CHET-TEST	Tilleul	Tuber brumale	2026-01-02	\N	Mort	\N	0.5	\N	\N	2026-01-03 21:17:49.260791	2026-01-03 21:17:49.260791	\N	\N	2026-01-03 21:18:33.177056
29	2	MOJE-D-08	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	8D	2026-01-03 00:36:07.642075	2026-01-03 00:36:07.642075	46.13967684	-0.16840070	\N
39	2	MOJE-D-10	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	10D	2026-01-03 00:36:07.817679	2026-01-03 00:36:07.817679	46.13957648	-0.16847312	\N
56	2	MOJE-D-13	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	13D	2026-01-03 00:36:08.101807	2026-01-03 00:36:08.101807	46.13942894	-0.16857516	\N
157	2	MOJE-D-23	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23D	2026-01-03 00:36:09.811187	2026-01-03 00:36:09.811187	46.13894572	-0.16892921	\N
108	2	MOJE-E-19	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	19E	2026-01-03 00:36:08.99375	2026-01-03 00:36:08.99375	46.13911113	-0.16872805	\N
119	2	MOJE-E-20	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	20E	2026-01-03 00:36:09.177667	2026-01-03 00:36:09.177667	46.13906467	-0.16876023	\N
160	2	MOJE-G-23	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	23G	2026-01-03 00:36:09.860125	2026-01-03 00:36:09.860125	46.13886952	-0.16872805	\N
134	2	MOJE-H-21	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	21H	2026-01-03 00:36:09.427655	2026-01-03 00:36:09.427655	46.13893643	-0.16859662	\N
212	2	MOJE-K-26	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	26K	2026-01-03 00:36:10.735061	2026-01-03 00:36:10.735061	46.13860189	-0.16855638	\N
152	2	MOJE-M-22	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22M	2026-01-03 00:36:09.727646	2026-01-03 00:36:09.727646	46.13873757	-0.16829353	\N
232	2	MOJE-M-27	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	27M	2026-01-03 00:36:11.077332	2026-01-03 00:36:11.077332	46.13850525	-0.16846787	\N
182	2	MOJE-N-24	Chênes vert (V)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	24N	2026-01-03 00:36:10.229138	2026-01-03 00:36:10.229138	46.13860375	-0.16830426	\N
11	2	MOJE-C-03	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	3C	2026-01-03 00:36:07.33531	2026-01-03 00:36:07.33531	46.13993889	-0.16829073	\N
96	2	MOJE-C-18	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	18C	2026-01-03 00:36:08.764151	2026-01-03 00:36:08.764151	46.13921221	-0.16882181	\N
99	2	MOJE-F-18	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	18F	2026-01-03 00:36:08.839067	2026-01-03 00:36:08.839067	46.13912786	-0.16862612	\N
102	2	MOJE-I-18	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	18I	2026-01-03 00:36:08.893572	2026-01-03 00:36:08.893572	46.13904237	-0.16843300	\N
151	2	MOJE-L-22	Charmes (C)	Tuber melanosporum	2018-12-01	\N	Bon	\N	2.5	\N	22L	2026-01-03 00:36:09.710173	2026-01-03 00:36:09.710173	46.13876545	-0.16836327	\N
\.


--
-- Data for Name: caveurs; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.caveurs (id, nom, created_at, updated_at) FROM stdin;
2	Daniel	2026-01-03 00:10:00.018173	2026-01-03 00:10:00.018173
1	Marc	2026-01-01 17:16:49.500515	2026-01-03 17:45:01.187706
\.


--
-- Data for Name: chiens; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.chiens (id, nom, race, created_at, updated_at) FROM stdin;
1	Sweetie	Lagotto Romagnolo	2026-01-01 17:17:58.823905	2026-01-01 17:17:58.823905
2	Lyxi	\N	2026-01-03 00:10:03.346411	2026-01-03 00:10:03.346411
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.clients (id, type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays, siret, notes, date_premier_achat, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: commandes; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.commandes (id, client_id, numero_commande, date_commande, date_livraison_demandee, poids_grammes, calibre, qualite, maturite, prix_unitaire_kg, montant_total, statut, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: historique; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.historique (id, table_name, record_id, action, old_data, new_data, user_name, "timestamp") FROM stdin;
\.


--
-- Data for Name: intervention_details; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.intervention_details (id, intervention_id, volume_eau_m3, volume_eau_par_arbre_l, methode_irrigation, source_eau, debit_l_h, frequence_irrigation, humidite_sol_avant, humidite_sol_apres, pression_bar, categorie_traitement, nom_commercial, matiere_active, numero_amm, dose_produit_ha, dose_produit_arbre, concentration, volume_bouillie_l, surface_traitee_ha, methode_application, cible_traitement, delai_avant_recolte_jours, conditions_application, equipement_protection, zone_non_traitee_m, fabricant, type_amendement, nom_produit_amendement, composition_npk, composition_cao, composition_mgo, composition_autres, dose_kg_ha, dose_kg_arbre, quantite_totale_kg, ph_sol_avant, ph_sol_apres, methode_epandage, incorporation, profondeur_incorporation_cm, origine_produit, certification_bio, numero_lot, type_taille, intensite_taille, hauteur_avant_cm, hauteur_apres_cm, diametre_couronne_avant_m, diametre_couronne_apres_m, branches_supprimees, diametre_max_coupe_cm, volume_residus_m3, destination_residus, outils_taille, desinfection_outils, produit_desinfection, type_travail_sol, profondeur_travail_cm, largeur_travail_m, outil_travail_sol, zone_travaillee, distance_tronc_m, etat_sol_avant, enherbement_avant, enherbement_apres, presence_cailloux, type_observation, etat_brule, diametre_brule_m, evolution_brule, presence_ascomes, nombre_ascomes, indice_mycorhization, symptomes_observes, ravageurs_identifies, degats_constates, niveau_urgence, preconisations, type_paillage, epaisseur_cm, surface_paillee_m2, quantite_paillage_m3, origine_paillage, espece_plantee, variete_plant, fournisseur_plant, type_mycorhization, certification_plant, numero_lot_plant, taille_plant_cm, diametre_collet_mm, dimensions_trou_cm, amendement_plantation, tuteur, protection_gibier, type_protection, arrosage_plantation_l, laboratoire, reference_analyse, profondeur_prelevement_cm, nombre_echantillons, resultats_ph, resultats_calcaire_actif, resultats_matiere_organique, resultats_azote, resultats_phosphore, resultats_potassium, resultats_cec, interpretation, type_piege, cible_piegeage, nombre_pieges, captures, densite_pieges_ha, date_releve, action_suite, type_inoculum, espece_truffe_inoculation, quantite_inoculum, methode_inoculation, fournisseur_inoculum, photos_paths, documents_paths, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: interventions; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.interventions (id, type_intervention_id, parcelle_id, arbre_id, date_prevue, date_realisee, duree_minutes, personnel, description, cout, statut, meteo, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: login_attempts; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.login_attempts (id, email, ip_address, user_agent, success, failure_reason, attempted_at) FROM stdin;
1	admin@truffiere.local	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	f	invalid_password	2026-01-02 18:06:29.142729
2	admin@truffiere.local	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 18:11:58.066156
3	admin@truffiere.local	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 18:13:09.984134
4	burbansamuel@gmail.com	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 18:14:06.985955
5	burbansamuel@gmail.com	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 18:16:14.731311
6	admin@truffiere.local	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 18:30:47.91796
7	burbansamuel@gmail.com	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 18:31:28.409805
8	admin@truffiere.local	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 18:39:54.655227
9	burbansamuel@gmail.com	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 18:40:23.832616
10	admin@truffiere.local	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 18:41:07.696957
11	admin@truffiere.local	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 18:42:12.951837
12	burbansamuel@gmail.com	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 18:42:43.951698
13	burbansamuel@gmail.com	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 20:42:03.216747
14	admin@truffiere.local	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	t	\N	2026-01-02 22:52:30.685434
15	admin@truffiere.local	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	t	\N	2026-01-03 02:06:04.250377
16	burbansamuel@gmail.com	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	t	\N	2026-01-03 02:07:22.593661
17	burbansamuel@gmail.com	192.168.1.254	Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/146.1  Mobile/15E148 Safari/604.1	t	\N	2026-01-03 03:12:45.464162
18	admin@truffiere.local	192.168.1.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	t	\N	2026-01-03 11:31:46.272091
\.


--
-- Data for Name: parametres; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.parametres (id, cle, valeur, description, updated_at) FROM stdin;
9	colonnes_export_interventions	["date_prevue", "date_realisee", "type_nom", "parcelle_nom", "arbre_numero", "statut", "personnel", "cout", "description", "notes"]	Colonnes exportées par défaut pour les interventions	2026-01-01 17:58:20.523843
7	colonnes_export_parcelles	["nom", "surface_ha", "type_sol", "ph_sol", "exposition", "notes"]	Colonnes exportées par défaut pour les parcelles	2026-01-01 17:58:20.538974
10	colonnes_export_recoltes	["date_recolte", "parcelle_nom", "arbre_numero", "poids_grammes", "qualite", "calibre", "maturite", "prix_kg", "caveur", "notes"]	Colonnes exportées par défaut pour les récoltes	2026-01-01 17:58:20.554505
12	colonnes_export_ventes	["date_vente", "numero_facture", "client_nom", "quantite_grammes", "prix_unitaire_kg", "montant_total", "mode_paiement", "statut", "notes"]	Colonnes exportées par défaut pour les ventes	2026-01-01 17:58:20.571053
2	colonnes_affichees_arbres	["numero", "espece", "variete_truffe", "parcelle_nom", "etat", "date_plantation", "circonference_cm"]	Colonnes affichées par défaut pour les arbres	2026-01-01 17:58:20.389638
5	colonnes_affichees_clients	["nom", "type", "email", "telephone", "ville"]	Colonnes affichées par défaut pour les clients	2026-01-01 17:58:20.40851
3	colonnes_affichees_interventions	["date_prevue", "type_nom", "parcelle_nom", "arbre_numero", "statut", "personnel", "cout"]	Colonnes affichées par défaut pour les interventions	2026-01-01 17:58:20.424345
1	colonnes_affichees_parcelles	["nom"]	Colonnes affichées par défaut pour les parcelles	2026-01-01 17:58:20.439823
4	colonnes_affichees_recoltes	["date_recolte", "parcelle_nom", "arbre_numero", "poids_grammes", "qualite", "calibre", "prix_kg"]	Colonnes affichées par défaut pour les récoltes	2026-01-01 17:58:20.455958
6	colonnes_affichees_ventes	["date_vente", "client_nom", "quantite_grammes", "prix_unitaire_kg", "montant_total", "statut"]	Colonnes affichées par défaut pour les ventes	2026-01-01 17:58:20.473558
8	colonnes_export_arbres	["numero", "espece", "variete_truffe", "parcelle_nom", "etat", "date_plantation", "circonference_cm", "hauteur_m", "notes"]	Colonnes exportées par défaut pour les arbres	2026-01-01 17:58:20.489314
11	colonnes_export_clients	["nom", "prenom", "raison_sociale", "type", "email", "telephone", "adresse", "code_postal", "ville", "pays", "siret", "notes"]	Colonnes exportées par défaut pour les clients	2026-01-01 17:58:20.507876
58	facture_bic	""	\N	2026-01-02 23:04:53.406366
55	facture_conditions_paiement	"Paiement à réception"	\N	2026-01-02 23:04:53.433711
56	facture_delai_paiement	30	\N	2026-01-02 23:04:53.454798
57	facture_iban	""	\N	2026-01-02 23:04:53.475188
59	facture_mentions_legales	"TVA non applicable, art. 293 B du CGI"	\N	2026-01-02 23:04:53.495492
53	facture_prefixe	"FAC"	\N	2026-01-02 23:04:53.517899
37	app_date_format	"DD/MM/YYYY"	\N	2026-01-02 23:04:53.10901
39	app_devise	"EUR"	\N	2026-01-02 23:04:53.136549
38	app_langue	"fr"	\N	2026-01-02 23:04:53.159529
69	app_theme	"#2c5f2d"	\N	2026-01-02 23:04:53.184176
63	commande_alerte_delai	3	\N	2026-01-02 23:04:53.204134
73	dashboard_refresh_interval	60	\N	2026-01-02 23:04:53.223543
41	entreprise_adresse	"5, Rue Chalon"	\N	2026-01-02 23:04:53.242809
42	entreprise_code_postal	"79170"	\N	2026-01-02 23:04:53.263658
50	entreprise_email	""	\N	2026-01-02 23:04:53.284836
40	entreprise_nom	"MA Truffe"	\N	2026-01-02 23:04:53.305134
51	entreprise_siret	""	\N	2026-01-02 23:04:53.324864
44	entreprise_telephone	"06 81 61 89 11"	\N	2026-01-02 23:04:53.343624
52	entreprise_tva	""	\N	2026-01-02 23:04:53.365221
43	entreprise_ville	"Lusseray"	\N	2026-01-02 23:04:53.386416
54	facture_tva_taux	5.5	\N	2026-01-02 23:04:53.541606
74	historique_retention_jours	365	\N	2026-01-02 23:04:53.561796
65	recolte_calibres	"[\\"Petit (moins de 20g)\\",\\"Moyen (20-50g)\\",\\"Gros (50-100g)\\",\\"Très gros (plus de 100g)\\"]"	\N	2026-01-02 23:04:53.585368
66	recolte_maturites	"[\\"Immature\\",\\"À point\\",\\"Mature\\",\\"Très mature\\"]"	\N	2026-01-02 23:04:53.605197
64	recolte_qualites	"[\\"Extra\\",\\"1er choix\\",\\"2ème choix\\",\\"Brisures\\"]"	\N	2026-01-02 23:04:53.625709
67	saison_debut_mois	11	\N	2026-01-02 23:04:53.646608
68	saison_fin_mois	3	\N	2026-01-02 23:04:53.667727
60	stock_alerte_critique	100	\N	2026-01-02 23:04:53.688949
61	stock_alerte_faible	500	\N	2026-01-02 23:04:53.709228
62	stock_prix_moyen_defaut	800	\N	2026-01-02 23:04:53.72923
\.


--
-- Data for Name: parcelles; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.parcelles (id, nom, surface_ha, geometrie, type_sol, ph_sol, exposition, date_creation, notes) FROM stdin;
1	Champs Chetif	0.52	0103000020E610000001000000090000000000C4FF8DD6C3BF30C18A24001447400100C4FFCFC1C3BFEC1F802E161447400100C4FF97BDC3BFF8742DAD111447400200C4FF6DBAC3BF711C75770B1447400100C4FF27B5C3BF399C6ABE051447400100E27F45AEC3BF7D7D4598FF1347400100E27F2CA9C3BFD8B17274FB1347400000E2FF94A2C3BF28059895F61347400000C4FF8DD6C3BF30C18A2400144740	Argilo-calcaire	8.0	Sud	2025-12-29 11:47:49.050329	
2	Champs des mojettes	1.00	0103000020E6100000010000000D0000000100C4FF998CC5BFA8184771F11147400100C4FF3488C5BF048CB7FCEA1147400100C4FF9C89C5BF3926B837E21147400100C4FF508AC5BF508012B1D91147400100C4FFAA8AC5BFD5B9F730D01147400000C4FFDA87C5BF44D46860C41147400100C4FFDD84C5BF0557B830BD1147400100C4FF4B80C5BFD36B663AB21147400100C4FF89ABC5BF47180A79C51147400100E27F0FA6C5BF7121D86CCE1147400100E27F079FC5BF1A184D82D91147400100E2FF8096C5BF2D5C2F91E51147400100C4FF998CC5BFA8184771F1114740	Argilo-calcaire	8.2	Sud-Est	2025-12-29 11:47:49.050329	
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: preferences_utilisateur; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.preferences_utilisateur (id, user_id, colonnes_affichees, colonnes_export, created_at, updated_at) FROM stdin;
1	default	{}	{}	2025-12-31 15:55:12.187243	2026-01-01 17:58:12.033526
7	2	{}	{}	2026-01-02 18:14:21.13753	2026-01-02 18:14:21.13753
8	1	{}	{}	2026-01-02 18:41:11.287925	2026-01-02 18:41:11.287925
\.


--
-- Data for Name: produits_phyto; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.produits_phyto (id, nom_commercial, matiere_active, numero_amm, categorie, fabricant, dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio, phrase_risque, conseils_utilisation, actif, created_at) FROM stdin;
1	Bouillie bordelaise	Sulfate de cuivre	\N	Fongicide	\N	10-15 kg	21	\N	t	\N	\N	t	2026-01-03 18:09:46.268729
2	Soufre mouillable	Soufre	\N	Fongicide	\N	5-10 kg	5	\N	t	\N	\N	t	2026-01-03 18:09:46.268729
3	Huile de neem	Azadirachtine	\N	Insecticide	\N	2-3 L	3	\N	t	\N	\N	t	2026-01-03 18:09:46.268729
4	Bacillus thuringiensis	Bt	\N	Insecticide	\N	0.5-1 kg	0	\N	t	\N	\N	t	2026-01-03 18:09:46.268729
5	Pyrèthre naturel	Pyréthrines	\N	Insecticide	\N	0.5-1 L	2	\N	t	\N	\N	t	2026-01-03 18:09:46.268729
\.


--
-- Data for Name: recoltes; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.recoltes (id, parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, profondeur_cm, caveur, chien, conditions_meteo, temperature_sol, notes, created_at, exposition) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.refresh_tokens (id, user_id, token_hash, device_info, ip_address, expires_at, revoked, revoked_at, revoked_reason, created_at) FROM stdin;
1	1	e7c12308e21f779c967aa637efc974b71c4ca696fab66706426820d9d424681a	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 18:11:58.035	t	2026-01-02 18:13:01.010821	logout	2026-01-02 18:11:58.035974
2	1	6dde8beb803e6390c7cd04b16cfa2f2fdeaa03874fec6e5c6a8bc196d961089f	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 18:13:09.974	t	2026-01-02 18:13:56.372898	logout	2026-01-02 18:13:09.974986
3	2	35f8ebf403d5ea164b51cc6a6ee41d39026bb9b09a3d7b6f9cd31df89e66e945	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 18:14:06.976	t	2026-01-02 18:15:56.686539	logout	2026-01-02 18:14:06.977217
4	2	a492127ddf4f2753fb5a6ec6b0769acb1ebd9e476dc68b88f4d3c7b9268a619a	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 18:16:14.721	t	2026-01-02 18:30:41.042683	logout	2026-01-02 18:16:14.721644
5	1	6f7130105fb6203d7ba3c053e3154fcc939bc0c0a1311071d15b8fefeaea2cc8	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 18:30:47.907	t	2026-01-02 18:31:07.435257	logout	2026-01-02 18:30:47.90837
6	2	20f40869d6407fea601646483abc55ce6ca2359ee8e4ec6e8266528760c3a58a	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 18:31:28.4	t	2026-01-02 18:39:47.39491	logout	2026-01-02 18:31:28.400559
7	1	29a795d1cc73561208da60ac6b7ee43e21f33d06154731ab72c9ba540bbfcfc0	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 18:39:54.644	t	2026-01-02 18:40:06.7556	logout	2026-01-02 18:39:54.645447
8	2	6425bf2ff436b4d75aebf15ed6650bd9df739b40043744034d00040824f7ec36	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 18:40:23.822	t	2026-01-02 18:41:00.40214	logout	2026-01-02 18:40:23.823155
9	1	658f2e0e50eaee94635432670a9ef888c219fa8d0734f95998b5e3a421d18b73	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 18:41:07.687	t	2026-01-02 18:41:57.136724	logout	2026-01-02 18:41:07.687884
10	1	0eccb01c1da70c616b4226011ea34b101bc91cea5b98268f340a3336d891f6fa	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 18:42:12.941	t	2026-01-02 18:42:37.845953	logout	2026-01-02 18:42:12.942203
11	2	c7fa6fa36c23716346e816662f225da2b135262cd557d238bad1bdca8d3a5fc1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 18:42:43.943	t	2026-01-02 19:57:13.506536	logout	2026-01-02 18:42:43.943626
12	2	c6698baf208935faa4791782f9ee92daf7d681fb50d2dfdec4909768595bf52f	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 20:42:03.085	t	2026-01-02 22:52:22.768631	logout	2026-01-02 20:42:03.0866
14	1	ce384c3ea190caac4b0983d1bf5727cefce71dc7ef18661d385cdbbf42d7e47a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	192.168.1.254	2026-01-10 02:06:04.24	t	2026-01-03 02:07:21.256897	logout	2026-01-03 02:06:04.240935
15	2	cf524c3e6544dc0a6a115df2e92a0a63154477e35fc1fb6195be3846dee9275c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	192.168.1.254	2026-01-10 02:07:22.584	t	2026-01-03 02:09:46.187283	logout	2026-01-03 02:07:22.584953
13	1	0a188a044be6ff99446b87458b1a36301af0ccb0707d267d3cef33241ff668a3	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 22:52:30.66	t	2026-01-03 02:10:21.767337	logout	2026-01-02 22:52:30.661069
16	2	dabc56307ede2ee713f8e98d0345b1cd724453db104ee17f5e74c9c43588d67c	Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/146.1  Mobile/15E148 Safari/604.1	192.168.1.254	2026-01-10 03:12:45.336	f	\N	\N	2026-01-03 03:12:45.337108
17	1	a16fc94c6c0dd4ec8f95ba29c0420d12eab9265253e98982813e7e216395f3e4	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0	192.168.1.254	2026-01-10 11:31:46.236	f	\N	\N	2026-01-03 11:31:46.237243
\.


--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- Data for Name: types_intervention; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.types_intervention (id, nom, description, couleur) FROM stdin;
1	Irrigation	Arrosage des arbres	#3498db
2	Taille	Taille des arbres truffiers	#e74c3c
3	Travail du sol	Labour, binage, griffage	#f39c12
4	Amendement	Apport de calcaire, compost	#27ae60
5	Traitement	Traitement phytosanitaire	#9b59b6
6	Récolte	Cavage des truffes	#1abc9c
7	Observation	Surveillance et notes	#95a5a6
8	Fertilisation foliaire	Apport de nutriments par pulvérisation sur le feuillage	#8BC34A
9	Paillage	Couverture du sol (BRF, paille, copeaux)	#795548
10	Plantation	Mise en terre d'un nouvel arbre mycorhizé	#4CAF50
11	Remplacement	Remplacement d'un arbre mort ou improductif	#FF9800
12	Analyse de sol	Prélèvement d'échantillons pour analyse en laboratoire	#607D8B
13	Piégeage	Installation ou relevé de pièges (mouches, rongeurs)	#E91E63
14	Inoculation	Ré-inoculation mycorhizienne	#9C27B0
15	Protection	Travaux sur clôtures, protection contre le gibier	#455A64
16	Désherbage	Désherbage manuel ou mécanique	#8D6E63
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.user_sessions (id, user_id, session_id, ip_address, user_agent, device_type, last_activity, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.users (id, email, password_hash, nom, prenom, role, is_active, email_verified, last_login, password_changed_at, failed_login_attempts, locked_until, created_at, updated_at) FROM stdin;
2	burbansamuel@gmail.com	$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O	Samuel	BURBAN	user	t	t	2026-01-03 03:12:45.457847	\N	0	\N	2026-01-02 18:13:44.355252	2026-01-03 03:12:45.457847
1	admin@truffiere.local	$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu	Administrateur	Système	admin	t	t	2026-01-03 11:31:46.266326	\N	0	\N	2026-01-02 16:29:54.193672	2026-01-03 11:31:46.266326
\.


--
-- Data for Name: ventes; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.ventes (id, client_id, recolte_id, date_vente, quantite_grammes, prix_unitaire_kg, montant_total, mode_paiement, statut, numero_facture, notes, created_at, commande_id) FROM stdin;
\.


--
-- Data for Name: geocode_settings; Type: TABLE DATA; Schema: tiger; Owner: unstuffed1004
--

COPY tiger.geocode_settings (name, setting, unit, category, short_desc) FROM stdin;
\.


--
-- Data for Name: pagc_gaz; Type: TABLE DATA; Schema: tiger; Owner: unstuffed1004
--

COPY tiger.pagc_gaz (id, seq, word, stdword, token, is_custom) FROM stdin;
\.


--
-- Data for Name: pagc_lex; Type: TABLE DATA; Schema: tiger; Owner: unstuffed1004
--

COPY tiger.pagc_lex (id, seq, word, stdword, token, is_custom) FROM stdin;
\.


--
-- Data for Name: pagc_rules; Type: TABLE DATA; Schema: tiger; Owner: unstuffed1004
--

COPY tiger.pagc_rules (id, rule, is_custom) FROM stdin;
\.


--
-- Data for Name: topology; Type: TABLE DATA; Schema: topology; Owner: unstuffed1004
--

COPY topology.topology (id, name, srid, "precision", hasz) FROM stdin;
\.


--
-- Data for Name: layer; Type: TABLE DATA; Schema: topology; Owner: unstuffed1004
--

COPY topology.layer (topology_id, layer_id, schema_name, table_name, feature_column, feature_type, level, child_id) FROM stdin;
\.


--
-- Name: amendements_ref_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.amendements_ref_id_seq', 8, true);


--
-- Name: arbres_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.arbres_id_seq', 366, true);


--
-- Name: caveurs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.caveurs_id_seq', 2, true);


--
-- Name: chiens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.chiens_id_seq', 2, true);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.clients_id_seq', 1, true);


--
-- Name: commandes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.commandes_id_seq', 1, true);


--
-- Name: historique_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.historique_id_seq', 1820, true);


--
-- Name: intervention_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.intervention_details_id_seq', 5, true);


--
-- Name: interventions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.interventions_id_seq', 9, true);


--
-- Name: login_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.login_attempts_id_seq', 18, true);


--
-- Name: parametres_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.parametres_id_seq', 74, true);


--
-- Name: parcelles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.parcelles_id_seq', 8, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, false);


--
-- Name: preferences_utilisateur_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.preferences_utilisateur_id_seq', 8, true);


--
-- Name: produits_phyto_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.produits_phyto_id_seq', 5, true);


--
-- Name: recoltes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.recoltes_id_seq', 5, true);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.refresh_tokens_id_seq', 17, true);


--
-- Name: types_intervention_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.types_intervention_id_seq', 16, true);


--
-- Name: user_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.user_sessions_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: ventes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.ventes_id_seq', 10, true);


--
-- Name: topology_id_seq; Type: SEQUENCE SET; Schema: topology; Owner: unstuffed1004
--

SELECT pg_catalog.setval('topology.topology_id_seq', 1, false);


--
-- Name: amendements_ref amendements_ref_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.amendements_ref
    ADD CONSTRAINT amendements_ref_pkey PRIMARY KEY (id);


--
-- Name: arbres arbres_numero_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.arbres
    ADD CONSTRAINT arbres_numero_key UNIQUE (numero);


--
-- Name: arbres arbres_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.arbres
    ADD CONSTRAINT arbres_pkey PRIMARY KEY (id);


--
-- Name: caveurs caveurs_nom_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.caveurs
    ADD CONSTRAINT caveurs_nom_key UNIQUE (nom);


--
-- Name: caveurs caveurs_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.caveurs
    ADD CONSTRAINT caveurs_pkey PRIMARY KEY (id);


--
-- Name: chiens chiens_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.chiens
    ADD CONSTRAINT chiens_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: commandes commandes_numero_commande_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.commandes
    ADD CONSTRAINT commandes_numero_commande_key UNIQUE (numero_commande);


--
-- Name: commandes commandes_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.commandes
    ADD CONSTRAINT commandes_pkey PRIMARY KEY (id);


--
-- Name: historique historique_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.historique
    ADD CONSTRAINT historique_pkey PRIMARY KEY (id);


--
-- Name: intervention_details intervention_details_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.intervention_details
    ADD CONSTRAINT intervention_details_pkey PRIMARY KEY (id);


--
-- Name: interventions interventions_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.interventions
    ADD CONSTRAINT interventions_pkey PRIMARY KEY (id);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);


--
-- Name: parametres parametres_cle_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.parametres
    ADD CONSTRAINT parametres_cle_key UNIQUE (cle);


--
-- Name: parametres parametres_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.parametres
    ADD CONSTRAINT parametres_pkey PRIMARY KEY (id);


--
-- Name: parcelles parcelles_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.parcelles
    ADD CONSTRAINT parcelles_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: preferences_utilisateur preferences_utilisateur_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.preferences_utilisateur
    ADD CONSTRAINT preferences_utilisateur_pkey PRIMARY KEY (id);


--
-- Name: preferences_utilisateur preferences_utilisateur_user_id_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.preferences_utilisateur
    ADD CONSTRAINT preferences_utilisateur_user_id_key UNIQUE (user_id);


--
-- Name: produits_phyto produits_phyto_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.produits_phyto
    ADD CONSTRAINT produits_phyto_pkey PRIMARY KEY (id);


--
-- Name: recoltes recoltes_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.recoltes
    ADD CONSTRAINT recoltes_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: types_intervention types_intervention_nom_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.types_intervention
    ADD CONSTRAINT types_intervention_nom_key UNIQUE (nom);


--
-- Name: types_intervention types_intervention_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.types_intervention
    ADD CONSTRAINT types_intervention_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_session_id_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_id_key UNIQUE (session_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ventes ventes_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_pkey PRIMARY KEY (id);


--
-- Name: idx_arbres_deleted_at; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_arbres_deleted_at ON public.arbres USING btree (deleted_at);


--
-- Name: idx_arbres_parcelle; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_arbres_parcelle ON public.arbres USING btree (parcelle_id);


--
-- Name: idx_commandes_client; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_commandes_client ON public.commandes USING btree (client_id);


--
-- Name: idx_commandes_date; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_commandes_date ON public.commandes USING btree (date_commande);


--
-- Name: idx_commandes_statut; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_commandes_statut ON public.commandes USING btree (statut);


--
-- Name: idx_historique_table_record; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_historique_table_record ON public.historique USING btree (table_name, record_id);


--
-- Name: idx_intervention_details_intervention_id; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_intervention_details_intervention_id ON public.intervention_details USING btree (intervention_id);


--
-- Name: idx_interventions_arbre; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_interventions_arbre ON public.interventions USING btree (arbre_id);


--
-- Name: idx_interventions_date; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_interventions_date ON public.interventions USING btree (date_prevue);


--
-- Name: idx_interventions_parcelle; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_interventions_parcelle ON public.interventions USING btree (parcelle_id);


--
-- Name: idx_login_attempts_attempted_at; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_login_attempts_attempted_at ON public.login_attempts USING btree (attempted_at);


--
-- Name: idx_login_attempts_email; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_login_attempts_email ON public.login_attempts USING btree (email);


--
-- Name: idx_login_attempts_ip; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_login_attempts_ip ON public.login_attempts USING btree (ip_address);


--
-- Name: idx_password_reset_token_hash; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_password_reset_token_hash ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: idx_password_reset_user_id; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_password_reset_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_recoltes_arbre; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_recoltes_arbre ON public.recoltes USING btree (arbre_id);


--
-- Name: idx_recoltes_date; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_recoltes_date ON public.recoltes USING btree (date_recolte);


--
-- Name: idx_recoltes_exposition; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_recoltes_exposition ON public.recoltes USING btree (exposition);


--
-- Name: idx_recoltes_parcelle; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_recoltes_parcelle ON public.recoltes USING btree (parcelle_id);


--
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_user_sessions_expires_at; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);


--
-- Name: idx_user_sessions_session_id; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_user_sessions_session_id ON public.user_sessions USING btree (session_id);


--
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_ventes_client; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_ventes_client ON public.ventes USING btree (client_id);


--
-- Name: idx_ventes_commande_id; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_ventes_commande_id ON public.ventes USING btree (commande_id);


--
-- Name: idx_ventes_date; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_ventes_date ON public.ventes USING btree (date_vente);


--
-- Name: amendements_ref amendements_ref_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER amendements_ref_historique AFTER INSERT OR DELETE OR UPDATE ON public.amendements_ref FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER amendements_ref_historique ON amendements_ref; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER amendements_ref_historique ON public.amendements_ref IS 'Audit trail pour les modifications sur les références d''amendements';


--
-- Name: arbres arbres_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER arbres_historique AFTER INSERT OR DELETE OR UPDATE ON public.arbres FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: caveurs caveurs_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER caveurs_historique AFTER INSERT OR DELETE OR UPDATE ON public.caveurs FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER caveurs_historique ON caveurs; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER caveurs_historique ON public.caveurs IS 'Audit trail pour les modifications sur les caveurs';


--
-- Name: chiens chiens_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER chiens_historique AFTER INSERT OR DELETE OR UPDATE ON public.chiens FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER chiens_historique ON chiens; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER chiens_historique ON public.chiens IS 'Audit trail pour les modifications sur les chiens truffiers';


--
-- Name: clients clients_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER clients_historique AFTER INSERT OR DELETE OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER clients_historique ON clients; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER clients_historique ON public.clients IS 'Audit trail pour les modifications sur les clients';


--
-- Name: commandes commandes_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER commandes_historique AFTER INSERT OR DELETE OR UPDATE ON public.commandes FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: intervention_details intervention_details_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER intervention_details_historique AFTER INSERT OR DELETE OR UPDATE ON public.intervention_details FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER intervention_details_historique ON intervention_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER intervention_details_historique ON public.intervention_details IS 'Audit trail pour les modifications sur les détails d''interventions';


--
-- Name: interventions interventions_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER interventions_historique AFTER INSERT OR DELETE OR UPDATE ON public.interventions FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: parametres parametres_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER parametres_historique AFTER INSERT OR DELETE OR UPDATE ON public.parametres FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER parametres_historique ON parametres; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER parametres_historique ON public.parametres IS 'Audit trail pour les modifications sur les paramètres système';


--
-- Name: parcelles parcelles_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER parcelles_historique AFTER INSERT OR DELETE OR UPDATE ON public.parcelles FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER parcelles_historique ON parcelles; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER parcelles_historique ON public.parcelles IS 'Audit trail pour les modifications sur les parcelles';


--
-- Name: produits_phyto produits_phyto_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER produits_phyto_historique AFTER INSERT OR DELETE OR UPDATE ON public.produits_phyto FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER produits_phyto_historique ON produits_phyto; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER produits_phyto_historique ON public.produits_phyto IS 'Audit trail pour les modifications sur les produits phytosanitaires';


--
-- Name: recoltes recoltes_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER recoltes_historique AFTER INSERT OR DELETE OR UPDATE ON public.recoltes FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: intervention_details trigger_update_intervention_details_timestamp; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER trigger_update_intervention_details_timestamp BEFORE UPDATE ON public.intervention_details FOR EACH ROW EXECUTE FUNCTION public.update_intervention_details_timestamp();


--
-- Name: types_intervention types_intervention_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER types_intervention_historique AFTER INSERT OR DELETE OR UPDATE ON public.types_intervention FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: TRIGGER types_intervention_historique ON types_intervention; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TRIGGER types_intervention_historique ON public.types_intervention IS 'Audit trail pour les modifications sur les types d''intervention';


--
-- Name: caveurs update_caveurs_updated_at; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER update_caveurs_updated_at BEFORE UPDATE ON public.caveurs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chiens update_chiens_updated_at; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER update_chiens_updated_at BEFORE UPDATE ON public.chiens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: commandes update_commandes_updated_at; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER update_commandes_updated_at BEFORE UPDATE ON public.commandes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: parametres update_parametres_updated_at; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER update_parametres_updated_at BEFORE UPDATE ON public.parametres FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: preferences_utilisateur update_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER update_preferences_updated_at BEFORE UPDATE ON public.preferences_utilisateur FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users users_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER users_historique AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: ventes ventes_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER ventes_historique AFTER INSERT OR DELETE OR UPDATE ON public.ventes FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: arbres arbres_parcelle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.arbres
    ADD CONSTRAINT arbres_parcelle_id_fkey FOREIGN KEY (parcelle_id) REFERENCES public.parcelles(id) ON DELETE CASCADE;


--
-- Name: commandes commandes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.commandes
    ADD CONSTRAINT commandes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: intervention_details intervention_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.intervention_details
    ADD CONSTRAINT intervention_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: interventions interventions_arbre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.interventions
    ADD CONSTRAINT interventions_arbre_id_fkey FOREIGN KEY (arbre_id) REFERENCES public.arbres(id) ON DELETE CASCADE;


--
-- Name: interventions interventions_parcelle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.interventions
    ADD CONSTRAINT interventions_parcelle_id_fkey FOREIGN KEY (parcelle_id) REFERENCES public.parcelles(id) ON DELETE CASCADE;


--
-- Name: interventions interventions_type_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.interventions
    ADD CONSTRAINT interventions_type_intervention_id_fkey FOREIGN KEY (type_intervention_id) REFERENCES public.types_intervention(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recoltes recoltes_arbre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.recoltes
    ADD CONSTRAINT recoltes_arbre_id_fkey FOREIGN KEY (arbre_id) REFERENCES public.arbres(id);


--
-- Name: recoltes recoltes_parcelle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.recoltes
    ADD CONSTRAINT recoltes_parcelle_id_fkey FOREIGN KEY (parcelle_id) REFERENCES public.parcelles(id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ventes ventes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: ventes ventes_commande_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_commande_id_fkey FOREIGN KEY (commande_id) REFERENCES public.commandes(id) ON DELETE SET NULL;


--
-- Name: ventes ventes_recolte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_recolte_id_fkey FOREIGN KEY (recolte_id) REFERENCES public.recoltes(id);


--
-- PostgreSQL database dump complete
--

