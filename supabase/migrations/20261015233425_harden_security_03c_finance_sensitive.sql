-- Security 03C. LOCAL validation only; financial commands no longer use writer as sufficient authorization.
BEGIN;
-- SECURITY INVOKER is sufficient: organization_members SELECT uses the existing
-- non-recursive is_org_member helper. No extra membership/RLS bypass is needed.
CREATE OR REPLACE FUNCTION public.is_org_finance(org_uuid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT org_uuid IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.organization_members AS membership
  WHERE membership.organization_id = org_uuid
    AND membership.user_id = (SELECT auth.uid())
    AND membership.active = true AND membership.role IN ('admin','finanzas')
 );
$$;
REVOKE ALL ON FUNCTION public.is_org_finance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_finance(uuid) TO authenticated, service_role, postgres;

-- settings mixes branding with bank_details/tax configuration. This narrow RPC
-- retains the authenticated CRM branding contract without granting table-wide reads.
-- DEFINER is required to project only these columns through finance-only settings RLS.
CREATE OR REPLACE FUNCTION public.get_org_branding(org_uuid uuid)
RETURNS TABLE(editorial_name text, logo_url text, favicon_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT config.editorial_name, config.logo_url, config.favicon_url
 FROM public.settings AS config
 WHERE org_uuid IS NOT NULL AND (SELECT auth.uid()) IS NOT NULL
   AND config.organization_id = org_uuid AND public.is_org_member(org_uuid);
$$;
REVOKE ALL ON FUNCTION public.get_org_branding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_branding(uuid) TO authenticated, service_role, postgres;

-- incomes
DROP POLICY IF EXISTS "Users can manage their own incomes" ON public.incomes;
DROP POLICY IF EXISTS "incomes_org_delete" ON public.incomes;
DROP POLICY IF EXISTS "incomes_org_insert" ON public.incomes;
DROP POLICY IF EXISTS "incomes_org_select" ON public.incomes;
DROP POLICY IF EXISTS "incomes_org_update" ON public.incomes;
DROP POLICY IF EXISTS security03c_select ON public.incomes;
DROP POLICY IF EXISTS security03c_insert ON public.incomes;
DROP POLICY IF EXISTS security03c_update ON public.incomes;
DROP POLICY IF EXISTS security03c_delete ON public.incomes;
CREATE POLICY security03c_select ON public.incomes FOR SELECT TO authenticated USING (public.is_org_finance(organization_id));
CREATE POLICY security03c_insert ON public.incomes FOR INSERT TO authenticated WITH CHECK (public.is_org_finance(organization_id)
 AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients parent WHERE parent.id = incomes.client_id AND parent.organization_id = incomes.organization_id))
 AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services parent WHERE parent.id = incomes.service_id AND parent.organization_id = incomes.organization_id))
 AND (prospect_id IS NULL OR EXISTS (SELECT 1 FROM public.prospects parent WHERE parent.id = incomes.prospect_id AND parent.organization_id = incomes.organization_id)));
CREATE POLICY security03c_update ON public.incomes FOR UPDATE TO authenticated USING (public.is_org_finance(organization_id)) WITH CHECK (public.is_org_finance(organization_id)
 AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients parent WHERE parent.id = incomes.client_id AND parent.organization_id = incomes.organization_id))
 AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services parent WHERE parent.id = incomes.service_id AND parent.organization_id = incomes.organization_id))
 AND (prospect_id IS NULL OR EXISTS (SELECT 1 FROM public.prospects parent WHERE parent.id = incomes.prospect_id AND parent.organization_id = incomes.organization_id)));
CREATE POLICY security03c_delete ON public.incomes FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.incomes;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.incomes FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- income_allocations
DROP POLICY IF EXISTS "Income allocations org access" ON public.income_allocations;
DROP POLICY IF EXISTS security03c_select ON public.income_allocations;
DROP POLICY IF EXISTS security03c_insert ON public.income_allocations;
DROP POLICY IF EXISTS security03c_update ON public.income_allocations;
DROP POLICY IF EXISTS security03c_delete ON public.income_allocations;
CREATE POLICY security03c_select ON public.income_allocations FOR SELECT TO authenticated USING (public.is_org_finance(organization_id));
CREATE POLICY security03c_insert ON public.income_allocations FOR INSERT TO authenticated WITH CHECK (public.is_org_finance(organization_id)
 AND (income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = income_allocations.income_id AND parent.organization_id = income_allocations.organization_id)));
CREATE POLICY security03c_update ON public.income_allocations FOR UPDATE TO authenticated USING (public.is_org_finance(organization_id)) WITH CHECK (public.is_org_finance(organization_id)
 AND (income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = income_allocations.income_id AND parent.organization_id = income_allocations.organization_id)));
