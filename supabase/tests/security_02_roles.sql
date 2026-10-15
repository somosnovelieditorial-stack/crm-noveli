-- Local only. Run from a copied tests/ directory with sibling migrations/.
-- Fixtures, migration replays and all writes are rolled back.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert02(ok boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'PASS: %', label;
END;
$$;

CREATE TEMP TABLE subjects (id uuid, role text, active boolean);
INSERT INTO subjects VALUES
('92000000-0000-4000-8000-000000000001','admin',true),
('92000000-0000-4000-8000-000000000002','visualizador',true),
('92000000-0000-4000-8000-000000000003','editor',true),
('92000000-0000-4000-8000-000000000004','diseñador',true),
('92000000-0000-4000-8000-000000000005','corrector',true),
('92000000-0000-4000-8000-000000000006','finanzas',true),
('92000000-0000-4000-8000-000000000007','admin',false);
INSERT INTO auth.users (id,email)
SELECT id,'security02-'||id||'@example.invalid' FROM subjects;
INSERT INTO public.organizations (id,name) VALUES
('92000000-0000-4000-8000-000000000100','Security 02 A'),
('92000000-0000-4000-8000-000000000101','Security 02 B');
INSERT INTO public.organization_members (organization_id,user_id,role,active)
SELECT '92000000-0000-4000-8000-000000000100',id,role,active FROM subjects;
-- Same user is writer in A, viewer in B: no arbitrary LIMIT 1 authorization.
INSERT INTO public.organization_members (organization_id,user_id,role,active)
VALUES ('92000000-0000-4000-8000-000000000101',
        '92000000-0000-4000-8000-000000000003','visualizador',true);

-- Exercise actual historical row normalization and a second safe replay.
-- Dropping this CHECK is test setup only, within the rollback transaction.
ALTER TABLE public.organization_members DROP CONSTRAINT organization_members_role_canonical_check;
CREATE TEMP TABLE alias_cases (id uuid, original text, expected text);
INSERT INTO alias_cases VALUES
('92000000-0000-4000-8000-000000000011','administrador','admin'),
('92000000-0000-4000-8000-000000000012','direccion','admin'),
('92000000-0000-4000-8000-000000000013','maquetador','diseñador'),
('92000000-0000-4000-8000-000000000014','asistente','editor'),
('92000000-0000-4000-8000-000000000015','contador','finanzas'),
('92000000-0000-4000-8000-000000000016','solo lectura','visualizador');
INSERT INTO auth.users(id,email) SELECT id,'security02-alias-'||id||'@example.invalid' FROM alias_cases;
INSERT INTO public.organization_members(organization_id,user_id,role,active)
SELECT '92000000-0000-4000-8000-000000000100',id,original,true FROM alias_cases;
\ir ../migrations/20261015023731_harden_security_02_roles.sql
SELECT pg_temp.assert02(NOT EXISTS (
 SELECT 1 FROM alias_cases a JOIN public.organization_members m ON m.user_id=a.id
 WHERE m.role<>a.expected), 'all six aliases normalized');
SELECT pg_temp.assert02(NOT EXISTS (
 SELECT 1 FROM subjects s JOIN public.organization_members m ON m.user_id=s.id
 WHERE m.organization_id='92000000-0000-4000-8000-000000000100' AND m.role<>s.role),
 'canonical roles unchanged');
\ir ../migrations/20261015023731_harden_security_02_roles.sql
SELECT pg_temp.assert02((SELECT count(*)=290 FROM pg_policies WHERE schemaname='public'),
                        'migration replay is safe; 290 policies');
DO $$ BEGIN
 UPDATE public.organization_members SET role='unmapped-role'
 WHERE user_id='92000000-0000-4000-8000-000000000002';
 RAISE EXCEPTION 'FAIL: CHECK accepted unknown role';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: CHECK rejects unknown role'; END $$;

SELECT pg_temp.assert02((SELECT count(*)=46 FROM pg_tables WHERE schemaname='public'), '46 tables');
SELECT pg_temp.assert02((SELECT count(*)=6 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f'), 'six public functions');
SELECT pg_temp.assert02(NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity), 'all RLS enabled');
SELECT pg_temp.assert02((SELECT count(*)=126 FROM pg_policies WHERE schemaname='public'
 AND policyname LIKE 'security02_writer_%' AND permissive='RESTRICTIVE' AND roles=ARRAY['authenticated']::name[]),
 '126 restrictive policies on 42 tables');
SELECT pg_temp.assert02(NOT EXISTS (
 SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public'
 AND c.column_name='organization_id' AND c.table_name<>'website_leads'
 AND (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.table_name
 AND p.policyname LIKE 'security02_writer_%' AND p.permissive='RESTRICTIVE')<>3),
 'every internal organization_id table has INSERT/UPDATE/DELETE guards');
SELECT pg_temp.assert02(NOT has_function_privilege('anon','public.is_org_writer(uuid)','EXECUTE')
 AND has_function_privilege('authenticated','public.is_org_writer(uuid)','EXECUTE'), 'writer ACL');
SELECT pg_temp.assert02(NOT EXISTS (
 SELECT 1 FROM pg_tables WHERE schemaname='public'
 AND (has_table_privilege('authenticated',format('%I.%I',schemaname,tablename),'TRUNCATE')
   OR has_table_privilege('anon',format('%I.%I',schemaname,tablename),'TRUNCATE'))),
 'API roles cannot bypass RLS using TRUNCATE');

-- Seed rows owned by viewer: old ownership rules would allow writes without guards.
INSERT INTO public.clients(id,user_id,organization_id,name) VALUES
('92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000002',
 '92000000-0000-4000-8000-000000000100','Viewer owned'),
('92000000-0000-4000-8000-000000000207','92000000-0000-4000-8000-000000000007',
 '92000000-0000-4000-8000-000000000100','Inactive owned');
INSERT INTO public.website_settings(id,organization_id) VALUES
('92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000100');
INSERT INTO public.website_sections(id,organization_id,section_key) VALUES
('92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000100','security02');
INSERT INTO public.website_services(id,organization_id,title,active,visible_on_website) VALUES
('92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000100','Test',true,true);
INSERT INTO public.website_books(id,organization_id,title,author,active,visible) VALUES
('92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000100','Test','Test',true,true);
INSERT INTO public.website_links(id,organization_id,label,url) VALUES
('92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000100','Test','https://example.invalid');
INSERT INTO public.website_book_categories(id,organization_id,name,slug,active) VALUES
('92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000100','Test','security02',true);
INSERT INTO public.website_book_category_links(id,book_id,category_id) VALUES
('92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000200');
INSERT INTO public.website_footer_gallery(id,organization_id,image_url,active) VALUES
('92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000100','https://example.invalid/test.png',true);
INSERT INTO public.website_footer_settings(id,organization_id,active) VALUES
('92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000100',true);
INSERT INTO public.website_hero_quick_services(id,organization_id,label,active) VALUES
('92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000100','Test',true);
INSERT INTO public.website_hero_settings(id,organization_id,active) VALUES
('92000000-0000-4000-8000-000000000200','92000000-0000-4000-8000-000000000100',true);
INSERT INTO public.website_exchange_rates(id,target_currency,rate,active) VALUES
('92000000-0000-4000-8000-000000000200','S02',1,true);

CREATE TEMP TABLE cases(tab text, payload jsonb);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['clients','website_settings','website_sections','website_services',
 'website_books','website_links','website_book_categories','website_book_category_links'] LOOP
  EXECUTE format('INSERT INTO cases SELECT %L,to_jsonb(r) FROM public.%I r WHERE id=$1',t,t)
   USING '92000000-0000-4000-8000-000000000200'::uuid;
 END LOOP;
END $$;
GRANT SELECT ON subjects,cases TO authenticated;
GRANT SELECT ON cases TO anon;

CREATE FUNCTION pg_temp.check_table02(t text, payload jsonb, allowed boolean)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE affected integer; newid uuid := gen_random_uuid(); data jsonb; visible boolean;
BEGIN
 EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id=$1)',t)
  INTO visible USING (payload->>'id')::uuid;
 IF public.get_user_role()='visualizador' THEN
  PERFORM pg_temp.assert02(visible,'viewer reads '||t);
 END IF;
 data := payload || jsonb_build_object('id',newid);
 IF data ? 'user_id' THEN data:=data||jsonb_build_object('user_id',auth.uid()); END IF;
 IF t='website_sections' THEN data:=data||jsonb_build_object('section_key',newid::text); END IF;
 -- Avoid unique(book_id,category_id): INSERT test uses NULL optional category.
 IF t='website_book_category_links' THEN data:=data||jsonb_build_object('category_id',NULL); END IF;
 BEGIN
  EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I,$1)).*',t,t) USING data;
  PERFORM pg_temp.assert02(allowed,'INSERT permitted only to writer: '||t);
 EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.assert02(NOT allowed,'INSERT blocked: '||t);
 END;
 EXECUTE format('UPDATE public.%I SET id=id WHERE id=$1',t) USING (payload->>'id')::uuid;
 GET DIAGNOSTICS affected=ROW_COUNT;
 PERFORM pg_temp.assert02(affected=CASE WHEN allowed THEN 1 ELSE 0 END,'UPDATE '||t);
 IF allowed THEN
  EXECUTE format('DELETE FROM public.%I WHERE id=$1',t) USING newid;
 ELSE
  EXECUTE format('DELETE FROM public.%I WHERE id=$1',t) USING (payload->>'id')::uuid;
 END IF;
 GET DIAGNOSTICS affected=ROW_COUNT;
 PERFORM pg_temp.assert02(affected=CASE WHEN allowed THEN 1 ELSE 0 END,'DELETE '||t);
