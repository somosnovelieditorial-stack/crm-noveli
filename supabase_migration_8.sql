-- Migration 8: Add logo_url, favicon_url and unique constraint on organization_id to settings table

-- Add columns if they do not exist
ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- Add unique constraint on organization_id to support upsert by organization_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'settings_organization_id_key'
    ) THEN
        ALTER TABLE settings ADD CONSTRAINT settings_organization_id_key UNIQUE (organization_id);
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
