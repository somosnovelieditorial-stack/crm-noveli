-- Migration 17: Align services, service_stages, and service_checklists with advanced stages & checklists tracking

-- Alter services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS stage_progress INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS checklist_progress INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_category TEXT DEFAULT 'editorial';

-- Alter service_stages table
ALTER TABLE service_stages ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE service_stages ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE service_stages ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE service_stages ADD COLUMN IF NOT EXISTS started_at DATE;
ALTER TABLE service_stages ADD COLUMN IF NOT EXISTS completed_at DATE;
ALTER TABLE service_stages ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Alter service_checklists table
ALTER TABLE service_checklists ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE;
ALTER TABLE service_checklists ADD COLUMN IF NOT EXISTS completed_at DATE;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
