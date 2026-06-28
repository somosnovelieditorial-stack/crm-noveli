-- Migration 10: Ensure staff table uses agreed_payment instead of agreed_salary

DO $$
BEGIN
    -- Rename agreed_salary to agreed_payment if agreed_salary exists and agreed_payment does not
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

    -- If agreed_payment still does not exist, add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='staff' AND column_name='agreed_payment'
    ) THEN
        ALTER TABLE staff ADD COLUMN agreed_payment NUMERIC(12,2) NOT NULL DEFAULT 0.00;
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
