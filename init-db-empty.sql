-- ============================================================================
-- PostgreSQL Database Schema - VIDE (sans données)
-- Truffière Management System - Version Janvier 2026
-- 
-- ⚠️ BASE DE DONNÉES VIDE AVEC USER ADMIN/ADMIN
-- ============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption content;
SET client_min_messages = warning;
SET row_security = off;

-- ============================================================================
-- SCHEMAS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS tiger;
ALTER SCHEMA tiger OWNER TO unstuffed1004;

CREATE SCHEMA IF NOT EXISTS tigerdata;
ALTER SCHEMA tigerdata OWNER TO unstuffed1004;

CREATE SCHEMA IF NOT EXISTS topology;
ALTER SCHEMA topology OWNER TO unstuffed1004;
COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;
COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';

CREATE EXTENSION IF NOT EXISTS postgistigergeocoder WITH SCHEMA tiger;

CREATE EXTENSION IF NOT EXISTS postgistopology WITH SCHEMA topology;
COMMENT ON EXTENSION postgistopology IS 'PostGIS topology spatial types and functions';

-- ============================================================================
-- TYPES
-- ============================================================================

CREATE TYPE public.intervention_status AS ENUM (
    'planifiée',
    'en_cours',
    'complétée',
    'annulée'
);
ALTER TYPE public.intervention_status OWNER TO unstuffed1004;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
ALTER FUNCTION public.update_updated_at_column() OWNER TO unstuffed1004;

CREATE OR REPLACE FUNCTION public.log_historique()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.historique (tablename, recordid, action, olddata)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.historique (tablename, recordid, action, olddata, newdata)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO public.historique (tablename, recordid, action, newdata)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW));
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;
ALTER FUNCTION public.log_historique() OWNER TO unstuffed1004;

CREATE OR REPLACE FUNCTION public.check_account_lock(pemail character varying)
RETURNS TABLE(islocked boolean, lockeduntil timestamp without time zone, attempts integer) AS $$
DECLARE
    vuser RECORD;
    vrecentfailures INTEGER;
BEGIN
    SELECT u.locked_until, u.failed_login_attempts INTO vuser
    FROM public.users u
    WHERE u.email = pemail;
    
    SELECT COUNT(*) INTO vrecentfailures
    FROM public.login_attempts
    WHERE email = pemail AND success = false
    AND attempted_at > NOW() - INTERVAL '15 minutes';
    
    RETURN QUERY
    SELECT vuser.locked_until IS NOT NULL AND vuser.locked_until > NOW() AS islocked,
           vuser.locked_until,
           COALESCE(vrecentfailures, 0)::integer AS attempts;
END;
$$ LANGUAGE plpgsql;
ALTER FUNCTION public.check_account_lock(character varying) OWNER TO unstuffed1004;

CREATE OR REPLACE FUNCTION public.increment_login_failures(pemail character varying)
RETURNS void AS $$
DECLARE
    vfailures INTEGER;
BEGIN
    UPDATE public.users
    SET failed_login_attempts = failed_login_attempts + 1
    WHERE email = pemail
    RETURNING failed_login_attempts INTO vfailures;
    
    IF vfailures >= 5 THEN
        UPDATE public.users
        SET locked_until = NOW() + INTERVAL '15 minutes'
        WHERE email = pemail;
    END IF;
END;
$$ LANGUAGE plpgsql;
ALTER FUNCTION public.increment_login_failures(character varying) OWNER TO unstuffed1004;

CREATE OR REPLACE FUNCTION public.reset_login_failures(puserid integer)
RETURNS void AS $$
BEGIN
    UPDATE public.users
    SET failed_login_attempts = 0,
        locked_until = NULL,
        last_login = NOW()
    WHERE id = puserid;
END;
$$ LANGUAGE plpgsql;
ALTER FUNCTION public.reset_login_failures(integer) OWNER TO unstuffed1004;

CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.refresh_tokens WHERE expires_at < NOW() - INTERVAL '30 days';
    DELETE FROM public.password_reset_tokens WHERE expires_at < NOW() - INTERVAL '7 days';
    DELETE FROM public.user_sessions WHERE expires_at < NOW() - INTERVAL '7 days';
    DELETE FROM public.login_attempts WHERE attempted_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
