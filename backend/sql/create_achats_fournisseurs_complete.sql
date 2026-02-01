-- ========================================
-- SCRIPT COMPLET: Tables et Vues Achats & Fournisseurs
-- ========================================

-- Table: Stock des truffes achetées
CREATE TABLE IF NOT EXISTS public.stockstruffesachetees (
    id SERIAL PRIMARY KEY,
    lignecommandeid INTEGER NOT NULL,
    calibremm INTEGER NOT NULL,
    qualite public.qualitetruffe NOT NULL,
    maturite public.maturitetruffe NOT NULL,
    quantitekgstock NUMERIC(10,2) NOT NULL,
    conservation public.conservationtype DEFAULT 'Frais'::public.conservationtype,
    localisationstorage VARCHAR(100),
    dateachat DATE NOT NULL,
    datelimiteconsommation DATE,
    prixachatkg NUMERIC(10,2) NOT NULL,
    createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stock_lignecommande FOREIGN KEY (lignecommandeid) 
        REFERENCES public.lignescommandeachat(id) ON DELETE CASCADE
);

-- Table: Analyse des marges par truffe
CREATE TABLE IF NOT EXISTS public.analysemargetruffes (
    id SERIAL PRIMARY KEY,
    stockachatid INTEGER NOT NULL,
    commandeventeid INTEGER,
    calibremm INTEGER NOT NULL,
    qualite public.qualitetruffe NOT NULL,
    maturite public.maturitetruffe NOT NULL,
    prixachatkg NUMERIC(10,2) NOT NULL,
    prixventekg NUMERIC(10,2),
    quantitekg NUMERIC(10,2),
    margekg NUMERIC(10,2) GENERATED ALWAYS AS (
        CASE 
            WHEN prixventekg IS NOT NULL THEN prixventekg - prixachatkg 
            ELSE NULL::NUMERIC 
        END
    ) STORED,
    pourcentagemarge NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN prixventekg IS NOT NULL AND prixventekg > 0::NUMERIC 
            THEN ROUND(((prixventekg - prixachatkg) / prixventekg) * 100::NUMERIC, 2) 
            ELSE NULL::NUMERIC 
        END
    ) STORED,
    dateachat DATE NOT NULL,
    datevente DATE,
    createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_analysemarge_stock FOREIGN KEY (stockachatid) 
        REFERENCES public.stockstruffesachetees(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_stocks_achetees_calibre ON public.stockstruffesachetees(calibremm);
CREATE INDEX IF NOT EXISTS idx_stocks_achetees_qualite ON public.stockstruffesachetees(qualite);
CREATE INDEX IF NOT EXISTS idx_stocks_achetees_localisation ON public.stockstruffesachetees(localisationstorage);
CREATE INDEX IF NOT EXISTS idx_stocks_achetees_limite_consommation ON public.stockstruffesachetees(datelimiteconsommation);

CREATE INDEX IF NOT EXISTS idx_analysemarge_calibre ON public.analysemargetruffes(calibremm);
CREATE INDEX IF NOT EXISTS idx_analysemarge_dateachat ON public.analysemargetruffes(dateachat);

-- Vue: Stock de truffes disponible
CREATE OR REPLACE VIEW public.vstocktruffesdisponible AS
SELECT 
    calibremm,
    qualite,
    maturite,
    SUM(quantitekgstock) AS quantitetotalekg,
    conservation,
    localisationstorage,
    COUNT(*) AS nombrelots,
    MIN(datelimiteconsommation) AS datelimiteprochaine,
    AVG(prixachatkg) AS prixmoyenachat,
    MAX(dateachat) AS dernierachat
FROM public.stockstruffesachetees
WHERE quantitekgstock > 0
  AND (datelimiteconsommation IS NULL OR datelimiteconsommation >= CURRENT_DATE)
GROUP BY calibremm, qualite, maturite, conservation, localisationstorage
ORDER BY calibremm, qualite, maturite;

-- Vue: Analyse de marge par calibre
CREATE OR REPLACE VIEW public.vanalysemargeparcalibre AS
SELECT 
    calibremm,
    qualite,
    maturite,
    COUNT(*) AS nombretransactions,
    AVG(prixachatkg) AS prixachatmoyen,
    AVG(prixventekg) AS prixventemoyen,
    AVG(margekg) AS margemoyennekg,
    AVG(pourcentagemarge) AS pourcentagemargemoyen,
    SUM(quantitekg) AS quantitetotalekg
FROM public.analysemargetruffes
WHERE datevente IS NOT NULL
GROUP BY calibremm, qualite, maturite
ORDER BY calibremm DESC, qualite;

-- Vue: Performance des fournisseurs (déjà existante normalement, mais on s'assure)
CREATE OR REPLACE VIEW public.vperformancefournisseurstruffes AS
SELECT 
    f.id,
    f.nom,
    f.zoneproduction,
    COUNT(DISTINCT c.id) AS nombrecommandes,
    SUM(c.montanttotal) AS montanttotalachats,
    AVG(e.notequalite) AS notequalitemoyenne,
    AVG(e.notedelai) AS notedelaimoyenne,
    AVG(e.noteprix) AS noteprixmoyenne,
    AVG(e.noteglobale) AS noteglobalemoyenne,
    MAX(c.datecommande) AS dernierecommande
FROM public.fournisseurstruffes f
LEFT JOIN public.commandesachattruffes c ON f.id = c.fournisseurid
LEFT JOIN public.evaluationsfournisseurstruffes e ON f.id = e.fournisseurid
WHERE f.deletedat IS NULL
GROUP BY f.id, f.nom, f.zoneproduction
ORDER BY AVG(e.noteglobale) DESC NULLS LAST;

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
        WHERE tgname = 'update_stockstruffesachetees_updatedat'
    ) THEN
        CREATE TRIGGER update_stockstruffesachetees_updatedat
            BEFORE UPDATE ON public.stockstruffesachetees
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- Commentaires pour documentation
COMMENT ON TABLE public.stockstruffesachetees IS 'Stock de truffes achetées auprès des fournisseurs';
COMMENT ON TABLE public.analysemargetruffes IS 'Analyse des marges réalisées sur les ventes de truffes';
COMMENT ON VIEW public.vstocktruffesdisponible IS 'Vue du stock disponible de truffes par calibre/qualité';
COMMENT ON VIEW public.vanalysemargeparcalibre IS 'Vue synthétique des marges moyennes par calibre';

-- Fin du script
SELECT 'Tables et vues créées avec succès !' AS status;