CREATE POLICY security03c_delete ON public.income_allocations FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.income_allocations;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.income_allocations FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- income_distributions
DROP POLICY IF EXISTS "income_distributions_org_all" ON public.income_distributions;
DROP POLICY IF EXISTS security03c_select ON public.income_distributions;
DROP POLICY IF EXISTS security03c_insert ON public.income_distributions;
DROP POLICY IF EXISTS security03c_update ON public.income_distributions;
DROP POLICY IF EXISTS security03c_delete ON public.income_distributions;
CREATE POLICY security03c_select ON public.income_distributions FOR SELECT TO authenticated USING (public.is_org_finance(organization_id));
CREATE POLICY security03c_insert ON public.income_distributions FOR INSERT TO authenticated WITH CHECK (public.is_org_finance(organization_id)
 AND (income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = income_distributions.income_id AND parent.organization_id = income_distributions.organization_id))
 AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients parent WHERE parent.id = income_distributions.client_id AND parent.organization_id = income_distributions.organization_id))
 AND (prospect_id IS NULL OR EXISTS (SELECT 1 FROM public.prospects parent WHERE parent.id = income_distributions.prospect_id AND parent.organization_id = income_distributions.organization_id))
 AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services parent WHERE parent.id = income_distributions.service_id AND parent.organization_id = income_distributions.organization_id)));
CREATE POLICY security03c_update ON public.income_distributions FOR UPDATE TO authenticated USING (public.is_org_finance(organization_id)) WITH CHECK (public.is_org_finance(organization_id)
 AND (income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = income_distributions.income_id AND parent.organization_id = income_distributions.organization_id))
 AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients parent WHERE parent.id = income_distributions.client_id AND parent.organization_id = income_distributions.organization_id))
 AND (prospect_id IS NULL OR EXISTS (SELECT 1 FROM public.prospects parent WHERE parent.id = income_distributions.prospect_id AND parent.organization_id = income_distributions.organization_id))
 AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services parent WHERE parent.id = income_distributions.service_id AND parent.organization_id = income_distributions.organization_id)));
CREATE POLICY security03c_delete ON public.income_distributions FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.income_distributions;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.income_distributions FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- income_tax_reservations
DROP POLICY IF EXISTS "income_tax_reservations_org_all" ON public.income_tax_reservations;
DROP POLICY IF EXISTS security03c_select ON public.income_tax_reservations;
DROP POLICY IF EXISTS security03c_insert ON public.income_tax_reservations;
DROP POLICY IF EXISTS security03c_update ON public.income_tax_reservations;
DROP POLICY IF EXISTS security03c_delete ON public.income_tax_reservations;
CREATE POLICY security03c_select ON public.income_tax_reservations FOR SELECT TO authenticated USING (public.is_org_finance(organization_id));
CREATE POLICY security03c_insert ON public.income_tax_reservations FOR INSERT TO authenticated WITH CHECK (public.is_org_finance(organization_id)
 AND (income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = income_tax_reservations.income_id AND parent.organization_id = income_tax_reservations.organization_id)));
CREATE POLICY security03c_update ON public.income_tax_reservations FOR UPDATE TO authenticated USING (public.is_org_finance(organization_id)) WITH CHECK (public.is_org_finance(organization_id)
 AND (income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = income_tax_reservations.income_id AND parent.organization_id = income_tax_reservations.organization_id)));
CREATE POLICY security03c_delete ON public.income_tax_reservations FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.income_tax_reservations;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.income_tax_reservations FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- expenses
DROP POLICY IF EXISTS "Users can manage their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "expenses_org_delete" ON public.expenses;
DROP POLICY IF EXISTS "expenses_org_insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses_org_select" ON public.expenses;
DROP POLICY IF EXISTS "expenses_org_update" ON public.expenses;
DROP POLICY IF EXISTS security03c_select ON public.expenses;
DROP POLICY IF EXISTS security03c_insert ON public.expenses;
DROP POLICY IF EXISTS security03c_update ON public.expenses;
DROP POLICY IF EXISTS security03c_delete ON public.expenses;
CREATE POLICY security03c_select ON public.expenses FOR SELECT TO authenticated USING (public.is_org_finance(organization_id));
CREATE POLICY security03c_insert ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.is_org_finance(organization_id)
 AND (provider_id IS NULL OR EXISTS (SELECT 1 FROM public.providers parent WHERE parent.id = expenses.provider_id AND parent.organization_id = expenses.organization_id))
 AND (payroll_payment_id IS NULL OR EXISTS (SELECT 1 FROM public.payroll_payments parent WHERE parent.id = expenses.payroll_payment_id AND parent.organization_id = expenses.organization_id))
 AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients parent WHERE parent.id = expenses.client_id AND parent.organization_id = expenses.organization_id))
 AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services parent WHERE parent.id = expenses.service_id AND parent.organization_id = expenses.organization_id))
 AND (fund_id IS NULL OR EXISTS (SELECT 1 FROM public.client_funds parent WHERE parent.id = expenses.fund_id AND parent.organization_id = expenses.organization_id))
 AND (source_income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = expenses.source_income_id AND parent.organization_id = expenses.organization_id)));
