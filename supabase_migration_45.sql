-- Migration 45: Add brand_name, brand_subtitle, logo_dark_url, and logo_light_url to website_settings

ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS brand_name TEXT DEFAULT 'NOVELI';
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS brand_subtitle TEXT DEFAULT '— EDITORIAL';
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS logo_dark_url TEXT;
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS logo_light_url TEXT;
