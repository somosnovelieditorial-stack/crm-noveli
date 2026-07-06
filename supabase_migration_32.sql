-- Migration 32: Add converted_client_id alias column to prospects table
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS converted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
