--
-- Migration: Rename 'etat' column to 'etat_sanitaire' in arbres table
-- Reason: Consistency between API and database schema
-- Date: 2026-01-25
--

-- Step 1: Rename the column
ALTER TABLE public.arbres RENAME COLUMN etat TO etat_sanitaire;

-- Step 2: Update the column comment
COMMENT ON COLUMN public.arbres.etat_sanitaire IS 'État sanitaire de l''arbre: Excellent, Bon, Moyen, Mauvais';

-- Step 3: Verify the change (this query can be run to confirm)
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'arbres' AND column_name = 'etat_sanitaire';
