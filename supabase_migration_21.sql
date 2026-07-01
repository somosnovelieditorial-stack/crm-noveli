-- Migration 21: Create website_books table for website books management

CREATE TABLE IF NOT EXISTS website_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111',
    user_id UUID,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    cover_url TEXT,
    short_description TEXT,
    genre VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Destacado',
    featured BOOLEAN DEFAULT FALSE,
    sale_url TEXT,
    sale_platform VARCHAR(50) DEFAULT 'Amazon',
    active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_sale_platform CHECK (sale_platform IN ('Amazon', 'Buscalibre', 'Wattpad', 'Página del autor', 'Otro'))
);

-- Enable RLS
ALTER TABLE website_books ENABLE ROW LEVEL SECURITY;

-- Disable RLS restrictions or add permissive policies for easy development (standard in this project)
CREATE POLICY "Permit all operations for website_books" ON website_books
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert default books if not exists
INSERT INTO website_books (title, author, genre, status, featured, sale_url, sale_platform, active, display_order)
VALUES 
('El Eco de los Sauces', 'Clara Del Monte', 'Novela Histórica', 'Destacado', true, 'https://amazon.com', 'Amazon', true, 1),
('Cenizas de Neón', 'Julio Rivera', 'Ciencia Ficción', 'Novedad', true, 'https://wattpad.com', 'Wattpad', true, 2),
('Bajo la Sombra del Alerce', 'Marta Valdivia', 'Poesía', 'Preventa', false, '', 'Amazon', false, 3)
ON CONFLICT DO NOTHING;