CREATE POLICY security03c_update ON public.expenses FOR UPDATE TO authenticated USING (public.is_org_finance(organization_id)) WITH CHECK (public.is_org_finance(organization_id)
 AND (provider_id IS NULL OR EXISTS (SELECT 1 FROM public.providers parent WHERE parent.id = expenses.provider_id AND parent.organization_id = expenses.organization_id))
 AND (payroll_payment_id IS NULL OR EXISTS (SELECT 1 FROM public.payroll_payments parent WHERE parent.id = expenses.payroll_payment_id AND parent.organization_id = expenses.organization_id))
 AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients parent WHERE parent.id = expenses.client_id AND parent.organization_id = expenses.organization_id))
 AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services parent WHERE parent.id = expenses.service_id AND parent.organization_id = expenses.organization_id))
 AND (fund_id IS NULL OR EXISTS (SELECT 1 FROM public.client_funds parent WHERE parent.id = expenses.fund_id AND parent.organization_id = expenses.organization_id))
 AND (source_income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = expenses.source_income_id AND parent.organization_id = expenses.organization_id)));
CREATE POLICY security03c_delete ON public.expenses FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.expenses;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- client_funds
DROP POLICY IF EXISTS "client_funds_org_all" ON public.client_funds;
DROP POLICY IF EXISTS security03c_select ON public.client_funds;
DROP POLICY IF EXISTS security03c_insert ON public.client_funds;
DROP POLICY IF EXISTS security03c_update ON public.client_funds;
DROP POLICY IF EXISTS security03c_delete ON public.client_funds;
CREATE POLICY security03c_select ON public.client_funds FOR SELECT TO authenticated USING (public.is_org_finance(organization_id));
CREATE POLICY security03c_insert ON public.client_funds FOR INSERT TO authenticated WITH CHECK (public.is_org_finance(organization_id)
 AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients parent WHERE parent.id = client_funds.client_id AND parent.organization_id = client_funds.organization_id))
 AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services parent WHERE parent.id = client_funds.service_id AND parent.organization_id = client_funds.organization_id)));
CREATE POLICY security03c_update ON public.client_funds FOR UPDATE TO authenticated USING (public.is_org_finance(organization_id)) WITH CHECK (public.is_org_finance(organization_id)
 AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients parent WHERE parent.id = client_funds.client_id AND parent.organization_id = client_funds.organization_id))
 AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services parent WHERE parent.id = client_funds.service_id AND parent.organization_id = client_funds.organization_id)));
CREATE POLICY security03c_delete ON public.client_funds FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.client_funds;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.client_funds FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- fund_movements
DROP POLICY IF EXISTS "fund_movements_org_all" ON public.fund_movements;
DROP POLICY IF EXISTS security03c_select ON public.fund_movements;
DROP POLICY IF EXISTS security03c_insert ON public.fund_movements;
DROP POLICY IF EXISTS security03c_update ON public.fund_movements;
DROP POLICY IF EXISTS security03c_delete ON public.fund_movements;
CREATE POLICY security03c_select ON public.fund_movements FOR SELECT TO authenticated USING (public.is_org_finance(organization_id));
CREATE POLICY security03c_insert ON public.fund_movements FOR INSERT TO authenticated WITH CHECK (public.is_org_finance(organization_id)
 AND (fund_id IS NULL OR EXISTS (SELECT 1 FROM public.client_funds parent WHERE parent.id = fund_movements.fund_id AND parent.organization_id = fund_movements.organization_id))
 AND (income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = fund_movements.income_id AND parent.organization_id = fund_movements.organization_id))
 AND (expense_id IS NULL OR EXISTS (SELECT 1 FROM public.expenses parent WHERE parent.id = fund_movements.expense_id AND parent.organization_id = fund_movements.organization_id)));
