-- 04B LOCKDOWN: only after asset migration verification and explicit legacy reconciliation.
BEGIN;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.security04_asset_reference_inventory() reference
   WHERE reference.url LIKE '%/storage/v1/object/public/documents/%') THEN
  RAISE EXCEPTION '04B blocked: public website references still point to documents. Run and verify the asset migration first.';
 END IF;
 -- Reviewed CMS paths are URI-safe ASCII; unexpected/encoded paths fail closed for review.
 IF EXISTS (SELECT 1 FROM public.security04_asset_reference_inventory() reference
  WHERE reference.url LIKE '%/storage/v1/object/public/brand-assets/%'
   AND NOT EXISTS (SELECT 1 FROM storage.objects object
    WHERE object.bucket_id='brand-assets'
      AND object.name=split_part(reference.url,'/storage/v1/object/public/brand-assets/',2))) THEN
  RAISE EXCEPTION '04B blocked: referenced public asset destination is missing. Verify migrated assets first.';
 END IF;
 IF EXISTS (
  SELECT 1 FROM storage.objects legacy
  WHERE legacy.bucket_id='documents' AND legacy.name LIKE 'default-org/%'
   AND NOT EXISTS (
    SELECT 1 FROM public.documents document
    JOIN public.expenses expense ON expense.id=document.expense_id
    JOIN storage.objects target ON target.bucket_id='documents' AND target.name=document.file_path
    WHERE document.organization_id=expense.organization_id
      AND public.storage04_org(target.name)=expense.organization_id
      AND legacy.name LIKE 'default-org/%/gastos/'||expense.id::text||'/%'
      AND position(legacy.id::text IN target.name)>0
   )
 ) THEN
  RAISE EXCEPTION '04B blocked: default-org object requires a reviewed expense/tenant reconciliation, preserved source and verified target metadata.';
 END IF;
END;
$$;
-- Reassert the validated document and brand policies; no helper or public-table policy changes.
DROP POLICY IF EXISTS "Authenticated users can delete brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
DROP POLICY IF EXISTS security04_documents_select ON storage.objects;
CREATE POLICY security04_documents_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents' AND public.storage04_can_read(name));
DROP POLICY IF EXISTS security04_documents_insert ON storage.objects;
CREATE POLICY security04_documents_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND public.storage04_can_write(bucket_id,name));
DROP POLICY IF EXISTS security04_documents_update ON storage.objects;
CREATE POLICY security04_documents_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND public.storage04_can_write(bucket_id,name)) WITH CHECK (bucket_id = 'documents' AND public.storage04_can_write(bucket_id,name));
DROP POLICY IF EXISTS security04_documents_delete ON storage.objects;
CREATE POLICY security04_documents_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND public.storage04_can_write(bucket_id,name));
DROP POLICY IF EXISTS security04_brand_select ON storage.objects;
CREATE POLICY security04_brand_select ON storage.objects FOR SELECT TO PUBLIC USING (bucket_id = 'brand-assets');
DROP POLICY IF EXISTS security04_brand_insert ON storage.objects;
CREATE POLICY security04_brand_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand-assets' AND public.storage04_can_write(bucket_id,name));
DROP POLICY IF EXISTS security04_brand_update ON storage.objects;
CREATE POLICY security04_brand_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'brand-assets' AND public.storage04_can_write(bucket_id,name)) WITH CHECK (bucket_id = 'brand-assets' AND public.storage04_can_write(bucket_id,name));
DROP POLICY IF EXISTS security04_brand_delete ON storage.objects;
CREATE POLICY security04_brand_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'brand-assets' AND public.storage04_can_write(bucket_id,name));
DROP POLICY IF EXISTS security04_boundary_select ON storage.objects;
CREATE POLICY security04_boundary_select ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (CASE WHEN bucket_id='brand-assets' THEN true WHEN bucket_id='documents' THEN CASE WHEN (SELECT auth.uid()) IS NULL THEN false ELSE public.storage04_can_read(name) END ELSE true END);
DROP POLICY IF EXISTS security04_boundary_insert ON storage.objects;
CREATE POLICY security04_boundary_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (CASE WHEN bucket_id IN ('documents','brand-assets') THEN CASE WHEN (SELECT auth.uid()) IS NULL THEN false ELSE public.storage04_can_write(bucket_id,name) END ELSE true END);
DROP POLICY IF EXISTS security04_boundary_update ON storage.objects;
CREATE POLICY security04_boundary_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING (CASE WHEN bucket_id IN ('documents','brand-assets') THEN CASE WHEN (SELECT auth.uid()) IS NULL THEN false ELSE public.storage04_can_write(bucket_id,name) END ELSE true END) WITH CHECK (CASE WHEN bucket_id IN ('documents','brand-assets') THEN CASE WHEN (SELECT auth.uid()) IS NULL THEN false ELSE public.storage04_can_write(bucket_id,name) END ELSE true END);
DROP POLICY IF EXISTS security04_boundary_delete ON storage.objects;
CREATE POLICY security04_boundary_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (CASE WHEN bucket_id IN ('documents','brand-assets') THEN CASE WHEN (SELECT auth.uid()) IS NULL THEN false ELSE public.storage04_can_write(bucket_id,name) END ELSE true END);
-- Separate anon boundaries avoid granting anon EXECUTE on membership/writer helpers.
DROP POLICY IF EXISTS security04_anon_select ON storage.objects;
CREATE POLICY security04_anon_select ON storage.objects AS RESTRICTIVE FOR SELECT TO anon USING (CASE WHEN bucket_id='brand-assets' THEN true WHEN bucket_id='documents' THEN false ELSE true END);
DROP POLICY IF EXISTS security04_anon_insert ON storage.objects;
CREATE POLICY security04_anon_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO anon WITH CHECK (bucket_id NOT IN ('documents','brand-assets'));
DROP POLICY IF EXISTS security04_anon_update ON storage.objects;
CREATE POLICY security04_anon_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon USING (bucket_id NOT IN ('documents','brand-assets')) WITH CHECK (bucket_id NOT IN ('documents','brand-assets'));
DROP POLICY IF EXISTS security04_anon_delete ON storage.objects;
CREATE POLICY security04_anon_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon USING (bucket_id NOT IN ('documents','brand-assets'));
UPDATE storage.buckets SET public=false WHERE id='documents';
UPDATE storage.buckets SET public=true WHERE id='brand-assets';
COMMIT;
