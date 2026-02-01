-- ========================================
-- CRÉATION DES VUES UNIQUEMENT
-- Les tables existent déjà
-- ========================================

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

-- Commentaires pour documentation
COMMENT ON VIEW public.vstocktruffesdisponible IS 'Vue du stock disponible de truffes par calibre/qualité';
COMMENT ON VIEW public.vanalysemargeparcalibre IS 'Vue synthétique des marges moyennes par calibre';

-- Vérifier les vues
SELECT 'Vues créées avec succès !' AS status;
SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name LIKE 'v%' ORDER BY table_name;