CREATE POLICY security03c_update ON public.fund_movements FOR UPDATE TO authenticated USING (public.is_org_finance(organization_id)) WITH CHECK (public.is_org_finance(organization_id)
 AND (fund_id IS NULL OR EXISTS (SELECT 1 FROM public.client_funds parent WHERE parent.id = fund_movements.fund_id AND parent.organization_id = fund_movements.organization_id))
 AND (income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = fund_movements.income_id AND parent.organization_id = fund_movements.organization_id))
 AND (expense_id IS NULL OR EXISTS (SELECT 1 FROM public.expenses parent WHERE parent.id = fund_movements.expense_id AND parent.organization_id = fund_movements.organization_id)));
CREATE POLICY security03c_delete ON public.fund_movements FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.fund_movements;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.fund_movements FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- operational_reserve_movements
DROP POLICY IF EXISTS "Reserve org access" ON public.operational_reserve_movements;
DROP POLICY IF EXISTS "operational_reserve_movements_org_delete" ON public.operational_reserve_movements;
DROP POLICY IF EXISTS "operational_reserve_movements_org_insert" ON public.operational_reserve_movements;
DROP POLICY IF EXISTS "operational_reserve_movements_org_select" ON public.operational_reserve_movements;
DROP POLICY IF EXISTS "operational_reserve_movements_org_update" ON public.operational_reserve_movements;
DROP POLICY IF EXISTS security03c_select ON public.operational_reserve_movements;
DROP POLICY IF EXISTS security03c_insert ON public.operational_reserve_movements;
DROP POLICY IF EXISTS security03c_update ON public.operational_reserve_movements;
DROP POLICY IF EXISTS security03c_delete ON public.operational_reserve_movements;
CREATE POLICY security03c_select ON public.operational_reserve_movements FOR SELECT TO authenticated USING (public.is_org_finance(organization_id));
CREATE POLICY security03c_insert ON public.operational_reserve_movements FOR INSERT TO authenticated WITH CHECK (public.is_org_finance(organization_id)
 AND (source_income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = operational_reserve_movements.source_income_id AND parent.organization_id = operational_reserve_movements.organization_id))
 AND (distribution_id IS NULL OR EXISTS (SELECT 1 FROM public.income_distributions parent WHERE parent.id = operational_reserve_movements.distribution_id AND parent.organization_id = operational_reserve_movements.organization_id)));
CREATE POLICY security03c_update ON public.operational_reserve_movements FOR UPDATE TO authenticated USING (public.is_org_finance(organization_id)) WITH CHECK (public.is_org_finance(organization_id)
 AND (source_income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = operational_reserve_movements.source_income_id AND parent.organization_id = operational_reserve_movements.organization_id))
 AND (distribution_id IS NULL OR EXISTS (SELECT 1 FROM public.income_distributions parent WHERE parent.id = operational_reserve_movements.distribution_id AND parent.organization_id = operational_reserve_movements.organization_id)));
CREATE POLICY security03c_delete ON public.operational_reserve_movements FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.operational_reserve_movements;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.operational_reserve_movements FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- payroll_payments
DROP POLICY IF EXISTS "Payroll org access" ON public.payroll_payments;
DROP POLICY IF EXISTS "payroll_payments_org_delete" ON public.payroll_payments;
DROP POLICY IF EXISTS "payroll_payments_org_insert" ON public.payroll_payments;
DROP POLICY IF EXISTS "payroll_payments_org_select" ON public.payroll_payments;
DROP POLICY IF EXISTS "payroll_payments_org_update" ON public.payroll_payments;
DROP POLICY IF EXISTS security03c_select ON public.payroll_payments;
DROP POLICY IF EXISTS security03c_insert ON public.payroll_payments;
DROP POLICY IF EXISTS security03c_update ON public.payroll_payments;
DROP POLICY IF EXISTS security03c_delete ON public.payroll_payments;
CREATE POLICY security03c_select ON public.payroll_payments FOR SELECT TO authenticated USING (public.is_org_finance(organization_id));
CREATE POLICY security03c_insert ON public.payroll_payments FOR INSERT TO authenticated WITH CHECK (public.is_org_finance(organization_id)
 AND (staff_id IS NULL OR EXISTS (SELECT 1 FROM public.staff parent WHERE parent.id = payroll_payments.staff_id AND parent.organization_id = payroll_payments.organization_id))
 AND (source_income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = payroll_payments.source_income_id AND parent.organization_id = payroll_payments.organization_id))
 AND (distribution_id IS NULL OR EXISTS (SELECT 1 FROM public.income_distributions parent WHERE parent.id = payroll_payments.distribution_id AND parent.organization_id = payroll_payments.organization_id)));