END;
$$;

DO $$ DECLARE subject record; c record; allowed boolean; affected integer; BEGIN
 FOR subject IN SELECT * FROM subjects ORDER BY id LOOP
  PERFORM set_config('request.jwt.claim.sub',subject.id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',subject.id,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  allowed:=subject.active AND subject.role<>'visualizador';
  PERFORM pg_temp.assert02(public.is_org_writer('92000000-0000-4000-8000-000000000100')=allowed,
    'writer helper: '||subject.role||' active='||subject.active);
  PERFORM pg_temp.assert02(NOT public.is_org_writer(NULL),'NULL org denied');
  PERFORM pg_temp.assert02(NOT public.is_org_writer('92000000-0000-4000-8000-000000000101'),
    'other/viewer organization denied');
  FOR c IN SELECT * FROM cases LOOP
   PERFORM pg_temp.check_table02(c.tab,c.payload,allowed);
  END LOOP;
  IF NOT subject.active THEN
   PERFORM pg_temp.assert02(NOT public.is_org_member('92000000-0000-4000-8000-000000000100')
    AND NOT public.is_org_admin('92000000-0000-4000-8000-000000000100'), 'inactive membership helpers false');
   UPDATE public.clients SET name='must not change' WHERE id='92000000-0000-4000-8000-000000000207';
   GET DIAGNOSTICS affected=ROW_COUNT;
   PERFORM pg_temp.assert02(affected=0,'inactive cannot update own legacy-owned client');
  END IF;
  IF subject.role='visualizador' THEN
   UPDATE public.organization_members SET role='admin' WHERE user_id=auth.uid();
   GET DIAGNOSTICS affected=ROW_COUNT;
   PERFORM pg_temp.assert02(affected=0,'viewer cannot promote own membership');
  END IF;
  EXECUTE 'RESET ROLE';
 END LOOP;
END $$;

-- Defense in depth: even if a future privileged process bypassed the CHECK,
-- an unknown stored role still must fail closed in the helper and all guards.
ALTER TABLE public.organization_members DROP CONSTRAINT organization_members_role_canonical_check;
UPDATE public.organization_members SET role='unknown-test-role'
WHERE user_id='92000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"92000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT pg_temp.assert02(NOT public.is_org_writer('92000000-0000-4000-8000-000000000100'),
 'unknown stored role cannot write even without CHECK');
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT * FROM cases LOOP
  PERFORM pg_temp.check_table02(c.tab,c.payload,false);
 END LOOP;
