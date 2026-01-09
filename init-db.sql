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

ALTER TABLE IF EXISTS ONLY public.ventes DROP CONSTRAINT IF EXISTS ventes_recolte_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ventes DROP CONSTRAINT IF EXISTS ventes_client_id_fkey;
ALTER TABLE IF EXISTS ONLY public.recoltes DROP CONSTRAINT IF EXISTS recoltes_parcelle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.recoltes DROP CONSTRAINT IF EXISTS recoltes_arbre_id_fkey;
ALTER TABLE IF EXISTS ONLY public.interventions DROP CONSTRAINT IF EXISTS interventions_type_intervention_id_fkey;
ALTER TABLE IF EXISTS ONLY public.interventions DROP CONSTRAINT IF EXISTS interventions_parcelle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.interventions DROP CONSTRAINT IF EXISTS interventions_arbre_id_fkey;
ALTER TABLE IF EXISTS ONLY public.arbres DROP CONSTRAINT IF EXISTS arbres_parcelle_id_fkey;
DROP TRIGGER IF EXISTS ventes_historique ON public.ventes;
DROP TRIGGER IF EXISTS recoltes_historique ON public.recoltes;
DROP TRIGGER IF EXISTS interventions_historique ON public.interventions;
DROP TRIGGER IF EXISTS arbres_historique ON public.arbres;
DROP INDEX IF EXISTS public.idx_ventes_date;
DROP INDEX IF EXISTS public.idx_ventes_client;
DROP INDEX IF EXISTS public.idx_recoltes_parcelle;
DROP INDEX IF EXISTS public.idx_recoltes_date;
DROP INDEX IF EXISTS public.idx_recoltes_arbre;
DROP INDEX IF EXISTS public.idx_interventions_parcelle;
DROP INDEX IF EXISTS public.idx_interventions_date;
DROP INDEX IF EXISTS public.idx_interventions_arbre;
DROP INDEX IF EXISTS public.idx_historique_table_record;
DROP INDEX IF EXISTS public.idx_arbres_parcelle;
ALTER TABLE IF EXISTS ONLY public.ventes DROP CONSTRAINT IF EXISTS ventes_pkey;
ALTER TABLE IF EXISTS ONLY public.types_intervention DROP CONSTRAINT IF EXISTS types_intervention_pkey;
ALTER TABLE IF EXISTS ONLY public.types_intervention DROP CONSTRAINT IF EXISTS types_intervention_nom_key;
ALTER TABLE IF EXISTS ONLY public.recoltes DROP CONSTRAINT IF EXISTS recoltes_pkey;
ALTER TABLE IF EXISTS ONLY public.parcelles DROP CONSTRAINT IF EXISTS parcelles_pkey;
ALTER TABLE IF EXISTS ONLY public.interventions DROP CONSTRAINT IF EXISTS interventions_pkey;
ALTER TABLE IF EXISTS ONLY public.historique DROP CONSTRAINT IF EXISTS historique_pkey;
ALTER TABLE IF EXISTS ONLY public.clients DROP CONSTRAINT IF EXISTS clients_pkey;
ALTER TABLE IF EXISTS ONLY public.arbres DROP CONSTRAINT IF EXISTS arbres_pkey;
ALTER TABLE IF EXISTS ONLY public.arbres DROP CONSTRAINT IF EXISTS arbres_numero_key;
ALTER TABLE IF EXISTS public.ventes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.types_intervention ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.recoltes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.parcelles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.interventions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.historique ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.clients ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.arbres ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.ventes_id_seq;
DROP SEQUENCE IF EXISTS public.types_intervention_id_seq;
DROP TABLE IF EXISTS public.types_intervention;
DROP VIEW IF EXISTS public.stats_ventes;
DROP TABLE IF EXISTS public.ventes;
DROP VIEW IF EXISTS public.stats_production_parcelle;
DROP VIEW IF EXISTS public.stats_production_arbre;
DROP SEQUENCE IF EXISTS public.recoltes_id_seq;
DROP TABLE IF EXISTS public.recoltes;
DROP SEQUENCE IF EXISTS public.parcelles_id_seq;
DROP TABLE IF EXISTS public.parcelles;
DROP SEQUENCE IF EXISTS public.interventions_id_seq;
DROP TABLE IF EXISTS public.interventions;
DROP SEQUENCE IF EXISTS public.historique_id_seq;
DROP TABLE IF EXISTS public.historique;
DROP SEQUENCE IF EXISTS public.clients_id_seq;
DROP TABLE IF EXISTS public.clients;
DROP SEQUENCE IF EXISTS public.arbres_id_seq;
DROP TABLE IF EXISTS public.arbres;
DROP FUNCTION IF EXISTS public.log_historique();
DROP EXTENSION IF EXISTS postgis_topology;
DROP EXTENSION IF EXISTS postgis_tiger_geocoder;
DROP EXTENSION IF EXISTS postgis;
DROP EXTENSION IF EXISTS fuzzystrmatch;
DROP SCHEMA IF EXISTS topology;
DROP SCHEMA IF EXISTS tiger_data;
DROP SCHEMA IF EXISTS tiger;
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
    longitude numeric(11,8)
);


