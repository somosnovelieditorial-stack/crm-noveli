-- Migration 22: Create website_settings table for website domain and hosting configuration

CREATE TABLE IF NOT EXISTS website_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111',
    user_id UUID,
    domain TEXT NOT NULL DEFAULT 'somosnovelieditorial.com',
    www_domain TEXT DEFAULT 'www.somosnovelieditorial.com',
    public_url TEXT DEFAULT 'https://www.somosnovelieditorial.com/',
    vercel_preview_url TEXT DEFAULT '',
    domain_provider VARCHAR(100) DEFAULT 'Google Domains',
    hosting_provider VARCHAR(100) DEFAULT 'Vercel',
    domain_status VARCHAR(50) DEFAULT 'conectado',
    dns_notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_domain_status CHECK (domain_status IN ('pendiente', 'conectado', 'revisar DNS'))
);

-- Enable RLS
ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;

-- Disable RLS restrictions or add permissive policies for easy development (standard in this project)
CREATE POLICY "Permit all operations for website_settings" ON website_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert default website settings if not exists
INSERT INTO website_settings (domain, www_domain, public_url, domain_provider, hosting_provider, domain_status, dns_notes)
VALUES 
('somosnovelieditorial.com', 'www.somosnovelieditorial.com', 'https://www.somosnovelieditorial.com/', 'Google Domains', 'Vercel', 'conectado', 'Apuntar registro CNAME a cname.vercel-dns.com y registro A a 76.76.21.21')
ON CONFLICT DO NOTHING;
