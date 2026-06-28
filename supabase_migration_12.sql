-- Migration 12: Standardize payroll_payments columns to date, method, operational_expense

-- Rename payment_date to date if payment_date exists and date does not
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='payment_date'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='date'
    ) THEN
        ALTER TABLE payroll_payments RENAME COLUMN payment_date TO date;
    END IF;

    -- If date still doesn't exist, add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='date'
    ) THEN
        ALTER TABLE payroll_payments ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Rename payment_method to method if payment_method exists and method does not
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='payment_method'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='method'
    ) THEN
        ALTER TABLE payroll_payments RENAME COLUMN payment_method TO method;
    END IF;

    -- If method still doesn't exist, add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='method'
    ) THEN
        ALTER TABLE payroll_payments ADD COLUMN method TEXT NOT NULL DEFAULT 'transferencia';
    END IF;
END $$;

-- Rename counts_as_operational_expense to operational_expense if counts_as_operational_expense exists and operational_expense does not
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='counts_as_operational_expense'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='operational_expense'
    ) THEN
        ALTER TABLE payroll_payments RENAME COLUMN counts_as_operational_expense TO operational_expense;
    END IF;

    -- If operational_expense still doesn't exist, add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='payroll_payments' AND column_name='operational_expense'
    ) THEN
        ALTER TABLE payroll_payments ADD COLUMN operational_expense BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
