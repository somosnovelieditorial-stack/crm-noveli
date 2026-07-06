-- Migration 36: Add columns for dynamic tax rates, payment schedules, and proposal metadata to quotations.
-- Also add fields for default inclusions, exclusions, and payment/start terms to service_catalog and service_packs.

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS iva_mode TEXT DEFAULT 'IVA incluido',
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 19.00,
ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS payment_plan_type TEXT DEFAULT '50_inicio_50_termino',
ADD COLUMN IF NOT EXISTS upfront_percentage NUMERIC(5,2) DEFAULT 50.00,
ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS included_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS excluded_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS start_condition_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS proposal_format TEXT DEFAULT 'Formal completo',
ADD COLUMN IF NOT EXISTS show_signatures BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS has_alternatives BOOLEAN DEFAULT FALSE;

ALTER TABLE service_catalog
ADD COLUMN IF NOT EXISTS includes_text TEXT,
ADD COLUMN IF NOT EXISTS excludes_text TEXT,
ADD COLUMN IF NOT EXISTS default_work_timeline TEXT,
ADD COLUMN IF NOT EXISTS default_payment_terms TEXT,
ADD COLUMN IF NOT EXISTS default_start_conditions TEXT;

ALTER TABLE service_packs
ADD COLUMN IF NOT EXISTS includes_text TEXT,
ADD COLUMN IF NOT EXISTS excludes_text TEXT,
ADD COLUMN IF NOT EXISTS default_work_timeline TEXT,
ADD COLUMN IF NOT EXISTS default_payment_terms TEXT,
ADD COLUMN IF NOT EXISTS default_start_conditions TEXT;
