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
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS test_run_id TEXT;

-- 9. Alterations for table: expenses
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
