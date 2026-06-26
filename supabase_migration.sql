-- Migration script to update clients, prospects, and services tables
-- with commercial, billing, contract tracking, and manuscrit checklist columns.
-- Run this script in the Supabase SQL Editor.

-- 1. Remove timezone column (optional, marked unused or dropped)
ALTER TABLE clients DROP COLUMN IF EXISTS timezone;
ALTER TABLE prospects DROP COLUMN IF EXISTS timezone;

-- 2. Update clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS interest_service TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_agreed_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS includes_vat BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'sin pago';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12,2) DEFAULT 0.00;
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

-- 3. Update prospects table
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS total_agreed_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS includes_vat BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'sin pago';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12,2) DEFAULT 0.00;
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

-- 4. Update services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_duration_value INTEGER DEFAULT 6;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contract_duration_unit TEXT DEFAULT 'meses';
ALTER TABLE services ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE services ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendiente';
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS paid_at DATE;
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

-- 5. Update Check Constraints
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check CHECK (status IN (
  'prospecto', 'interesado', 'contrato enviado', 'link de pago enviado', 
  'esperando pago', 'pago recibido', 'contrato firmado recibido', 
  'esperando manuscrito/archivos', 'listo para iniciar', 'en proceso editorial', 
  'finalizado', 'perdido / rechazado'
));

-- Ensure currency fields accept CLP, USD, EUR
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_currency_check;
ALTER TABLE services ADD CONSTRAINT services_currency_check CHECK (currency IN ('CLP', 'USD', 'EUR'));

ALTER TABLE incomes DROP CONSTRAINT IF EXISTS incomes_currency_check;
ALTER TABLE incomes ADD CONSTRAINT incomes_currency_check CHECK (currency IN ('CLP', 'USD', 'EUR'));

NOTIFY pgrst, 'reload schema';
