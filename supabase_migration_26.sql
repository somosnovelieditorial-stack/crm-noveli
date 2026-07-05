-- Migration 26: Add tax_type and source columns to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tax_type TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source TEXT;

-- Update existing records if category is 'impuestos' to set tax_payment = true and affects_cashflow = true
UPDATE expenses SET tax_payment = TRUE, affects_cashflow = TRUE WHERE category = 'impuestos';
