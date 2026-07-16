-- Migration 41: Add category management for website books and update website_books table

-- Create website_book_categories table
CREATE TABLE IF NOT EXISTS website_book_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('main', 'genre', 'collection')),
    parent_id UUID REFERENCES website_book_categories(id) ON DELETE SET NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for website_book_categories
ALTER TABLE website_book_categories ENABLE ROW LEVEL SECURITY;

-- Setup policies for website_book_categories
DROP POLICY IF EXISTS "Select website_book_categories" ON website_book_categories;
CREATE POLICY "Select website_book_categories" ON website_book_categories 
    FOR SELECT 
    USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Insert website_book_categories" ON website_book_categories;
CREATE POLICY "Insert website_book_categories" ON website_book_categories 
    FOR INSERT 
    WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Update website_book_categories" ON website_book_categories;
CREATE POLICY "Update website_book_categories" ON website_book_categories 
    FOR UPDATE 
    USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

DROP POLICY IF EXISTS "Delete website_book_categories" ON website_book_categories;
CREATE POLICY "Delete website_book_categories" ON website_book_categories 
    FOR DELETE 
    USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));


-- Create website_book_category_links table
CREATE TABLE IF NOT EXISTS website_book_category_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    book_id UUID NOT NULL REFERENCES website_books(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES website_book_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_book_category UNIQUE (book_id, category_id)
);

-- Enable RLS for website_book_category_links
ALTER TABLE website_book_category_links ENABLE ROW LEVEL SECURITY;

-- Setup policies for website_book_category_links
DROP POLICY IF EXISTS "Select website_book_category_links" ON website_book_category_links;
CREATE POLICY "Select website_book_category_links" ON website_book_category_links 
    FOR SELECT 
    USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Insert website_book_category_links" ON website_book_category_links;
CREATE POLICY "Insert website_book_category_links" ON website_book_category_links 
    FOR INSERT 
    WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Update website_book_category_links" ON website_book_category_links;
CREATE POLICY "Update website_book_category_links" ON website_book_category_links 
    FOR UPDATE 
    USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

DROP POLICY IF EXISTS "Delete website_book_category_links" ON website_book_category_links;
CREATE POLICY "Delete website_book_category_links" ON website_book_category_links 
    FOR DELETE 
    USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));


-- Alter website_books table to add new fields
ALTER TABLE website_books ADD COLUMN IF NOT EXISTS book_origin VARCHAR(50) CHECK (book_origin IN ('published_by_noveli', 'author_purchase')) DEFAULT 'published_by_noveli';
ALTER TABLE website_books ADD COLUMN IF NOT EXISTS purchase_type VARCHAR(50) CHECK (purchase_type IN ('noveli', 'external_author', 'no_purchase')) DEFAULT 'noveli';
ALTER TABLE website_books ADD COLUMN IF NOT EXISTS author_purchase_link TEXT;
ALTER TABLE website_books ADD COLUMN IF NOT EXISTS noveli_purchase_link TEXT;
ALTER TABLE website_books ADD COLUMN IF NOT EXISTS novelty BOOLEAN DEFAULT FALSE;
ALTER TABLE website_books ADD COLUMN IF NOT EXISTS upcoming BOOLEAN DEFAULT FALSE;

-- Insert default main categories
-- We use a subquery to get a valid organization_id or default to '11111111-1111-1111-1111-111111111111'
INSERT INTO website_book_categories (organization_id, name, slug, type, description, display_order, active)
SELECT 
    COALESCE((SELECT id FROM organizations LIMIT 1), '11111111-1111-1111-1111-111111111111'::uuid),
    'Publicados por Noveli',
    'publicados-por-noveli',
    'main',
    'Libros publicados oficialmente por Noveli',
    1,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM website_book_categories WHERE slug = 'publicados-por-noveli'
);

INSERT INTO website_book_categories (organization_id, name, slug, type, description, display_order, active)
SELECT 
    COALESCE((SELECT id FROM organizations LIMIT 1), '11111111-1111-1111-1111-111111111111'::uuid),
    'Compra con el autor',
    'compra-con-el-autor',
    'main',
    'Libros adquiridos directamente con el autor',
    2,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM website_book_categories WHERE slug = 'compra-con-el-autor'
);
