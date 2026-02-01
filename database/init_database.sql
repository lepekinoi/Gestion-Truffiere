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

CREATE SCHEMA tiger;


ALTER SCHEMA tiger OWNER TO unstuffed1004;

--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: unstuffed1004
--

CREATE SCHEMA tiger_data;


ALTER SCHEMA tiger_data OWNER TO unstuffed1004;

--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: unstuffed1004
--

CREATE SCHEMA topology;


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
-- Name: conservation_type; Type: TYPE; Schema: public; Owner: unstuffed1004
--

CREATE TYPE public.conservation_type AS ENUM (
    'Frais',
    'Surgelé',
    'Séché'
);


ALTER TYPE public.conservation_type OWNER TO unstuffed1004;

--
-- Name: maturite_truffe; Type: TYPE; Schema: public; Owner: unstuffed1004
--

CREATE TYPE public.maturite_truffe AS ENUM (
    'Blanc',
    'Gris',
    'Noir'
);


ALTER TYPE public.maturite_truffe OWNER TO unstuffed1004;

--
-- Name: qualite_truffe; Type: TYPE; Schema: public; Owner: unstuffed1004
--

CREATE TYPE public.qualite_truffe AS ENUM (
    'Extra',
    '1ère',
    '2e'
);


ALTER TYPE public.qualite_truffe OWNER TO unstuffed1004;

--
-- Name: statut_commande_achat; Type: TYPE; Schema: public; Owner: unstuffed1004
--

CREATE TYPE public.statut_commande_achat AS ENUM (
    'En attente',
    'Confirmée',
    'Expédiée',
    'Livrée',
    'Réceptionnée',
    'Annulée'
);


ALTER TYPE public.statut_commande_achat OWNER TO unstuffed1004;

--
-- Name: statut_fournisseur_truffe; Type: TYPE; Schema: public; Owner: unstuffed1004
--

CREATE TYPE public.statut_fournisseur_truffe AS ENUM (
    'Actif',
    'Inactif',
    'Suspendu'
);


ALTER TYPE public.statut_fournisseur_truffe OWNER TO unstuffed1004;

--
-- Name: statut_paiement_achat; Type: TYPE; Schema: public; Owner: unstuffed1004
--

CREATE TYPE public.statut_paiement_achat AS ENUM (
    'En attente',
    'Partiellement payée',
    'Payée'
);


ALTER TYPE public.statut_paiement_achat OWNER TO unstuffed1004;

--
-- Name: statut_reception_achat; Type: TYPE; Schema: public; Owner: unstuffed1004
--

CREATE TYPE public.statut_reception_achat AS ENUM (
    'Acceptée',
    'Rejetée',
    'Partielle'
);


ALTER TYPE public.statut_reception_achat OWNER TO unstuffed1004;

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
-- Name: cleanup_expired_refresh_tokens(integer); Type: FUNCTION; Schema: public; Owner: unstuffed1004
--

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


ALTER FUNCTION public.cleanup_expired_refresh_tokens(p_days_old integer) OWNER TO unstuffed1004;

--
-- Name: FUNCTION cleanup_expired_refresh_tokens(p_days_old integer); Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON FUNCTION public.cleanup_expired_refresh_tokens(p_days_old integer) IS 'Supprime les tokens expirés ou révoqués de plus de X jours';


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
-- Name: detect_token_reuse(character varying); Type: FUNCTION; Schema: public; Owner: unstuffed1004
--

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


ALTER FUNCTION public.detect_token_reuse(p_token_hash character varying) OWNER TO unstuffed1004;

--
-- Name: FUNCTION detect_token_reuse(p_token_hash character varying); Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON FUNCTION public.detect_token_reuse(p_token_hash character varying) IS 'Détecte si un token a été réutilisé (possible attaque)';


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
-- Name: revoke_token_chain(integer, character varying); Type: FUNCTION; Schema: public; Owner: unstuffed1004
--

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


ALTER FUNCTION public.revoke_token_chain(p_token_id integer, p_reason character varying) OWNER TO unstuffed1004;

--
-- Name: FUNCTION revoke_token_chain(p_token_id integer, p_reason character varying); Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON FUNCTION public.revoke_token_chain(p_token_id integer, p_reason character varying) IS 'Révoque un token et toute sa chaîne de rotation';


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
-- Name: update_token_last_used(); Type: FUNCTION; Schema: public; Owner: unstuffed1004
--

CREATE FUNCTION public.update_token_last_used() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.last_used_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_token_last_used() OWNER TO unstuffed1004;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: unstuffed1004
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Essayer avec updated_at (snake_case)
    IF TG_TABLE_NAME IN ('users', 'arbres', 'parcelles', 'interventions', 'recoltes', 
                         'clients', 'ventes', 'commandes') THEN
        NEW.updated_at = CURRENT_TIMESTAMP;
    -- Sinon utiliser updatedat (camelCase)
    ELSE
        NEW.updatedat = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO unstuffed1004;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: amendement_details; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.amendement_details OWNER TO unstuffed1004;

--
-- Name: TABLE amendement_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.amendement_details IS 'Détails spécifiques aux amendements 🌱';


--
-- Name: COLUMN amendement_details.certification_bio; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.amendement_details.certification_bio IS 'Produit utilisable en agriculture biologique';


--
-- Name: amendement_details_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.amendement_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.amendement_details_id_seq OWNER TO unstuffed1004;

--
-- Name: amendement_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.amendement_details_id_seq OWNED BY public.amendement_details.id;


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
-- Name: analyse_marge_truffes; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.analyse_marge_truffes OWNER TO unstuffed1004;

--
-- Name: TABLE analyse_marge_truffes; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.analyse_marge_truffes IS 'Analyse des marges réalisées sur les ventes de truffes';


--
-- Name: analyse_marge_truffes_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.analyse_marge_truffes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.analyse_marge_truffes_id_seq OWNER TO unstuffed1004;

--
-- Name: analyse_marge_truffes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.analyse_marge_truffes_id_seq OWNED BY public.analyse_marge_truffes.id;


--
-- Name: analyse_sol_details; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.analyse_sol_details OWNER TO unstuffed1004;

--
-- Name: TABLE analyse_sol_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.analyse_sol_details IS 'Détails spécifiques aux analyses de sol 🧪';


--
-- Name: analyse_sol_details_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.analyse_sol_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.analyse_sol_details_id_seq OWNER TO unstuffed1004;

--
-- Name: analyse_sol_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.analyse_sol_details_id_seq OWNED BY public.analyse_sol_details.id;


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
    "rendement_estimé" numeric(10,2)
);


ALTER TABLE public.arbres OWNER TO unstuffed1004;

--
-- Name: COLUMN arbres.etat_sanitaire; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.arbres.etat_sanitaire IS 'État sanitaire de l''arbre: Excellent, Bon, Moyen, Mauvais';


--
-- Name: COLUMN arbres.deleted_at; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.arbres.deleted_at IS 'Date de suppression (soft delete) - NULL si l''arbre est actif';


--
-- Name: COLUMN arbres.porte_greffe; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.arbres.porte_greffe IS 'Porte-greffe utilisé (base de greffage)';


--
-- Name: COLUMN arbres."rendement_estimé"; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.arbres."rendement_estimé" IS 'Rendement estimé en kg';


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
-- Name: audit_trail_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.audit_trail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_trail_id_seq OWNER TO unstuffed1004;

--
-- Name: audit_trail; Type: TABLE; Schema: public; Owner: unstuffed1004
--

