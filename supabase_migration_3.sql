-- Migration 3: Add requires_* requirement checkboxes to service_catalog and service_packs

-- Update service_catalog Table
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS requires_manuscript BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS requires_materials BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS requires_signed_contract BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS requires_agreement_sent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS requires_duration BOOLEAN NOT NULL DEFAULT FALSE;

-- Update service_packs Table
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS requires_manuscript BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS requires_materials BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS requires_signed_contract BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS requires_agreement_sent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS requires_duration BOOLEAN NOT NULL DEFAULT FALSE;
