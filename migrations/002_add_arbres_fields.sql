-- Migration 002: Add missing columns to arbres table
-- Date: 2026-01-24
-- Description: Add 2 new columns for tree management

BEGIN TRANSACTION;

-- Add porte_greffe column (rootstock/grafting base)
ALTER TABLE public.arbres 
ADD COLUMN IF NOT EXISTS porte_greffe VARCHAR(100);

-- Add rendement_estimé column (estimated yield in kg)
ALTER TABLE public.arbres 
ADD COLUMN IF NOT EXISTS rendement_estimé NUMERIC(10,2);

-- Add comments for documentation
COMMENT ON COLUMN public.arbres.porte_greffe IS 'Porte-greffe utilisé (base de greffage)';
COMMENT ON COLUMN public.arbres.rendement_estimé IS 'Rendement estimé en kg';
COMMENT ON COLUMN public.arbres.etat IS 'État sanitaire de l''arbre (Excellent, Bon, Moyen, Mauvais)';

-- Note: age_ans is calculated at frontend from date_plantation
-- No need to store it in the database

COMMIT;
