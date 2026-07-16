-- Migration 43: Create website_footer_settings and website_footer_gallery tables

-- Create website_footer_settings table
CREATE TABLE IF NOT EXISTS website_footer_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    contact_title TEXT DEFAULT 'Ponte en contacto',
    contact_email TEXT DEFAULT 'contacto@somosnovelieditorial.com',
    contact_location TEXT DEFAULT 'Santiago, Chile',
    contact_description TEXT,
    instagram_title TEXT DEFAULT 'Síguenos en Instagram',
    instagram_url TEXT DEFAULT 'https://instagram.com/somosnovelieditorial',
    instagram_enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE website_footer_settings ENABLE ROW LEVEL SECURITY;

-- Policies for website_footer_settings
DROP POLICY IF EXISTS "Select website_footer_settings" ON website_footer_settings;
CREATE POLICY "Select website_footer_settings" ON website_footer_settings 
    FOR SELECT 
    USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Insert website_footer_settings" ON website_footer_settings;
CREATE POLICY "Insert website_footer_settings" ON website_footer_settings 
    FOR INSERT 
    WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Update website_footer_settings" ON website_footer_settings;
CREATE POLICY "Update website_footer_settings" ON website_footer_settings 
    FOR UPDATE 
    USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

DROP POLICY IF EXISTS "Delete website_footer_settings" ON website_footer_settings;
CREATE POLICY "Delete website_footer_settings" ON website_footer_settings 
    FOR DELETE 
    USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));


-- Create website_footer_gallery table
CREATE TABLE IF NOT EXISTS website_footer_gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    image_url TEXT NOT NULL,
    title TEXT,
    link_url TEXT,
    display_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE website_footer_gallery ENABLE ROW LEVEL SECURITY;

-- Policies for website_footer_gallery
DROP POLICY IF EXISTS "Select website_footer_gallery" ON website_footer_gallery;
CREATE POLICY "Select website_footer_gallery" ON website_footer_gallery 
    FOR SELECT 
    USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Insert website_footer_gallery" ON website_footer_gallery;
CREATE POLICY "Insert website_footer_gallery" ON website_footer_gallery 
    FOR INSERT 
    WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Update website_footer_gallery" ON website_footer_gallery;
CREATE POLICY "Update website_footer_gallery" ON website_footer_gallery 
    FOR UPDATE 
    USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

DROP POLICY IF EXISTS "Delete website_footer_gallery" ON website_footer_gallery;
CREATE POLICY "Delete website_footer_gallery" ON website_footer_gallery 
    FOR DELETE 
    USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));


-- Seed default setting row
INSERT INTO website_footer_settings (
    organization_id,
    contact_title,
    contact_email,
    contact_location,
    contact_description,
    instagram_title,
    instagram_url,
    instagram_enabled,
    active
)
SELECT 
    COALESCE((SELECT id FROM organizations LIMIT 1), '11111111-1111-1111-1111-111111111111'::uuid),
    'Ponte en contacto',
    'contacto@somosnovelieditorial.com',
    'Santiago, Chile',
    'Ayudamos a autores independientes a maquetar, corregir, diseñar y distribuir sus libros a nivel global con calidad profesional.',
    'Síguenos en Instagram',
    'https://instagram.com/somosnovelieditorial',
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM website_footer_settings LIMIT 1
);
