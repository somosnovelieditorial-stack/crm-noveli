-- Migration 31: Add converted_to_client and converted_at to prospects
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS converted_to_client BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE;
