-- 04A PREPARE: backward-compatible public-byte serving during asset transition.
-- documents remains PUBLIC intentionally. Its bytes are not confidential until 04B.
BEGIN;
-- Never reopen documents if a later lockdown has already made it private.
INSERT INTO storage.buckets(id,name,public) VALUES ('documents','documents',true) ON CONFLICT(id) DO NOTHING;
INSERT INTO storage.buckets(id,name,public) VALUES ('brand-assets','brand-assets',true) ON CONFLICT(id) DO UPDATE SET public=true;

-- A path prefix is not a claim: actual membership is verified independently.
-- Invalid/legacy prefixes are quarantined; never infer a default organization.
CREATE OR REPLACE FUNCTION public.storage04_org(object_name text) RETURNS uuid
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT CASE WHEN object_name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[^/].*$'
 AND object_name !~ '(^|/)\.\.?(/|$)' AND object_name NOT LIKE '%//%'
 THEN split_part(object_name,'/',1)::uuid ELSE NULL END;
$$;
-- Canonical active memberships only; an invalid/unknown role cannot read private bytes.
CREATE OR REPLACE FUNCTION public.storage04_can_read(object_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.organization_members membership
  WHERE membership.organization_id=public.storage04_org(object_name)
    AND membership.user_id=(SELECT auth.uid()) AND membership.active=true
    AND membership.role IN ('admin','editor','diseñador','corrector','finanzas','visualizador'));
$$;
CREATE OR REPLACE FUNCTION public.storage04_can_write(bucket text,object_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT CASE WHEN bucket='documents' THEN public.is_org_writer(public.storage04_org(object_name))
 WHEN bucket='brand-assets' THEN public.is_org_admin(public.storage04_org(object_name)) OR (
   split_part(object_name,'/',2)='website'
   AND split_part(object_name,'/',3) IN ('hero','identity','covers','services','footer')
   AND public.is_org_writer(public.storage04_org(object_name)))
 ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.storage04_org(text), public.storage04_can_read(text), public.storage04_can_write(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.storage04_org(text), public.storage04_can_read(text), public.storage04_can_write(text,text) TO authenticated,service_role,postgres;
-- DELETE writer preserves approved attachment removal in Documents/Clients/Services.
-- CMS public images are writable by writers; brand identity roots are admin-only.

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
-- Metadata-only inventory for the controlled asset migration tool. No document body access.
-- Invoker privileges: service_role already has the required reads; no RLS bypass is added.
CREATE OR REPLACE FUNCTION public.security04_asset_reference_inventory()
RETURNS TABLE(table_name text,row_id text,organization_id text,column_name text,url text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE relation_name text;
BEGIN
 FOR relation_name IN
  SELECT c.relname::text FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'
 LOOP
  RETURN QUERY EXECUTE format($query$
   WITH rows AS (SELECT to_jsonb(r) AS payload FROM public.%I r)
   SELECT %L::text,payload->>'id',payload->>'organization_id',entry.key,
          split_part(found.val #>> '{}','?',1)
   FROM rows CROSS JOIN LATERAL jsonb_each(payload) entry
   CROSS JOIN LATERAL jsonb_path_query(entry.value,'$.** ? (@.type() == "string")') found(val)
   WHERE (found.val #>> '{}') LIKE '%%/storage/v1/object/public/documents/%%/website/%%'
      OR (found.val #>> '{}') LIKE '%%/storage/v1/object/public/brand-assets/%%/website/%%'
  $query$,relation_name,relation_name);
 END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.security04_asset_reference_inventory() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.security04_asset_reference_inventory() TO service_role,postgres;

COMMIT;