ALTER FUNCTION public.cleanup_expired_tokens() OWNER TO unstuffed1004;
COMMENT ON FUNCTION public.cleanup_expired_tokens() IS 'Nettoie les tokens et sessions expirés';

CREATE OR REPLACE FUNCTION public.get_consommation_eau(pdatedebut date, pdatefin date, pparcelleid integer DEFAULT NULL)
RETURNS TABLE(parcelle_nom character varying, volume_total_m3 numeric, nb_irrigations bigint, volume_moyen_m3 numeric) AS $$
BEGIN
    RETURN QUERY
    SELECT p.nom,
           COALESCE(SUM(id.volume_eau_m3), 0)::numeric as volume_total,
           COUNT(i.id),
           COALESCE(AVG(id.volume_eau_m3), 0)::numeric as volume_moyen
    FROM public.interventions i
    JOIN public.intervention_details id ON i.id = id.intervention_id
    JOIN public.parcelles p ON i.parcelle_id = p.id
    WHERE i.type_intervention_id = (SELECT id FROM public.types_intervention WHERE nom = 'Irrigation')
    AND i.date_realisee BETWEEN pdatedebut AND pdatefin
    AND (pparcelleid IS NULL OR i.parcelle_id = pparcelleid)
    GROUP BY p.nom
    ORDER BY volume_total DESC;
END;
$$ LANGUAGE plpgsql;
ALTER FUNCTION public.get_consommation_eau(date, date, integer) OWNER TO unstuffed1004;

-- ============================================================================
-- TABLES
-- ============================================================================

-- TABLE: users
CREATE TABLE IF NOT EXISTS public.users (
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
    CONSTRAINT users_role_check CHECK ((role::text = ANY (ARRAY['admin'::character varying::text, 'user'::character varying::text, 'readonly'::character varying::text])))
);
ALTER TABLE public.users OWNER TO unstuffed1004;

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_key UNIQUE (email);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER users_historique AFTER INSERT OR DELETE OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.log_historique();

-- TABLE: parcelles
CREATE TABLE IF NOT EXISTS public.parcelles (
    id integer NOT NULL,
    nom character varying(150) NOT NULL,
    surface_hectares numeric(10,2),
    altitude_m integer,
    exposition character varying(50),
    texture_sol character varying(100),
    ph_sol numeric(4,2),
    pourcentage_calcaire numeric(5,2),
    type_sol character varying(100),
    drainage character varying(50),
    notes text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    geometry public.geometry(Point,4326),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);
ALTER TABLE public.parcelles OWNER TO unstuffed1004;

CREATE SEQUENCE public.parcelles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.parcelles_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.parcelles_id_seq OWNED BY public.parcelles.id;
ALTER TABLE ONLY public.parcelles ALTER COLUMN id SET DEFAULT nextval('public.parcelles_id_seq'::regclass);

ALTER TABLE ONLY public.parcelles ADD CONSTRAINT parcelles_pkey PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS idx_parcelles_nom ON public.parcelles USING btree (nom);

CREATE TRIGGER parcelles_updated_at BEFORE UPDATE ON public.parcelles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER parcelles_historique AFTER INSERT OR DELETE OR UPDATE ON public.parcelles
    FOR EACH ROW EXECUTE FUNCTION public.log_historique();

