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

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing storage policies if they exist to avoid duplication errors
DROP POLICY IF EXISTS "Public Access Brand Assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth Insert Brand Assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update Brand Assets" ON storage.objects;

-- Create policies for brand-assets bucket
CREATE POLICY "Public Access Brand Assets" ON storage.objects FOR SELECT USING (bucket_id = 'brand-assets');
CREATE POLICY "Auth Insert Brand Assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'brand-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Update Brand Assets" ON storage.objects FOR UPDATE USING (bucket_id = 'brand-assets' AND auth.role() = 'authenticated');

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
