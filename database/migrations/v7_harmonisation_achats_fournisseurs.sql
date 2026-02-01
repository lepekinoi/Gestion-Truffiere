-- ========================================
-- MIGRATION ACHATS FOURNISSEURS V7
-- Harmonisation avec les valeurs récoltes
-- Date: 2026-02-02
-- Version: 1.5 (calibre_mm corrigé)
-- ========================================

-- IMPORTANT: Exécuter ce script avec précaution sur une base de données de production
-- Il est recommandé de faire une sauvegarde complète avant l'exécution

BEGIN;

-- ========================================
-- 0. SUPPRIMER TOUTES LES VUES DÉPENDANTES
-- ========================================
DO $$
BEGIN
    -- Supprimer la vue v_stock_truffes_disponible (nouvelle version)
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_stock_truffes_disponible') THEN
        DROP VIEW v_stock_truffes_disponible CASCADE;
        RAISE NOTICE 'Vue v_stock_truffes_disponible supprimée';
    END IF;
    
    -- Supprimer la vue vstocktruffesdisponible (ancienne version sans underscores)
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'vstocktruffesdisponible') THEN
        DROP VIEW vstocktruffesdisponible CASCADE;
        RAISE NOTICE 'Vue vstocktruffesdisponible supprimée';
    END IF;
    
    -- Supprimer vanalysemargeparcalibre qui peut aussi dépendre d'analysemargetruffes
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'vanalysemargeparcalibre') THEN
        DROP VIEW vanalysemargeparcalibre CASCADE;
        RAISE NOTICE 'Vue vanalysemargeparcalibre supprimée';
    END IF;
END $$;

-- ========================================
-- 1. MODIFIER LE TYPE qualitetruffe
-- ========================================
DO $$ 
DECLARE
    type_exists BOOLEAN;
BEGIN
    -- Vérifier si le type existe
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'qualitetruffe'
    ) INTO type_exists;
    
    IF type_exists THEN
        -- Le type existe, on le renomme et on en crée un nouveau
        RAISE NOTICE 'Type qualitetruffe existe, migration en cours...';
        ALTER TYPE public.qualitetruffe RENAME TO qualitetruffe_old;
        
        CREATE TYPE public.qualitetruffe AS ENUM (
            'Extra',
            'Première catégorie',
            'Deuxième catégorie',
            'Pourrie'
        );
        
        -- Migrer analysemargetruffes
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analysemargetruffes') THEN
            ALTER TABLE analysemargetruffes 
                ALTER COLUMN qualite TYPE public.qualitetruffe 
                USING CASE qualite::text
                    WHEN 'Extra' THEN 'Extra'::public.qualitetruffe
                    WHEN '1re' THEN 'Première catégorie'::public.qualitetruffe
                    WHEN '2e' THEN 'Deuxième catégorie'::public.qualitetruffe
                    WHEN 'Pourrie' THEN 'Pourrie'::public.qualitetruffe
                    ELSE NULL
                END;
        END IF;
        
        -- Migrer stocks_truffes_achetees
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocks_truffes_achetees') THEN
            ALTER TABLE stocks_truffes_achetees 
                ALTER COLUMN qualite TYPE public.qualitetruffe 
                USING CASE qualite::text
                    WHEN 'Extra' THEN 'Extra'::public.qualitetruffe
                    WHEN '1re' THEN 'Première catégorie'::public.qualitetruffe
                    WHEN '2e' THEN 'Deuxième catégorie'::public.qualitetruffe
                    WHEN 'Pourrie' THEN 'Pourrie'::public.qualitetruffe
                    ELSE NULL
                END;
        END IF;
        
        -- Migrer stockstruffesachetees (ancien nom)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stockstruffesachetees') THEN
            ALTER TABLE stockstruffesachetees 
                ALTER COLUMN qualite TYPE public.qualitetruffe 
                USING CASE qualite::text
                    WHEN 'Extra' THEN 'Extra'::public.qualitetruffe
                    WHEN '1re' THEN 'Première catégorie'::public.qualitetruffe
                    WHEN '2e' THEN 'Deuxième catégorie'::public.qualitetruffe
                    WHEN 'Pourrie' THEN 'Pourrie'::public.qualitetruffe
                    ELSE NULL
                END;
        END IF;
        
        -- Migrer recoltes
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recoltes') THEN
            ALTER TABLE recoltes
                ALTER COLUMN qualite TYPE public.qualitetruffe
                USING CASE qualite::text
                    WHEN 'Extra' THEN 'Extra'::public.qualitetruffe
                    WHEN 'Première catégorie' THEN 'Première catégorie'::public.qualitetruffe
                    WHEN 'Deuxième catégorie' THEN 'Deuxième catégorie'::public.qualitetruffe
                    WHEN 'Pourrie' THEN 'Pourrie'::public.qualitetruffe
                    ELSE NULL
                END;
        END IF;
        
        -- Supprimer l'ancien type
        DROP TYPE public.qualitetruffe_old;
        
    ELSE
        -- Le type n'existe pas, on le crée directement
        RAISE NOTICE 'Type qualitetruffe n''existe pas, création...';
        CREATE TYPE public.qualitetruffe AS ENUM (
            'Extra',
            'Première catégorie',
            'Deuxième catégorie',
            'Pourrie'
        );
    END IF;
    
    RAISE NOTICE 'Type qualitetruffe mis à jour avec succès';
