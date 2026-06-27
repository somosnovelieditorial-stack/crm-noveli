-- Migration 4: Fix column mismatches, nullability, and check constraints for production database

-- 1. Update exchange_rates Table columns
-- Rename columns to match frontend expectations:
-- from_currency -> currency_from
-- to_currency -> currency_to
-- rate_date -> date
ALTER TABLE exchange_rates RENAME COLUMN from_currency TO currency_from;
ALTER TABLE exchange_rates RENAME COLUMN to_currency TO currency_to;
ALTER TABLE exchange_rates RENAME COLUMN rate_date TO date;

-- Add source column if not exists
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Manual';


-- 2. Update agenda_events Table columns
-- Make start_date nullable and add date, time, and type columns for manual events:
ALTER TABLE agenda_events ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS type TEXT;


-- 4. Update incomes Table check constraint
-- Update payment_method CHECK to include 'paypal':
ALTER TABLE incomes DROP CONSTRAINT IF EXISTS incomes_payment_method_check;
ALTER TABLE incomes ADD CONSTRAINT incomes_payment_method_check CHECK (payment_method IN ('transferencia', 'tarjeta', 'efectivo', 'paypal', 'otro'));


-- 5. Update clients Table status check constraint
-- Expand status CHECK to support both old and new status values:
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check CHECK (status IN (
  'prospecto', 'interesado', 'contrato enviado', 'acuerdo enviado',
  'link de pago enviado', 'esperando pago', 'pago recibido',
  'contrato firmado recibido', 'esperando contrato firmado',
  'esperando manuscrito/archivos', 'esperando archivos/materiales',
  'listo para iniciar', 'en proceso editorial', 'en proceso',
  'finalizado', 'perdido / rechazado', 'perdido'
));


-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
