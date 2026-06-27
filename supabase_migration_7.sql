-- Migration 7: Add source column to incomes table for tracking auto-generated records

ALTER TABLE incomes ADD COLUMN IF NOT EXISTS source TEXT;

-- Reload PostgREST schema cache to make columns visible immediately
NOTIFY pgrst, 'reload schema';
