-- Migration 002: Add missing columns to arbres table
-- Date: 2026-01-24
-- Description: Add 3 new columns for tree management
--
-- DESIGN DECISIONS:
-- 1. variete_truffe: Already exists in init_database.sql
-- 2. etat_sanitaire: Removed - use existing 'etat' column instead (same purpose)
-- 3. age_ans: Added as GENERATED column (calculated from date_plantation)
--
-- COLUMNS ADDED:
-- - porte_greffe: VARCHAR(100) - Rootstock/grafting base
-- - rendement_estimé: NUMERIC(10,2) - Estimated yield in kg
-- - age_ans: INTEGER GENERATED - Age in years (auto-calculated from date_plantation)

BEGIN TRANSACTION;

-- Add porte_greffe column (rootstock/grafting base)
ALTER TABLE public.arbres 
ADD COLUMN IF NOT EXISTS porte_greffe VARCHAR(100);

-- Add rendement_estimé column (estimated yield in kg)
ALTER TABLE public.arbres 
ADD COLUMN IF NOT EXISTS rendement_estimé NUMERIC(10,2);

-- Add age_ans as GENERATED column (calculated from date_plantation)
-- This ensures age is always up-to-date without manual updates
ALTER TABLE public.arbres 
ADD COLUMN IF NOT EXISTS age_ans INTEGER 
GENERATED ALWAYS AS (
    EXTRACT(YEAR FROM AGE(NOW(), date_plantation))::INTEGER
) STORED;

-- Add comments for documentation
COMMENT ON COLUMN public.arbres.porte_greffe IS 'Porte-greffe utilisé (base de greffage)';
COMMENT ON COLUMN public.arbres.rendement_estimé IS 'Rendement estimé en kg';
COMMENT ON COLUMN public.arbres.age_ans IS 'Âge de l''arbre en années (calculé automatiquement à partir de date_plantation)';
COMMENT ON COLUMN public.arbres.etat IS 'État sanitaire de l''arbre (Excellent, Bon, Moyen, Mauvais) - valeur par défaut: Bon';

COMMIT;