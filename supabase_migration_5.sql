-- Migration 5: Add all missing columns in clients, prospects, and services tables to match the frontend payloads

-- =========================================================================
-- 1. CLIENTS TABLE ADDITIONS
-- =========================================================================

-- Ensure new columns exist with proper types in clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS interest_service TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_agreed_amount NUMERIC DEFAULT 0.00;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS includes_vat BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'sin pago';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0.00;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS balance_due NUMERIC DEFAULT 0.00;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS paid_at DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_link_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_link_sent_at DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_sent_at DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_signed_received BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_signed_received_at DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS files_received BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS files_received_at DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ready_to_start BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agreement_notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CLP';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS selected_services JSONB DEFAULT '[]'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_category TEXT DEFAULT 'editorial';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agreement_period_type TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS materials_received BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS materials_received_at DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS partial_payment_authorized BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ready_to_start_reason TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS services_summary TEXT;

-- Drop obsolete timezone column if present
ALTER TABLE clients DROP COLUMN IF EXISTS timezone;

-- Update status CHECK constraint on clients to allow all new workflow states
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check CHECK (status IN (
  'prospecto', 'interesado', 'contrato enviado', 'acuerdo enviado',
  'link de pago enviado', 'esperando pago', 'pago recibido',
  'contrato firmado recibido', 'esperando contrato firmado',
  'esperando manuscrito/archivos', 'esperando archivos/materiales',
  'listo para iniciar', 'en proceso editorial', 'en proceso',
  'finalizado', 'perdido / rechazado', 'perdido'
));


-- =========================================================================
-- 2. PROSPECTS TABLE ADDITIONS
-- =========================================================================

-- Ensure contact fallback fields and commercial fields exist in prospects table
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS total_agreed_amount NUMERIC DEFAULT 0.00;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS includes_vat BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'sin pago';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0.00;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS balance_due NUMERIC DEFAULT 0.00;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS paid_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_link_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_link_sent_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_sent_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_signed_received BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_signed_received_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS files_received BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS files_received_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ready_to_start BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agreement_notes TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CLP';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS selected_services JSONB DEFAULT '[]'::jsonb;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS service_category TEXT DEFAULT 'editorial';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agreement_period_type TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS materials_received BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS materials_received_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS partial_payment_authorized BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ready_to_start_reason TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS services_summary TEXT;

-- Drop obsolete timezone column if present
ALTER TABLE prospects DROP COLUMN IF EXISTS timezone;


-- =========================================================================
-- 3. SERVICES TABLE ADDITIONS
-- =========================================================================

-- Ensure commercial and requirements details fields exist in services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0.00;
ALTER TABLE services ADD COLUMN IF NOT EXISTS balance_due NUMERIC DEFAULT 0.00;
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendiente';
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS paid_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_duration_value INTEGER DEFAULT 6;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_duration_unit TEXT DEFAULT 'meses';
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_notes TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_link_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_link_sent_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_sent_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_signed_received BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_signed_received_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS files_received BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS files_received_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS ready_to_start BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_category TEXT DEFAULT 'editorial';
ALTER TABLE services ADD COLUMN IF NOT EXISTS agreement_period_type TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS materials_received BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS materials_received_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS partial_payment_authorized BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS ready_to_start_reason TEXT;

-- Drop/Recreate check constraint for currency in services to support EUR
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_currency_check;
ALTER TABLE services ADD CONSTRAINT services_currency_check CHECK (currency IN ('CLP', 'USD', 'EUR'));


-- Reload PostgREST schema cache to make columns visible immediately
NOTIFY pgrst, 'reload schema';
