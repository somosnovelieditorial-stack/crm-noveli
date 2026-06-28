-- Migration 9: Add Staff, Payroll Payments, and Operational Reserve tables and policies (Idempotent Unified Migration)

-- 1. STAFF Table
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('fundador', 'colaborador', 'proveedor recurrente', 'externo')),
    agreed_payment NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    frequency TEXT NOT NULL CHECK (frequency IN ('mensual', 'proyecto', 'único')),
    status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Rename agreed_salary to agreed_payment if legacy column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='staff' AND column_name='agreed_salary'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='staff' AND column_name='agreed_payment'
    ) THEN
        ALTER TABLE staff RENAME COLUMN agreed_salary TO agreed_payment;
    END IF;
END $$;

-- RLS policies for staff
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select staff" ON staff;
DROP POLICY IF EXISTS "Insert staff" ON staff;
DROP POLICY IF EXISTS "Update staff" ON staff;
DROP POLICY IF EXISTS "Delete staff" ON staff;

CREATE POLICY "Select staff" ON staff FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert staff" ON staff FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update staff" ON staff FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete staff" ON staff FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 2. PAYROLL PAYMENTS Table
CREATE TABLE IF NOT EXISTS payroll_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado')),
    notes TEXT,
    is_operational_expense BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies for payroll_payments
ALTER TABLE payroll_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select payroll" ON payroll_payments;
DROP POLICY IF EXISTS "Insert payroll" ON payroll_payments;
DROP POLICY IF EXISTS "Update payroll" ON payroll_payments;
DROP POLICY IF EXISTS "Delete payroll" ON payroll_payments;

CREATE POLICY "Select payroll" ON payroll_payments FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert payroll" ON payroll_payments FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update payroll" ON payroll_payments FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete payroll" ON payroll_payments FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 3. OPERATIONAL RESERVE MOVEMENTS Table
CREATE TABLE IF NOT EXISTS operational_reserve_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    type TEXT NOT NULL CHECK (type IN ('entrada', 'salida', 'ajuste')),
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies for operational_reserve_movements
ALTER TABLE operational_reserve_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select reserve" ON operational_reserve_movements;
DROP POLICY IF EXISTS "Insert reserve" ON operational_reserve_movements;
DROP POLICY IF EXISTS "Update reserve" ON operational_reserve_movements;
DROP POLICY IF EXISTS "Delete reserve" ON operational_reserve_movements;

CREATE POLICY "Select reserve" ON operational_reserve_movements FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert reserve" ON operational_reserve_movements FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update reserve" ON operational_reserve_movements FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete reserve" ON operational_reserve_movements FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
