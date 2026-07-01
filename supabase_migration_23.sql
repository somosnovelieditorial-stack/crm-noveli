-- Migration 23: Redefine website tables, add missing columns, and create website_links and website_sections

-- 1. Add visible_on_website to website_services if it does not exist
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS visible_on_website BOOLEAN DEFAULT TRUE;

-- 2. Add visible_on_website to website_books if it does not exist
ALTER TABLE website_books ADD COLUMN IF NOT EXISTS visible_on_website BOOLEAN DEFAULT TRUE;

-- 3. Add visible_on_website to website_settings if it does not exist
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS visible_on_website BOOLEAN DEFAULT TRUE;

-- 4. Create website_links table
CREATE TABLE IF NOT EXISTS website_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111',
    user_id UUID,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    platform VARCHAR(50) DEFAULT 'Amazon',
    active BOOLEAN DEFAULT TRUE,
    featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    visible_on_website BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for website_links
ALTER TABLE website_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permit all operations for website_links" ON website_links
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Seed default links
INSERT INTO website_links (title, url, platform, active, featured, display_order, visible_on_website)
VALUES 
('Amazon Oficial', 'https://www.amazon.com', 'Amazon', true, true, 1, true),
('Buscalibre Chile', 'https://www.buscalibre.cl', 'Buscalibre', true, true, 2, true),
('Wattpad Noveli', 'https://www.wattpad.com', 'Wattpad', true, false, 3, true)
ON CONFLICT DO NOTHING;

-- 5. Create website_sections table (for homepage main texts)
CREATE TABLE IF NOT EXISTS website_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111',
    user_id UUID,
    section_key VARCHAR(50) UNIQUE NOT NULL,
    title TEXT,
    content TEXT,
    active BOOLEAN DEFAULT TRUE,
    featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    visible_on_website BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for website_sections
ALTER TABLE website_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permit all operations for website_sections" ON website_sections
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Seed default sections
INSERT INTO website_sections (section_key, title, content, active, featured, display_order, visible_on_website)
VALUES 
('hero', 'Somos Noveli Editorial', 'Creamos puentes entre autores y lectores. Tu historia merece ser contada de la manera más hermosa.', true, true, 1, true),
('about', 'Sobre Nosotros', 'Noveli Editorial nació con la vocación de simplificar y dignificar el proceso de autopublicación. Ayudamos a autores independientes a maquetar, corregir, diseñar y distribuir sus libros a nivel global con calidad profesional.', true, true, 2, true),
('contact', 'Ponte en contacto', '¿Tienes un manuscrito listo? Escríbenos a contacto@somosnovelieditorial.com o búscanos en redes sociales.', true, false, 3, true)
ON CONFLICT (section_key) DO NOTHING;