ALTER TABLE public.arbres OWNER TO unstuffed1004;

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
    prix_kg numeric(10,2),
    caveur character varying(100),
    chien character varying(100),
    conditions_meteo character varying(200),
    temperature_sol numeric(4,1),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.recoltes OWNER TO unstuffed1004;

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
    round(avg(r.poids_grammes), 2) AS poids_moyen_g,
    sum(((r.poids_grammes * r.prix_kg) / (1000)::numeric)) AS valeur_totale
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
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ventes OWNER TO unstuffed1004;

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
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: historique id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.historique ALTER COLUMN id SET DEFAULT nextval('public.historique_id_seq'::regclass);


--
-- Name: interventions id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.interventions ALTER COLUMN id SET DEFAULT nextval('public.interventions_id_seq'::regclass);


--
-- Name: parcelles id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.parcelles ALTER COLUMN id SET DEFAULT nextval('public.parcelles_id_seq'::regclass);


--
-- Name: recoltes id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.recoltes ALTER COLUMN id SET DEFAULT nextval('public.recoltes_id_seq'::regclass);


--
-- Name: types_intervention id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.types_intervention ALTER COLUMN id SET DEFAULT nextval('public.types_intervention_id_seq'::regclass);


--
-- Name: ventes id; Type: DEFAULT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.ventes ALTER COLUMN id SET DEFAULT nextval('public.ventes_id_seq'::regclass);


