-- Migration 44: Create website_hero_settings and website_hero_quick_services tables

-- Create website_hero_settings table
CREATE TABLE IF NOT EXISTS website_hero_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    eyebrow TEXT DEFAULT 'EDITORIAL INDEPENDIENTE',
    title TEXT DEFAULT 'Tu historia merece ser contada de la manera más',
    highlighted_word TEXT DEFAULT 'hermosa',
    subtitle TEXT DEFAULT 'Ayudamos a autores independientes a maquetar, corregir, diseñar y distribuir sus libros a nivel global con calidad profesional.',
    primary_button_text TEXT DEFAULT 'Ver Servicios',
    primary_button_url TEXT DEFAULT '#servicios',
    secondary_button_text TEXT DEFAULT 'Conoce el Catálogo',
    secondary_button_url TEXT DEFAULT '#libros',
    background_image_url TEXT,
    side_image_url TEXT,
    featured_book_id UUID REFERENCES website_books(id) ON DELETE SET NULL,
    show_featured_book BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE website_hero_settings ENABLE ROW LEVEL SECURITY;

-- Policies for website_hero_settings
DROP POLICY IF EXISTS "Select website_hero_settings" ON website_hero_settings;
CREATE POLICY "Select website_hero_settings" ON website_hero_settings 
    FOR SELECT 
    USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Insert website_hero_settings" ON website_hero_settings;
CREATE POLICY "Insert website_hero_settings" ON website_hero_settings 
    FOR INSERT 
    WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Update website_hero_settings" ON website_hero_settings;
CREATE POLICY "Update website_hero_settings" ON website_hero_settings 
    FOR UPDATE 
    USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

DROP POLICY IF EXISTS "Delete website_hero_settings" ON website_hero_settings;
CREATE POLICY "Delete website_hero_settings" ON website_hero_settings 
    FOR DELETE 
    USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));


-- Create website_hero_quick_services table
CREATE TABLE IF NOT EXISTS website_hero_quick_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    label TEXT NOT NULL,
    icon_name VARCHAR(50) DEFAULT 'feather',
    link_url TEXT,
    display_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE website_hero_quick_services ENABLE ROW LEVEL SECURITY;

-- Policies for website_hero_quick_services
DROP POLICY IF EXISTS "Select website_hero_quick_services" ON website_hero_quick_services;
CREATE POLICY "Select website_hero_quick_services" ON website_hero_quick_services 
    FOR SELECT 
    USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Insert website_hero_quick_services" ON website_hero_quick_services;
CREATE POLICY "Insert website_hero_quick_services" ON website_hero_quick_services 
    FOR INSERT 
    WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Update website_hero_quick_services" ON website_hero_quick_services;
CREATE POLICY "Update website_hero_quick_services" ON website_hero_quick_services 
    FOR UPDATE 
    USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

DROP POLICY IF EXISTS "Delete website_hero_quick_services" ON website_hero_quick_services;
CREATE POLICY "Delete website_hero_quick_services" ON website_hero_quick_services 
    FOR DELETE 
    USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));


-- Seed default setting row
INSERT INTO website_hero_settings (
    organization_id,
    eyebrow,
    title,
    highlighted_word,
    subtitle,
    primary_button_text,
    primary_button_url,
    secondary_button_text,
    secondary_button_url,
    show_featured_book,
    active
)
SELECT 
    COALESCE((SELECT id FROM organizations LIMIT 1), '11111111-1111-1111-1111-111111111111'::uuid),
    'EDITORIAL INDEPENDIENTE',
    'Tu historia merece ser contada de la manera más',
    'hermosa',
    'Ayudamos a autores independientes a maquetar, corregir, diseñar y distribuir sus libros a nivel global con calidad profesional.',
    'Ver Servicios',
    '#servicios',
    'Conoce el Catálogo',
    '#libros',
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM website_hero_settings LIMIT 1
);