CREATE TABLE public.audit_trail (
    id integer DEFAULT nextval('public.audit_trail_id_seq'::regclass) NOT NULL,
    user_id integer NOT NULL,
    action character varying(20) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer NOT NULL,
    old_values jsonb,
    new_values jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_trail OWNER TO unstuffed1004;

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
-- Name: commandes_achat_truffes; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.commandes_achat_truffes OWNER TO unstuffed1004;

--
-- Name: commandes_achat_truffes_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.commandes_achat_truffes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.commandes_achat_truffes_id_seq OWNER TO unstuffed1004;

--
-- Name: commandes_achat_truffes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.commandes_achat_truffes_id_seq OWNED BY public.commandes_achat_truffes.id;


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
-- Name: contacts_fournisseurs_truffes; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.contacts_fournisseurs_truffes OWNER TO unstuffed1004;

--
-- Name: contacts_fournisseurs_truffes_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.contacts_fournisseurs_truffes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contacts_fournisseurs_truffes_id_seq OWNER TO unstuffed1004;

--
-- Name: contacts_fournisseurs_truffes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.contacts_fournisseurs_truffes_id_seq OWNED BY public.contacts_fournisseurs_truffes.id;


--
-- Name: especes_arbres; Type: TABLE; Schema: public; Owner: unstuffed1004
--

CREATE TABLE public.especes_arbres (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    code character varying(10) NOT NULL,
    nom_scientifique character varying(150),
    description text,
    groupe_principal character varying(50),
    est_espece_principale boolean DEFAULT false,
    ordre_affichage integer DEFAULT 0,
    actif boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.especes_arbres OWNER TO unstuffed1004;

--
-- Name: especes_arbres_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.especes_arbres_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.especes_arbres_id_seq OWNER TO unstuffed1004;

--
-- Name: especes_arbres_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.especes_arbres_id_seq OWNED BY public.especes_arbres.id;


--
-- Name: evaluations_fournisseurs_truffes; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.evaluations_fournisseurs_truffes OWNER TO unstuffed1004;

--
-- Name: evaluations_fournisseurs_truffes_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.evaluations_fournisseurs_truffes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.evaluations_fournisseurs_truffes_id_seq OWNER TO unstuffed1004;

--
-- Name: evaluations_fournisseurs_truffes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.evaluations_fournisseurs_truffes_id_seq OWNED BY public.evaluations_fournisseurs_truffes.id;


--
-- Name: factures_achat_truffes; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.factures_achat_truffes OWNER TO unstuffed1004;

--
-- Name: factures_achat_truffes_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.factures_achat_truffes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.factures_achat_truffes_id_seq OWNER TO unstuffed1004;

--
-- Name: factures_achat_truffes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.factures_achat_truffes_id_seq OWNED BY public.factures_achat_truffes.id;


--
-- Name: fournisseurs_truffes; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.fournisseurs_truffes OWNER TO unstuffed1004;

--
-- Name: fournisseurs_truffes_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.fournisseurs_truffes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fournisseurs_truffes_id_seq OWNER TO unstuffed1004;

--
-- Name: fournisseurs_truffes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.fournisseurs_truffes_id_seq OWNED BY public.fournisseurs_truffes.id;


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
-- Name: inoculation_details; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.inoculation_details OWNER TO unstuffed1004;

--
-- Name: TABLE inoculation_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.inoculation_details IS 'Détails spécifiques aux inoculations 💉';


--
-- Name: inoculation_details_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.inoculation_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inoculation_details_id_seq OWNER TO unstuffed1004;

--
-- Name: inoculation_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.inoculation_details_id_seq OWNED BY public.inoculation_details.id;


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
-- Name: irrigation_details; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.irrigation_details OWNER TO unstuffed1004;

--
-- Name: TABLE irrigation_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.irrigation_details IS 'Détails spécifiques aux interventions d''irrigation 💧';


--
-- Name: COLUMN irrigation_details.volume_eau_m3; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.irrigation_details.volume_eau_m3 IS 'Volume d''eau apporté en m³';


--
-- Name: COLUMN irrigation_details.volume_eau_par_arbre_l; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.irrigation_details.volume_eau_par_arbre_l IS 'Volume d''eau par arbre en litres';


--
-- Name: irrigation_details_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.irrigation_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.irrigation_details_id_seq OWNER TO unstuffed1004;

--
-- Name: irrigation_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.irrigation_details_id_seq OWNED BY public.irrigation_details.id;


--
-- Name: lignes_commande_achat; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.lignes_commande_achat OWNER TO unstuffed1004;

--
-- Name: lignes_commande_achat_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.lignes_commande_achat_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lignes_commande_achat_id_seq OWNER TO unstuffed1004;

--
-- Name: lignes_commande_achat_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.lignes_commande_achat_id_seq OWNED BY public.lignes_commande_achat.id;


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
-- Name: observation_details; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.observation_details OWNER TO unstuffed1004;

--
-- Name: TABLE observation_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.observation_details IS 'Détails spécifiques aux observations 🔍';


--
-- Name: COLUMN observation_details.etat_brule; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.observation_details.etat_brule IS 'État du brûlé (zone sans végétation autour de l''arbre mycorhizé)';


--
-- Name: COLUMN observation_details.indice_mycorhization; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.observation_details.indice_mycorhization IS 'Estimation du taux de mycorhization des racines';


--
-- Name: observation_details_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.observation_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.observation_details_id_seq OWNER TO unstuffed1004;

--
-- Name: observation_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.observation_details_id_seq OWNED BY public.observation_details.id;


--
-- Name: paillage_details; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.paillage_details OWNER TO unstuffed1004;

--
-- Name: TABLE paillage_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.paillage_details IS 'Détails spécifiques au paillage 🍂';


--
-- Name: paillage_details_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.paillage_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.paillage_details_id_seq OWNER TO unstuffed1004;

--
-- Name: paillage_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.paillage_details_id_seq OWNED BY public.paillage_details.id;


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
-- Name: piegeage_details; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.piegeage_details OWNER TO unstuffed1004;

--
-- Name: TABLE piegeage_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.piegeage_details IS 'Détails spécifiques au piégeage 🪤';


--
-- Name: piegeage_details_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.piegeage_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.piegeage_details_id_seq OWNER TO unstuffed1004;

--
-- Name: piegeage_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.piegeage_details_id_seq OWNED BY public.piegeage_details.id;


--
-- Name: plantation_details; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.plantation_details OWNER TO unstuffed1004;

--
-- Name: TABLE plantation_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.plantation_details IS 'Détails spécifiques aux plantations 🌳';


--
-- Name: plantation_details_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.plantation_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.plantation_details_id_seq OWNER TO unstuffed1004;

--
-- Name: plantation_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.plantation_details_id_seq OWNED BY public.plantation_details.id;


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
-- Name: reception_achats; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.reception_achats OWNER TO unstuffed1004;

--
-- Name: reception_achats_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.reception_achats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reception_achats_id_seq OWNER TO unstuffed1004;

--
-- Name: reception_achats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.reception_achats_id_seq OWNED BY public.reception_achats.id;


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
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    parent_token_id integer,
    rotation_count integer DEFAULT 0 NOT NULL,
    user_agent text,
    last_used_at timestamp without time zone,
    CONSTRAINT rotation_count_limit CHECK ((rotation_count <= 10)),
    CONSTRAINT rotation_count_positive CHECK ((rotation_count >= 0))
);


ALTER TABLE public.refresh_tokens OWNER TO unstuffed1004;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.refresh_tokens IS 'Ajout des colonnes pour la rotation automatique';


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
-- Name: security_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.security_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.security_logs_id_seq OWNER TO unstuffed1004;

--
-- Name: security_logs; Type: TABLE; Schema: public; Owner: unstuffed1004
--

CREATE TABLE public.security_logs (
    id integer DEFAULT nextval('public.security_logs_id_seq'::regclass) NOT NULL,
    user_id integer,
    event_type character varying(100) NOT NULL,
    details jsonb,
    severity character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT security_logs_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


ALTER TABLE public.security_logs OWNER TO unstuffed1004;

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
-- Name: stocks_truffes_achetees; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.stocks_truffes_achetees OWNER TO unstuffed1004;

--
-- Name: TABLE stocks_truffes_achetees; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.stocks_truffes_achetees IS 'Stock de truffes achetées auprès des fournisseurs';


--
-- Name: stocks_truffes_achetees_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.stocks_truffes_achetees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stocks_truffes_achetees_id_seq OWNER TO unstuffed1004;

--
-- Name: stocks_truffes_achetees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.stocks_truffes_achetees_id_seq OWNED BY public.stocks_truffes_achetees.id;


--
-- Name: taille_details; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.taille_details OWNER TO unstuffed1004;

--
-- Name: TABLE taille_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.taille_details IS 'Détails spécifiques aux opérations de taille ✂️';


--
-- Name: taille_details_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.taille_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.taille_details_id_seq OWNER TO unstuffed1004;

--
-- Name: taille_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.taille_details_id_seq OWNED BY public.taille_details.id;


--
-- Name: traitement_phyto_details; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.traitement_phyto_details OWNER TO unstuffed1004;

--
-- Name: TABLE traitement_phyto_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.traitement_phyto_details IS 'Détails spécifiques aux traitements phytosanitaires 🧪';


--
-- Name: COLUMN traitement_phyto_details.delai_avant_recolte_jours; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.traitement_phyto_details.delai_avant_recolte_jours IS 'DAR - Délai réglementaire avant récolte';


--
-- Name: COLUMN traitement_phyto_details.zone_non_traitee_m; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON COLUMN public.traitement_phyto_details.zone_non_traitee_m IS 'ZNT - Distance minimale des cours d''eau';


--
-- Name: traitement_phyto_details_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.traitement_phyto_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.traitement_phyto_details_id_seq OWNER TO unstuffed1004;

--
-- Name: traitement_phyto_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.traitement_phyto_details_id_seq OWNED BY public.traitement_phyto_details.id;


--
-- Name: travail_sol_details; Type: TABLE; Schema: public; Owner: unstuffed1004
--

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


ALTER TABLE public.travail_sol_details OWNER TO unstuffed1004;

--
-- Name: TABLE travail_sol_details; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON TABLE public.travail_sol_details IS 'Détails spécifiques aux travaux du sol 🚜';


--
-- Name: travail_sol_details_id_seq; Type: SEQUENCE; Schema: public; Owner: unstuffed1004
--

CREATE SEQUENCE public.travail_sol_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.travail_sol_details_id_seq OWNER TO unstuffed1004;

--
-- Name: travail_sol_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: unstuffed1004
--

ALTER SEQUENCE public.travail_sol_details_id_seq OWNED BY public.travail_sol_details.id;


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
-- Name: v_analyse_marge_par_calibre; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.v_analyse_marge_par_calibre AS
 SELECT calibre_mm,
    qualite,
    maturite,
    count(*) AS nombre_transactions,
    avg(prix_achat_kg) AS prix_achat_moyen,
    avg(prix_vente_kg) AS prix_vente_moyen,
    avg(marge_kg) AS marge_moyenne_kg,
    avg(pourcentage_marge) AS pourcentage_marge_moyen,
    sum(quantite_kg) AS quantite_totale_kg
   FROM public.analyse_marge_truffes
  WHERE (date_vente IS NOT NULL)
  GROUP BY calibre_mm, qualite, maturite
  ORDER BY calibre_mm DESC, qualite;


ALTER VIEW public.v_analyse_marge_par_calibre OWNER TO unstuffed1004;

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
-- Name: v_performance_fournisseurs_truffes; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.v_performance_fournisseurs_truffes AS
 SELECT f.id,
    f.nom,
    f.zone_production,
    count(DISTINCT c.id) AS nombre_commandes,
    sum(c.montant_total) AS montant_total_achats,
    avg(e.note_qualite) AS note_qualite_moyenne,
    avg(e.note_delai) AS note_delai_moyenne,
    avg(e.note_prix) AS note_prix_moyenne,
    avg(e.note_globale) AS note_globale_moyenne,
    max(c.date_commande) AS derniere_commande
   FROM ((public.fournisseurs_truffes f
     LEFT JOIN public.commandes_achat_truffes c ON ((f.id = c.fournisseur_id)))
     LEFT JOIN public.evaluations_fournisseurs_truffes e ON ((f.id = e.fournisseur_id)))
  WHERE (f.deleted_at IS NULL)
  GROUP BY f.id, f.nom, f.zone_production
  ORDER BY (avg(e.note_globale)) DESC NULLS LAST;


ALTER VIEW public.v_performance_fournisseurs_truffes OWNER TO unstuffed1004;

--
-- Name: v_stock_truffes_disponible; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.v_stock_truffes_disponible AS
 SELECT calibre_mm,
    qualite,
    maturite,
    sum(quantite_kg_stock) AS quantite_totale_kg,
    conservation,
    localisation_storage,
    count(*) AS nombre_lots,
    min(date_limite_consommation) AS date_limite_prochaine,
    avg(prix_achat_kg) AS prix_moyen_achat,
    max(date_achat) AS dernier_achat
   FROM public.stocks_truffes_achetees
  WHERE ((quantite_kg_stock > (0)::numeric) AND ((date_limite_consommation IS NULL) OR (date_limite_consommation > CURRENT_DATE)))
  GROUP BY calibre_mm, qualite, maturite, conservation, localisation_storage
  ORDER BY calibre_mm, qualite, maturite;


ALTER VIEW public.v_stock_truffes_disponible OWNER TO unstuffed1004;

--
-- Name: v_token_stats; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.v_token_stats AS
 SELECT u.id AS user_id,
    u.email,
    u.nom,
    count(rt.id) FILTER (WHERE ((rt.revoked = false) AND (rt.expires_at > now()))) AS active_tokens,
    count(rt.id) FILTER (WHERE (rt.revoked = true)) AS revoked_tokens,
    count(rt.id) FILTER (WHERE (rt.expires_at < now())) AS expired_tokens,
    max(rt.created_at) AS last_token_created,
    max(rt.last_used_at) AS last_token_used
   FROM (public.users u
     LEFT JOIN public.refresh_tokens rt ON ((u.id = rt.user_id)))
  GROUP BY u.id, u.email, u.nom;


ALTER VIEW public.v_token_stats OWNER TO unstuffed1004;

--
-- Name: VIEW v_token_stats; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON VIEW public.v_token_stats IS 'Statistiques des refresh tokens par utilisateur';


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
-- Name: vanalysemargeparcalibre; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.vanalysemargeparcalibre AS
 SELECT calibre_mm AS calibremm,
    qualite,
    maturite,
    count(*) AS nombretransactions,
    avg(prix_achat_kg) AS prixachatmoyen,
    avg(prix_vente_kg) AS prixventemoyen,
    avg(marge_kg) AS margemoyennekg,
    avg(pourcentage_marge) AS pourcentagemargemoyen,
    sum(quantite_kg) AS quantitetotalekg
   FROM public.analyse_marge_truffes
  WHERE (date_vente IS NOT NULL)
  GROUP BY calibre_mm, qualite, maturite
  ORDER BY calibre_mm DESC, qualite;


ALTER VIEW public.vanalysemargeparcalibre OWNER TO unstuffed1004;

--
-- Name: VIEW vanalysemargeparcalibre; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON VIEW public.vanalysemargeparcalibre IS 'Vue synthétique des marges moyennes par calibre';


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
-- Name: vstocktruffesdisponible; Type: VIEW; Schema: public; Owner: unstuffed1004
--

CREATE VIEW public.vstocktruffesdisponible AS
 SELECT calibre_mm AS calibremm,
    qualite,
    maturite,
    sum(quantite_kg_stock) AS quantitetotalekg,
    conservation,
    localisation_storage AS localisationstorage,
    count(*) AS nombrelots,
    min(date_limite_consommation) AS datelimiteprochaine,
    avg(prix_achat_kg) AS prixmoyenachat,
    max(date_achat) AS dernierachat
   FROM public.stocks_truffes_achetees
  WHERE ((quantite_kg_stock > (0)::numeric) AND ((date_limite_consommation IS NULL) OR (date_limite_consommation >= CURRENT_DATE)))
  GROUP BY calibre_mm, qualite, maturite, conservation, localisation_storage
  ORDER BY calibre_mm, qualite, maturite;


ALTER VIEW public.vstocktruffesdisponible OWNER TO unstuffed1004;

--
-- Name: VIEW vstocktruffesdisponible; Type: COMMENT; Schema: public; Owner: unstuffed1004
--

COMMENT ON VIEW public.vstocktruffesdisponible IS 'Vue du stock disponible de truffes par calibre/qualité';


--
-- Name: amendement_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.amendement_details ALTER COLUMN id SET DEFAULT nextval('public.amendement_details_id_seq'::regclass);


--
-- Name: amendements_ref id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.amendements_ref ALTER COLUMN id SET DEFAULT nextval('public.amendements_ref_id_seq'::regclass);


--
-- Name: analyse_marge_truffes id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.analyse_marge_truffes ALTER COLUMN id SET DEFAULT nextval('public.analyse_marge_truffes_id_seq'::regclass);


--
-- Name: analyse_sol_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.analyse_sol_details ALTER COLUMN id SET DEFAULT nextval('public.analyse_sol_details_id_seq'::regclass);


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
-- Name: commandes_achat_truffes id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.commandes_achat_truffes ALTER COLUMN id SET DEFAULT nextval('public.commandes_achat_truffes_id_seq'::regclass);


--
-- Name: contacts_fournisseurs_truffes id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.contacts_fournisseurs_truffes ALTER COLUMN id SET DEFAULT nextval('public.contacts_fournisseurs_truffes_id_seq'::regclass);


--
-- Name: especes_arbres id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.especes_arbres ALTER COLUMN id SET DEFAULT nextval('public.especes_arbres_id_seq'::regclass);


--
-- Name: evaluations_fournisseurs_truffes id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.evaluations_fournisseurs_truffes ALTER COLUMN id SET DEFAULT nextval('public.evaluations_fournisseurs_truffes_id_seq'::regclass);


--
-- Name: factures_achat_truffes id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.factures_achat_truffes ALTER COLUMN id SET DEFAULT nextval('public.factures_achat_truffes_id_seq'::regclass);


--
-- Name: fournisseurs_truffes id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.fournisseurs_truffes ALTER COLUMN id SET DEFAULT nextval('public.fournisseurs_truffes_id_seq'::regclass);


--
-- Name: historique id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.historique ALTER COLUMN id SET DEFAULT nextval('public.historique_id_seq'::regclass);


--
-- Name: inoculation_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.inoculation_details ALTER COLUMN id SET DEFAULT nextval('public.inoculation_details_id_seq'::regclass);


--
-- Name: intervention_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.intervention_details ALTER COLUMN id SET DEFAULT nextval('public.intervention_details_id_seq'::regclass);


--
-- Name: interventions id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.interventions ALTER COLUMN id SET DEFAULT nextval('public.interventions_id_seq'::regclass);


--
-- Name: irrigation_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.irrigation_details ALTER COLUMN id SET DEFAULT nextval('public.irrigation_details_id_seq'::regclass);


--
-- Name: lignes_commande_achat id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.lignes_commande_achat ALTER COLUMN id SET DEFAULT nextval('public.lignes_commande_achat_id_seq'::regclass);


--
-- Name: login_attempts id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.login_attempts ALTER COLUMN id SET DEFAULT nextval('public.login_attempts_id_seq'::regclass);


--
-- Name: observation_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.observation_details ALTER COLUMN id SET DEFAULT nextval('public.observation_details_id_seq'::regclass);


--
-- Name: paillage_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.paillage_details ALTER COLUMN id SET DEFAULT nextval('public.paillage_details_id_seq'::regclass);


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
-- Name: piegeage_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.piegeage_details ALTER COLUMN id SET DEFAULT nextval('public.piegeage_details_id_seq'::regclass);


--
-- Name: plantation_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.plantation_details ALTER COLUMN id SET DEFAULT nextval('public.plantation_details_id_seq'::regclass);


--
-- Name: preferences_utilisateur id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.preferences_utilisateur ALTER COLUMN id SET DEFAULT nextval('public.preferences_utilisateur_id_seq'::regclass);


--
-- Name: produits_phyto id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.produits_phyto ALTER COLUMN id SET DEFAULT nextval('public.produits_phyto_id_seq'::regclass);


--
-- Name: reception_achats id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.reception_achats ALTER COLUMN id SET DEFAULT nextval('public.reception_achats_id_seq'::regclass);


--
-- Name: recoltes id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.recoltes ALTER COLUMN id SET DEFAULT nextval('public.recoltes_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: stocks_truffes_achetees id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.stocks_truffes_achetees ALTER COLUMN id SET DEFAULT nextval('public.stocks_truffes_achetees_id_seq'::regclass);


--
-- Name: taille_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.taille_details ALTER COLUMN id SET DEFAULT nextval('public.taille_details_id_seq'::regclass);


--
-- Name: traitement_phyto_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.traitement_phyto_details ALTER COLUMN id SET DEFAULT nextval('public.traitement_phyto_details_id_seq'::regclass);


--
-- Name: travail_sol_details id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.travail_sol_details ALTER COLUMN id SET DEFAULT nextval('public.travail_sol_details_id_seq'::regclass);


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
-- Data for Name: amendement_details; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.amendement_details (id, intervention_id, type_amendement, nom_produit_amendement, origine_produit, numero_lot, certification_bio, composition_npk, composition_cao, composition_mgo, composition_autres, dose_kg_ha, dose_kg_arbre, quantite_totale_kg, methode_epandage, incorporation, profondeur_incorporation_cm, ph_sol_avant, ph_sol_apres, created_at, updated_at) FROM stdin;
\.


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
-- Data for Name: analyse_marge_truffes; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.analyse_marge_truffes (id, stock_achat_id, commande_vente_id, calibre_mm, qualite, maturite, prix_achat_kg, prix_vente_kg, quantite_kg, date_achat, date_vente, created_at) FROM stdin;
\.


--
-- Data for Name: analyse_sol_details; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.analyse_sol_details (id, intervention_id, profondeur_prelevement_cm, nombre_echantillons, laboratoire, reference_analyse, resultats_ph, resultats_calcaire_actif, resultats_matiere_organique, resultats_azote, resultats_phosphore, resultats_potassium, resultats_cec, interpretation, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: arbres; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.arbres (id, parcelle_id, numero, espece, variete_truffe, date_plantation, "position", etat_sanitaire, circonference_cm, hauteur_m, date_derniere_taille, notes, created_at, updated_at, latitude, longitude, deleted_at, porte_greffe, "rendement_estimé") FROM stdin;
\.


--
-- Data for Name: audit_trail; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.audit_trail (id, user_id, action, entity_type, entity_id, old_values, new_values, created_at) FROM stdin;
\.


--
-- Data for Name: inoculation_details; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.inoculation_details (id, intervention_id, type_inoculum, espece_truffe_inoculation, quantite_inoculum, methode_inoculation, fournisseur_inoculum, created_at, updated_at) FROM stdin;
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
-- Data for Name: irrigation_details; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.irrigation_details (id, intervention_id, volume_eau_m3, volume_eau_par_arbre_l, methode_irrigation, source_eau, debit_l_h, pression_bar, frequence_irrigation, humidite_sol_avant, humidite_sol_apres, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lignes_commande_achat; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.lignes_commande_achat (id, commande_id, calibre_mm, qualite, maturite, quantite_kg, prix_achat_kg, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: login_attempts; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.login_attempts (id, email, ip_address, user_agent, success, failure_reason, attempted_at) FROM stdin;
\.


--
-- Data for Name: observation_details; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.observation_details (id, intervention_id, type_observation, niveau_urgence, etat_brule, diametre_brule_m, evolution_brule, presence_ascomes, nombre_ascomes, indice_mycorhization, symptomes_observes, ravageurs_identifies, degats_constates, preconisations, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: paillage_details; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.paillage_details (id, intervention_id, type_paillage, epaisseur_cm, surface_paillee_m2, quantite_paillage_m3, origine_paillage, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: parametres; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.parametres (id, cle, valeur, description, updated_at) FROM stdin;
62	stock_prix_moyen_defaut	800	\N	2026-01-13 18:19:15.145272
2	colonnes_affichees_arbres	["numero", "espece", "variete_truffe", "parcelle_nom", "etat", "date_plantation", "notes", "hauteur_m"]	\N	2026-01-22 21:19:31.92651
5	colonnes_affichees_clients	["nom", "type", "email", "telephone", "ville", "prenom", "raison_sociale", "notes"]	\N	2026-01-22 21:19:31.962731
37	app_date_format	"DD/MM/YYYY"	\N	2026-01-13 18:19:14.567699
3	colonnes_affichees_interventions	["date_prevue", "type_nom", "parcelle_nom", "arbre_numero", "statut", "date_realisee", "description", "notes"]	\N	2026-01-22 21:19:31.983421
1	colonnes_affichees_parcelles	["nom", "type_sol", "ph_sol", "date_creation", "notes", "surface_ha"]	\N	2026-01-22 21:19:32.00437
4	colonnes_affichees_recoltes	["date_recolte", "parcelle_nom", "arbre_numero", "poids_grammes", "qualite", "prix_kg", "caveur", "chien", "conditions_meteo", "maturite", "profondeur_cm", "notes"]	\N	2026-01-22 21:19:32.023868
6	colonnes_affichees_ventes	["date_vente", "client_nom", "quantite_grammes", "prix_unitaire_kg", "montant_total", "statut", "numero_facture", "commande_numero"]	\N	2026-01-22 21:19:32.042338
39	app_devise	"EUR"	\N	2026-01-13 18:19:14.58995
38	app_langue	"fr"	\N	2026-01-13 18:19:14.606859
69	app_theme	"#2c5f2d"	\N	2026-01-13 18:19:14.623263
63	commande_alerte_delai	3	\N	2026-01-13 18:19:14.639792
73	dashboard_refresh_interval	60	\N	2026-01-13 18:19:14.656805
41	entreprise_adresse	"5, Rue Chalon"	\N	2026-01-13 18:19:14.675097
42	entreprise_code_postal	"79170"	\N	2026-01-13 18:19:14.692254
50	entreprise_email	""	\N	2026-01-13 18:19:14.70976
40	entreprise_nom	"M-A Truffe"	\N	2026-01-13 18:19:14.727282
51	entreprise_siret	""	\N	2026-01-13 18:19:14.74428
44	entreprise_telephone	"06 81 61 89 11"	\N	2026-01-13 18:19:14.760822
52	entreprise_tva	""	\N	2026-01-13 18:19:14.777083
43	entreprise_ville	"Lusseray"	\N	2026-01-13 18:19:14.793718
58	facture_bic	""	\N	2026-01-13 18:19:14.81079
8	colonnes_export_arbres	["numero", "espece", "variete_truffe", "parcelle_nom", "etat", "date_plantation", "hauteur_m", "notes"]	\N	2026-01-22 21:19:32.061933
11	colonnes_export_clients	["nom", "prenom", "raison_sociale", "type", "email", "telephone", "adresse", "code_postal", "ville", "pays", "siret", "notes"]	\N	2026-01-22 21:19:32.081571
9	colonnes_export_interventions	["date_prevue", "date_realisee", "type_nom", "parcelle_nom", "arbre_numero", "statut", "personnel", "cout", "description", "notes"]	\N	2026-01-22 21:19:32.099776
7	colonnes_export_parcelles	["nom", "surface_ha", "type_sol", "ph_sol", "exposition", "notes"]	\N	2026-01-22 21:19:32.116856
10	colonnes_export_recoltes	["date_recolte", "parcelle_nom", "arbre_numero", "poids_grammes", "qualite", "calibre", "maturite", "prix_kg", "caveur", "notes"]	\N	2026-01-22 21:19:32.134008
12	colonnes_export_ventes	["date_vente", "numero_facture", "client_nom", "quantite_grammes", "prix_unitaire_kg", "montant_total", "mode_paiement", "statut", "notes", "commande_numero"]	\N	2026-01-22 21:19:32.151614
55	facture_conditions_paiement	"Paiement à réception"	\N	2026-01-13 18:19:14.829611
56	facture_delai_paiement	30	\N	2026-01-13 18:19:14.848065
57	facture_iban	""	\N	2026-01-13 18:19:14.869951
59	facture_mentions_legales	"TVA non applicable, art. 293 B du CGI"	\N	2026-01-13 18:19:14.890938
53	facture_prefixe	"FAC"	\N	2026-01-13 18:19:14.909723
54	facture_tva_taux	5.5	\N	2026-01-13 18:19:14.928595
74	historique_retention_jours	365	\N	2026-01-13 18:19:14.946644
65	recolte_calibres	"[\\"Petit (moins de 20g)\\",\\"Moyen (20-50g)\\",\\"Gros (50-100g)\\",\\"Très gros (plus de 100g)\\"]"	\N	2026-01-13 18:19:14.963648
66	recolte_maturites	"[\\"Immature\\",\\"À point\\",\\"Mature\\",\\"Très mature\\"]"	\N	2026-01-13 18:19:14.981988
64	recolte_qualites	"[\\"Extra\\",\\"1er choix\\",\\"2ème choix\\",\\"Pourrie\\"]"	\N	2026-01-13 18:19:14.998645
67	saison_debut_mois	11	\N	2026-01-13 18:19:15.015239
68	saison_fin_mois	3	\N	2026-01-13 18:19:15.034597
60	stock_alerte_critique	100	\N	2026-01-13 18:19:15.074448
61	stock_alerte_faible	500	\N	2026-01-13 18:19:15.126626
\.


--
-- Data for Name: parcelles; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.parcelles (id, nom, surface_ha, geometrie, type_sol, ph_sol, exposition, date_creation, notes) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: piegeage_details; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.piegeage_details (id, intervention_id, type_piege, cible_piegeage, nombre_pieges, densite_pieges_ha, date_releve, captures, action_suite, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: plantation_details; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.plantation_details (id, intervention_id, espece_plantee, variete_plant, type_mycorhization, fournisseur_plant, certification_plant, numero_lot_plant, taille_plant_cm, diametre_collet_mm, dimensions_trou_cm, amendement_plantation, arrosage_plantation_l, tuteur, protection_gibier, type_protection, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: preferences_utilisateur; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.preferences_utilisateur (id, user_id, colonnes_affichees, colonnes_export, created_at, updated_at) FROM stdin;
1	default	{}	{}	2025-12-31 15:55:12.187243	2026-01-01 17:58:12.033526
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
-- Data for Name: reception_achats; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.reception_achats (id, commande_id, date_reception, "quantite_reçue_kg", controle_qualite, observations, responsable_reception, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: recoltes; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.recoltes (id, parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, profondeur_cm, caveur, chien, conditions_meteo, temperature_sol, notes, created_at, exposition) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.refresh_tokens (id, user_id, token_hash, device_info, ip_address, expires_at, revoked, revoked_at, revoked_reason, created_at, parent_token_id, rotation_count, user_agent, last_used_at) FROM stdin;
\.


--
-- Data for Name: security_logs; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.security_logs (id, user_id, event_type, details, severity, created_at) FROM stdin;
\.


--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- Data for Name: stocks_truffes_achetees; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.stocks_truffes_achetees (id, ligne_commande_id, calibre_mm, qualite, maturite, quantite_kg_stock, conservation, localisation_storage, date_achat, date_limite_consommation, prix_achat_kg, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: taille_details; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.taille_details (id, intervention_id, type_taille, intensite_taille, hauteur_avant_cm, hauteur_apres_cm, diametre_couronne_avant_m, diametre_couronne_apres_m, branches_supprimees, diametre_max_coupe_cm, volume_residus_m3, destination_residus, outils_taille, desinfection_outils, produit_desinfection, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: traitement_phyto_details; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.traitement_phyto_details (id, intervention_id, categorie_traitement, nom_commercial, matiere_active, numero_amm, fabricant, dose_produit_ha, dose_produit_arbre, concentration, volume_bouillie_l, surface_traitee_ha, methode_application, cible_traitement, delai_avant_recolte_jours, zone_non_traitee_m, equipement_protection, conditions_application, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: travail_sol_details; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.travail_sol_details (id, intervention_id, type_travail_sol, outil_travail_sol, zone_travaillee, profondeur_travail_cm, largeur_travail_m, distance_tronc_m, etat_sol_avant, enherbement_avant, enherbement_apres, presence_cailloux, created_at, updated_at) FROM stdin;
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
1	admin@truffiere.local	$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu	Administrateur	Système	admin	t	t	2026-01-29 22:04:50.06384	\N	0	\N	2026-01-02 16:29:54.193672	2026-01-29 22:04:50.06384
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
-- Name: amendement_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.amendement_details_id_seq', 1, false);


--
-- Name: amendements_ref_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.amendements_ref_id_seq', 8, true);


--
-- Name: analyse_marge_truffes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.analyse_marge_truffes_id_seq', 1, false);


--
-- Name: analyse_sol_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.analyse_sol_details_id_seq', 1, false);


--
-- Name: arbres_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.arbres_id_seq', 438, true);


--
-- Name: audit_trail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.audit_trail_id_seq', 923, true);


--
-- Name: caveurs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.caveurs_id_seq', 6, true);


--
-- Name: chiens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.chiens_id_seq', 4, true);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.clients_id_seq', 39, true);


--
-- Name: commandes_achat_truffes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.commandes_achat_truffes_id_seq', 1, false);


--
-- Name: commandes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.commandes_id_seq', 1, true);


--
-- Name: contacts_fournisseurs_truffes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.contacts_fournisseurs_truffes_id_seq', 1, false);


--
-- Name: especes_arbres_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.especes_arbres_id_seq', 13, false);


--
-- Name: evaluations_fournisseurs_truffes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.evaluations_fournisseurs_truffes_id_seq', 1, false);


--
-- Name: factures_achat_truffes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.factures_achat_truffes_id_seq', 1, false);


--
-- Name: fournisseurs_truffes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.fournisseurs_truffes_id_seq', 1, true);


--
-- Name: historique_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.historique_id_seq', 6361, true);


--
-- Name: inoculation_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.inoculation_details_id_seq', 1, false);


--
-- Name: intervention_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.intervention_details_id_seq', 5, true);


--
-- Name: interventions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.interventions_id_seq', 365, true);


--
-- Name: irrigation_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.irrigation_details_id_seq', 1, false);


--
-- Name: lignes_commande_achat_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.lignes_commande_achat_id_seq', 1, false);


--
-- Name: login_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.login_attempts_id_seq', 204, true);


--
-- Name: observation_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.observation_details_id_seq', 1, false);


--
-- Name: paillage_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.paillage_details_id_seq', 1, false);


--
-- Name: parametres_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.parametres_id_seq', 74, true);


--
-- Name: parcelles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.parcelles_id_seq', 15, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, false);


--
-- Name: piegeage_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.piegeage_details_id_seq', 1, false);


--
-- Name: plantation_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.plantation_details_id_seq', 1, false);


--
-- Name: preferences_utilisateur_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.preferences_utilisateur_id_seq', 12, true);


--
-- Name: produits_phyto_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.produits_phyto_id_seq', 5, true);


--
-- Name: reception_achats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.reception_achats_id_seq', 1, false);


--
-- Name: recoltes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.recoltes_id_seq', 1780, true);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.refresh_tokens_id_seq', 291, true);


--
-- Name: security_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.security_logs_id_seq', 10, true);


--
-- Name: stocks_truffes_achetees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.stocks_truffes_achetees_id_seq', 1, false);


--
-- Name: taille_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.taille_details_id_seq', 1, false);


--
-- Name: traitement_phyto_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.traitement_phyto_details_id_seq', 1, false);


--
-- Name: travail_sol_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.travail_sol_details_id_seq', 1, false);


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

SELECT pg_catalog.setval('public.users_id_seq', 4, true);


--
-- Name: ventes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.ventes_id_seq', 192, true);


--
-- Name: topology_id_seq; Type: SEQUENCE SET; Schema: topology; Owner: unstuffed1004
--

SELECT pg_catalog.setval('topology.topology_id_seq', 1, false);


--
-- Name: amendement_details amendement_details_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.amendement_details
    ADD CONSTRAINT amendement_details_pkey PRIMARY KEY (id);


--
-- Name: amendements_ref amendements_ref_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.amendements_ref
    ADD CONSTRAINT amendements_ref_pkey PRIMARY KEY (id);


--
-- Name: analyse_marge_truffes analyse_marge_truffes_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.analyse_marge_truffes
    ADD CONSTRAINT analyse_marge_truffes_pkey PRIMARY KEY (id);


--
-- Name: analyse_sol_details analyse_sol_details_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.analyse_sol_details
    ADD CONSTRAINT analyse_sol_details_pkey PRIMARY KEY (id);


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
-- Name: audit_trail audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_pkey PRIMARY KEY (id);


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
-- Name: commandes_achat_truffes commandes_achat_truffes_numero_commande_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.commandes_achat_truffes
    ADD CONSTRAINT commandes_achat_truffes_numero_commande_key UNIQUE (numero_commande);


--
-- Name: commandes_achat_truffes commandes_achat_truffes_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.commandes_achat_truffes
    ADD CONSTRAINT commandes_achat_truffes_pkey PRIMARY KEY (id);


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
-- Name: contacts_fournisseurs_truffes contacts_fournisseurs_truffes_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.contacts_fournisseurs_truffes
    ADD CONSTRAINT contacts_fournisseurs_truffes_pkey PRIMARY KEY (id);


--
-- Name: especes_arbres especes_arbres_code_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.especes_arbres
    ADD CONSTRAINT especes_arbres_code_key UNIQUE (code);


--
-- Name: especes_arbres especes_arbres_nom_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.especes_arbres
    ADD CONSTRAINT especes_arbres_nom_key UNIQUE (nom);


--
-- Name: especes_arbres especes_arbres_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.especes_arbres
    ADD CONSTRAINT especes_arbres_pkey PRIMARY KEY (id);


--
-- Name: evaluations_fournisseurs_truffes evaluations_fournisseurs_truffes_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.evaluations_fournisseurs_truffes
    ADD CONSTRAINT evaluations_fournisseurs_truffes_pkey PRIMARY KEY (id);


--
-- Name: factures_achat_truffes factures_achat_truffes_numero_facture_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.factures_achat_truffes
    ADD CONSTRAINT factures_achat_truffes_numero_facture_key UNIQUE (numero_facture);


--
-- Name: factures_achat_truffes factures_achat_truffes_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.factures_achat_truffes
    ADD CONSTRAINT factures_achat_truffes_pkey PRIMARY KEY (id);


--
-- Name: fournisseurs_truffes fournisseurs_truffes_nom_key; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.fournisseurs_truffes
    ADD CONSTRAINT fournisseurs_truffes_nom_key UNIQUE (nom);


--
-- Name: fournisseurs_truffes fournisseurs_truffes_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.fournisseurs_truffes
    ADD CONSTRAINT fournisseurs_truffes_pkey PRIMARY KEY (id);


--
-- Name: historique historique_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.historique
    ADD CONSTRAINT historique_pkey PRIMARY KEY (id);


--
-- Name: inoculation_details inoculation_details_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.inoculation_details
    ADD CONSTRAINT inoculation_details_pkey PRIMARY KEY (id);


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
-- Name: irrigation_details irrigation_details_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.irrigation_details
    ADD CONSTRAINT irrigation_details_pkey PRIMARY KEY (id);


--
-- Name: lignes_commande_achat lignes_commande_achat_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.lignes_commande_achat
    ADD CONSTRAINT lignes_commande_achat_pkey PRIMARY KEY (id);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);


--
-- Name: observation_details observation_details_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.observation_details
    ADD CONSTRAINT observation_details_pkey PRIMARY KEY (id);


--
-- Name: paillage_details paillage_details_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.paillage_details
    ADD CONSTRAINT paillage_details_pkey PRIMARY KEY (id);


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
-- Name: piegeage_details piegeage_details_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.piegeage_details
    ADD CONSTRAINT piegeage_details_pkey PRIMARY KEY (id);


--
-- Name: plantation_details plantation_details_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.plantation_details
    ADD CONSTRAINT plantation_details_pkey PRIMARY KEY (id);


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
-- Name: reception_achats reception_achats_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.reception_achats
    ADD CONSTRAINT reception_achats_pkey PRIMARY KEY (id);


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
-- Name: security_logs security_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.security_logs
    ADD CONSTRAINT security_logs_pkey PRIMARY KEY (id);


--
-- Name: stocks_truffes_achetees stocks_truffes_achetees_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.stocks_truffes_achetees
    ADD CONSTRAINT stocks_truffes_achetees_pkey PRIMARY KEY (id);


--
-- Name: taille_details taille_details_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.taille_details
    ADD CONSTRAINT taille_details_pkey PRIMARY KEY (id);


--
-- Name: traitement_phyto_details traitement_phyto_details_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.traitement_phyto_details
    ADD CONSTRAINT traitement_phyto_details_pkey PRIMARY KEY (id);


--
-- Name: travail_sol_details travail_sol_details_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.travail_sol_details
    ADD CONSTRAINT travail_sol_details_pkey PRIMARY KEY (id);


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
-- Name: idx_amendement_intervention; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_amendement_intervention ON public.amendement_details USING btree (intervention_id);


--
-- Name: idx_analyse_marge_calibre; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_analyse_marge_calibre ON public.analyse_marge_truffes USING btree (calibre_mm);


--
-- Name: idx_analyse_marge_date_achat; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_analyse_marge_date_achat ON public.analyse_marge_truffes USING btree (date_achat);


--
-- Name: idx_analyse_sol_intervention; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_analyse_sol_intervention ON public.analyse_sol_details USING btree (intervention_id);


--
-- Name: idx_analysemarge_calibre; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_analysemarge_calibre ON public.analyse_marge_truffes USING btree (calibre_mm);


--
-- Name: idx_analysemarge_dateachat; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_analysemarge_dateachat ON public.analyse_marge_truffes USING btree (date_achat);


--
-- Name: idx_arbres_deleted_at; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_arbres_deleted_at ON public.arbres USING btree (deleted_at);


--
-- Name: idx_arbres_parcelle; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_arbres_parcelle ON public.arbres USING btree (parcelle_id);


--
-- Name: idx_audit_trail_created_at; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_audit_trail_created_at ON public.audit_trail USING btree (created_at);


--
-- Name: idx_audit_trail_entity; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_audit_trail_entity ON public.audit_trail USING btree (entity_type, entity_id);


--
-- Name: idx_audit_trail_user_id; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_audit_trail_user_id ON public.audit_trail USING btree (user_id);


--
-- Name: idx_commandes_achat_date; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_commandes_achat_date ON public.commandes_achat_truffes USING btree (date_commande);


--
-- Name: idx_commandes_achat_fournisseur; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_commandes_achat_fournisseur ON public.commandes_achat_truffes USING btree (fournisseur_id);


--
-- Name: idx_commandes_achat_statut; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_commandes_achat_statut ON public.commandes_achat_truffes USING btree (statut);


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
-- Name: idx_contacts_fournisseurs_truffes_id; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_contacts_fournisseurs_truffes_id ON public.contacts_fournisseurs_truffes USING btree (fournisseur_id);


--
-- Name: idx_especes_arbres_actif; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_especes_arbres_actif ON public.especes_arbres USING btree (actif);


--
-- Name: idx_especes_arbres_code; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_especes_arbres_code ON public.especes_arbres USING btree (code);


--
-- Name: idx_especes_arbres_nom; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_especes_arbres_nom ON public.especes_arbres USING btree (nom);


--
-- Name: idx_especes_arbres_principal; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_especes_arbres_principal ON public.especes_arbres USING btree (est_espece_principale);


--
-- Name: idx_evaluations_fournisseurs_truffes_fournisseur; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_evaluations_fournisseurs_truffes_fournisseur ON public.evaluations_fournisseurs_truffes USING btree (fournisseur_id);


--
-- Name: idx_factures_achat_date; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_factures_achat_date ON public.factures_achat_truffes USING btree (date_facture);


--
-- Name: idx_factures_achat_fournisseur; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_factures_achat_fournisseur ON public.factures_achat_truffes USING btree (fournisseur_id);


--
-- Name: idx_factures_achat_statut; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_factures_achat_statut ON public.factures_achat_truffes USING btree (statut_paiement);


--
-- Name: idx_fournisseurs_truffes_statut; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_fournisseurs_truffes_statut ON public.fournisseurs_truffes USING btree (statut);


--
-- Name: idx_fournisseurs_truffes_zone; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_fournisseurs_truffes_zone ON public.fournisseurs_truffes USING btree (zone_production);


--
-- Name: idx_historique_table_record; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_historique_table_record ON public.historique USING btree (table_name, record_id);


--
-- Name: idx_inoculation_intervention; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_inoculation_intervention ON public.inoculation_details USING btree (intervention_id);


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
-- Name: idx_irrigation_intervention; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_irrigation_intervention ON public.irrigation_details USING btree (intervention_id);


--
-- Name: idx_lignes_calibre_qualite; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_lignes_calibre_qualite ON public.lignes_commande_achat USING btree (calibre_mm, qualite);


--
-- Name: idx_lignes_commande_achat; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_lignes_commande_achat ON public.lignes_commande_achat USING btree (commande_id);


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
-- Name: idx_observation_intervention; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_observation_intervention ON public.observation_details USING btree (intervention_id);


--
-- Name: idx_paillage_intervention; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_paillage_intervention ON public.paillage_details USING btree (intervention_id);


--
-- Name: idx_password_reset_token_hash; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_password_reset_token_hash ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: idx_password_reset_user_id; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_password_reset_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_piegeage_intervention; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_piegeage_intervention ON public.piegeage_details USING btree (intervention_id);


--
-- Name: idx_plantation_intervention; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_plantation_intervention ON public.plantation_details USING btree (intervention_id);


--
-- Name: idx_reception_achats_commande; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_reception_achats_commande ON public.reception_achats USING btree (commande_id);


--
-- Name: idx_reception_achats_date; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_reception_achats_date ON public.reception_achats USING btree (date_reception);


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
-- Name: idx_refresh_tokens_parent; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_refresh_tokens_parent ON public.refresh_tokens USING btree (parent_token_id);


--
-- Name: idx_refresh_tokens_revoked; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_refresh_tokens_revoked ON public.refresh_tokens USING btree (revoked) WHERE (revoked = false);


--
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_security_logs_created_at; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_security_logs_created_at ON public.security_logs USING btree (created_at);


--
-- Name: idx_security_logs_event_type; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_security_logs_event_type ON public.security_logs USING btree (event_type);


--
-- Name: idx_security_logs_severity; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_security_logs_severity ON public.security_logs USING btree (severity);


--
-- Name: idx_security_logs_user_id; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_security_logs_user_id ON public.security_logs USING btree (user_id);


--
-- Name: idx_stocks_achetees_calibre; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_stocks_achetees_calibre ON public.stocks_truffes_achetees USING btree (calibre_mm);


--
-- Name: idx_stocks_achetees_limite_consommation; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_stocks_achetees_limite_consommation ON public.stocks_truffes_achetees USING btree (date_limite_consommation);


--
-- Name: idx_stocks_achetees_localisation; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_stocks_achetees_localisation ON public.stocks_truffes_achetees USING btree (localisation_storage);


--
-- Name: idx_stocks_achetees_qualite; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_stocks_achetees_qualite ON public.stocks_truffes_achetees USING btree (qualite);


--
-- Name: idx_taille_intervention; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_taille_intervention ON public.taille_details USING btree (intervention_id);


--
-- Name: idx_traitement_intervention; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_traitement_intervention ON public.traitement_phyto_details USING btree (intervention_id);


--
-- Name: idx_traitement_produit; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_traitement_produit ON public.traitement_phyto_details USING btree (nom_commercial);


--
-- Name: idx_travail_sol_intervention; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_travail_sol_intervention ON public.travail_sol_details USING btree (intervention_id);


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
-- Name: especes_arbres especes_arbres_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER especes_arbres_historique AFTER INSERT OR DELETE OR UPDATE ON public.especes_arbres FOR EACH ROW EXECUTE FUNCTION public.log_historique();


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
-- Name: users users_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER users_historique AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: ventes ventes_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER ventes_historique AFTER INSERT OR DELETE OR UPDATE ON public.ventes FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: amendement_details amendement_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.amendement_details
    ADD CONSTRAINT amendement_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: analyse_marge_truffes analyse_marge_truffes_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.analyse_marge_truffes
    ADD CONSTRAINT analyse_marge_truffes_stock_id_fkey FOREIGN KEY (stock_achat_id) REFERENCES public.stocks_truffes_achetees(id) ON DELETE CASCADE;


--
-- Name: analyse_sol_details analyse_sol_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.analyse_sol_details
    ADD CONSTRAINT analyse_sol_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: arbres arbres_parcelle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.arbres
    ADD CONSTRAINT arbres_parcelle_id_fkey FOREIGN KEY (parcelle_id) REFERENCES public.parcelles(id) ON DELETE CASCADE;


--
-- Name: audit_trail audit_trail_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: commandes_achat_truffes commandes_achat_truffes_fournisseur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.commandes_achat_truffes
    ADD CONSTRAINT commandes_achat_truffes_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs_truffes(id) ON DELETE SET NULL;


--
-- Name: commandes commandes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.commandes
    ADD CONSTRAINT commandes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: contacts_fournisseurs_truffes contacts_fournisseurs_truffes_fournisseur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.contacts_fournisseurs_truffes
    ADD CONSTRAINT contacts_fournisseurs_truffes_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs_truffes(id) ON DELETE CASCADE;


--
-- Name: evaluations_fournisseurs_truffes evaluations_fournisseurs_truffes_fournisseur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.evaluations_fournisseurs_truffes
    ADD CONSTRAINT evaluations_fournisseurs_truffes_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs_truffes(id) ON DELETE CASCADE;


--
-- Name: factures_achat_truffes factures_achat_truffes_commande_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.factures_achat_truffes
    ADD CONSTRAINT factures_achat_truffes_commande_id_fkey FOREIGN KEY (commande_id) REFERENCES public.commandes_achat_truffes(id) ON DELETE SET NULL;


--
-- Name: factures_achat_truffes factures_achat_truffes_fournisseur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.factures_achat_truffes
    ADD CONSTRAINT factures_achat_truffes_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs_truffes(id) ON DELETE SET NULL;


--
-- Name: amendement_details fk_amendement_intervention; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.amendement_details
    ADD CONSTRAINT fk_amendement_intervention FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: analyse_sol_details fk_analyse_sol_intervention; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.analyse_sol_details
    ADD CONSTRAINT fk_analyse_sol_intervention FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: inoculation_details fk_inoculation_intervention; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.inoculation_details
    ADD CONSTRAINT fk_inoculation_intervention FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: irrigation_details fk_irrigation_intervention; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.irrigation_details
    ADD CONSTRAINT fk_irrigation_intervention FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: observation_details fk_observation_intervention; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.observation_details
    ADD CONSTRAINT fk_observation_intervention FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: paillage_details fk_paillage_intervention; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.paillage_details
    ADD CONSTRAINT fk_paillage_intervention FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens fk_parent_token; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT fk_parent_token FOREIGN KEY (parent_token_id) REFERENCES public.refresh_tokens(id) ON DELETE SET NULL;


--
-- Name: piegeage_details fk_piegeage_intervention; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.piegeage_details
    ADD CONSTRAINT fk_piegeage_intervention FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: plantation_details fk_plantation_intervention; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.plantation_details
    ADD CONSTRAINT fk_plantation_intervention FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: taille_details fk_taille_intervention; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.taille_details
    ADD CONSTRAINT fk_taille_intervention FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: traitement_phyto_details fk_traitement_intervention; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.traitement_phyto_details
    ADD CONSTRAINT fk_traitement_intervention FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: travail_sol_details fk_travail_sol_intervention; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.travail_sol_details
    ADD CONSTRAINT fk_travail_sol_intervention FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: inoculation_details inoculation_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.inoculation_details
    ADD CONSTRAINT inoculation_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


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
-- Name: irrigation_details irrigation_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.irrigation_details
    ADD CONSTRAINT irrigation_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: lignes_commande_achat lignes_commande_achat_commande_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.lignes_commande_achat
    ADD CONSTRAINT lignes_commande_achat_commande_id_fkey FOREIGN KEY (commande_id) REFERENCES public.commandes_achat_truffes(id) ON DELETE CASCADE;


--
-- Name: observation_details observation_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.observation_details
    ADD CONSTRAINT observation_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: paillage_details paillage_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.paillage_details
    ADD CONSTRAINT paillage_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: piegeage_details piegeage_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.piegeage_details
    ADD CONSTRAINT piegeage_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: plantation_details plantation_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.plantation_details
    ADD CONSTRAINT plantation_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: reception_achats reception_achats_commande_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.reception_achats
    ADD CONSTRAINT reception_achats_commande_id_fkey FOREIGN KEY (commande_id) REFERENCES public.commandes_achat_truffes(id) ON DELETE CASCADE;


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
-- Name: security_logs security_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.security_logs
    ADD CONSTRAINT security_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stocks_truffes_achetees stocks_truffes_achetees_ligne_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.stocks_truffes_achetees
    ADD CONSTRAINT stocks_truffes_achetees_ligne_id_fkey FOREIGN KEY (ligne_commande_id) REFERENCES public.lignes_commande_achat(id) ON DELETE SET NULL;


--
-- Name: taille_details taille_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.taille_details
    ADD CONSTRAINT taille_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: traitement_phyto_details traitement_phyto_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.traitement_phyto_details
    ADD CONSTRAINT traitement_phyto_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


--
-- Name: travail_sol_details travail_sol_details_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.travail_sol_details
    ADD CONSTRAINT travail_sol_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;


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

