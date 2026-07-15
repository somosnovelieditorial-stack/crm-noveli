-- Migration 39: Add distribution_status to incomes table

ALTER TABLE incomes 
ADD COLUMN IF NOT EXISTS distribution_status TEXT CHECK (distribution_status IN ('sin_configurar', 'pendiente', 'parcial', 'completa')) DEFAULT 'sin_configurar';
