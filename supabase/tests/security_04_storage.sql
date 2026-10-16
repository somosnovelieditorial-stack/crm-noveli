-- LOCAL ONLY. Metadata fixtures only; all SQL writes roll back.
\set ON_ERROR_STOP on
BEGIN;
-- Native Storage test setting; never drop/disable its delete-protection trigger.
SELECT set_config('storage.allow_delete_query','true',true);
CREATE FUNCTION pg_temp.assert04(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END; $$;
INSERT INTO public.organizations(id,name) VALUES ('96000000-0000-4000-8000-000000000100','Storage A'),('96000000-0000-4000-8000-000000000101','Storage B');
CREATE TEMP TABLE actors(id uuid,role text,active boolean);
INSERT INTO actors VALUES ('96000000-0000-4000-8000-000000000001','admin',true),('96000000-0000-4000-8000-000000000002','editor',true),('96000000-0000-4000-8000-000000000003','diseñador',true),('96000000-0000-4000-8000-000000000004','corrector',true),('96000000-0000-4000-8000-000000000005','finanzas',true),('96000000-0000-4000-8000-000000000006','visualizador',true),('96000000-0000-4000-8000-000000000007','unknown',true),('96000000-0000-4000-8000-000000000008','admin',false);
INSERT INTO auth.users(id,email) SELECT id,'storage04-'||id||'@example.invalid' FROM actors;
ALTER TABLE public.organization_members DROP CONSTRAINT organization_members_role_canonical_check;
INSERT INTO public.organization_members(organization_id,user_id,role,active) SELECT '96000000-0000-4000-8000-000000000100',id,role,active FROM actors;
CREATE TEMP TABLE objects04(bucket text,path text,kind text);
INSERT INTO objects04 VALUES ('documents','96000000-0000-4000-8000-000000000100/general/synthetic.txt','private'),('documents','96000000-0000-4000-8000-000000000101/general/synthetic.txt','foreign'),('brand-assets','96000000-0000-4000-8000-000000000100/logo_synthetic.png','root'),('brand-assets','96000000-0000-4000-8000-000000000100/website/hero/synthetic.png','cms'),('brand-assets','96000000-0000-4000-8000-000000000101/logo_synthetic.png','foreignbrand'),('documents','default-org/general/synthetic.txt','legacy');
INSERT INTO storage.objects(bucket_id,name) SELECT bucket,path FROM objects04;
GRANT SELECT ON objects04 TO authenticated,anon;
CREATE FUNCTION pg_temp.check04(bucket text,path text,can_read boolean,can_write boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n int; inserted boolean:=false;
BEGIN
 SELECT count(*) INTO n FROM storage.objects WHERE bucket_id=bucket AND name=path;
 PERFORM pg_temp.assert04(n=CASE WHEN can_read THEN 1 ELSE 0 END,'SELECT '||bucket||'/'||path);
 BEGIN INSERT INTO storage.objects(bucket_id,name,metadata) VALUES (bucket,path||'.'||gen_random_uuid(),jsonb_build_object('organization_id','96000000-0000-4000-8000-000000000100'));
 inserted:=true; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM pg_temp.assert04(inserted=can_write,'INSERT ignores forged tenant metadata '||path);
 UPDATE storage.objects SET name=name WHERE bucket_id=bucket AND name=path;
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM pg_temp.assert04(n=CASE WHEN can_write THEN 1 ELSE 0 END,'UPDATE '||path);
 BEGIN DELETE FROM storage.objects WHERE bucket_id=bucket AND name=path;
 GET DIAGNOSTICS n=ROW_COUNT; RAISE SQLSTATE 'PT001'; EXCEPTION WHEN SQLSTATE 'PT001' THEN NULL; END;
 PERFORM pg_temp.assert04(n=CASE WHEN can_write THEN 1 ELSE 0 END,'DELETE '||path);
END; $$;
-- Deliberately reintroduce an unsafe OR; restrictive boundaries must still enforce tenant/role.
CREATE POLICY security04_test_unsafe_or ON storage.objects FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"96000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT pg_temp.check04(bucket,path,CASE WHEN bucket='brand-assets' THEN true WHEN kind='private' THEN true ELSE false END,CASE WHEN kind IN ('private','cms') THEN true WHEN kind='root' THEN true ELSE false END) FROM objects04;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"96000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT pg_temp.check04(bucket,path,CASE WHEN bucket='brand-assets' THEN true WHEN kind='private' THEN true ELSE false END,CASE WHEN kind IN ('private','cms') THEN true WHEN kind='root' THEN false ELSE false END) FROM objects04;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"96000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT pg_temp.check04(bucket,path,CASE WHEN bucket='brand-assets' THEN true WHEN kind='private' THEN true ELSE false END,CASE WHEN kind IN ('private','cms') THEN true WHEN kind='root' THEN false ELSE false END) FROM objects04;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000004',true);
SELECT set_config('request.jwt.claims','{"sub":"96000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
SELECT pg_temp.check04(bucket,path,CASE WHEN bucket='brand-assets' THEN true WHEN kind='private' THEN true ELSE false END,CASE WHEN kind IN ('private','cms') THEN true WHEN kind='root' THEN false ELSE false END) FROM objects04;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000005',true);
SELECT set_config('request.jwt.claims','{"sub":"96000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
SELECT pg_temp.check04(bucket,path,CASE WHEN bucket='brand-assets' THEN true WHEN kind='private' THEN true ELSE false END,CASE WHEN kind IN ('private','cms') THEN true WHEN kind='root' THEN false ELSE false END) FROM objects04;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000006',true);
SELECT set_config('request.jwt.claims','{"sub":"96000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
SELECT pg_temp.check04(bucket,path,CASE WHEN bucket='brand-assets' THEN true WHEN kind='private' THEN true ELSE false END,CASE WHEN kind IN ('private','cms') THEN false WHEN kind='root' THEN false ELSE false END) FROM objects04;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000007',true);
SELECT set_config('request.jwt.claims','{"sub":"96000000-0000-4000-8000-000000000007","role":"authenticated"}',true);
SELECT pg_temp.check04(bucket,path,CASE WHEN bucket='brand-assets' THEN true WHEN kind='private' THEN false ELSE false END,CASE WHEN kind IN ('private','cms') THEN false WHEN kind='root' THEN false ELSE false END) FROM objects04;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000008',true);
SELECT set_config('request.jwt.claims','{"sub":"96000000-0000-4000-8000-000000000008","role":"authenticated"}',true);
SELECT pg_temp.check04(bucket,path,CASE WHEN bucket='brand-assets' THEN true WHEN kind='private' THEN false ELSE false END,CASE WHEN kind IN ('private','cms') THEN false WHEN kind='root' THEN false ELSE false END) FROM objects04;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT pg_temp.check04(bucket,path,bucket='brand-assets',false) FROM objects04;
RESET ROLE;
DROP POLICY security04_test_unsafe_or ON storage.objects;
INSERT INTO public.organization_members(organization_id,user_id,role,active) VALUES ('96000000-0000-4000-8000-000000000101','96000000-0000-4000-8000-000000000002','visualizador',true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN UPDATE storage.objects SET name='96000000-0000-4000-8000-000000000101/general/moved.txt'
 WHERE bucket_id='documents' AND name='96000000-0000-4000-8000-000000000100/general/synthetic.txt';
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 PERFORM pg_temp.assert04(blocked,'UPDATE WITH CHECK rejects moving own object to unauthorized tenant');
END $$;
SELECT pg_temp.assert04(public.storage04_can_read('96000000-0000-4000-8000-000000000101/documents/test.txt') AND NOT public.storage04_can_write('documents','96000000-0000-4000-8000-000000000101/documents/test.txt'),'multi-org requested tenant viewer is read only');
SELECT pg_temp.assert04(public.storage04_org('default-org/file') IS NULL AND public.storage04_org('bad/file') IS NULL AND public.storage04_org('96000000-0000-4000-8000-000000000100/../secret') IS NULL,'invalid and traversal prefixes fail closed');
RESET ROLE;
SELECT pg_temp.assert04((SELECT public=false FROM storage.buckets WHERE id='documents') AND (SELECT public=true FROM storage.buckets WHERE id='brand-assets'),'private/public bucket flags');
SELECT pg_temp.assert04((SELECT count(*)=16 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'),'16 Storage policies');
SELECT pg_temp.assert04((SELECT count(*)=8 FROM pg_policies WHERE schemaname='storage' AND permissive='RESTRICTIVE'),'eight Storage restrictive boundaries');
SELECT pg_temp.assert04((SELECT count(*)=126 FROM pg_policies WHERE schemaname='public' AND permissive='RESTRICTIVE'),'126 prior guards retained');
SELECT pg_temp.assert04((SELECT count(*)=13 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'),'13 public functions including metadata inventory');
SELECT pg_temp.assert04(NOT has_function_privilege('anon','public.storage04_can_write(text,text)','EXECUTE'),'anon cannot execute storage writer helper');
ROLLBACK;
\echo SECURITY_04_ALL_CHECKS_PASSED_AND_ROLLED_BACK