END $$;

-- ========================================
-- 2. TRANSFORMER calibre_mm (INTEGER) en calibre (VARCHAR)
-- ========================================
DO $$
BEGIN
    -- Traiter stocks_truffes_achetees (nouveau nom avec underscores)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks_truffes_achetees' AND column_name = 'calibre_mm') THEN
        ALTER TABLE stocks_truffes_achetees ADD COLUMN IF NOT EXISTS calibre VARCHAR(50);
        UPDATE stocks_truffes_achetees
        SET calibre = CASE
            WHEN calibre_mm IS NULL THEN NULL
            WHEN calibre_mm < 20 THEN 'Petit (moins de 20g)'
            WHEN calibre_mm >= 20 AND calibre_mm < 50 THEN 'Moyen (20-50g)'
            WHEN calibre_mm >= 50 AND calibre_mm < 100 THEN 'Gros (50-100g)'
            WHEN calibre_mm >= 100 THEN 'Très gros (plus de 100g)'
        END;
        ALTER TABLE stocks_truffes_achetees DROP COLUMN calibre_mm;
        RAISE NOTICE 'Colonne calibre créée dans stocks_truffes_achetees (depuis calibre_mm)';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks_truffes_achetees' AND column_name = 'calibremm') THEN
        ALTER TABLE stocks_truffes_achetees ADD COLUMN IF NOT EXISTS calibre VARCHAR(50);
        UPDATE stocks_truffes_achetees
        SET calibre = CASE
            WHEN calibremm IS NULL THEN NULL
            WHEN calibremm < 20 THEN 'Petit (moins de 20g)'
            WHEN calibremm >= 20 AND calibremm < 50 THEN 'Moyen (20-50g)'
            WHEN calibremm >= 50 AND calibremm < 100 THEN 'Gros (50-100g)'
            WHEN calibremm >= 100 THEN 'Très gros (plus de 100g)'
        END;
        ALTER TABLE stocks_truffes_achetees DROP COLUMN calibremm;
        RAISE NOTICE 'Colonne calibre créée dans stocks_truffes_achetees (depuis calibremm)';
    ELSE
        RAISE NOTICE 'Colonne calibre_mm/calibremm non trouvée dans stocks_truffes_achetees';
    END IF;
    
    -- Traiter stockstruffesachetees (ancien nom sans underscores)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stockstruffesachetees' AND column_name = 'calibremm') THEN
        ALTER TABLE stockstruffesachetees ADD COLUMN IF NOT EXISTS calibre VARCHAR(50);
        UPDATE stockstruffesachetees
        SET calibre = CASE
            WHEN calibremm IS NULL THEN NULL
            WHEN calibremm < 20 THEN 'Petit (moins de 20g)'
            WHEN calibremm >= 20 AND calibremm < 50 THEN 'Moyen (20-50g)'
            WHEN calibremm >= 50 AND calibremm < 100 THEN 'Gros (50-100g)'
            WHEN calibremm >= 100 THEN 'Très gros (plus de 100g)'
        END;
        ALTER TABLE stockstruffesachetees DROP COLUMN calibremm;
        RAISE NOTICE 'Colonne calibre créée dans stockstruffesachetees';
    END IF;
