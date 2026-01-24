-- Migration 002: Add missing columns to arbres table
-- Date: 2026-01-24
-- Description: Add 4 new columns for tree management
--
-- IMPORTANT: variete_truffe already exists in the table (from init_database.sql)
--            Only add: age_ans, porte_greffe, etat_sanitaire, rendement_estimé

BEGIN TRANSACTION;

-- Add age_ans column (age in years)
ALTER TABLE public.arbres 
ADD COLUMN IF NOT EXISTS age_ans INTEGER;

-- Add porte_greffe column (rootstock/grafting base)
ALTER TABLE public.arbres 
ADD COLUMN IF NOT EXISTS porte_greffe VARCHAR(100);

-- Add etat_sanitaire column (health status)
ALTER TABLE public.arbres 
ADD COLUMN IF NOT EXISTS etat_sanitaire VARCHAR(50);

-- Add rendement_estimé column (estimated yield in kg)
ALTER TABLE public.arbres 
ADD COLUMN IF NOT EXISTS rendement_estimé NUMERIC(10,2);

-- Add comments for documentation
COMMENT ON COLUMN public.arbres.age_ans IS 'Age de l''arbre en années';
COMMENT ON COLUMN public.arbres.porte_greffe IS 'Porte-greffe utilisé (base de greffage)';
COMMENT ON COLUMN public.arbres.etat_sanitaire IS 'État sanitaire de l''arbre (Excellent, Bon, Moyen, Mauvais)';
COMMENT ON COLUMN public.arbres.rendement_estimé IS 'Rendement estimé en kg';

COMMIT;