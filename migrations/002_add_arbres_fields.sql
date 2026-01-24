-- Migration: Add missing fields to arbres table
-- Date: 2026-01-24
-- Purpose: Add age_ans, porte_greffe, etat_sanitaire, rendement_estimé fields

BEGIN TRANSACTION;

-- Add missing columns to arbres table
ALTER TABLE public.arbres
ADD COLUMN age_ans INTEGER,
ADD COLUMN porte_greffe VARCHAR(100),
ADD COLUMN etat_sanitaire VARCHAR(50),
ADD COLUMN rendement_estimé NUMERIC(10,2);

-- Update etat column to support new values (Excellent, Bon, Moyen, Mauvais)
-- Note: The column already exists, just documenting that it should support these values
COMMENT ON COLUMN public.arbres.etat_sanitaire IS 'État sanitaire de l''arbre: Excellent, Bon, Moyen, Mauvais';

COMMIT;