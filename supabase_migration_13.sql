-- Migration 13: Unify and standardize staff columns: frequency -> payment_frequency

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='staff' AND column_name='frequency'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='staff' AND column_name='payment_frequency'
    ) THEN
        ALTER TABLE staff RENAME COLUMN frequency TO payment_frequency;
    END IF;

    -- If payment_frequency still doesn't exist, add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='staff' AND column_name='payment_frequency'
    ) THEN
        ALTER TABLE staff ADD COLUMN payment_frequency TEXT NOT NULL DEFAULT 'mensual' CHECK (payment_frequency IN ('mensual', 'proyecto', 'único'));
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
