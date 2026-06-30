-- Migration 18: Add status, notes, and stage_id to agenda_events table

-- Add columns if they do not exist
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en proceso', 'completada', 'vencida'));
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES service_stages(id) ON DELETE CASCADE;