--
-- Data for Name: arbres; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.arbres (id, parcelle_id, numero, espece, variete_truffe, date_plantation, "position", etat, circonference_cm, hauteur_m, date_derniere_taille, notes, created_at, updated_at, latitude, longitude) FROM stdin;
1	1	A001	Chêne pubescent	Tuber melanosporum	2018-11-15	\N	Bon	\N	\N	\N	\N	2025-12-29 11:47:49.052547	2025-12-29 11:47:49.052547	\N	\N
2	1	A002	Chêne vert	Tuber melanosporum	2018-11-15	\N	Bon	\N	\N	\N	\N	2025-12-29 11:47:49.052547	2025-12-29 11:47:49.052547	\N	\N
3	2	B001	Noisetier	Tuber melanosporum	2019-03-20	\N	Bon	\N	\N	\N	\N	2025-12-29 11:47:49.052547	2025-12-29 11:47:49.052547	\N	\N
4	2	B002	Chêne pubescent	Tuber melanosporum	2019-03-20	\N	Moyen	\N	\N	\N	\N	2025-12-29 11:47:49.052547	2025-12-29 11:47:49.052547	\N	\N
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.clients (id, type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays, siret, notes, date_premier_achat, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: historique; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.historique (id, table_name, record_id, action, old_data, new_data, user_name, "timestamp") FROM stdin;
1	arbres	1	INSERT	\N	{"id": 1, "etat": "Bon", "notes": null, "espece": "Chêne pubescent", "numero": "A001", "position": null, "hauteur_m": null, "created_at": "2025-12-29T11:47:49.052547", "updated_at": "2025-12-29T11:47:49.052547", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": null, "date_derniere_taille": null}	\N	2025-12-29 11:47:49.052547
2	arbres	2	INSERT	\N	{"id": 2, "etat": "Bon", "notes": null, "espece": "Chêne vert", "numero": "A002", "position": null, "hauteur_m": null, "created_at": "2025-12-29T11:47:49.052547", "updated_at": "2025-12-29T11:47:49.052547", "parcelle_id": 1, "variete_truffe": "Tuber melanosporum", "date_plantation": "2018-11-15", "circonference_cm": null, "date_derniere_taille": null}	\N	2025-12-29 11:47:49.052547
3	arbres	3	INSERT	\N	{"id": 3, "etat": "Bon", "notes": null, "espece": "Noisetier", "numero": "B001", "position": null, "hauteur_m": null, "created_at": "2025-12-29T11:47:49.052547", "updated_at": "2025-12-29T11:47:49.052547", "parcelle_id": 2, "variete_truffe": "Tuber melanosporum", "date_plantation": "2019-03-20", "circonference_cm": null, "date_derniere_taille": null}	\N	2025-12-29 11:47:49.052547
4	arbres	4	INSERT	\N	{"id": 4, "etat": "Moyen", "notes": null, "espece": "Chêne pubescent", "numero": "B002", "position": null, "hauteur_m": null, "created_at": "2025-12-29T11:47:49.052547", "updated_at": "2025-12-29T11:47:49.052547", "parcelle_id": 2, "variete_truffe": "Tuber melanosporum", "date_plantation": "2019-03-20", "circonference_cm": null, "date_derniere_taille": null}	\N	2025-12-29 11:47:49.052547
\.


--
-- Data for Name: interventions; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.interventions (id, type_intervention_id, parcelle_id, arbre_id, date_prevue, date_realisee, duree_minutes, personnel, description, cout, statut, meteo, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: parcelles; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.parcelles (id, nom, surface_ha, geometrie, type_sol, ph_sol, exposition, date_creation, notes) FROM stdin;
1	Parcelle Nord	1.50	\N	Calcaire	7.8	Sud	2025-12-29 11:47:49.050329	\N
2	Parcelle Sud	2.30	\N	Argilo-calcaire	8.1	Sud-Est	2025-12-29 11:47:49.050329	\N
3	Parcelle Est	0.80	\N	Calcaire	7.5	Ouest	2025-12-29 11:47:49.050329	\N
\.


--
-- Data for Name: recoltes; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.recoltes (id, parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, profondeur_cm, prix_kg, caveur, chien, conditions_meteo, temperature_sol, notes, created_at) FROM stdin;
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
-- Data for Name: ventes; Type: TABLE DATA; Schema: public; Owner: unstuffed1004
--

COPY public.ventes (id, client_id, recolte_id, date_vente, quantite_grammes, prix_unitaire_kg, montant_total, mode_paiement, statut, numero_facture, notes, created_at) FROM stdin;
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

SELECT pg_catalog.setval('public.arbres_id_seq', 4, true);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.clients_id_seq', 1, false);


--
-- Name: historique_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.historique_id_seq', 4, true);


--
-- Name: interventions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.interventions_id_seq', 1, false);


--
-- Name: parcelles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.parcelles_id_seq', 4, true);


--
-- Name: recoltes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.recoltes_id_seq', 1, false);


--
-- Name: types_intervention_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.types_intervention_id_seq', 7, true);


--
-- Name: ventes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: unstuffed1004
--

SELECT pg_catalog.setval('public.ventes_id_seq', 1, false);


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
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


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
-- Name: parcelles parcelles_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.parcelles
    ADD CONSTRAINT parcelles_pkey PRIMARY KEY (id);


--
-- Name: recoltes recoltes_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.recoltes
    ADD CONSTRAINT recoltes_pkey PRIMARY KEY (id);


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
-- Name: ventes ventes_pkey; Type: CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_pkey PRIMARY KEY (id);


--
-- Name: idx_arbres_parcelle; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_arbres_parcelle ON public.arbres USING btree (parcelle_id);


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
-- Name: idx_ventes_client; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_ventes_client ON public.ventes USING btree (client_id);


--
-- Name: idx_ventes_date; Type: INDEX; Schema: public; Owner: unstuffed1004
--

CREATE INDEX idx_ventes_date ON public.ventes USING btree (date_vente);


--
-- Name: arbres arbres_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER arbres_historique AFTER INSERT OR DELETE OR UPDATE ON public.arbres FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: interventions interventions_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER interventions_historique AFTER INSERT OR DELETE OR UPDATE ON public.interventions FOR EACH ROW EXECUTE FUNCTION public.log_historique();


--
-- Name: recoltes recoltes_historique; Type: TRIGGER; Schema: public; Owner: unstuffed1004
--

CREATE TRIGGER recoltes_historique AFTER INSERT OR DELETE OR UPDATE ON public.recoltes FOR EACH ROW EXECUTE FUNCTION public.log_historique();


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
-- Name: ventes ventes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: ventes ventes_recolte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unstuffed1004
--

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_recolte_id_fkey FOREIGN KEY (recolte_id) REFERENCES public.recoltes(id);


--
-- PostgreSQL database dump complete
--

