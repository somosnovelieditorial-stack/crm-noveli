-- Migration 11: Add payroll_payment_id and status to expenses, and rename columns in payroll_payments

-- 1. Add payroll_payment_id and status to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payroll_payment_id UUID;

-- Add status column to expenses to match payment statuses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='expenses' AND column_name='status'
    ) THEN
        ALTER TABLE expenses ADD COLUMN status TEXT NOT NULL DEFAULT 'pagado' CHECK (status IN ('pagado', 'pendiente', 'parcial'));
    END IF;
END $$;

-- 2. Rename date to payment_date in payroll_payments if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='date'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='payment_date'
    ) THEN
        ALTER TABLE payroll_payments RENAME COLUMN date TO payment_date;
    END IF;

    -- If payment_date still doesn't exist, add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='payment_date'
    ) THEN
        ALTER TABLE payroll_payments ADD COLUMN payment_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- 3. Rename is_operational_expense to counts_as_operational_expense in payroll_payments if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='is_operational_expense'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='counts_as_operational_expense'
    ) THEN
        ALTER TABLE payroll_payments RENAME COLUMN is_operational_expense TO counts_as_operational_expense;
    END IF;

    -- If counts_as_operational_expense still doesn't exist, add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='counts_as_operational_expense'
    ) THEN
        ALTER TABLE payroll_payments ADD COLUMN counts_as_operational_expense BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