END $$;

-- ========================================
-- 3. MODIFIER LE TYPE maturitetruffe
-- ========================================
DO $$ 
DECLARE
    type_exists BOOLEAN;
BEGIN
    -- Vérifier si le type existe
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'maturitetruffe'
    ) INTO type_exists;
    
    IF type_exists THEN
        -- Le type existe, on le renomme et on en crée un nouveau
        RAISE NOTICE 'Type maturitetruffe existe, migration en cours...';
        ALTER TYPE public.maturitetruffe RENAME TO maturitetruffe_old;
        
        CREATE TYPE public.maturitetruffe AS ENUM (
            'Immature',
            'À point',
            'Mature',
            'Très mature'
        );
        
        -- Migrer analysemargetruffes
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analysemargetruffes') THEN
            ALTER TABLE analysemargetruffes
                ALTER COLUMN maturite TYPE public.maturitetruffe
                USING CASE maturite::text
                    WHEN 'Blanc' THEN 'Immature'::public.maturitetruffe
                    WHEN 'Gris' THEN 'À point'::public.maturitetruffe
                    WHEN 'Noir' THEN 'Mature'::public.maturitetruffe
                    WHEN 'Immature' THEN 'Immature'::public.maturitetruffe
                    WHEN 'À point' THEN 'À point'::public.maturitetruffe
                    WHEN 'Mature' THEN 'Mature'::public.maturitetruffe
                    WHEN 'Très mature' THEN 'Très mature'::public.maturitetruffe
                    ELSE NULL
                END;
        END IF;
        
        -- Migrer stocks_truffes_achetees
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocks_truffes_achetees') THEN
            ALTER TABLE stocks_truffes_achetees
                ALTER COLUMN maturite TYPE public.maturitetruffe
                USING CASE maturite::text
                    WHEN 'Blanc' THEN 'Immature'::public.maturitetruffe
                    WHEN 'Gris' THEN 'À point'::public.maturitetruffe
                    WHEN 'Noir' THEN 'Mature'::public.maturitetruffe
                    WHEN 'Immature' THEN 'Immature'::public.maturitetruffe
                    WHEN 'À point' THEN 'À point'::public.maturitetruffe
                    WHEN 'Mature' THEN 'Mature'::public.maturitetruffe
                    WHEN 'Très mature' THEN 'Très mature'::public.maturitetruffe
                    ELSE NULL
                END;
        END IF;
        
        -- Migrer stockstruffesachetees (ancien nom)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stockstruffesachetees') THEN
            ALTER TABLE stockstruffesachetees
                ALTER COLUMN maturite TYPE public.maturitetruffe
                USING CASE maturite::text
                    WHEN 'Blanc' THEN 'Immature'::public.maturitetruffe
                    WHEN 'Gris' THEN 'À point'::public.maturitetruffe
                    WHEN 'Noir' THEN 'Mature'::public.maturitetruffe
                    WHEN 'Immature' THEN 'Immature'::public.maturitetruffe
                    WHEN 'À point' THEN 'À point'::public.maturitetruffe
                    WHEN 'Mature' THEN 'Mature'::public.maturitetruffe
                    WHEN 'Très mature' THEN 'Très mature'::public.maturitetruffe
                    ELSE NULL
                END;
        END IF;
        
        -- Migrer recoltes
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recoltes') THEN
            ALTER TABLE recoltes
                ALTER COLUMN maturite TYPE public.maturitetruffe
                USING CASE maturite::text
                    WHEN 'Blanc' THEN 'Immature'::public.maturitetruffe
                    WHEN 'Gris' THEN 'À point'::public.maturitetruffe
                    WHEN 'Noir' THEN 'Mature'::public.maturitetruffe
                    WHEN 'Immature' THEN 'Immature'::public.maturitetruffe
                    WHEN 'À point' THEN 'À point'::public.maturitetruffe
                    WHEN 'Mature' THEN 'Mature'::public.maturitetruffe
                    WHEN 'Très mature' THEN 'Très mature'::public.maturitetruffe
                    ELSE NULL
                END;
        END IF;
        
        -- Supprimer l'ancien type
        DROP TYPE public.maturitetruffe_old;
        
    ELSE
        -- Le type n'existe pas, on le crée directement
        RAISE NOTICE 'Type maturitetruffe n''existe pas, création...';
        CREATE TYPE public.maturitetruffe AS ENUM (
            'Immature',
            'À point',
            'Mature',
            'Très mature'
        );
    END IF;
    
    RAISE NOTICE 'Type maturitetruffe mis à jour avec succès';
