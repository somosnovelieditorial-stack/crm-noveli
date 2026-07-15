-- Migration 40: Create website_leads table

CREATE TABLE IF NOT EXISTS website_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    user_id UUID DEFAULT auth.uid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    instagram VARCHAR(100),
    service_of_interest TEXT,
    message TEXT,
    status VARCHAR(50) DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'revisado', 'contactado', 'propuesta creada', 'convertido a prospecto', 'descartado')),
    converted_to_proposal BOOLEAN DEFAULT FALSE,
    converted_quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
    converted_to_prospect BOOLEAN DEFAULT FALSE,
    converted_prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE website_leads ENABLE ROW LEVEL SECURITY;

-- Setup policies (using organization_id, not filtering by user_id)
DROP POLICY IF EXISTS "Select website_leads" ON website_leads;
CREATE POLICY "Select website_leads" ON website_leads 
    FOR SELECT 
    USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Insert website_leads" ON website_leads;
CREATE POLICY "Insert website_leads" ON website_leads 
    FOR INSERT 
    WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Update website_leads" ON website_leads;
CREATE POLICY "Update website_leads" ON website_leads 
    FOR UPDATE 
    USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

DROP POLICY IF EXISTS "Delete website_leads" ON website_leads;
CREATE POLICY "Delete website_leads" ON website_leads 
    FOR DELETE 
    USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
