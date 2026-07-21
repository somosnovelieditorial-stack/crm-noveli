-- Migration 48: Add logo height controls to website_settings

ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS logo_header_height INTEGER DEFAULT 42;
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS logo_footer_height INTEGER DEFAULT 46;
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS logo_menu_height INTEGER DEFAULT 42;
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS logo_mobile_height INTEGER DEFAULT 32;
