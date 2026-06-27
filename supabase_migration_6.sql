-- Migration 6: Update documents table schema to support new columns from the frontend payload and make legacy columns nullable

-- =========================================================================
-- 1. DROP NOT NULL CONSTRAINTS ON LEGACY COLUMNS
-- =========================================================================
ALTER TABLE documents ALTER COLUMN name DROP NOT NULL;
ALTER TABLE documents ALTER COLUMN file_type DROP NOT NULL;

-- =========================================================================
-- 2. ADD NEW FRONTEND-SUPPORTED COLUMNS
-- =========================================================================
ALTER TABLE documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS notes TEXT;

-- =========================================================================
-- 3. DROP OLD CHECK CONSTRAINT ON file_type IF PRESENT
-- =========================================================================
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_file_type_check;

-- =========================================================================
-- 4. ADD NEW CHECK CONSTRAINT ON document_type
-- =========================================================================
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_document_type_check CHECK (document_type IN (
  'contrato', 'factura', 'boleta', 'comprobante de pago', 'manuscrito', 'portada', 'archivo final', 'documento legal', 'imagen', 'otro'
));

-- =========================================================================
-- 5. RECONCILE LEGACY DATA (IF ANY EXISTS)
-- =========================================================================
UPDATE documents SET title = name WHERE title IS NULL AND name IS NOT NULL;
UPDATE documents SET document_type = file_type WHERE document_type IS NULL AND file_type IS NOT NULL;

-- Reload PostgREST schema cache to make columns visible immediately
NOTIFY pgrst, 'reload schema';
