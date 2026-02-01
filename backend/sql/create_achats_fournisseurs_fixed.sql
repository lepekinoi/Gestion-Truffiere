-- ========================================
-- SCRIPT COMPLET: Tables et Vues Achats & Fournisseurs
-- VERSION CORRIGÉE avec les bons noms de types
-- ========================================

-- Table: Stock des truffes achetées
CREATE TABLE IF NOT EXISTS public.stocks_truffes_achetees (
    id SERIAL PRIMARY KEY,
    ligne_commande_id INTEGER,
    calibre_mm INTEGER NOT NULL,
    qualite public.qualite_truffe NOT NULL,
    maturite public.maturite_truffe NOT NULL,
    quantite_kg_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
    conservation public.conservation_type DEFAULT 'Frais'::public.conservation_type,
    localisation_storage VARCHAR(100),
    date_achat DATE NOT NULL,
    date_limite_consommation DATE,
    prix_achat_kg NUMERIC(10,2) NOT NULL,
    createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Analyse des marges par truffe
CREATE TABLE IF NOT EXISTS public.analyse_marge_truffes (
    id SERIAL PRIMARY KEY,
    stock_achat_id INTEGER,
    commande_vente_id INTEGER,
    calibre_mm INTEGER NOT NULL,
    qualite public.qualite_truffe NOT NULL,
    maturite public.maturite_truffe NOT NULL,
    prix_achat_kg NUMERIC(10,2) NOT NULL,
    prix_vente_kg NUMERIC(10,2),
    quantite_kg NUMERIC(10,2),
    marge_kg NUMERIC(10,2) GENERATED ALWAYS AS (
        CASE 
            WHEN prix_vente_kg IS NOT NULL THEN prix_vente_kg - prix_achat_kg 
            ELSE NULL::NUMERIC 
        END
    ) STORED,
    pourcentage_marge NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN prix_vente_kg IS NOT NULL AND prix_vente_kg > 0::NUMERIC 
            THEN ROUND(((prix_vente_kg - prix_achat_kg) / prix_vente_kg) * 100::NUMERIC, 2) 
            ELSE NULL::NUMERIC 
        END
    ) STORED,
    date_achat DATE NOT NULL,
    date_vente DATE,
    createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_analysemarge_stock FOREIGN KEY (stock_achat_id) 
        REFERENCES public.stocks_truffes_achetees(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_stocks_achetees_calibre ON public.stocks_truffes_achetees(calibre_mm);
CREATE INDEX IF NOT EXISTS idx_stocks_achetees_qualite ON public.stocks_truffes_achetees(qualite);
CREATE INDEX IF NOT EXISTS idx_stocks_achetees_localisation ON public.stocks_truffes_achetees(localisation_storage);
CREATE INDEX IF NOT EXISTS idx_stocks_achetees_limite_consommation ON public.stocks_truffes_achetees(date_limite_consommation);

CREATE INDEX IF NOT EXISTS idx_analysemarge_calibre ON public.analyse_marge_truffes(calibre_mm);
CREATE INDEX IF NOT EXISTS idx_analysemarge_dateachat ON public.analyse_marge_truffes(date_achat);

-- Vue: Stock de truffes disponible
CREATE OR REPLACE VIEW public.vstocktruffesdisponible AS
SELECT 
    calibre_mm AS calibremm,
    qualite,
    maturite,
    SUM(quantite_kg_stock) AS quantitetotalekg,
    conservation,
    localisation_storage AS localisationstorage,
    COUNT(*) AS nombrelots,
    MIN(date_limite_consommation) AS datelimiteprochaine,
    AVG(prix_achat_kg) AS prixmoyenachat,
    MAX(date_achat) AS dernierachat
FROM public.stocks_truffes_achetees
WHERE quantite_kg_stock > 0
  AND (date_limite_consommation IS NULL OR date_limite_consommation >= CURRENT_DATE)
GROUP BY calibre_mm, qualite, maturite, conservation, localisation_storage
ORDER BY calibre_mm, qualite, maturite;

-- Vue: Analyse de marge par calibre
CREATE OR REPLACE VIEW public.vanalysemargeparcalibre AS
SELECT 
    calibre_mm AS calibremm,
    qualite,
    maturite,
    COUNT(*) AS nombretransactions,
    AVG(prix_achat_kg) AS prixachatmoyen,
    AVG(prix_vente_kg) AS prixventemoyen,
    AVG(marge_kg) AS margemoyennekg,
    AVG(pourcentage_marge) AS pourcentagemargemoyen,
    SUM(quantite_kg) AS quantitetotalekg
FROM public.analyse_marge_truffes
WHERE date_vente IS NOT NULL
GROUP BY calibre_mm, qualite, maturite
ORDER BY calibre_mm DESC, qualite;

-- Trigger pour mettre à jour updatedat automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger aux tables si pas déjà existant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_stocks_truffes_achetees_updatedat'
    ) THEN
        CREATE TRIGGER update_stocks_truffes_achetees_updatedat
            BEFORE UPDATE ON public.stocks_truffes_achetees
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- Commentaires pour documentation
COMMENT ON TABLE public.stocks_truffes_achetees IS 'Stock de truffes achetées auprès des fournisseurs';
COMMENT ON TABLE public.analyse_marge_truffes IS 'Analyse des marges réalisées sur les ventes de truffes';
COMMENT ON VIEW public.vstocktruffesdisponible IS 'Vue du stock disponible de truffes par calibre/qualité';
COMMENT ON VIEW public.vanalysemargeparcalibre IS 'Vue synthétique des marges moyennes par calibre';

-- Fin du script
SELECT 'Tables et vues créées avec succès !' AS status;
