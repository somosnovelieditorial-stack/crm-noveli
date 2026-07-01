-- Migration 24: Recreate website tables with exact requested fields and RLS security based on organization_members

-- Drop existing tables if they exist to start fresh and clean
DROP TABLE IF EXISTS website_settings CASCADE;
DROP TABLE IF EXISTS website_services CASCADE;
DROP TABLE IF EXISTS website_books CASCADE;
DROP TABLE IF EXISTS website_links CASCADE;
DROP TABLE IF EXISTS website_sections CASCADE;

-- 1. website_settings
CREATE TABLE website_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    user_id UUID DEFAULT auth.uid(),
    site_name TEXT DEFAULT 'Somos Noveli Editorial',
    public_url TEXT DEFAULT 'https://www.somosnovelieditorial.com/',
    short_description TEXT,
    contact_email TEXT,
    instagram_url TEXT,
    hero_title TEXT DEFAULT 'Somos Noveli Editorial',
    hero_subtitle TEXT DEFAULT 'Tu historia merece ser contada',
    logo_url TEXT,
    favicon_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Select settings" ON website_settings FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "Insert settings" ON website_settings FOR INSERT WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update settings" ON website_settings FOR UPDATE USING (organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete settings" ON website_settings FOR DELETE USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 2. website_services
CREATE TABLE website_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    user_id UUID DEFAULT auth.uid(),
    title TEXT NOT NULL,
    short_description TEXT,
    full_description TEXT,
    price_from NUMERIC(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'CLP',
    category VARCHAR(50) DEFAULT 'Editorial',
    featured BOOLEAN DEFAULT FALSE,
    visible_on_website BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE website_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Select services" ON website_services FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "Insert services" ON website_services FOR INSERT WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update services" ON website_services FOR UPDATE USING (organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete services" ON website_services FOR DELETE USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 3. website_books
CREATE TABLE website_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    user_id UUID DEFAULT auth.uid(),
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    cover_url TEXT,
    short_description TEXT,
    genre VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Destacado',
    featured BOOLEAN DEFAULT FALSE,
    visible_on_website BOOLEAN DEFAULT TRUE,
    sale_url TEXT,
    sale_platform VARCHAR(50) DEFAULT 'Amazon',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE website_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Select books" ON website_books FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "Insert books" ON website_books FOR INSERT WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update books" ON website_books FOR UPDATE USING (organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete books" ON website_books FOR DELETE USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 4. website_links
CREATE TABLE website_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    user_id UUID DEFAULT auth.uid(),
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    link_type VARCHAR(50) DEFAULT 'compra', -- compra, lectura, autor, red social, otro
    related_type VARCHAR(50),
    related_id VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE website_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Select links" ON website_links FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "Insert links" ON website_links FOR INSERT WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update links" ON website_links FOR UPDATE USING (organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete links" ON website_links FOR DELETE USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 5. website_sections
CREATE TABLE website_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    user_id UUID DEFAULT auth.uid(),
    section_key VARCHAR(50) UNIQUE NOT NULL,
    title TEXT,
    subtitle TEXT,
    content TEXT,
    image_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE website_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Select sections" ON website_sections FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "Insert sections" ON website_sections FOR INSERT WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update sections" ON website_sections FOR UPDATE USING (organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete sections" ON website_sections FOR DELETE USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- Seeding logic for all organizations
DO $$
DECLARE
    org_rec RECORD;
BEGIN
    FOR org_rec IN SELECT id FROM organizations LOOP
        -- Seed Settings
        INSERT INTO website_settings (organization_id, site_name, public_url, contact_email, hero_title, hero_subtitle)
        VALUES (org_rec.id, 'Somos Noveli Editorial', 'https://www.somosnovelieditorial.com/', 'contacto@somosnovelieditorial.com', 'Somos Noveli Editorial', 'Tu historia merece ser contada')
        ON CONFLICT DO NOTHING;

        -- Seed Sections
        INSERT INTO website_sections (organization_id, section_key, title, subtitle, content)
        VALUES 
        (org_rec.id, 'inicio', 'Somos Noveli Editorial', 'Tu historia merece ser contada', 'Creamos puentes entre autores y lectores. Tu historia merece ser contada de la manera más hermosa.'),
        (org_rec.id, 'nosotros', 'Sobre Nosotros', 'Nuestra vocación', 'Noveli Editorial nació con la vocación de simplificar y dignificar el proceso de autopublicación. Ayudamos a autores independientes a maquetar, corregir, diseñar y distribuir sus libros a nivel global con calidad profesional.'),
        (org_rec.id, 'contacto', 'Ponte en contacto', 'Hablemos hoy', '¿Tienes un manuscrito listo? Escríbenos a contacto@somosnovelieditorial.com o búscanos en redes sociales.')
        ON CONFLICT (section_key) DO NOTHING;

        -- Seed Services
        INSERT INTO website_services (organization_id, title, category, price_from, short_description, featured, visible_on_website)
        VALUES 
        (org_rec.id, 'Full eBook', 'Digitalización', 80000, 'Publicación completa de tu eBook en plataformas globales', true, true),
        (org_rec.id, 'Full Físico', 'Producción', 250000, 'Edición e impresión física de tu obra literaria', true, true),
        (org_rec.id, 'Full Total', 'Producción', 450000, 'El pack definitivo: eBook, libro físico, tapa blanda e ilustración', true, true),
        (org_rec.id, 'Corrección', 'Editorial', 2500, 'Corrección de estilo, gramática y ortografía profesional', false, true),
        (org_rec.id, 'Portada', 'Diseño', 120000, 'Diseño de portada personalizado y adaptado al género', false, true),
        (org_rec.id, 'Maquetación', 'Editorial', 90000, 'Maquetación interior profesional para impresión y digital', false, true),
        (org_rec.id, 'Difusión Editorial', 'Marketing', 150000, 'Campañas de marketing, notas de prensa y difusión', false, true),
        (org_rec.id, 'Registro de Derechos de Autor', 'Legal', 50000, 'Gestión legal de registro de propiedad intelectual', false, true);

        -- Seed Books
        INSERT INTO website_books (organization_id, title, author, genre, status, featured, visible_on_website, sale_url, sale_platform)
        VALUES 
        (org_rec.id, 'El Eco de los Sauces', 'Clara Del Monte', 'Novela Histórica', 'Destacado', true, true, 'https://amazon.com', 'Amazon'),
        (org_rec.id, 'Cenizas de Neón', 'Julio Rivera', 'Ciencia Ficción', 'Novedad', true, true, 'https://wattpad.com', 'Wattpad');

        -- Seed Links
        INSERT INTO website_links (organization_id, label, url, link_type, active, display_order)
        VALUES 
        (org_rec.id, 'Amazon Oficial', 'https://www.amazon.com', 'compra', true, 1),
        (org_rec.id, 'Buscalibre Chile', 'https://www.buscalibre.cl', 'compra', true, 2),
        (org_rec.id, 'Wattpad Noveli', 'https://www.wattpad.com', 'lectura', true, 3);
    END LOOP;
END $$;
