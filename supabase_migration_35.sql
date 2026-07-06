-- Ensure default organization exists
INSERT INTO organizations (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Editorial Noveli')
ON CONFLICT (id) DO NOTHING;

-- Migrate all records with null organization_id to the default organization
UPDATE providers SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE clients SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE prospects SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE services SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE service_stages SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE incomes SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE expenses SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE service_catalog SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE service_packs SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE service_pack_items SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE quotations SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE quotation_items SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE quick_replies SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE documents SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE settings SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE exchange_rates SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE editorial_stages SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE service_checklists SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE activity_log SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE agenda_events SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE company_settings SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE staff SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE payroll_payments SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE operational_reserve_movements SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE income_allocations SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE website_services SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL OR organization_id != '11111111-1111-1111-1111-111111111111';
UPDATE website_books SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL OR organization_id != '11111111-1111-1111-1111-111111111111';
UPDATE website_settings SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL OR organization_id != '11111111-1111-1111-1111-111111111111';
UPDATE website_links SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL OR organization_id != '11111111-1111-1111-1111-111111111111';
UPDATE website_sections SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL OR organization_id != '11111111-1111-1111-1111-111111111111';
