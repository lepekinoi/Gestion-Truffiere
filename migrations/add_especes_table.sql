-- ============================================================
-- Ajout table especes_arbres - Gestion des espèces truffières
-- ============================================================

-- Créer la séquence pour l'id
CREATE SEQUENCE IF NOT EXISTS public.especes_arbres_id_seq AS integer START WITH 1 INCREMENT BY 1;

-- Créer la table especes_arbres
CREATE TABLE IF NOT EXISTS public.especes_arbres (
    id integer NOT NULL DEFAULT nextval('public.especes_arbres_id_seq'::regclass),
    nom character varying(100) NOT NULL UNIQUE,
    code character varying(10) NOT NULL UNIQUE,
    nom_scientifique character varying(150),
    description text,
    groupe_principal character varying(50),
    est_espece_principale boolean DEFAULT false,
    ordre_affichage integer DEFAULT 0,
    actif boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- Créer l'index sur la séquence
ALTER SEQUENCE public.especes_arbres_id_seq OWNED BY public.especes_arbres.id;

-- Créer les index
CREATE INDEX IF NOT EXISTS idx_especes_arbres_code ON public.especes_arbres (code);
CREATE INDEX IF NOT EXISTS idx_especes_arbres_nom ON public.especes_arbres (nom);
CREATE INDEX IF NOT EXISTS idx_especes_arbres_actif ON public.especes_arbres (actif);
CREATE INDEX IF NOT EXISTS idx_especes_arbres_principal ON public.especes_arbres (est_espece_principale);

-- Ajouter le trigger d'historique
CREATE TRIGGER especes_arbres_historique AFTER INSERT OR DELETE OR UPDATE ON public.especes_arbres 
FOR EACH ROW EXECUTE FUNCTION public.log_historique();

-- ============================================================
-- Données initiales : Les 4 espèces existantes + 8 nouvelles
-- ============================================================

INSERT INTO public.especes_arbres (nom, code, nom_scientifique, description, groupe_principal, est_espece_principale, ordre_affichage, actif) 
VALUES 
-- Espèces principales existantes
('Chêne pubescent', 'P', 'Quercus pubescens', 'Chêne résistant à la sécheresse, excellent pour la truffe noire', 'Chêne', true, 1, true),
('Chênes vert', 'V', 'Quercus ilex', 'Chêne vert méditerranéen, très productif', 'Chêne', true, 2, true),
('Charmes', 'C', 'Carpinus betulus', 'Charme commun, bon support pour le brûlé', 'Charme', true, 3, true),
('Chênes Cerris', 'Cé', 'Quercus cerris', 'Chêne chevelu, adapté aux terrains alcalins', 'Chêne', true, 4, true),

-- Nouvelles espèces proposées
('Chêne blanc', 'Blanc', 'Quercus pubescens var. alba', 'Excellent pour la truffe noire, bonne rusticité', 'Chêne', true, 5, true),
('Noisetier commun', 'N', 'Corylus avellana', 'Support productive, bon pour brûlé et production', 'Noisetier', true, 6, true),
('Tilleul à petites feuilles', 'Ti', 'Tilia cordata', 'Support secondaire, améliore structure brûlé', 'Tilleul', false, 7, true),
('Châtaignier', 'Ch', 'Castanea sativa', 'Alternative méditerranéenne, zones calcaires', 'Châtaignier', false, 8, true),
('Chêne de Hongrie', 'Ho', 'Quercus frainetto', 'Adapté aux terrains très alcalins', 'Chêne', false, 9, true),
('Érable champêtre', 'Éra', 'Acer campestre', 'Support complémentaire, structure brûlé', 'Érable', false, 10, true),
('Charme-houblon', 'CH', 'Ostrya carpinifolia', 'Variante améliorée du charme', 'Charme', false, 11, true),
('Noisetier de Byzance', 'NB', 'Corylus colurna', 'Noisetier amélioré, meilleure rusticité', 'Noisetier', false, 12, true);

-- Réinitialiser la séquence
SELECT pg_catalog.setval('public.especes_arbres_id_seq', (SELECT MAX(id) FROM public.especes_arbres) + 1, false);

-- ============================================================
-- Modification de la table arbres (optionnel mais recommandé)
-- Ajouter contrainte de clé étrangère
-- ============================================================

-- Si tu veux ajouter une clé étrangère à especes_arbres (optionnel):
-- ALTER TABLE public.arbres ADD COLUMN espece_id integer REFERENCES public.especes_arbres(id);
-- Ne pas forcer car tu gardes le champ texte libre "espece"

-- ============================================================
-- Fin du script
-- ============================================================
