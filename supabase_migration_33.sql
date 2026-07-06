-- Migration 33: Add conversion to prospect columns to quotations
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS author_phone TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS author_instagram TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS origin TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS converted_to_prospect BOOLEAN DEFAULT FALSE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS converted_prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS excludes_notes TEXT;
