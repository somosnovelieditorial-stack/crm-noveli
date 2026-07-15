-- Migration 38: Update RLS policies for payroll_payments and operational_reserve_movements to not filter by user_id

-- 1. payroll_payments
DROP POLICY IF EXISTS "Select payroll" ON payroll_payments;
CREATE POLICY "Select payroll" ON payroll_payments FOR SELECT USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Insert payroll" ON payroll_payments;
CREATE POLICY "Insert payroll" ON payroll_payments FOR INSERT WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

DROP POLICY IF EXISTS "Update payroll" ON payroll_payments;
CREATE POLICY "Update payroll" ON payroll_payments FOR UPDATE USING (organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');

DROP POLICY IF EXISTS "Delete payroll" ON payroll_payments;
CREATE POLICY "Delete payroll" ON payroll_payments FOR DELETE USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));


-- 2. operational_reserve_movements
DROP POLICY IF EXISTS "Select reserve" ON operational_reserve_movements;
CREATE POLICY "Select reserve" ON operational_reserve_movements FOR SELECT USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Insert reserve" ON operational_reserve_movements;
CREATE POLICY "Insert reserve" ON operational_reserve_movements FOR INSERT WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

DROP POLICY IF EXISTS "Update reserve" ON operational_reserve_movements;
CREATE POLICY "Update reserve" ON operational_reserve_movements FOR UPDATE USING (organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');

DROP POLICY IF EXISTS "Delete reserve" ON operational_reserve_movements;
CREATE POLICY "Delete reserve" ON operational_reserve_movements FOR DELETE USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
