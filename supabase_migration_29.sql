-- Migration 29: Add pdf metadata and terms to quotations and quotation_items
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quote_number TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS issue_date DATE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS valid_until DATE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 15;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS scope_notes TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS includes_notes TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS excludes_notes TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS start_conditions TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS legal_notes TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
