-- Migration 20: Create website_services table for website services management

CREATE TABLE IF NOT EXISTS website_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111',
    user_id UUID,
    title TEXT NOT NULL,
    short_description TEXT,
    full_description TEXT,
    price_from NUMERIC(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'CLP',
    category VARCHAR(50) DEFAULT 'Editorial',
    featured BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE website_services ENABLE ROW LEVEL SECURITY;

-- Disable RLS restrictions or add permissive policies for easy development (standard in this project)
CREATE POLICY "Permit all operations for website_services" ON website_services
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert recommended default services if not exists
INSERT INTO website_services (title, short_description, price_from, currency, category, featured, active, display_order)
VALUES 
('Full eBook', 'Publicación completa de tu eBook en plataformas globales', 80000, 'CLP', 'Digitalización', true, true, 1),
('Full Físico', 'Edición e impresión física de tu obra literaria', 250000, 'CLP', 'Producción', true, true, 2),
('Full Total', 'El pack definitivo: eBook, libro físico, tapa blanda e ilustración', 450000, 'CLP', 'Producción', true, true, 3),
('Corrección', 'Corrección de estilo, gramática y ortografía profesional', 2500, 'CLP', 'Editorial', false, true, 4),
('Portada', 'Diseño de portada personalizado y adaptado al género', 120000, 'CLP', 'Diseño', false, true, 5),
('Maquetación', 'Maquetación interior profesional para impresión y digital', 90000, 'CLP', 'Editorial', false, true, 6),
('Difusión Editorial', 'Campañas de marketing, notas de prensa y difusión', 150000, 'CLP', 'Marketing', false, true, 7),
('Registro de Derechos de Autor', 'Gestión legal de registro de propiedad intelectual', 50000, 'CLP', 'Legal', false, true, 8)
ON CONFLICT DO NOTHING;
