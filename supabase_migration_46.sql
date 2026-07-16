-- Migration 46: Add detail and quoting fields to website_services

ALTER TABLE website_services ADD COLUMN IF NOT EXISTS includes TEXT;
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS not_included TEXT;
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS process_steps TEXT;
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS estimated_time TEXT;
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS requires_manuscript_info BOOLEAN DEFAULT FALSE;
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS quote_note TEXT;
