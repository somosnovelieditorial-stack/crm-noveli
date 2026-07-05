-- Migration 27: Catálogo y Cotizaciones
-- Actualizar CHECK constraint de categorías en la tabla service_catalog
ALTER TABLE service_catalog DROP CONSTRAINT IF EXISTS service_catalog_category_check;
ALTER TABLE service_catalog ADD CONSTRAINT service_catalog_category_check CHECK (category IN ('editorial', 'diseño', 'legal', 'asesoría', 'publicidad', 'impresión', 'otro', 'corrección', 'maquetación', 'difusión', 'derechos de autor', 'publicación'));

-- Agregar columnas en la tabla service_packs
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS category TEXT;

-- Agregar columnas en la tabla quotations
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS pages INTEGER DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS extension_adjustment NUMERIC(5,2) DEFAULT 0.00;
