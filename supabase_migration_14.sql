-- Migration 14: Add income_allocations table for income distribution / treasury

CREATE TABLE IF NOT EXISTS income_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    income_id UUID REFERENCES incomes(id) ON DELETE CASCADE,
    area TEXT NOT NULL CHECK (area IN ('sueldos', 'reserva operacional', 'gastos del autor', 'publicidad', 'proveedores', 'impuestos', 'utilidad Noveli', 'otro')),
    allocation_type TEXT NOT NULL CHECK (allocation_type IN ('porcentaje', 'monto fijo')),
    value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    calculated_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies for income_allocations
ALTER TABLE income_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select allocations" ON income_allocations;
DROP POLICY IF EXISTS "Insert allocations" ON income_allocations;
DROP POLICY IF EXISTS "Update allocations" ON income_allocations;
DROP POLICY IF EXISTS "Delete allocations" ON income_allocations;

CREATE POLICY "Select allocations" ON income_allocations FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert allocations" ON income_allocations FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update allocations" ON income_allocations FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete allocations" ON income_allocations FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
