-- Migration 42: Add image_url, background_url, icon_name, and color_theme to website_services table

ALTER TABLE website_services ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS background_url TEXT;
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS icon_name VARCHAR(50) DEFAULT 'feather';
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS color_theme VARCHAR(50) DEFAULT 'gold';
