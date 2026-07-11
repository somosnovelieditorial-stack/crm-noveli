-- MASTER SCHEMA GUARD MIGRATION
-- This script ensures all tables have the correct columns expected by the CRM frontend.
-- It uses ADD COLUMN IF NOT EXISTS to guarantee zero disruption to existing data.

-- 1. Alterations for table: quotations
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS converted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS converted_to_client BOOLEAN DEFAULT FALSE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS includes_vat BOOLEAN DEFAULT FALSE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS includes_iva BOOLEAN DEFAULT FALSE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 2. Alterations for table: prospects
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS converted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS converted_to_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS converted_to_client BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS includes_vat BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS includes_iva BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 3. Alterations for table: clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS includes_vat BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS includes_iva BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 4. Alterations for table: services
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 5. Alterations for table: service_stages
ALTER TABLE service_stages ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE service_stages ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE service_stages ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 6. Alterations for table: quotation_items
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 7. Alterations for table: documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 8. Alterations for table: incomes
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 9. Alterations for table: expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS fund_type TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS money_source TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 10. Alterations for table: staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 11. Alterations for table: payroll_payments
ALTER TABLE payroll_payments ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE payroll_payments ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 12. Alterations for table: operational_reserve_movements
ALTER TABLE operational_reserve_movements ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE operational_reserve_movements ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 13. Alterations for table: service_catalog
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS includes_iva BOOLEAN DEFAULT FALSE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 14. Alterations for table: service_packs
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS includes_iva BOOLEAN DEFAULT FALSE;
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 15. Alterations for table: company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 16. Alterations for table: website_settings
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 17. Alterations for table: website_services
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS visible_on_website BOOLEAN DEFAULT TRUE;
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 18. Alterations for table: website_books
ALTER TABLE website_books ADD COLUMN IF NOT EXISTS visible_on_website BOOLEAN DEFAULT TRUE;
ALTER TABLE website_books ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE website_books ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 19. Alterations for table: website_links
ALTER TABLE website_links ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE website_links ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 20. Alterations for table: website_sections
ALTER TABLE website_sections ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE website_sections ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 22. Alterations for table: organization_members
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS permissions JSONB;

-- 21. Drop status check constraints to prevent rigid DB constraints on CRM editable status states
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_status_check;
ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_services_status;
ALTER TABLE service_stages DROP CONSTRAINT IF EXISTS service_stages_status_check;
ALTER TABLE service_stages DROP CONSTRAINT IF EXISTS chk_service_stages_status;

-- 23. Helper function to find auth.users ID by email safely from frontend
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_addr TEXT)
RETURNS UUID AS $$
    SELECT id FROM auth.users WHERE email = email_addr LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 24. Create Income Distributions Table
CREATE TABLE IF NOT EXISTS income_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE DEFAULT get_user_org_id(),
    income_id UUID NOT NULL REFERENCES incomes(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    distribution_type TEXT NOT NULL,
    category TEXT,
    amount NUMERIC(12,2) NOT NULL,
    percentage NUMERIC(5,2),
    status TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_test BOOLEAN DEFAULT FALSE,
    test_run_id TEXT
);

-- Enable RLS and setup policies for income_distributions
ALTER TABLE income_distributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage income_distributions" ON income_distributions;
CREATE POLICY "Users can manage income_distributions" ON income_distributions 
    FOR ALL USING (organization_id = get_user_org_id()) WITH CHECK (organization_id = get_user_org_id());

-- 25. Create Client Funds Table
CREATE TABLE IF NOT EXISTS client_funds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE DEFAULT get_user_org_id(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    fund_type TEXT NOT NULL,
    fund_name TEXT NOT NULL,
    initial_amount NUMERIC(12,2) DEFAULT 0,
    allocated_amount NUMERIC(12,2) DEFAULT 0,
    used_amount NUMERIC(12,2) DEFAULT 0,
    balance NUMERIC(12,2) DEFAULT 0,
    status TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_test BOOLEAN DEFAULT FALSE,
    test_run_id TEXT
);

-- Enable RLS and setup policies for client_funds
ALTER TABLE client_funds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage client_funds" ON client_funds;
CREATE POLICY "Users can manage client_funds" ON client_funds 
    FOR ALL USING (organization_id = get_user_org_id()) WITH CHECK (organization_id = get_user_org_id());

-- 26. Create Fund Movements Table
CREATE TABLE IF NOT EXISTS fund_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE DEFAULT get_user_org_id(),
    fund_id UUID NOT NULL REFERENCES client_funds(id) ON DELETE CASCADE,
    income_id UUID REFERENCES incomes(id) ON DELETE SET NULL,
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    concept TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    is_test BOOLEAN DEFAULT FALSE,
    test_run_id TEXT
);

-- Enable RLS and setup policies for fund_movements
ALTER TABLE fund_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage fund_movements" ON fund_movements;
CREATE POLICY "Users can manage fund_movements" ON fund_movements 
    FOR ALL USING (organization_id = get_user_org_id()) WITH CHECK (organization_id = get_user_org_id());

-- 27. Create Income Tax Reservations Table
CREATE TABLE IF NOT EXISTS income_tax_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE DEFAULT get_user_org_id(),
    income_id UUID NOT NULL REFERENCES incomes(id) ON DELETE CASCADE,
    tax_type TEXT NOT NULL,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    taxable_amount NUMERIC(12,2) DEFAULT 0,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    status TEXT,
    paid_at DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and setup policies for income_tax_reservations
ALTER TABLE income_tax_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage income_tax_reservations" ON income_tax_reservations;
CREATE POLICY "Users can manage income_tax_reservations" ON income_tax_reservations 
    FOR ALL USING (organization_id = get_user_org_id()) WITH CHECK (organization_id = get_user_org_id());

-- 28. Create CRM Error Logs Table
CREATE TABLE IF NOT EXISTS crm_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_message TEXT NOT NULL,
    error_stack TEXT,
    module TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and setup policies for crm_error_logs
ALTER TABLE crm_error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert error logs" ON crm_error_logs;
CREATE POLICY "Anyone can insert error logs" ON crm_error_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can select error logs" ON crm_error_logs;
CREATE POLICY "Admins can select error logs" ON crm_error_logs FOR SELECT USING (true);