END $$;
RESET ROLE;
UPDATE public.organization_members SET role='visualizador'
WHERE user_id='92000000-0000-4000-8000-000000000002';
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_role_canonical_check
CHECK (role IN ('admin','editor','diseñador','corrector','finanzas','visualizador'));

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
SELECT pg_temp.assert02((SELECT count(*)=0 FROM public.clients), 'anon no internal client access');
SELECT pg_temp.assert02(EXISTS (SELECT 1 FROM public.website_books WHERE id='92000000-0000-4000-8000-000000000200')
 AND EXISTS (SELECT 1 FROM public.website_services WHERE id='92000000-0000-4000-8000-000000000200')
 AND EXISTS (SELECT 1 FROM public.website_book_categories WHERE id='92000000-0000-4000-8000-000000000200'),
 'anon public books/services/categories preserved');
DO $$ DECLARE t text; visible boolean; c record; BEGIN
 FOREACH t IN ARRAY ARRAY['website_books','website_services','website_book_categories',
 'website_book_category_links','website_footer_gallery','website_footer_settings',
 'website_hero_quick_services','website_hero_settings','website_exchange_rates'] LOOP
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id=$1)',t)
   INTO visible USING '92000000-0000-4000-8000-000000000200'::uuid;
  PERFORM pg_temp.assert02(visible,'anon public SELECT preserved: '||t);
 END LOOP;
 FOR c IN SELECT * FROM cases LOOP
  PERFORM pg_temp.check_table02(c.tab,c.payload,false);
 END LOOP;
END $$;
DO $$ BEGIN
 INSERT INTO public.website_books(organization_id,title,author)
 VALUES ('92000000-0000-4000-8000-000000000100','Denied','Denied');
 RAISE EXCEPTION 'FAIL: anon website write';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: anon cannot write website books'; END $$;
INSERT INTO public.website_leads(organization_id,name,email)
VALUES ('92000000-0000-4000-8000-000000000100','Public test','security02-form@example.invalid');
RESET ROLE;
SELECT pg_temp.assert02(EXISTS (SELECT 1 FROM public.website_leads
 WHERE email='security02-form@example.invalid'), 'public form insert preserved');
SELECT pg_temp.assert02(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
 AND tablename='website_leads' AND policyname LIKE 'security02_writer_%'), 'public leads deliberately excluded');
ROLLBACK;
\echo SECURITY_02_ROLES_ALL_CHECKS_PASSED_AND_ROLLED_BACK
