-- ========================================
-- MIGRATION ACHATS FOURNISSEURS V7
-- Harmonisation avec les valeurs récoltes
-- Date: 2026-02-02
-- Version: 1.3 (gestion des vues dépendantes)
-- ========================================

-- IMPORTANT: Exécuter ce script avec précaution sur une base de données de production
-- Il est recommandé de faire une sauvegarde complète avant l'exécution

BEGIN;

-- ========================================
-- 0. SUPPRIMER LES VUES DÉPENDANTES
-- ========================================
DO $$
BEGIN
    -- Supprimer la vue v_stock_truffes_disponible si elle existe
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_stock_truffes_disponible') THEN
        DROP VIEW v_stock_truffes_disponible CASCADE;
        RAISE NOTICE 'Vue v_stock_truffes_disponible supprimée';
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
        
        -- Convertir les colonnes VARCHAR en ENUM
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analysemargetruffes') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analysemargetruffes' AND column_name = 'qualite') THEN
                ALTER TABLE analysemargetruffes
                    ALTER COLUMN qualite TYPE public.qualitetruffe
                    USING CASE qualite
                        WHEN 'Extra' THEN 'Extra'::public.qualitetruffe
                        WHEN '1re' THEN 'Première catégorie'::public.qualitetruffe
                        WHEN '2e' THEN 'Deuxième catégorie'::public.qualitetruffe
                        WHEN 'Pourrie' THEN 'Pourrie'::public.qualitetruffe
                        ELSE NULL
                    END;
            END IF;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocks_truffes_achetees') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks_truffes_achetees' AND column_name = 'qualite') THEN
                ALTER TABLE stocks_truffes_achetees
                    ALTER COLUMN qualite TYPE public.qualitetruffe
                    USING CASE qualite
                        WHEN 'Extra' THEN 'Extra'::public.qualitetruffe
                        WHEN '1re' THEN 'Première catégorie'::public.qualitetruffe
                        WHEN '2e' THEN 'Deuxième catégorie'::public.qualitetruffe
                        WHEN 'Pourrie' THEN 'Pourrie'::public.qualitetruffe
                        ELSE NULL
                    END;
            END IF;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recoltes') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recoltes' AND column_name = 'qualite') THEN
                ALTER TABLE recoltes
                    ALTER COLUMN qualite TYPE public.qualitetruffe
                    USING CASE qualite
                        WHEN 'Extra' THEN 'Extra'::public.qualitetruffe
                        WHEN 'Première catégorie' THEN 'Première catégorie'::public.qualitetruffe
                        WHEN 'Deuxième catégorie' THEN 'Deuxième catégorie'::public.qualitetruffe
                        WHEN 'Pourrie' THEN 'Pourrie'::public.qualitetruffe
                        ELSE NULL
                    END;
            END IF;
        END IF;
    END IF;
    
    RAISE NOTICE 'Type qualitetruffe mis à jour avec succès';
END $$;

-- ========================================
-- 2. TRANSFORMER calibremm (INTEGER) en calibre (VARCHAR)
-- ========================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks_truffes_achetees' AND column_name = 'calibremm') THEN
        -- Ajouter la nouvelle colonne calibre
        ALTER TABLE stocks_truffes_achetees
            ADD COLUMN IF NOT EXISTS calibre VARCHAR(50);
        
        -- Migrer les données
        UPDATE stocks_truffes_achetees
        SET calibre = CASE
            WHEN calibremm IS NULL THEN NULL
            WHEN calibremm < 20 THEN 'Petit (moins de 20g)'
            WHEN calibremm >= 20 AND calibremm < 50 THEN 'Moyen (20-50g)'
            WHEN calibremm >= 50 AND calibremm < 100 THEN 'Gros (50-100g)'
            WHEN calibremm >= 100 THEN 'Très gros (plus de 100g)'
        END;
        
        -- Supprimer l'ancienne colonne
        ALTER TABLE stocks_truffes_achetees DROP COLUMN calibremm;
        
        RAISE NOTICE 'Colonne calibre créée et données migrées avec succès';
    ELSE
        RAISE NOTICE 'Colonne calibremm n''existe pas, passage à l''étape suivante';
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
        
        -- Convertir les colonnes VARCHAR en ENUM
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analysemargetruffes') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analysemargetruffes' AND column_name = 'maturite') THEN
                ALTER TABLE analysemargetruffes
                    ALTER COLUMN maturite TYPE public.maturitetruffe
                    USING CASE maturite
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
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocks_truffes_achetees') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks_truffes_achetees' AND column_name = 'maturite') THEN
                ALTER TABLE stocks_truffes_achetees
                    ALTER COLUMN maturite TYPE public.maturitetruffe
                    USING CASE maturite
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
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recoltes') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recoltes' AND column_name = 'maturite') THEN
                ALTER TABLE recoltes
                    ALTER COLUMN maturite TYPE public.maturitetruffe
                    USING CASE maturite
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
        END IF;
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
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocks_truffes_achetees') THEN
        -- Ajouter la colonne statut si elle n'existe pas
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'stocks_truffes_achetees' 
            AND column_name = 'statut'
        ) THEN
            ALTER TABLE stocks_truffes_achetees
                ADD COLUMN statut public.statutcommandeachat DEFAULT 'En attente'::public.statutcommandeachat;
            
            COMMENT ON COLUMN stocks_truffes_achetees.statut IS 'Statut de l''achat: En attente, Confirmé, Expédié, Livré, Réceptionné, Annulé';
            
            RAISE NOTICE 'Colonne statut ajoutée à stocks_truffes_achetees avec succès';
        ELSE
            RAISE NOTICE 'Colonne statut existe déjà dans stocks_truffes_achetees';
        END IF;
    ELSE
        RAISE NOTICE 'Table stocks_truffes_achetees n''existe pas';
    END IF;
END $$;

-- ========================================
-- 5. RECRÉER LA VUE v_stock_truffes_disponible
-- ========================================
DO $$
BEGIN
    -- Recréer la vue avec la nouvelle structure
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
        
        RAISE NOTICE 'Vue v_stock_truffes_disponible recréée avec succès';
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
    
    -- Vérifier la colonne calibre
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks_truffes_achetees' AND column_name = 'calibre') THEN
        RAISE NOTICE 'Colonne calibre existe dans stocks_truffes_achetees: OUI';
    ELSE
        RAISE NOTICE 'Colonne calibre existe dans stocks_truffes_achetees: NON';
    END IF;
    
    -- Vérifier la colonne statut
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks_truffes_achetees' AND column_name = 'statut') THEN
        RAISE NOTICE 'Colonne statut existe dans stocks_truffes_achetees: OUI';
    ELSE
        RAISE NOTICE 'Colonne statut existe dans stocks_truffes_achetees: NON';
    END IF;
    
    -- Vérifier que la vue a été recréée
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_stock_truffes_disponible') THEN
        RAISE NOTICE 'Vue v_stock_truffes_disponible existe: OUI';
    ELSE
        RAISE NOTICE 'Vue v_stock_truffes_disponible existe: NON';
    END IF;
    
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
-- 4. STATUT: Ajouté à stocks_truffes_achetees
-- 5. VUE: v_stock_truffes_disponible recréée avec la nouvelle structure
--
-- Les valeurs sont maintenant identiques à celles utilisées dans recoltes.js
-- ========================================