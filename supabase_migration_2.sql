-- Migration script 2 to update clients, prospects, services, service_catalog, and service_packs tables
-- with dynamic requirements, multiple selected services, categories, and new pipeline states.
-- Run this script in the Supabase SQL Editor.

-- 1. Update clients status constraint to the new 12 states
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check CHECK (status IN (
  'prospecto', 'interesado', 'acuerdo enviado', 'link de pago enviado', 
  'esperando pago', 'pago recibido', 'esperando contrato firmado', 
  'esperando archivos/materiales', 'listo para iniciar', 'en proceso', 
  'finalizado', 'perdido'
));

-- 2. Update service_catalog categories check constraint and requirements
ALTER TABLE service_catalog DROP CONSTRAINT IF EXISTS service_catalog_category_check;
ALTER TABLE service_catalog ADD CONSTRAINT service_catalog_category_check CHECK (category IN (
  'editorial', 'publicidad', 'diseño', 'corrección', 'maquetación', 'derechos de autor', 'asesoría', 'otro'
));

ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS requires_manuscript BOOLEAN DEFAULT TRUE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS requires_materials BOOLEAN DEFAULT FALSE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS requires_signed_contract BOOLEAN DEFAULT TRUE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS requires_agreement_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS requires_duration BOOLEAN DEFAULT FALSE;

-- 3. Update service_packs categories check constraint and requirements
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'editorial' CHECK (category IN (
  'editorial', 'publicidad', 'diseño', 'corrección', 'maquetación', 'derechos de autor', 'asesoría', 'otro'
));

ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS requires_manuscript BOOLEAN DEFAULT TRUE;
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS requires_materials BOOLEAN DEFAULT FALSE;
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS requires_signed_contract BOOLEAN DEFAULT TRUE;
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS requires_agreement_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS requires_duration BOOLEAN DEFAULT FALSE;

-- 4. Update clients table for selected services, categories, period types, and requirements
ALTER TABLE clients ADD COLUMN IF NOT EXISTS selected_services JSONB DEFAULT '[]'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_category TEXT DEFAULT 'editorial';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agreement_period_type TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS materials_received BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS materials_received_at DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS partial_payment_authorized BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ready_to_start_reason TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS services_summary TEXT;

-- 5. Update prospects table for selected services, categories, period types, and requirements
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS selected_services JSONB DEFAULT '[]'::jsonb;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS service_category TEXT DEFAULT 'editorial';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agreement_period_type TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS materials_received BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS materials_received_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS partial_payment_authorized BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ready_to_start_reason TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS services_summary TEXT;

-- 6. Update services table for selected services, categories, period types, and requirements
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_category TEXT DEFAULT 'editorial';
ALTER TABLE services ADD COLUMN IF NOT EXISTS agreement_period_type TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS materials_received BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS materials_received_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS partial_payment_authorized BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS ready_to_start_reason TEXT;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
