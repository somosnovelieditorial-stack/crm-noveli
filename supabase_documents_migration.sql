-- Create documents bucket if not exists in storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Add new required columns to the documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS notes TEXT;

-- Populate new fields from older names/types if they exist
UPDATE documents SET title = name WHERE title IS NULL AND name IS NOT NULL;
UPDATE documents SET document_type = file_type WHERE document_type IS NULL AND file_type IS NOT NULL;
UPDATE documents SET file_name = substring(file_path from '[^/]+$') WHERE file_name IS NULL AND file_path IS NOT NULL;

-- Remove older file_type constraint to allow custom document types
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_file_type_check;

-- Add check constraint for document_type
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_document_type_check CHECK (document_type IN (
  'contrato', 'factura', 'boleta', 'comprobante de pago', 'manuscrito', 'portada', 'archivo final', 'documento legal', 'imagen', 'otro'
));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