END $$;

-- ========================================
-- 4. AJOUTER le champ STATUT aux achats
-- ========================================
DO $$
DECLARE
    type_exists BOOLEAN;
BEGIN
    -- Vérifier si le type statutcommandeachat existe
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'statutcommandeachat'
    ) INTO type_exists;
    
    IF NOT type_exists THEN
        -- Créer le type ENUM si absent
        RAISE NOTICE 'Type statutcommandeachat n''existe pas, création...';
        CREATE TYPE public.statutcommandeachat AS ENUM (
            'En attente',
            'Confirmé',
            'Expédié',
            'Livré',
            'Réceptionné',
            'Annulé'
        );
    END IF;
    
    -- Traiter stocks_truffes_achetees (nouveau nom)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocks_truffes_achetees') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'stocks_truffes_achetees' 
            AND column_name = 'statut'
        ) THEN
            ALTER TABLE stocks_truffes_achetees
                ADD COLUMN statut public.statutcommandeachat DEFAULT 'En attente'::public.statutcommandeachat;
            
            COMMENT ON COLUMN stocks_truffes_achetees.statut IS 'Statut de l''achat: En attente, Confirmé, Expédié, Livré, Réceptionné, Annulé';
            
            RAISE NOTICE 'Colonne statut ajoutée à stocks_truffes_achetees';
        END IF;
    END IF;
    
    -- Traiter stockstruffesachetees (ancien nom)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stockstruffesachetees') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'stockstruffesachetees' 
            AND column_name = 'statut'
        ) THEN
            ALTER TABLE stockstruffesachetees
                ADD COLUMN statut public.statutcommandeachat DEFAULT 'En attente'::public.statutcommandeachat;
            
            COMMENT ON COLUMN stockstruffesachetees.statut IS 'Statut de l''achat: En attente, Confirmé, Expédié, Livré, Réceptionné, Annulé';
            
            RAISE NOTICE 'Colonne statut ajoutée à stockstruffesachetees';
        END IF;
    END IF;
END $$;

-- ========================================
-- 5. RECRÉER LES VUES
-- ========================================
DO $$
BEGIN
    -- Recréer vstocktruffesdisponible (ancienne version, compatible avec l'ancien schéma)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stockstruffesachetees') THEN
        CREATE VIEW vstocktruffesdisponible AS
        SELECT 
            calibre,
            qualite,
            maturite,
            SUM(quantitekgstock) AS quantitetotalekg,
            conservation,
            localisationstorage,
            COUNT(*) AS nombrelots,
            MIN(datelimiteconsommation) AS datelimiteprochaine,
            AVG(prixachatkg) AS prixmoyenachat,
            MAX(dateachat) AS dernierachat
        FROM stockstruffesachetees
        WHERE 
            quantitekgstock > 0
            AND (datelimiteconsommation IS NULL OR datelimiteconsommation >= CURRENT_DATE)
        GROUP BY calibre, qualite, maturite, conservation, localisationstorage
        ORDER BY calibre, qualite, maturite;
        
        COMMENT ON VIEW vstocktruffesdisponible IS 'Vue du stock disponible de truffes par calibre/qualité';
        RAISE NOTICE 'Vue vstocktruffesdisponible recréée';
    END IF;
    
    -- Recréer v_stock_truffes_disponible (nouvelle version)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocks_truffes_achetees') THEN
        CREATE VIEW v_stock_truffes_disponible AS
        SELECT 
            calibre,
            qualite,
            maturite,
            SUM(quantite_kg_stock) AS quantite_totale_kg,
            conservation,
            localisation_storage,
            COUNT(*) AS nombre_lots,
            MIN(date_limite_consommation) AS date_limite_prochaine,
            AVG(prix_achat_kg) AS prix_moyen_achat,
            MAX(date_achat) AS dernier_achat
        FROM stocks_truffes_achetees
        WHERE 
            quantite_kg_stock > 0
            AND (date_limite_consommation IS NULL OR date_limite_consommation >= CURRENT_DATE)
        GROUP BY calibre, qualite, maturite, conservation, localisation_storage
        ORDER BY calibre, qualite, maturite;
        
        COMMENT ON VIEW v_stock_truffes_disponible IS 'Vue du stock disponible de truffes par calibre/qualité';
        RAISE NOTICE 'Vue v_stock_truffes_disponible recréée';
    END IF;
    
    -- Recréer vanalysemargeparcalibre
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analysemargetruffes') THEN
        CREATE VIEW vanalysemargeparcalibre AS
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
        FROM analysemargetruffes
        WHERE datevente IS NOT NULL
        GROUP BY calibremm, qualite, maturite
        ORDER BY calibremm DESC, qualite;
        
        COMMENT ON VIEW vanalysemargeparcalibre IS 'Vue synthétique des marges moyennes par calibre';
        RAISE NOTICE 'Vue vanalysemargeparcalibre recréée';
    END IF;
