-- Vue pour le stock de truffes disponible
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

-- Vue pour l'analyse de marge par calibre
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
