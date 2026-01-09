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
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
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
-- Data for Name: arbres; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.arbres (id, parcelle_id, numero, espece, variete_truffe, date_plantation, "position", etat, circonference_cm, hauteur_m, date_derniere_taille, notes, created_at, updated_at, latitude, longitude, deleted_at) FROM stdin;
3	2	B001	Noisetier	Tuber melanosporum	2019-03-20	\N	Bon	\N	\N	\N	\N	2025-12-29 11:47:49.052547	2026-01-01 15:50:55.47752	\N	\N	\N
5	1	A551	Chêne pédonculé	Tuber aestivum	2021-05-05	\N	Bon	35.0	2.0	\N	\N	2025-12-29 19:54:51.211234	2026-01-01 16:27:19.630866	\N	\N	\N
4	2	B002	Chêne pubescent	Tuber melanosporum	2019-03-20	\N	Moyen	\N	\N	\N	\N	2025-12-29 11:47:49.052547	2025-12-29 11:47:49.052547	\N	\N	\N
1	1	A0012	Chêne pubescent	Tuber melanosporum	2018-11-15	\N	Bon	32.0	35.0	\N		2025-12-29 11:47:49.052547	2026-01-01 16:27:19.581977	46.15627250	-0.15492930	\N
\.


--
-- Data for Name: caveurs; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.caveurs (id, nom, created_at, updated_at) FROM stdin;
1	Marc	2026-01-01 17:16:49.500515	2026-01-02 18:51:06.493145
\.


--
-- Data for Name: chiens; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.chiens (id, nom, race, created_at, updated_at) FROM stdin;
1	Sweetie	Lagotto Romagnolo	2026-01-01 17:17:58.823905	2026-01-01 17:17:58.823905
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.clients (id, type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays, siret, notes, date_premier_achat, created_at, updated_at) FROM stdin;
1	Restaurant	toto	\N	Client	sdfsdf@gtrer.fr	0606060606		79480	Titi	France			\N	2025-12-31 15:56:34.682423	2025-12-31 15:56:34.682423
\.


--
-- Data for Name: commandes; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.commandes (id, client_id, numero_commande, date_commande, date_livraison_demandee, poids_grammes, calibre, qualite, maturite, prix_unitaire_kg, montant_total, statut, notes, created_at, updated_at) FROM stdin;
1	1	CMD-2025-0001	2025-12-31	2026-01-03	250.00	Petit	Extra	À point	850.00	212.50	Livrée	OK	2025-12-31 15:56:55.579559	2026-01-02 18:48:49.690379
\.


