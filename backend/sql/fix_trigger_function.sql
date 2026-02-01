-- ========================================
-- CORRECTION DE LA FONCTION TRIGGER
-- Gère à la fois updated_at et updatedat
-- ========================================

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Créer une nouvelle fonction qui gère les deux formats
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Essayer avec updated_at (snake_case)
    IF TG_TABLE_NAME IN ('users', 'arbres', 'parcelles', 'interventions', 'recoltes', 
                         'clients', 'ventes', 'commandes') THEN
        NEW.updated_at = CURRENT_TIMESTAMP;
    -- Sinon utiliser updatedat (camelCase)
    ELSE
        NEW.updatedat = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Réappliquer les triggers sur toutes les tables concernées

-- Tables avec updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'updated_at'
          AND table_name NOT LIKE 'pg_%'
    LOOP
        -- Supprimer le trigger existant s'il existe
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updatedat ON public.%I', t, t);
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I', t, t);
        
        -- Créer le nouveau trigger
        EXECUTE format('CREATE TRIGGER update_%s_updated_at
                        BEFORE UPDATE ON public.%I
                        FOR EACH ROW
                        EXECUTE FUNCTION update_updated_at_column()', t, t);
        
        RAISE NOTICE 'Trigger créé pour table: %', t;
    END LOOP;
END$$;

-- Tables avec updatedat (si elles existent)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'updatedat'
          AND table_name NOT LIKE 'pg_%'
    LOOP
        -- Supprimer le trigger existant s'il existe
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updatedat ON public.%I', t, t);
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I', t, t);
        
        -- Créer le nouveau trigger
        EXECUTE format('CREATE TRIGGER update_%s_updatedat
                        BEFORE UPDATE ON public.%I
                        FOR EACH ROW
                        EXECUTE FUNCTION update_updated_at_column()', t, t);
        
        RAISE NOTICE 'Trigger créé pour table: %', t;
    END LOOP;
END$$;

SELECT 'Fonction trigger corrigée avec succès !' AS status;
