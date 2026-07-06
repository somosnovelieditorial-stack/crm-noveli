-- Migration 30: Add commercial proposal columns to quotations
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS author_email TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS object TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS work_timeline TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS other_notes TEXT;
