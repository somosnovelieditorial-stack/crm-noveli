-- Migration 49: Add service price visibility control to website_settings

ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS show_service_prices BOOLEAN DEFAULT TRUE;
