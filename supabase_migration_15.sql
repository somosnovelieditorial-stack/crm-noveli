-- Migration 15: Align prospects table with expected fields and frontend schema

-- Add core missing columns if not present
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'Instagram';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'Nacional';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'CLP';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS probability TEXT DEFAULT 'media';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS followup_date DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add requirements & services columns
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS selected_services JSONB DEFAULT '[]'::jsonb;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS services_summary TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS total_agreed_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agreed_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CLP';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS includes_vat BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS includes_iva BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'sin pago';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS paid_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_link_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_link_sent_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_sent_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_signed_received BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_signed_received_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS files_received BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS files_received_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS materials_received BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS materials_received_at DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS partial_payment_authorized BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ready_to_start BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ready_to_start_reason TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agreement_notes TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agreement_period_type TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agreement_start_date DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agreement_duration_value TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agreement_duration_unit TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agreement_end_date DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS service_category TEXT DEFAULT 'editorial';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'prospecto';

-- Drop constraints if exist and recreate them to match types/defaults
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS chk_prospects_status;
ALTER TABLE prospects ADD CONSTRAINT chk_prospects_status CHECK (status IN (
  'prospecto', 'interesado', 'contrato enviado', 'acuerdo enviado',
  'link de pago enviado', 'esperando pago', 'pago recibido',
  'contrato firmado recibido', 'esperando contrato firmado',
  'esperando manuscrito/archivos', 'esperando archivos/materiales',
  'listo para iniciar', 'en proceso editorial', 'en proceso',
  'finalizado', 'perdido / rechazado', 'perdido'
));

ALTER TABLE prospects DROP CONSTRAINT IF EXISTS chk_prospects_payment_status;
ALTER TABLE prospects ADD CONSTRAINT chk_prospects_payment_status CHECK (payment_status IN (
  'sin pago', 'pendiente', 'pago parcial', 'pagado'
));

ALTER TABLE prospects DROP CONSTRAINT IF EXISTS chk_prospects_currency;
ALTER TABLE prospects ADD CONSTRAINT chk_prospects_currency CHECK (currency IN ('CLP', 'USD', 'EUR'));

ALTER TABLE prospects DROP CONSTRAINT IF EXISTS chk_prospects_service_category;
ALTER TABLE prospects ADD CONSTRAINT chk_prospects_service_category CHECK (service_category IN (
  'editorial', 'publicidad', 'diseño', 'asesoría', 'otro'
));

ALTER TABLE prospects DROP CONSTRAINT IF EXISTS chk_prospects_duration_unit;
ALTER TABLE prospects ADD CONSTRAINT chk_prospects_duration_unit CHECK (agreement_duration_unit IN (
  'meses', 'semanas', 'días', 'años'
));

NOTIFY pgrst, 'reload schema';
