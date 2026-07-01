-- Migration 19: Add service_name to services table

ALTER TABLE services ADD COLUMN IF NOT EXISTS service_name TEXT;