-- TABLE: arbres
CREATE TABLE IF NOT EXISTS public.arbres (
    id integer NOT NULL,
    parcelle_id integer,
    numero character varying(50) NOT NULL,
    espece character varying(100) NOT NULL,
    variete_truffe character varying(100),
    date_plantation date NOT NULL,
    position public.geometry(Point,4326),
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

CREATE SEQUENCE public.arbres_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.arbres_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.arbres_id_seq OWNED BY public.arbres.id;
ALTER TABLE ONLY public.arbres ALTER COLUMN id SET DEFAULT nextval('public.arbres_id_seq'::regclass);

ALTER TABLE ONLY public.arbres ADD CONSTRAINT arbres_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.arbres ADD CONSTRAINT arbres_parcelle_id_fkey FOREIGN KEY (parcelle_id) REFERENCES public.parcelles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_arbres_parcelle_id ON public.arbres USING btree (parcelle_id);
CREATE INDEX IF NOT EXISTS idx_arbres_numero ON public.arbres USING btree (numero);

CREATE TRIGGER arbres_updated_at BEFORE UPDATE ON public.arbres
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER arbres_historique AFTER INSERT OR DELETE OR UPDATE ON public.arbres
    FOR EACH ROW EXECUTE FUNCTION public.log_historique();

-- TABLE: types_intervention
CREATE TABLE IF NOT EXISTS public.types_intervention (
    id integer NOT NULL,
    nom character varying(150) NOT NULL,
    description text,
    categorie character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.types_intervention OWNER TO unstuffed1004;

CREATE SEQUENCE public.types_intervention_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.types_intervention_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.types_intervention_id_seq OWNED BY public.types_intervention.id;
ALTER TABLE ONLY public.types_intervention ALTER COLUMN id SET DEFAULT nextval('public.types_intervention_id_seq'::regclass);

ALTER TABLE ONLY public.types_intervention ADD CONSTRAINT types_intervention_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.types_intervention ADD CONSTRAINT types_intervention_nom_key UNIQUE (nom);

CREATE TRIGGER types_intervention_updated_at BEFORE UPDATE ON public.types_intervention
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TABLE: interventions
CREATE TABLE IF NOT EXISTS public.interventions (
    id integer NOT NULL,
    parcelle_id integer,
    arbre_id integer,
    type_intervention_id integer,
    date_planifiee date,
    date_realisee date,
    operateur character varying(150),
    notes text,
    statut public.intervention_status DEFAULT 'planifiée'::public.intervention_status,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.interventions OWNER TO unstuffed1004;

CREATE SEQUENCE public.interventions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.interventions_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.interventions_id_seq OWNED BY public.interventions.id;
ALTER TABLE ONLY public.interventions ALTER COLUMN id SET DEFAULT nextval('public.interventions_id_seq'::regclass);

ALTER TABLE ONLY public.interventions ADD CONSTRAINT interventions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.interventions ADD CONSTRAINT interventions_parcelle_id_fkey FOREIGN KEY (parcelle_id) REFERENCES public.parcelles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.interventions ADD CONSTRAINT interventions_arbre_id_fkey FOREIGN KEY (arbre_id) REFERENCES public.arbres(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.interventions ADD CONSTRAINT interventions_type_intervention_id_fkey FOREIGN KEY (type_intervention_id) REFERENCES public.types_intervention(id);
CREATE INDEX IF NOT EXISTS idx_interventions_parcelle_id ON public.interventions USING btree (parcelle_id);
CREATE INDEX IF NOT EXISTS idx_interventions_arbre_id ON public.interventions USING btree (arbre_id);
CREATE INDEX IF NOT EXISTS idx_interventions_type_intervention_id ON public.interventions USING btree (type_intervention_id);
CREATE INDEX IF NOT EXISTS idx_interventions_date_realisee ON public.interventions USING btree (date_realisee);

CREATE TRIGGER interventions_updated_at BEFORE UPDATE ON public.interventions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER interventions_historique AFTER INSERT OR DELETE OR UPDATE ON public.interventions
    FOR EACH ROW EXECUTE FUNCTION public.log_historique();

-- TABLE: intervention_details
CREATE TABLE IF NOT EXISTS public.intervention_details (
    id integer NOT NULL,
    intervention_id integer NOT NULL,
    type_detail character varying(100),
    volume_eau_m3 numeric(10,2),
    quantite_produit numeric(10,2),
    unite_produit character varying(50),
    temperature_celsius numeric(5,2),
    humidite_pourcent numeric(5,2),
    ph_sol numeric(4,2),
    conductivite_ms_cm numeric(10,2),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.intervention_details OWNER TO unstuffed1004;

CREATE SEQUENCE public.intervention_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.intervention_details_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.intervention_details_id_seq OWNED BY public.intervention_details.id;
ALTER TABLE ONLY public.intervention_details ALTER COLUMN id SET DEFAULT nextval('public.intervention_details_id_seq'::regclass);

ALTER TABLE ONLY public.intervention_details ADD CONSTRAINT intervention_details_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.intervention_details ADD CONSTRAINT intervention_details_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_intervention_details_intervention_id ON public.intervention_details USING btree (intervention_id);

CREATE TRIGGER intervention_details_updated_at BEFORE UPDATE ON public.intervention_details
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER intervention_details_historique AFTER INSERT OR DELETE OR UPDATE ON public.intervention_details
    FOR EACH ROW EXECUTE FUNCTION public.log_historique();

-- TABLE: clients
CREATE TABLE IF NOT EXISTS public.clients (
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
ALTER TABLE public.clients OWNER TO unstuffed1004;

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.clients_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;
ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);

ALTER TABLE ONLY public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS idx_clients_type ON public.clients USING btree (type);

CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER clients_historique AFTER INSERT OR DELETE OR UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.log_historique();

-- TABLE: commandes
CREATE TABLE IF NOT EXISTS public.commandes (
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

CREATE SEQUENCE public.commandes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.commandes_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.commandes_id_seq OWNED BY public.commandes.id;
ALTER TABLE ONLY public.commandes ALTER COLUMN id SET DEFAULT nextval('public.commandes_id_seq'::regclass);

ALTER TABLE ONLY public.commandes ADD CONSTRAINT commandes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.commandes ADD CONSTRAINT commandes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_commandes_client_id ON public.commandes USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_commandes_date_commande ON public.commandes USING btree (date_commande);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON public.commandes USING btree (statut);

CREATE TRIGGER commandes_updated_at BEFORE UPDATE ON public.commandes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER commandes_historique AFTER INSERT OR DELETE OR UPDATE ON public.commandes
    FOR EACH ROW EXECUTE FUNCTION public.log_historique();

-- TABLE: recoltes
CREATE TABLE IF NOT EXISTS public.recoltes (
    id integer NOT NULL,
    parcelle_id integer,
    date_recolte date NOT NULL,
    poids_grammes numeric(10,2),
    qualite character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.recoltes OWNER TO unstuffed1004;

CREATE SEQUENCE public.recoltes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.recoltes_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.recoltes_id_seq OWNED BY public.recoltes.id;
ALTER TABLE ONLY public.recoltes ALTER COLUMN id SET DEFAULT nextval('public.recoltes_id_seq'::regclass);

ALTER TABLE ONLY public.recoltes ADD CONSTRAINT recoltes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.recoltes ADD CONSTRAINT recoltes_parcelle_id_fkey FOREIGN KEY (parcelle_id) REFERENCES public.parcelles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_recoltes_parcelle_id ON public.recoltes USING btree (parcelle_id);
CREATE INDEX IF NOT EXISTS idx_recoltes_date_recolte ON public.recoltes USING btree (date_recolte);

CREATE TRIGGER recoltes_updated_at BEFORE UPDATE ON public.recoltes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER recoltes_historique AFTER INSERT OR DELETE OR UPDATE ON public.recoltes
    FOR EACH ROW EXECUTE FUNCTION public.log_historique();

-- TABLE: historique
CREATE TABLE IF NOT EXISTS public.historique (
    id integer NOT NULL,
    tablename character varying(50) NOT NULL,
    recordid integer NOT NULL,
    action character varying(20) NOT NULL,
    olddata jsonb,
    newdata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.historique OWNER TO unstuffed1004;

CREATE SEQUENCE public.historique_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.historique_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.historique_id_seq OWNED BY public.historique.id;
ALTER TABLE ONLY public.historique ALTER COLUMN id SET DEFAULT nextval('public.historique_id_seq'::regclass);

ALTER TABLE ONLY public.historique ADD CONSTRAINT historique_pkey PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS idx_historique_tablename ON public.historique USING btree (tablename);
CREATE INDEX IF NOT EXISTS idx_historique_recordid ON public.historique USING btree (recordid);
CREATE INDEX IF NOT EXISTS idx_historique_action ON public.historique USING btree (action);

-- TABLE: refresh_tokens
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(500) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.refresh_tokens OWNER TO unstuffed1004;

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.refresh_tokens_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;
ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);

ALTER TABLE ONLY public.refresh_tokens ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.refresh_tokens ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);

-- TABLE: password_reset_tokens
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(500) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    used_at timestamp without time zone
);
ALTER TABLE public.password_reset_tokens OWNER TO unstuffed1004;

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;
ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);

ALTER TABLE ONLY public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);

-- TABLE: user_sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    session_token character varying(500) NOT NULL,
    ip_address character varying(50),
    user_agent text,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.user_sessions OWNER TO unstuffed1004;

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.user_sessions_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;
ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);

ALTER TABLE ONLY public.user_sessions ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);

-- TABLE: login_attempts
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    success boolean NOT NULL,
    ip_address character varying(50),
    attempted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.login_attempts OWNER TO unstuffed1004;

CREATE SEQUENCE public.login_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.login_attempts_id_seq OWNER TO unstuffed1004;
ALTER SEQUENCE public.login_attempts_id_seq OWNED BY public.login_attempts.id;
ALTER TABLE ONLY public.login_attempts ALTER COLUMN id SET DEFAULT nextval('public.login_attempts_id_seq'::regclass);

ALTER TABLE ONLY public.login_attempts ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts USING btree (email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON public.login_attempts USING btree (attempted_at);

-- ============================================================================
-- VUES (Views)
-- ============================================================================

CREATE OR REPLACE VIEW public.v_interventions_completes AS
SELECT 
    i.id,
    i.parcelle_id,
    p.nom as parcelle_nom,
    i.arbre_id,
    a.numero as arbre_numero,
    i.type_intervention_id,
    ti.nom as type_intervention,
    i.date_planifiee,
    i.date_realisee,
    i.operateur,
    i.statut,
    i.notes,
    i.created_at,
    i.updated_at
FROM public.interventions i
LEFT JOIN public.parcelles p ON i.parcelle_id = p.id
LEFT JOIN public.arbres a ON i.arbre_id = a.id
LEFT JOIN public.types_intervention ti ON i.type_intervention_id = ti.id;

ALTER TABLE public.v_interventions_completes OWNER TO unstuffed1004;

CREATE OR REPLACE VIEW public.v_user_stats AS
SELECT 
    u.id,
    u.email,
    u.nom,
    u.prenom,
    u.role,
    u.is_active,
    u.last_login,
    COUNT(DISTINCT us.id) as session_count,
    MAX(us.created_at) as last_session
FROM public.users u
LEFT JOIN public.user_sessions us ON u.id = us.user_id
GROUP BY u.id, u.email, u.nom, u.prenom, u.role, u.is_active, u.last_login;

ALTER TABLE public.v_user_stats OWNER TO unstuffed1004;

-- ============================================================================
-- INITIAL DATA: UTILISATEUR ADMIN
-- ============================================================================

-- 🔐 User: admin / admin (bcrypt hash, 12 rounds)
INSERT INTO public.users (
    id, email, password_hash, nom, prenom, role, 
    is_active, email_verified, failed_login_attempts
) VALUES (
    1, 
    'admin@truffiere.local', 
    '$2a$12$SX9i0CLKfO0UeJsp9uXsUO4mWw.tmxz4iQWZ9M6/qnggKqnC9xvY2', 
    'Administrateur',
    'Système',
    'admin',
    true,
    true,
    0
);

-- Positionner les séquences
SELECT pg_catalog.setval('public.users_id_seq', 1, true);
SELECT pg_catalog.setval('public.parcelles_id_seq', 1, false);
SELECT pg_catalog.setval('public.arbres_id_seq', 1, false);
SELECT pg_catalog.setval('public.types_intervention_id_seq', 1, false);
SELECT pg_catalog.setval('public.interventions_id_seq', 1, false);
SELECT pg_catalog.setval('public.intervention_details_id_seq', 1, false);
SELECT pg_catalog.setval('public.clients_id_seq', 1, false);
SELECT pg_catalog.setval('public.commandes_id_seq', 1, false);
SELECT pg_catalog.setval('public.recoltes_id_seq', 1, false);
SELECT pg_catalog.setval('public.historique_id_seq', 1, false);
SELECT pg_catalog.setval('public.refresh_tokens_id_seq', 1, false);
SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, false);
SELECT pg_catalog.setval('public.user_sessions_id_seq', 1, false);
SELECT pg_catalog.setval('public.login_attempts_id_seq', 1, false);

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================
-- Base de données vide, prête à être peuplée
-- Utilisateur admin/admin configuré
-- Tous les schémas, extensions, fonctions et tables en place
-- ============================================================================