--
-- Data for Name: historique; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.historique (id, table_name, record_id, action, old_data, new_data, user_name, "timestamp") FROM stdin;
38	arbres	3	UPDATE	{"id": 3, "etat": "Bon", "notes": null, "espece": "Noisetier", "numero": "B001", "latitude": null, "position": null, "hauteur_m": null, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2025-12-31T17:07:02.560944", "parcelle_id": 2, "variete_truffe": "Tuber melanosporum", "date_plantation": "2019-03-20", "circonference_cm": null, "date_derniere_taille": null}	{"id": 3, "etat": "Bon", "notes": null, "espece": "Noisetier", "numero": "B001", "latitude": 46.17032955, "position": null, "hauteur_m": null, "longitude": -0.13488293, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T14:06:56.418822", "parcelle_id": 2, "variete_truffe": "Tuber melanosporum", "date_plantation": "2019-03-20", "circonference_cm": null, "date_derniere_taille": null}	\N	2026-01-01 14:06:56.418822
39	arbres	3	UPDATE	{"id": 3, "etat": "Bon", "notes": null, "espece": "Noisetier", "numero": "B001", "latitude": 46.17032955, "position": null, "hauteur_m": null, "longitude": -0.13488293, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T14:06:56.418822", "parcelle_id": 2, "variete_truffe": "Tuber melanosporum", "date_plantation": "2019-03-20", "circonference_cm": null, "date_derniere_taille": null}	{"id": 3, "etat": "Bon", "notes": null, "espece": "Noisetier", "numero": "B001", "latitude": null, "position": null, "hauteur_m": null, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T15:50:55.47752", "parcelle_id": 2, "variete_truffe": "Tuber melanosporum", "date_plantation": "2019-03-20", "circonference_cm": null, "date_derniere_taille": null}	\N	2026-01-01 15:50:55.47752
40	recoltes	1	INSERT	\N	{"id": 1, "chien": null, "notes": null, "caveur": "Marc", "equipe": null, "calibre": "Moyen (20-50g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 1, "maturite": "À point", "created_at": "2026-01-01T16:14:24.894188", "parcelle_id": 3, "date_recolte": "2025-12-31", "poids_grammes": 42.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	\N	2026-01-01 16:14:24.894188
41	arbres	1	UPDATE	{"id": 1, "etat": "Bon", "notes": null, "espece": "Chêne pubescent", "numero": "A0012", "latitude": 46.16848900, "position": null, "hauteur_m": 35.0, "longitude": -0.13374400, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2025-12-31T16:56:52.903254", "parcelle_id": 3, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	{"id": 1, "etat": "Bon", "notes": null, "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:15:04.384889", "parcelle_id": 3, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	\N	2026-01-01 16:15:04.384889
42	commandes	1	UPDATE	{"id": 1, "notes": "", "statut": "Annulée", "calibre": "Moyen (20-50g)", "qualite": "Première catégorie", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2025-12-31T17:27:07.03244", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	{"id": 1, "notes": "", "statut": "En préparation", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T16:16:33.723991", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	\N	2026-01-01 16:16:33.723991
43	commandes	1	UPDATE	{"id": 1, "notes": "", "statut": "En préparation", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T16:16:33.723991", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	{"id": 1, "notes": "", "statut": "Livrée", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T16:17:01.250684", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	\N	2026-01-01 16:17:01.250684
44	recoltes	2	INSERT	\N	{"id": 2, "chien": null, "notes": null, "caveur": null, "equipe": null, "calibre": "Petit (moins de 20g)", "prix_kg": null, "qualite": "Première catégorie", "arbre_id": 1, "maturite": "Mature", "created_at": "2026-01-01T16:17:47.74005", "parcelle_id": 3, "date_recolte": "2026-01-01", "poids_grammes": 25.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	\N	2026-01-01 16:17:47.74005
45	recoltes	2	UPDATE	{"id": 2, "chien": null, "notes": null, "caveur": null, "equipe": null, "calibre": "Petit (moins de 20g)", "prix_kg": null, "qualite": "Première catégorie", "arbre_id": 1, "maturite": "Mature", "created_at": "2026-01-01T16:17:47.74005", "parcelle_id": 3, "date_recolte": "2026-01-01", "poids_grammes": 25.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	{"id": 2, "chien": null, "notes": null, "caveur": null, "equipe": null, "calibre": "Petit (moins de 20g)", "prix_kg": null, "qualite": "Première catégorie", "arbre_id": 1, "maturite": "Mature", "created_at": "2026-01-01T16:17:47.74005", "parcelle_id": 3, "date_recolte": "2026-01-01", "poids_grammes": 25.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	\N	2026-01-01 16:19:51.728682
46	recoltes	2	UPDATE	{"id": 2, "chien": null, "notes": null, "caveur": null, "equipe": null, "calibre": "Petit (moins de 20g)", "prix_kg": null, "qualite": "Première catégorie", "arbre_id": 1, "maturite": "Mature", "created_at": "2026-01-01T16:17:47.74005", "parcelle_id": 3, "date_recolte": "2026-01-01", "poids_grammes": 25.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	{"id": 2, "chien": null, "notes": null, "caveur": null, "equipe": null, "calibre": "Petit (moins de 20g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 1, "maturite": "Mature", "created_at": "2026-01-01T16:17:47.74005", "parcelle_id": 3, "date_recolte": "2026-01-01", "poids_grammes": 25.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	\N	2026-01-01 16:19:59.707579
47	recoltes	2	UPDATE	{"id": 2, "chien": null, "notes": null, "caveur": null, "equipe": null, "calibre": "Petit (moins de 20g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 1, "maturite": "Mature", "created_at": "2026-01-01T16:17:47.74005", "parcelle_id": 3, "date_recolte": "2026-01-01", "poids_grammes": 25.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	{"id": 2, "chien": null, "notes": null, "caveur": null, "equipe": null, "calibre": "Petit (moins de 20g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 1, "maturite": "Mature", "created_at": "2026-01-01T16:17:47.74005", "parcelle_id": 3, "date_recolte": "2026-01-01", "poids_grammes": 37.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	\N	2026-01-01 16:21:08.901751
48	recoltes	2	UPDATE	{"id": 2, "chien": null, "notes": null, "caveur": null, "equipe": null, "calibre": "Petit (moins de 20g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 1, "maturite": "Mature", "created_at": "2026-01-01T16:17:47.74005", "parcelle_id": 3, "date_recolte": "2026-01-01", "poids_grammes": 37.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	{"id": 2, "chien": null, "notes": null, "caveur": null, "equipe": null, "calibre": "Petit (moins de 20g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 1, "maturite": "Mature", "created_at": "2026-01-01T16:17:47.74005", "parcelle_id": 3, "date_recolte": "2026-01-01", "poids_grammes": 37.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	\N	2026-01-01 16:21:24.942131
49	recoltes	3	INSERT	\N	{"id": 3, "chien": null, "notes": null, "caveur": "Marc", "equipe": null, "calibre": "Très gros (plus de 100g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 3, "maturite": null, "created_at": "2026-01-01T16:24:20.054613", "parcelle_id": 2, "date_recolte": "2026-01-01", "poids_grammes": 542.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	\N	2026-01-01 16:24:20.054613
50	arbres	1	UPDATE	{"id": 1, "etat": "Bon", "notes": null, "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:15:04.384889", "parcelle_id": 3, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	{"id": 1, "etat": "Bon", "notes": null, "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	\N	2026-01-01 16:27:19.581977
51	arbres	5	UPDATE	{"id": 5, "etat": "Bon", "notes": "", "espece": "Chêne pédonculé", "numero": "A551", "latitude": null, "position": null, "hauteur_m": 2.0, "longitude": null, "created_at": "2025-12-29T19:54:51.211234", "deleted_at": null, "updated_at": "2025-12-29T19:54:51.211234", "parcelle_id": 3, "variete_truffe": "Tuber aestivum", "date_plantation": "2021-05-05", "circonference_cm": 35.0, "date_derniere_taille": null}	{"id": 5, "etat": "Bon", "notes": null, "espece": "Chêne pédonculé", "numero": "A551", "latitude": null, "position": null, "hauteur_m": 2.0, "longitude": null, "created_at": "2025-12-29T19:54:51.211234", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.630866", "parcelle_id": 1, "variete_truffe": "Tuber aestivum", "date_plantation": "2021-05-05", "circonference_cm": 35.0, "date_derniere_taille": null}	\N	2026-01-01 16:27:19.630866
52	recoltes	2	UPDATE	{"id": 2, "chien": null, "notes": null, "caveur": null, "equipe": null, "calibre": "Petit (moins de 20g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 1, "maturite": "Mature", "created_at": "2026-01-01T16:17:47.74005", "parcelle_id": 3, "date_recolte": "2026-01-01", "poids_grammes": 37.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	{"id": 2, "chien": null, "notes": null, "caveur": null, "equipe": null, "calibre": "Petit (moins de 20g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 1, "maturite": "Mature", "created_at": "2026-01-01T16:17:47.74005", "parcelle_id": 1, "date_recolte": "2026-01-01", "poids_grammes": 37.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	\N	2026-01-01 16:27:19.645982
53	recoltes	1	UPDATE	{"id": 1, "chien": null, "notes": null, "caveur": "Marc", "equipe": null, "calibre": "Moyen (20-50g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 1, "maturite": "À point", "created_at": "2026-01-01T16:14:24.894188", "parcelle_id": 3, "date_recolte": "2025-12-31", "poids_grammes": 42.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	{"id": 1, "chien": null, "notes": null, "caveur": "Marc", "equipe": null, "calibre": "Moyen (20-50g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 1, "maturite": "À point", "created_at": "2026-01-01T16:14:24.894188", "parcelle_id": 1, "date_recolte": "2025-12-31", "poids_grammes": 42.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	\N	2026-01-01 16:27:19.662696
54	interventions	1	INSERT	\N	{"id": 1, "cout": null, "meteo": "Nuageux", "notes": "", "statut": "En cours", "arbre_id": null, "personnel": "", "created_at": "2026-01-01T16:41:53.443067", "updated_at": "2026-01-01T16:41:53.443067", "date_prevue": "2026-01-01", "description": "", "parcelle_id": 1, "date_realisee": "2026-01-03", "duree_minutes": 150, "type_intervention_id": 4}	\N	2026-01-01 16:41:53.443067
55	interventions	1	UPDATE	{"id": 1, "cout": null, "meteo": "Nuageux", "notes": "", "statut": "En cours", "arbre_id": null, "personnel": "", "created_at": "2026-01-01T16:41:53.443067", "updated_at": "2026-01-01T16:41:53.443067", "date_prevue": "2026-01-01", "description": "", "parcelle_id": 1, "date_realisee": "2026-01-03", "duree_minutes": 150, "type_intervention_id": 4}	{"id": 1, "cout": null, "meteo": "Nuageux", "notes": "qsqafghkjfhyukyhjk", "statut": "En cours", "arbre_id": null, "personnel": "Marc", "created_at": "2026-01-01T16:41:53.443067", "updated_at": "2026-01-01T16:41:53.443067", "date_prevue": "2026-01-01", "description": "ddfgdfgd", "parcelle_id": 1, "date_realisee": "2026-01-03", "duree_minutes": 150, "type_intervention_id": 4}	\N	2026-01-01 16:42:03.703012
56	interventions	1	UPDATE	{"id": 1, "cout": null, "meteo": "Nuageux", "notes": "qsqafghkjfhyukyhjk", "statut": "En cours", "arbre_id": null, "personnel": "Marc", "created_at": "2026-01-01T16:41:53.443067", "updated_at": "2026-01-01T16:41:53.443067", "date_prevue": "2026-01-01", "description": "ddfgdfgd", "parcelle_id": 1, "date_realisee": "2026-01-03", "duree_minutes": 150, "type_intervention_id": 4}	{"id": 1, "cout": null, "meteo": "Nuageux", "notes": "qsqafghkjfhyukyhjk", "statut": "En cours", "arbre_id": null, "personnel": "Marc", "created_at": "2026-01-01T16:41:53.443067", "updated_at": "2026-01-01T16:41:53.443067", "date_prevue": "2026-01-01", "description": "ddfgdfgd", "parcelle_id": 1, "date_realisee": "2026-01-03", "duree_minutes": 150, "type_intervention_id": 4}	\N	2026-01-01 16:42:31.165946
57	interventions	1	UPDATE	{"id": 1, "cout": null, "meteo": "Nuageux", "notes": "qsqafghkjfhyukyhjk", "statut": "En cours", "arbre_id": null, "personnel": "Marc", "created_at": "2026-01-01T16:41:53.443067", "updated_at": "2026-01-01T16:41:53.443067", "date_prevue": "2026-01-01", "description": "ddfgdfgd", "parcelle_id": 1, "date_realisee": "2026-01-03", "duree_minutes": 150, "type_intervention_id": 4}	{"id": 1, "cout": null, "meteo": "Nuageux", "notes": "qsqafghkjfhyukyhjk", "statut": "En cours", "arbre_id": null, "personnel": "Marcsqdfsd", "created_at": "2026-01-01T16:41:53.443067", "updated_at": "2026-01-01T16:41:53.443067", "date_prevue": "2026-01-01", "description": "ddfgdfgd", "parcelle_id": 1, "date_realisee": "2026-01-03", "duree_minutes": 150, "type_intervention_id": 4}	\N	2026-01-01 16:42:35.380755
58	interventions	1	UPDATE	{"id": 1, "cout": null, "meteo": "Nuageux", "notes": "qsqafghkjfhyukyhjk", "statut": "En cours", "arbre_id": null, "personnel": "Marcsqdfsd", "created_at": "2026-01-01T16:41:53.443067", "updated_at": "2026-01-01T16:41:53.443067", "date_prevue": "2026-01-01", "description": "ddfgdfgd", "parcelle_id": 1, "date_realisee": "2026-01-03", "duree_minutes": 150, "type_intervention_id": 4}	{"id": 1, "cout": null, "meteo": "Nuageux", "notes": "qsqafghkjfhyukyhjk", "statut": "En cours", "arbre_id": null, "personnel": "Marc", "created_at": "2026-01-01T16:41:53.443067", "updated_at": "2026-01-01T16:41:53.443067", "date_prevue": "2026-01-01", "description": "ddfgdfgd", "parcelle_id": 1, "date_realisee": "2026-01-03", "duree_minutes": 150, "type_intervention_id": 4}	\N	2026-01-01 16:43:08.964157
59	interventions	1	DELETE	{"id": 1, "cout": null, "meteo": "Nuageux", "notes": "qsqafghkjfhyukyhjk", "statut": "En cours", "arbre_id": null, "personnel": "Marc", "created_at": "2026-01-01T16:41:53.443067", "updated_at": "2026-01-01T16:41:53.443067", "date_prevue": "2026-01-01", "description": "ddfgdfgd", "parcelle_id": 1, "date_realisee": "2026-01-03", "duree_minutes": 150, "type_intervention_id": 4}	\N	\N	2026-01-01 16:43:20.723728
60	interventions	2	INSERT	\N	{"id": 2, "cout": null, "meteo": "Orageux", "notes": "", "statut": "Planifié", "arbre_id": 1, "personnel": "", "created_at": "2026-01-01T16:44:05.819861", "updated_at": "2026-01-01T16:44:05.819861", "date_prevue": "2026-01-01", "description": "", "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	\N	2026-01-01 16:44:05.819861
61	interventions	3	INSERT	\N	{"id": 3, "cout": null, "meteo": "Orageux", "notes": "", "statut": "Planifié", "arbre_id": 5, "personnel": "", "created_at": "2026-01-01T16:44:05.843796", "updated_at": "2026-01-01T16:44:05.843796", "date_prevue": "2026-01-01", "description": "", "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	\N	2026-01-01 16:44:05.843796
62	interventions	3	UPDATE	{"id": 3, "cout": null, "meteo": "Orageux", "notes": "", "statut": "Planifié", "arbre_id": 5, "personnel": "", "created_at": "2026-01-01T16:44:05.843796", "updated_at": "2026-01-01T16:44:05.843796", "date_prevue": "2026-01-01", "description": "", "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	{"id": 3, "cout": null, "meteo": "Orageux", "notes": "", "statut": "Planifié", "arbre_id": 1, "personnel": "", "created_at": "2026-01-01T16:44:05.843796", "updated_at": "2026-01-01T16:44:05.843796", "date_prevue": "2026-01-01", "description": "", "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	\N	2026-01-01 16:45:58.764049
63	ventes	8	INSERT	\N	{"id": 8, "notes": "", "statut": "Payée", "client_id": 1, "created_at": "2026-01-01T18:01:51.990137", "date_vente": "2026-01-01", "recolte_id": 3, "commande_id": null, "mode_paiement": "Espèces", "montant_total": 28.90, "numero_facture": "FACT-2026-001", "prix_unitaire_kg": 850.00, "quantite_grammes": 34.00}	\N	2026-01-01 18:01:51.990137
64	commandes	1	UPDATE	{"id": 1, "notes": "", "statut": "Livrée", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T16:17:01.250684", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	{"id": 1, "notes": "", "statut": "En préparation", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T18:02:36.530353", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	\N	2026-01-01 18:02:36.530353
65	commandes	1	UPDATE	{"id": 1, "notes": "", "statut": "En préparation", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T18:02:36.530353", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	{"id": 1, "notes": "", "statut": "Livrée", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T18:02:40.889221", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	\N	2026-01-01 18:02:40.889221
66	ventes	9	INSERT	\N	{"id": 9, "notes": "Vente crée automatiquement depuis commande #1", "statut": "En attente", "client_id": 1, "created_at": "2026-01-01T18:02:40.908669", "date_vente": "2026-01-01", "recolte_id": null, "commande_id": 1, "mode_paiement": "", "montant_total": 212.50, "numero_facture": "FACT-2026-002", "prix_unitaire_kg": 850.00, "quantite_grammes": 250.00}	\N	2026-01-01 18:02:40.908669
67	interventions	2	UPDATE	{"id": 2, "cout": null, "meteo": "Orageux", "notes": "", "statut": "Planifié", "arbre_id": 1, "personnel": "", "created_at": "2026-01-01T16:44:05.819861", "updated_at": "2026-01-01T16:44:05.819861", "date_prevue": "2026-01-01", "description": "", "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	{"id": 2, "cout": null, "meteo": "Orageux", "notes": null, "statut": "Planifié", "arbre_id": 1, "personnel": null, "created_at": "2026-01-01T16:44:05.819861", "updated_at": "2026-01-01T16:44:05.819861", "date_prevue": "2026-01-01", "description": null, "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	\N	2026-01-01 18:08:19.06684
68	interventions	3	UPDATE	{"id": 3, "cout": null, "meteo": "Orageux", "notes": "", "statut": "Planifié", "arbre_id": 1, "personnel": "", "created_at": "2026-01-01T16:44:05.843796", "updated_at": "2026-01-01T16:44:05.843796", "date_prevue": "2026-01-01", "description": "", "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	{"id": 3, "cout": null, "meteo": "Orageux", "notes": null, "statut": "Planifié", "arbre_id": 1, "personnel": "Marc", "created_at": "2026-01-01T16:44:05.843796", "updated_at": "2026-01-01T16:44:05.843796", "date_prevue": "2026-01-01", "description": null, "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	\N	2026-01-01 18:09:18.937824
69	interventions	2	UPDATE	{"id": 2, "cout": null, "meteo": "Orageux", "notes": null, "statut": "Planifié", "arbre_id": 1, "personnel": null, "created_at": "2026-01-01T16:44:05.819861", "updated_at": "2026-01-01T16:44:05.819861", "date_prevue": "2026-01-01", "description": null, "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	{"id": 2, "cout": null, "meteo": "Orageux", "notes": null, "statut": "Planifié", "arbre_id": 1, "personnel": "Marc", "created_at": "2026-01-01T16:44:05.819861", "updated_at": "2026-01-01T16:44:05.819861", "date_prevue": "2026-01-01", "description": null, "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	\N	2026-01-01 18:09:24.766509
70	recoltes	4	INSERT	\N	{"id": 4, "chien": "Sweetie", "notes": null, "caveur": "Marc", "equipe": null, "calibre": "Petit (moins de 20g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 3, "maturite": "Très mature", "created_at": "2026-01-01T19:14:13.80894", "parcelle_id": 2, "date_recolte": "2026-01-01", "poids_grammes": 66.00, "profondeur_cm": 9, "temperature_sol": null, "conditions_meteo": "Nuageux"}	\N	2026-01-01 19:14:13.80894
71	interventions	2	UPDATE	{"id": 2, "cout": null, "meteo": "Orageux", "notes": null, "statut": "Planifié", "arbre_id": 1, "personnel": "Marc", "created_at": "2026-01-01T16:44:05.819861", "updated_at": "2026-01-01T16:44:05.819861", "date_prevue": "2026-01-01", "description": null, "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	{"id": 2, "cout": null, "meteo": "Orageux", "notes": null, "statut": "Planifié", "arbre_id": 5, "personnel": "Marc", "created_at": "2026-01-01T16:44:05.819861", "updated_at": "2026-01-01T16:44:05.819861", "date_prevue": "2026-01-01", "description": null, "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	\N	2026-01-01 19:19:28.329761
72	commandes	1	UPDATE	{"id": 1, "notes": "", "statut": "Livrée", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T18:02:40.889221", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	{"id": 1, "notes": "", "statut": "En préparation", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T19:40:38.309904", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	\N	2026-01-01 19:40:38.309904
73	commandes	1	UPDATE	{"id": 1, "notes": "", "statut": "En préparation", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T19:40:38.309904", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	{"id": 1, "notes": "", "statut": "Livrée", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T19:40:41.885774", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	\N	2026-01-01 19:40:41.885774
74	ventes	8	DELETE	{"id": 8, "notes": "", "statut": "Payée", "client_id": 1, "created_at": "2026-01-01T18:01:51.990137", "date_vente": "2026-01-01", "recolte_id": 3, "commande_id": null, "mode_paiement": "Espèces", "montant_total": 28.90, "numero_facture": "FACT-2026-001", "prix_unitaire_kg": 850.00, "quantite_grammes": 34.00}	\N	\N	2026-01-01 19:40:51.26354
75	ventes	9	DELETE	{"id": 9, "notes": "Vente crée automatiquement depuis commande #1", "statut": "En attente", "client_id": 1, "created_at": "2026-01-01T18:02:40.908669", "date_vente": "2026-01-01", "recolte_id": null, "commande_id": 1, "mode_paiement": "", "montant_total": 212.50, "numero_facture": "FACT-2026-002", "prix_unitaire_kg": 850.00, "quantite_grammes": 250.00}	\N	\N	2026-01-01 19:40:52.636025
76	commandes	1	UPDATE	{"id": 1, "notes": "", "statut": "Livrée", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T19:40:41.885774", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	{"id": 1, "notes": "", "statut": "En préparation", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T19:40:57.127334", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	\N	2026-01-01 19:40:57.127334
77	commandes	1	UPDATE	{"id": 1, "notes": "", "statut": "En préparation", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T19:40:57.127334", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	{"id": 1, "notes": "", "statut": "Livrée", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T19:41:00.828354", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	\N	2026-01-01 19:41:00.828354
78	ventes	10	INSERT	\N	{"id": 10, "notes": "Vente issue de la commande NÃ‚Â°CMD-2025-0001", "statut": "En attente", "client_id": 1, "created_at": "2026-01-01T19:41:00.864767", "date_vente": "2026-01-01", "recolte_id": null, "commande_id": 1, "mode_paiement": "", "montant_total": 212.50, "numero_facture": "FACT-2026-001", "prix_unitaire_kg": 850.00, "quantite_grammes": 250.00}	\N	2026-01-01 19:41:00.864767
79	ventes	10	UPDATE	{"id": 10, "notes": "Vente issue de la commande NÃ‚Â°CMD-2025-0001", "statut": "En attente", "client_id": 1, "created_at": "2026-01-01T19:41:00.864767", "date_vente": "2026-01-01", "recolte_id": null, "commande_id": 1, "mode_paiement": "", "montant_total": 212.50, "numero_facture": "FACT-2026-001", "prix_unitaire_kg": 850.00, "quantite_grammes": 250.00}	{"id": 10, "notes": "Vente issue de la commande NÃ‚Â°CMD-2025-0001", "statut": "Payée", "client_id": 1, "created_at": "2026-01-01T19:41:00.864767", "date_vente": "2026-01-01", "recolte_id": 3, "commande_id": null, "mode_paiement": "", "montant_total": 212.50, "numero_facture": "FACT-2026-001", "prix_unitaire_kg": 850.00, "quantite_grammes": 250.00}	\N	2026-01-01 20:05:37.591148
80	recoltes	3	UPDATE	{"id": 3, "chien": null, "notes": null, "caveur": "Marc", "equipe": null, "calibre": "Très gros (plus de 100g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 3, "maturite": null, "created_at": "2026-01-01T16:24:20.054613", "parcelle_id": 2, "date_recolte": "2026-01-01", "poids_grammes": 542.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	{"id": 3, "chien": null, "notes": null, "caveur": "Marc", "equipe": null, "calibre": "Très gros (plus de 100g)", "prix_kg": null, "qualite": "Extra", "arbre_id": 3, "maturite": null, "created_at": "2026-01-01T16:24:20.054613", "parcelle_id": 2, "date_recolte": "2026-01-01", "poids_grammes": 542.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	\N	2026-01-01 20:17:04.734108
81	recoltes	3	UPDATE	{"id": 3, "chien": null, "notes": null, "caveur": "Marc", "calibre": "Très gros (plus de 100g)", "qualite": "Extra", "arbre_id": 3, "maturite": null, "created_at": "2026-01-01T16:24:20.054613", "parcelle_id": 2, "date_recolte": "2026-01-01", "poids_grammes": 542.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	{"id": 3, "chien": null, "notes": null, "caveur": "Marc", "calibre": "Très gros (plus de 100g)", "qualite": "Extra", "arbre_id": 3, "maturite": null, "created_at": "2026-01-01T16:24:20.054613", "parcelle_id": 2, "date_recolte": "2026-01-01", "poids_grammes": 542.00, "profondeur_cm": null, "temperature_sol": null, "conditions_meteo": null}	\N	2026-01-01 21:13:23.214631
82	interventions	2	UPDATE	{"id": 2, "cout": null, "meteo": "Orageux", "notes": null, "statut": "Planifié", "arbre_id": 5, "personnel": "Marc", "created_at": "2026-01-01T16:44:05.819861", "updated_at": "2026-01-01T16:44:05.819861", "date_prevue": "2026-01-01", "description": null, "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	{"id": 2, "cout": null, "meteo": "Orageux", "notes": null, "statut": "Planifié", "arbre_id": 5, "personnel": "Marc", "created_at": "2026-01-01T16:44:05.819861", "updated_at": "2026-01-01T16:44:05.819861", "date_prevue": "2026-01-01", "description": null, "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	\N	2026-01-01 23:13:51.721
83	arbres	4	UPDATE	{"id": 4, "etat": "Moyen", "notes": null, "espece": "Chêne pubescent", "numero": "B002", "latitude": null, "position": null, "hauteur_m": null, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2025-12-29T11:47:49.052547", "parcelle_id": 2, "variete_truffe": "Tuber melanosporum", "date_plantation": "2019-03-20", "circonference_cm": null, "date_derniere_taille": null}	{"id": 4, "etat": "Moyen", "notes": null, "espece": "Chêne pubescent", "numero": "B002", "latitude": null, "position": null, "hauteur_m": null, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": "2026-01-01T23:14:13.298292", "updated_at": "2025-12-29T11:47:49.052547", "parcelle_id": 2, "variete_truffe": "Tuber melanosporum", "date_plantation": "2019-03-20", "circonference_cm": null, "date_derniere_taille": null}	\N	2026-01-01 23:14:13.298292
84	arbres	4	UPDATE	{"id": 4, "etat": "Moyen", "notes": null, "espece": "Chêne pubescent", "numero": "B002", "latitude": null, "position": null, "hauteur_m": null, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": "2026-01-01T23:14:13.298292", "updated_at": "2025-12-29T11:47:49.052547", "parcelle_id": 2, "variete_truffe": "Tuber melanosporum", "date_plantation": "2019-03-20", "circonference_cm": null, "date_derniere_taille": null}	{"id": 4, "etat": "Moyen", "notes": null, "espece": "Chêne pubescent", "numero": "B002", "latitude": null, "position": null, "hauteur_m": null, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2025-12-29T11:47:49.052547", "parcelle_id": 2, "variete_truffe": "Tuber melanosporum", "date_plantation": "2019-03-20", "circonference_cm": null, "date_derniere_taille": null}	\N	2026-01-01 23:14:16.319982
85	users	1	INSERT	\N	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": null, "updated_at": "2026-01-02T16:29:54.193672", "locked_until": null, "password_hash": "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qVYrXqLYZtqZGK", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 16:29:54.193672
86	users	1	UPDATE	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": null, "updated_at": "2026-01-02T16:29:54.193672", "locked_until": null, "password_hash": "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qVYrXqLYZtqZGK", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": null, "updated_at": "2026-01-02T18:06:29.147504", "locked_until": null, "password_hash": "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qVYrXqLYZtqZGK", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 1}	\N	2026-01-02 18:06:29.147504
87	users	1	UPDATE	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": null, "updated_at": "2026-01-02T18:06:29.147504", "locked_until": null, "password_hash": "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qVYrXqLYZtqZGK", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 1}	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": null, "updated_at": "2026-01-02T18:06:48.680654", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 1}	\N	2026-01-02 18:06:48.680654
88	users	1	UPDATE	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": null, "updated_at": "2026-01-02T18:06:48.680654", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 1}	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": "2026-01-02T18:11:58.05863", "updated_at": "2026-01-02T18:11:58.05863", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:11:58.05863
89	users	1	UPDATE	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": "2026-01-02T18:11:58.05863", "updated_at": "2026-01-02T18:11:58.05863", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": "2026-01-02T18:13:09.978543", "updated_at": "2026-01-02T18:13:09.978543", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:13:09.978543
90	users	2	INSERT	\N	{"id": 2, "nom": "Samuel", "role": "admin", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": null, "updated_at": "2026-01-02T18:13:44.355252", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:13:44.355252
91	users	2	UPDATE	{"id": 2, "nom": "Samuel", "role": "admin", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": null, "updated_at": "2026-01-02T18:13:44.355252", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 2, "nom": "Samuel", "role": "admin", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:14:06.980627", "updated_at": "2026-01-02T18:14:06.980627", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:14:06.980627
92	users	2	UPDATE	{"id": 2, "nom": "Samuel", "role": "admin", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:14:06.980627", "updated_at": "2026-01-02T18:14:06.980627", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 2, "nom": "Samuel", "role": "admin", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:16:14.725577", "updated_at": "2026-01-02T18:16:14.725577", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:16:14.725577
93	users	1	UPDATE	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": "2026-01-02T18:13:09.978543", "updated_at": "2026-01-02T18:13:09.978543", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": "2026-01-02T18:30:47.911524", "updated_at": "2026-01-02T18:30:47.911524", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:30:47.911524
94	users	2	UPDATE	{"id": 2, "nom": "Samuel", "role": "admin", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:16:14.725577", "updated_at": "2026-01-02T18:16:14.725577", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 2, "nom": "Samuel", "role": "user", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:16:14.725577", "updated_at": "2026-01-02T18:31:02.052164", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:31:02.052164
95	users	2	UPDATE	{"id": 2, "nom": "Samuel", "role": "user", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:16:14.725577", "updated_at": "2026-01-02T18:31:02.052164", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 2, "nom": "Samuel", "role": "user", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:31:28.404628", "updated_at": "2026-01-02T18:31:28.404628", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:31:28.404628
96	users	1	UPDATE	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": "2026-01-02T18:30:47.911524", "updated_at": "2026-01-02T18:30:47.911524", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": "2026-01-02T18:39:54.648798", "updated_at": "2026-01-02T18:39:54.648798", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:39:54.648798
97	users	2	UPDATE	{"id": 2, "nom": "Samuel", "role": "user", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:31:28.404628", "updated_at": "2026-01-02T18:31:28.404628", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 2, "nom": "Samuel", "role": "readonly", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:31:28.404628", "updated_at": "2026-01-02T18:40:01.22508", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:40:01.22508
98	users	2	UPDATE	{"id": 2, "nom": "Samuel", "role": "readonly", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:31:28.404628", "updated_at": "2026-01-02T18:40:01.22508", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 2, "nom": "Samuel", "role": "readonly", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:40:23.827165", "updated_at": "2026-01-02T18:40:23.827165", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:40:23.827165
99	users	1	UPDATE	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": "2026-01-02T18:39:54.648798", "updated_at": "2026-01-02T18:39:54.648798", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": "2026-01-02T18:41:07.691925", "updated_at": "2026-01-02T18:41:07.691925", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:41:07.691925
100	users	1	UPDATE	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": "2026-01-02T18:41:07.691925", "updated_at": "2026-01-02T18:41:07.691925", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 1, "nom": "Administrateur", "role": "admin", "email": "admin@truffiere.local", "prenom": "Système", "is_active": true, "created_at": "2026-01-02T16:29:54.193672", "last_login": "2026-01-02T18:42:12.94638", "updated_at": "2026-01-02T18:42:12.94638", "locked_until": null, "password_hash": "$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:42:12.94638
101	users	2	UPDATE	{"id": 2, "nom": "Samuel", "role": "readonly", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:40:23.827165", "updated_at": "2026-01-02T18:40:23.827165", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 2, "nom": "Samuel", "role": "user", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:40:23.827165", "updated_at": "2026-01-02T18:42:29.831024", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:42:29.831024
102	users	2	UPDATE	{"id": 2, "nom": "Samuel", "role": "user", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:40:23.827165", "updated_at": "2026-01-02T18:42:29.831024", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	{"id": 2, "nom": "Samuel", "role": "user", "email": "burbansamuel@gmail.com", "prenom": "BURBAN", "is_active": true, "created_at": "2026-01-02T18:13:44.355252", "last_login": "2026-01-02T18:42:43.946724", "updated_at": "2026-01-02T18:42:43.946724", "locked_until": null, "password_hash": "$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O", "email_verified": true, "password_changed_at": null, "failed_login_attempts": 0}	\N	2026-01-02 18:42:43.946724
103	arbres	1	UPDATE	{"id": 1, "etat": "Bon", "notes": null, "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": 46.15627517, "position": null, "hauteur_m": 35.0, "longitude": -0.15493065, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	\N	2026-01-02 18:43:25.838515
104	arbres	1	UPDATE	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": 46.15627517, "position": null, "hauteur_m": 35.0, "longitude": -0.15493065, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	\N	2026-01-02 18:43:34.285348
105	arbres	1	UPDATE	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": "2026-01-02T18:46:20.868686", "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	\N	2026-01-02 18:46:20.868686
106	arbres	1	UPDATE	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": "2026-01-02T18:46:20.868686", "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	\N	2026-01-02 18:46:23.760101
107	arbres	1	UPDATE	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": "2026-01-02T18:46:35.070729", "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	\N	2026-01-02 18:46:35.070729
108	arbres	1	UPDATE	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": "2026-01-02T18:46:35.070729", "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	\N	2026-01-02 18:46:37.573533
109	interventions	2	UPDATE	{"id": 2, "cout": null, "meteo": "Orageux", "notes": null, "statut": "Planifié", "arbre_id": 5, "personnel": "Marc", "created_at": "2026-01-01T16:44:05.819861", "updated_at": "2026-01-01T16:44:05.819861", "date_prevue": "2026-01-01", "description": null, "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	{"id": 2, "cout": null, "meteo": "Orageux", "notes": null, "statut": "Planifié", "arbre_id": 1, "personnel": "Marc", "created_at": "2026-01-01T16:44:05.819861", "updated_at": "2026-01-01T16:44:05.819861", "date_prevue": "2026-01-01", "description": null, "parcelle_id": 1, "date_realisee": "2026-01-02", "duree_minutes": null, "type_intervention_id": 4}	\N	2026-01-02 18:46:54.074203
110	ventes	10	DELETE	{"id": 10, "notes": "Vente issue de la commande NÃ‚Â°CMD-2025-0001", "statut": "Payée", "client_id": 1, "created_at": "2026-01-01T19:41:00.864767", "date_vente": "2026-01-01", "recolte_id": 3, "commande_id": null, "mode_paiement": "", "montant_total": 212.50, "numero_facture": "FACT-2026-001", "prix_unitaire_kg": 850.00, "quantite_grammes": 250.00}	\N	\N	2026-01-02 18:48:33.691261
111	commandes	1	UPDATE	{"id": 1, "notes": "", "statut": "Livrée", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-01T19:41:00.828354", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	{"id": 1, "notes": null, "statut": "En préparation", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-02T18:48:41.388793", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	\N	2026-01-02 18:48:41.388793
112	commandes	1	UPDATE	{"id": 1, "notes": null, "statut": "En préparation", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-02T18:48:41.388793", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	{"id": 1, "notes": "OK", "statut": "Livrée", "calibre": "Petit", "qualite": "Extra", "maturite": "À point", "client_id": 1, "created_at": "2025-12-31T15:56:55.579559", "updated_at": "2026-01-02T18:48:49.690379", "date_commande": "2025-12-31", "montant_total": 212.50, "poids_grammes": 250.00, "numero_commande": "CMD-2025-0001", "prix_unitaire_kg": 850.00, "date_livraison_demandee": "2026-01-03"}	\N	2026-01-02 18:48:49.690379
113	ventes	10	INSERT	\N	{"id": 10, "notes": "Vente issue de la commande CMD-2025-0001", "statut": "En attente", "client_id": 1, "created_at": "2026-01-02T18:48:49.72616", "date_vente": "2026-01-02", "recolte_id": null, "commande_id": 1, "mode_paiement": "", "montant_total": 212.50, "numero_facture": "FACT-2026-001", "prix_unitaire_kg": 850.00, "quantite_grammes": 250.00}	\N	2026-01-02 18:48:49.72616
114	ventes	10	UPDATE	{"id": 10, "notes": "Vente issue de la commande CMD-2025-0001", "statut": "En attente", "client_id": 1, "created_at": "2026-01-02T18:48:49.72616", "date_vente": "2026-01-02", "recolte_id": null, "commande_id": 1, "mode_paiement": "", "montant_total": 212.50, "numero_facture": "FACT-2026-001", "prix_unitaire_kg": 850.00, "quantite_grammes": 250.00}	{"id": 10, "notes": "Vente issue de la commande CMD-2025-0001", "statut": "Payée", "client_id": 1, "created_at": "2026-01-02T18:48:49.72616", "date_vente": "2026-01-02", "recolte_id": 4, "commande_id": null, "mode_paiement": "Espèces", "montant_total": 212.50, "numero_facture": "FACT-2026-001", "prix_unitaire_kg": 850.00, "quantite_grammes": 250.00}	\N	2026-01-02 18:50:10.247882
115	arbres	1	UPDATE	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": null, "position": null, "hauteur_m": 35.0, "longitude": null, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": 46.15627750, "position": null, "hauteur_m": 35.0, "longitude": -0.15493750, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	\N	2026-01-02 19:14:13.032612
116	arbres	1	UPDATE	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": 46.15627750, "position": null, "hauteur_m": 35.0, "longitude": -0.15493750, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	{"id": 1, "etat": "Bon", "notes": "", "espece": "Chêne pubescent", "numero": "A0012", "latitude": 46.15627250, "position": null, "hauteur_m": 35.0, "longitude": -0.15492930, "created_at": "2025-12-29T11:47:49.052547", "deleted_at": null, "updated_at": "2026-01-01T16:27:19.581977", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": 32.0, "date_derniere_taille": null}	\N	2026-01-02 19:54:46.131081
\.


--
-- Data for Name: interventions; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.interventions (id, type_intervention_id, parcelle_id, arbre_id, date_prevue, date_realisee, duree_minutes, personnel, description, cout, statut, meteo, notes, created_at, updated_at) FROM stdin;
3	4	1	1	2026-01-01	2026-01-02	\N	Marc	\N	\N	Planifié	Orageux	\N	2026-01-01 16:44:05.843796	2026-01-01 16:44:05.843796
2	4	1	1	2026-01-01	2026-01-02	\N	Marc	\N	\N	Planifié	Orageux	\N	2026-01-01 16:44:05.819861	2026-01-01 16:44:05.819861
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
\.


--
-- Data for Name: parcelles; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.parcelles (id, nom, surface_ha, geometrie, type_sol, ph_sol, exposition, date_creation, notes) FROM stdin;
1	Champs Chetif	1.50	0103000020E610000001000000090000000000C4FF8DD6C3BF30C18A24001447400100C4FFCFC1C3BFEC1F802E161447400100C4FF97BDC3BFF8742DAD111447400200C4FF6DBAC3BF711C75770B1447400100C4FF27B5C3BF399C6ABE051447400100E27F45AEC3BF7D7D4598FF1347400100E27F2CA9C3BFD8B17274FB1347400000E2FF94A2C3BF28059895F61347400000C4FF8DD6C3BF30C18A2400144740	Calcaire	7.8	Sud	2025-12-29 11:47:49.050329	
2	Champs des mojettes	2.30	0103000020E6100000010000000D0000000100C4FF998CC5BFA8184771F11147400100C4FF3488C5BF048CB7FCEA1147400100C4FF9C89C5BF3926B837E21147400100C4FF508AC5BF508012B1D91147400100C4FFAA8AC5BFD5B9F730D01147400000C4FFDA87C5BF44D46860C41147400100C4FFDD84C5BF0557B830BD1147400100C4FF4B80C5BFD36B663AB21147400100C4FF89ABC5BF47180A79C51147400100E27F0FA6C5BF7121D86CCE1147400100E27F079FC5BF1A184D82D91147400100E2FF8096C5BF2D5C2F91E51147400100C4FF998CC5BFA8184771F1114740	Argilo-calcaire	8.1	Sud-Est	2025-12-29 11:47:49.050329	
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
-- Data for Name: recoltes; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.recoltes (id, parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, profondeur_cm, caveur, chien, conditions_meteo, temperature_sol, notes, created_at) FROM stdin;
2	1	1	2026-01-01	37.00	Extra	Petit (moins de 20g)	Mature	\N	\N	\N	\N	\N	\N	2026-01-01 16:17:47.74005
1	1	1	2025-12-31	42.00	Extra	Moyen (20-50g)	À point	\N	Marc	\N	\N	\N	\N	2026-01-01 16:14:24.894188
4	2	3	2026-01-01	66.00	Extra	Petit (moins de 20g)	Très mature	9	Marc	Sweetie	Nuageux	\N	\N	2026-01-01 19:14:13.80894
3	2	3	2026-01-01	542.00	Extra	Très gros (plus de 100g)	\N	\N	Marc	\N	\N	\N	\N	2026-01-01 16:24:20.054613
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
11	2	c7fa6fa36c23716346e816662f225da2b135262cd557d238bad1bdca8d3a5fc1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	192.168.1.254	2026-01-09 18:42:43.943	f	\N	\N	2026-01-02 18:42:43.943626
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
1	admin@truffiere.local	$2a$12$gSUlB7gFLJN0huj0SGb9t.4hnXCTnqjcbhlqSag0S2sHkZpwJJGOu	Administrateur	Système	admin	t	t	2026-01-02 18:42:12.94638	\N	0	\N	2026-01-02 16:29:54.193672	2026-01-02 18:42:12.94638
2	burbansamuel@gmail.com	$2a$12$cwfgVGKNOcwFYub9cGPOQ.f3q8U/9GcToZwEG4zDK1A8HDQym1k/O	Samuel	BURBAN	user	t	t	2026-01-02 18:42:43.946724	\N	0	\N	2026-01-02 18:13:44.355252	2026-01-02 18:42:43.946724
\.


--
-- Data for Name: ventes; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.ventes (id, client_id, recolte_id, date_vente, quantite_grammes, prix_unitaire_kg, montant_total, mode_paiement, statut, numero_facture, notes, created_at, commande_id) FROM stdin;
10	1	4	2026-01-02	250.00	850.00	212.50	Espèces	Payée	FACT-2026-001	Vente issue de la commande CMD-2025-0001	2026-01-02 18:48:49.72616	\N
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
-- Name: arbres_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.arbres_id_seq', 5, true);


--
-- Name: caveurs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.caveurs_id_seq', 1, true);


--
-- Name: chiens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.chiens_id_seq', 1, true);


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

SELECT pg_catalog.setval('public.historique_id_seq', 116, true);


--
-- Name: interventions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.interventions_id_seq', 3, true);


--
-- Name: login_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.login_attempts_id_seq', 12, true);


--
-- Name: parametres_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.parametres_id_seq', 36, true);


--
-- Name: parcelles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.parcelles_id_seq', 4, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, false);


--
-- Name: preferences_utilisateur_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.preferences_utilisateur_id_seq', 8, true);


--
-- Name: recoltes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.recoltes_id_seq', 3, true);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.refresh_tokens_id_seq', 11, true);


--
-- Name: types_intervention_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.types_intervention_id_seq', 7, true);


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
-- Name: arbres arbres_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER arbres_historique AFTER INSERT OR DELETE OR UPDATE ON public.arbres FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: commandes commandes_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER commandes_historique AFTER INSERT OR DELETE OR UPDATE ON public.commandes FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: interventions interventions_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER interventions_historique AFTER INSERT OR DELETE OR UPDATE ON public.interventions FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: recoltes recoltes_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER recoltes_historique AFTER INSERT OR DELETE OR UPDATE ON public.recoltes FOR EACH ROW EXECUTE FUNCTION public.log_historique();


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

