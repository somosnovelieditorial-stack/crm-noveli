-- Migration 16: Align services table with expected fields and constraints

-- Add missing columns if they do not exist
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS total_agreed_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE services ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE services ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendiente';
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS paid_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_link_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_link_sent_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_sent_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_signed_received BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_signed_received_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS files_received BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS files_received_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS materials_received BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS materials_received_at DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS partial_payment_authorized BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS ready_to_start BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS ready_to_start_reason TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_notes TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS agreement_notes TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_duration_value INTEGER DEFAULT 6;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_duration_unit TEXT DEFAULT 'meses';
ALTER TABLE services ADD COLUMN IF NOT EXISTS agreement_period_type TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_category TEXT DEFAULT 'editorial';
ALTER TABLE services ADD COLUMN IF NOT EXISTS selected_services JSONB DEFAULT '[]'::jsonb;
ALTER TABLE services ADD COLUMN IF NOT EXISTS services_summary TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;

-- Drop constraints if exist and recreate them to be secure
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_status_check;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_status_check1;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_status_check2;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_status_check3;
ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_services_status;
ALTER TABLE services ADD CONSTRAINT chk_services_status CHECK (status IN (
  'recibido', 'contrato pendiente', 'pago pendiente', 'en revisión',
  'en corrección', 'en diseño', 'en maquetación', 'entregado', 'cerrado'
));

ALTER TABLE services DROP CONSTRAINT IF EXISTS services_currency_check;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_currency_check1;
ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_services_currency;
ALTER TABLE services ADD CONSTRAINT chk_services_currency CHECK (currency IN ('CLP', 'USD', 'EUR'));

ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_services_payment_status;
ALTER TABLE services ADD CONSTRAINT chk_services_payment_status CHECK (payment_status IN (
  'sin pago', 'pendiente', 'pago parcial', 'pagado'
));

ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_services_service_category;
ALTER TABLE services ADD CONSTRAINT chk_services_service_category CHECK (service_category IN (
  'editorial', 'publicidad', 'diseño', 'asesoría', 'otro'
));

ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_services_contract_duration_unit;
ALTER TABLE services ADD CONSTRAINT chk_services_contract_duration_unit CHECK (contract_duration_unit IN (
  'meses', 'semanas', 'días', 'años'
));

NOTIFY pgrst, 'reload schema';