CREATE POLICY security03c_update ON public.payroll_payments FOR UPDATE TO authenticated USING (public.is_org_finance(organization_id)) WITH CHECK (public.is_org_finance(organization_id)
 AND (staff_id IS NULL OR EXISTS (SELECT 1 FROM public.staff parent WHERE parent.id = payroll_payments.staff_id AND parent.organization_id = payroll_payments.organization_id))
 AND (source_income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes parent WHERE parent.id = payroll_payments.source_income_id AND parent.organization_id = payroll_payments.organization_id))
 AND (distribution_id IS NULL OR EXISTS (SELECT 1 FROM public.income_distributions parent WHERE parent.id = payroll_payments.distribution_id AND parent.organization_id = payroll_payments.organization_id)));
CREATE POLICY security03c_delete ON public.payroll_payments FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.payroll_payments;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.payroll_payments FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- company_settings
DROP POLICY IF EXISTS "company_settings_org_access" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_org_delete" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_org_insert" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_org_select" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_org_update" ON public.company_settings;
DROP POLICY IF EXISTS security03c_select ON public.company_settings;
DROP POLICY IF EXISTS security03c_insert ON public.company_settings;
DROP POLICY IF EXISTS security03c_update ON public.company_settings;
DROP POLICY IF EXISTS security03c_delete ON public.company_settings;
CREATE POLICY security03c_select ON public.company_settings FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03c_insert ON public.company_settings FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(organization_id));
CREATE POLICY security03c_update ON public.company_settings FOR UPDATE TO authenticated USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));
CREATE POLICY security03c_delete ON public.company_settings FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.company_settings;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- settings
DROP POLICY IF EXISTS "Users can manage their own settings" ON public.settings;
DROP POLICY IF EXISTS security03c_select ON public.settings;
DROP POLICY IF EXISTS security03c_insert ON public.settings;
DROP POLICY IF EXISTS security03c_update ON public.settings;
DROP POLICY IF EXISTS security03c_delete ON public.settings;
CREATE POLICY security03c_select ON public.settings FOR SELECT TO authenticated USING (public.is_org_finance(organization_id));
CREATE POLICY security03c_insert ON public.settings FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(organization_id));
CREATE POLICY security03c_update ON public.settings FOR UPDATE TO authenticated USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));
CREATE POLICY security03c_delete ON public.settings FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.settings;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.settings FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- exchange_rates
DROP POLICY IF EXISTS "Users can manage their own exchange_rates" ON public.exchange_rates;
DROP POLICY IF EXISTS security03c_select ON public.exchange_rates;
DROP POLICY IF EXISTS security03c_insert ON public.exchange_rates;
DROP POLICY IF EXISTS security03c_update ON public.exchange_rates;
DROP POLICY IF EXISTS security03c_delete ON public.exchange_rates;
CREATE POLICY security03c_select ON public.exchange_rates FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03c_insert ON public.exchange_rates FOR INSERT TO authenticated WITH CHECK (public.is_org_finance(organization_id));
CREATE POLICY security03c_update ON public.exchange_rates FOR UPDATE TO authenticated USING (public.is_org_finance(organization_id)) WITH CHECK (public.is_org_finance(organization_id));
CREATE POLICY security03c_delete ON public.exchange_rates FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.exchange_rates;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.exchange_rates FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- staff
DROP POLICY IF EXISTS "Staff org access" ON public.staff;
DROP POLICY IF EXISTS "staff_org_delete" ON public.staff;
DROP POLICY IF EXISTS "staff_org_insert" ON public.staff;
DROP POLICY IF EXISTS "staff_org_select" ON public.staff;
DROP POLICY IF EXISTS "staff_org_update" ON public.staff;
DROP POLICY IF EXISTS security03c_select ON public.staff;
DROP POLICY IF EXISTS security03c_insert ON public.staff;
DROP POLICY IF EXISTS security03c_update ON public.staff;
DROP POLICY IF EXISTS security03c_delete ON public.staff;
CREATE POLICY security03c_select ON public.staff FOR SELECT TO authenticated USING (public.is_org_finance(organization_id));
CREATE POLICY security03c_insert ON public.staff FOR INSERT TO authenticated WITH CHECK (public.is_org_finance(organization_id));
CREATE POLICY security03c_update ON public.staff FOR UPDATE TO authenticated USING (public.is_org_finance(organization_id)) WITH CHECK (public.is_org_finance(organization_id));
CREATE POLICY security03c_delete ON public.staff FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
-- Reuse the unchanged SECURITY INVOKER tenant-immutability trigger function from 03B.
DROP TRIGGER IF EXISTS security03c_preserve_tenant ON public.staff;
CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.staff FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

COMMIT;