END $$;

-- ========================================
-- 6. VÉRIFICATIONS POST-MIGRATION
-- ========================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE '--- Vérifications post-migration ---';
    RAISE NOTICE '=========================================';
    
    -- Vérifier les types ENUM
    SELECT COUNT(*) INTO v_count
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'qualitetruffe';
    RAISE NOTICE 'Nombre de valeurs pour qualitetruffe: %', v_count;
    
    SELECT COUNT(*) INTO v_count
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'maturitetruffe';
    RAISE NOTICE 'Nombre de valeurs pour maturitetruffe: %', v_count;
    
    SELECT COUNT(*) INTO v_count
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'statutcommandeachat';
    RAISE NOTICE 'Nombre de valeurs pour statutcommandeachat: %', v_count;
    
    -- Vérifier les colonnes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks_truffes_achetees' AND column_name = 'calibre') THEN
        RAISE NOTICE 'Colonne calibre dans stocks_truffes_achetees: OUI';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stockstruffesachetees' AND column_name = 'calibre') THEN
        RAISE NOTICE 'Colonne calibre dans stockstruffesachetees: OUI';
    ELSE
        RAISE NOTICE 'Colonne calibre: NON TROUVÉE';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks_truffes_achetees' AND column_name = 'statut') THEN
        RAISE NOTICE 'Colonne statut dans stocks_truffes_achetees: OUI';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stockstruffesachetees' AND column_name = 'statut') THEN
        RAISE NOTICE 'Colonne statut dans stockstruffesachetees: OUI';
    ELSE
        RAISE NOTICE 'Colonne statut: NON TROUVÉE';
    END IF;
    
    -- Vérifier les vues
    SELECT COUNT(*) INTO v_count
    FROM information_schema.views
    WHERE table_name IN ('vstocktruffesdisponible', 'v_stock_truffes_disponible', 'vanalysemargeparcalibre');
    RAISE NOTICE 'Nombre de vues recréées: %', v_count;
    
    RAISE NOTICE '=========================================';
    RAISE NOTICE '--- Fin des vérifications ---';
    RAISE NOTICE '=========================================';
END $$;

COMMIT;

-- ========================================
-- INFORMATIONS FINALES
-- ========================================
-- Ce script a harmonisé:
-- 1. QUALITÉ: Extra, Première catégorie, Deuxième catégorie, Pourrie
-- 2. CALIBRE: Petit (moins de 20g), Moyen (20-50g), Gros (50-100g), Très gros (plus de 100g)
-- 3. MATURITÉ: Immature, À point, Mature, Très mature
-- 4. STATUT: Ajouté aux tables de stock
-- 5. VUES: Toutes les vues dépendantes recréées
--
-- Compatibilité assurée avec les deux schémas:
-- - stockstruffesachetees (ancien)
-- - stocks_truffes_achetees (nouveau)
-- ========================================