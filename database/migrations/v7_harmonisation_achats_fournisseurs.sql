-- ========================================
-- MIGRATION ACHATS FOURNISSEURS V7
-- Harmonisation avec les valeurs récoltes
-- Date: 2026-02-02
-- ========================================

-- IMPORTANT: Exécuter ce script avec précaution sur une base de données de production
-- Il est recommandé de faire une sauvegarde complète avant l'exécution

BEGIN;

-- ========================================
-- 1. MODIFIER LE TYPE qualitetruffe
-- ========================================
DO $$ 
BEGIN
    -- Renommer l'ancien type
    ALTER TYPE public.qualitetruffe RENAME TO qualitetruffe_old;
    
    -- Créer le nouveau type avec les valeurs harmonisées
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
                ELSE NULL
            END;
    END IF;
    
    -- Migrer stocksachatstruffes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocksachatstruffes') THEN
        ALTER TABLE stocksachatstruffes 
            ALTER COLUMN qualite TYPE public.qualitetruffe 
            USING CASE qualite::text
                WHEN 'Extra' THEN 'Extra'::public.qualitetruffe
                WHEN '1re' THEN 'Première catégorie'::public.qualitetruffe
                WHEN '2e' THEN 'Deuxième catégorie'::public.qualitetruffe
                ELSE NULL
            END;
    END IF;
    
    -- Migrer recoltes si la colonne utilise ce type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recoltes' 
        AND column_name = 'qualite'
        AND data_type = 'USER-DEFINED'
    ) THEN
        ALTER TABLE recoltes
            ALTER COLUMN qualite TYPE public.qualitetruffe
            USING qualite::text::public.qualitetruffe;
    END IF;
    
    -- Supprimer l'ancien type
    DROP TYPE public.qualitetruffe_old;
    
    RAISE NOTICE 'Type qualitetruffe mis à jour avec succès';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erreur lors de la migration de qualitetruffe: %', SQLERRM;
END $$;

-- ========================================
-- 2. TRANSFORMER calibremm (INTEGER) en calibre (VARCHAR)
-- ========================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocksachatstruffes' AND column_name = 'calibremm') THEN
        -- Ajouter la nouvelle colonne calibre
        ALTER TABLE stocksachatstruffes
            ADD COLUMN IF NOT EXISTS calibre VARCHAR(50);
        
        -- Migrer les données
        UPDATE stocksachatstruffes
        SET calibre = CASE
            WHEN calibremm IS NULL THEN NULL
            WHEN calibremm < 20 THEN 'Petit (moins de 20g)'
            WHEN calibremm >= 20 AND calibremm < 50 THEN 'Moyen (20-50g)'
            WHEN calibremm >= 50 AND calibremm < 100 THEN 'Gros (50-100g)'
            WHEN calibremm >= 100 THEN 'Très gros (plus de 100g)'
        END;
        
        -- Supprimer l'ancienne colonne
        ALTER TABLE stocksachatstruffes DROP COLUMN calibremm;
        
        RAISE NOTICE 'Colonne calibre créée et données migrées avec succès';
    ELSE
        RAISE NOTICE 'Colonne calibremm n''existe pas, passage à l''étape suivante';
    END IF;
END $$;

-- ========================================
-- 3. MODIFIER LE TYPE maturitetruffe
-- ========================================
DO $$ 
BEGIN
    -- Renommer l'ancien type
    ALTER TYPE public.maturitetruffe RENAME TO maturitetruffe_old;
    
    -- Créer le nouveau type avec les valeurs harmonisées
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
                ELSE NULL
            END;
    END IF;
    
    -- Migrer stocksachatstruffes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocksachatstruffes') THEN
        ALTER TABLE stocksachatstruffes
            ALTER COLUMN maturite TYPE public.maturitetruffe
            USING CASE maturite::text
                WHEN 'Blanc' THEN 'Immature'::public.maturitetruffe
                WHEN 'Gris' THEN 'À point'::public.maturitetruffe
                WHEN 'Noir' THEN 'Mature'::public.maturitetruffe
                ELSE NULL
            END;
    END IF;
    
    -- Migrer recoltes si la colonne utilise ce type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recoltes' 
        AND column_name = 'maturite'
        AND data_type = 'USER-DEFINED'
    ) THEN
        ALTER TABLE recoltes
            ALTER COLUMN maturite TYPE public.maturitetruffe
            USING maturite::text::public.maturitetruffe;
    END IF;
    
    -- Supprimer l'ancien type
    DROP TYPE public.maturitetruffe_old;
    
    RAISE NOTICE 'Type maturitetruffe mis à jour avec succès';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erreur lors de la migration de maturitetruffe: %', SQLERRM;
END $$;

-- ========================================
-- 4. AJOUTER le champ STATUT aux achats
-- ========================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocksachatstruffes') THEN
        -- Ajouter la colonne statut si elle n'existe pas
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'stocksachatstruffes' 
            AND column_name = 'statut'
        ) THEN
            ALTER TABLE stocksachatstruffes
                ADD COLUMN statut public.statutcommandeachat DEFAULT 'En attente'::public.statutcommandeachat;
            
            COMMENT ON COLUMN stocksachatstruffes.statut IS 'Statut de l''achat: En attente, Confirmé, Expédié, Livré, Réceptionné, Annulé';
            
            RAISE NOTICE 'Colonne statut ajoutée à stocksachatstruffes avec succès';
        ELSE
            RAISE NOTICE 'Colonne statut existe déjà dans stocksachatstruffes';
        END IF;
    ELSE
        RAISE NOTICE 'Table stocksachatstruffes n''existe pas';
    END IF;
END $$;

-- ========================================
-- 5. VÉRIFICATIONS POST-MIGRATION
-- ========================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '--- Vérifications post-migration ---';
    
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
    
    -- Vérifier la colonne calibre
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocksachatstruffes' AND column_name = 'calibre') THEN
        RAISE NOTICE 'Colonne calibre existe dans stocksachatstruffes: OUI';
    ELSE
        RAISE NOTICE 'Colonne calibre existe dans stocksachatstruffes: NON';
    END IF;
    
    -- Vérifier la colonne statut
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocksachatstruffes' AND column_name = 'statut') THEN
        RAISE NOTICE 'Colonne statut existe dans stocksachatstruffes: OUI';
    ELSE
        RAISE NOTICE 'Colonne statut existe dans stocksachatstruffes: NON';
    END IF;
    
    RAISE NOTICE '--- Fin des vérifications ---';
END $$;

COMMIT;

-- ========================================
-- INFORMATIONS FINALES
-- ========================================
-- Ce script a harmonisé:
-- 1. QUALITÉ: Extra, Première catégorie, Deuxième catégorie, Pourrie
-- 2. CALIBRE: Petit (moins de 20g), Moyen (20-50g), Gros (50-100g), Très gros (plus de 100g)
-- 3. MATURITÉ: Immature, À point, Mature, Très mature
-- 4. STATUT: Ajouté à stocksachatstruffes
--
-- Les valeurs sont maintenant identiques à celles utilisées dans recoltes.js
-- ========================================