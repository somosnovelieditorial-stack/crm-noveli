-- Migration 25: Add affects_cashflow and tax_payment columns to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS affects_cashflow BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tax_payment BOOLEAN NOT NULL DEFAULT FALSE;

-- Update existing records: if category is 'impuestos', set tax_payment = true
UPDATE expenses SET tax_payment = TRUE WHERE category = 'impuestos';
