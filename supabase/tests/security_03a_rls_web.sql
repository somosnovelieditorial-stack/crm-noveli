-- LOCAL ONLY. Synthetic fixtures and all writes are rolled back.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert03(ok boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
 RAISE NOTICE 'PASS: %',label;
END;
$$;
CREATE TEMP TABLE actors(id uuid,role text,active boolean);
INSERT INTO actors VALUES
('93000000-0000-4000-8000-000000000001','admin',true),
('93000000-0000-4000-8000-000000000002','editor',true),
('93000000-0000-4000-8000-000000000003','visualizador',true),
('93000000-0000-4000-8000-000000000004','admin',false);
INSERT INTO auth.users(id,email) SELECT id,'security03a-'||id||'@example.invalid' FROM actors;
INSERT INTO auth.users(id,email) VALUES
('93000000-0000-4000-8000-000000000005','security03a-added@example.invalid');
INSERT INTO public.organizations(id,name) VALUES
('93000000-0000-4000-8000-000000000100','Web test A'),
('93000000-0000-4000-8000-000000000101','Web test B'),
('11111111-1111-1111-1111-111111111111','Noveli public intake test');
INSERT INTO public.organization_members(organization_id,user_id,role,active)
SELECT '93000000-0000-4000-8000-000000000100',id,role,active FROM actors;
INSERT INTO public.organization_members(organization_id,user_id,role,active) VALUES
('93000000-0000-4000-8000-000000000101','93000000-0000-4000-8000-000000000002','visualizador',true);
INSERT INTO public.user_profiles(id,full_name) SELECT id,role FROM actors;

-- Private base rows test internal SELECT separately from publication.
INSERT INTO public.website_settings(id,organization_id,active) VALUES
('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000100',false);
INSERT INTO public.website_sections(id,organization_id,section_key,active) VALUES
('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000100','security03a',false);
INSERT INTO public.website_services(id,organization_id,title,active,visible_on_website) VALUES
('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000100','Private',false,false),
('93000000-0000-4000-8000-000000000201','93000000-0000-4000-8000-000000000100','Public',true,true);
INSERT INTO public.website_books(id,organization_id,title,author,active,visible) VALUES
('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000100','Private','Test',false,false),
('93000000-0000-4000-8000-000000000201','93000000-0000-4000-8000-000000000100','Public','Test',true,true),
('93000000-0000-4000-8000-000000000202','93000000-0000-4000-8000-000000000101','Other tenant private','Test',false,false);
INSERT INTO public.website_links(id,organization_id,label,url,active) VALUES
('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000100','Private','https://example.invalid',false);
INSERT INTO public.website_book_categories(id,organization_id,name,slug,active) VALUES
('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000100','Private','security03a-private',false),
('93000000-0000-4000-8000-000000000201','93000000-0000-4000-8000-000000000100','Public','security03a-public',true),
('93000000-0000-4000-8000-000000000202','93000000-0000-4000-8000-000000000101','Foreign','security03a-foreign',true);
INSERT INTO public.website_book_category_links(id,book_id,category_id) VALUES
('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000200'),
('93000000-0000-4000-8000-000000000201','93000000-0000-4000-8000-000000000201','93000000-0000-4000-8000-000000000201'),
('93000000-0000-4000-8000-000000000202','93000000-0000-4000-8000-000000000201','93000000-0000-4000-8000-000000000202');
INSERT INTO public.website_footer_gallery(id,organization_id,image_url,active) VALUES
('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000100','https://example.invalid/private.png',false),
('93000000-0000-4000-8000-000000000201','93000000-0000-4000-8000-000000000100','https://example.invalid/public.png',true);
INSERT INTO public.website_footer_settings(id,organization_id,active) VALUES
('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000100',false),
('93000000-0000-4000-8000-000000000201','93000000-0000-4000-8000-000000000100',true);
INSERT INTO public.website_hero_quick_services(id,organization_id,label,active) VALUES
('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000100','Private',false),
('93000000-0000-4000-8000-000000000201','93000000-0000-4000-8000-000000000100','Public',true);
INSERT INTO public.website_hero_settings(id,organization_id,active) VALUES
('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000100',false),
('93000000-0000-4000-8000-000000000201','93000000-0000-4000-8000-000000000100',true);
INSERT INTO public.website_exchange_rates(id,target_currency,rate,active) VALUES
('93000000-0000-4000-8000-000000000200','S03PRIVATE',1,false),
('93000000-0000-4000-8000-000000000201','S03PUBLIC',1,true);
INSERT INTO public.website_leads(id,organization_id,name,notes) VALUES
('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000100','Internal','Private notes');

CREATE TEMP TABLE cms_cases(tab text,payload jsonb,admin_delete boolean);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['website_settings','website_sections','website_services','website_books',
 'website_links','website_book_categories','website_book_category_links','website_hero_settings',
 'website_hero_quick_services','website_footer_settings','website_footer_gallery'] LOOP
  EXECUTE format('INSERT INTO cms_cases SELECT %L,to_jsonb(r),%L::boolean FROM public.%I r WHERE id=$1',
   t,t=ANY(ARRAY['website_settings','website_sections','website_services','website_books','website_links']),t)
   USING '93000000-0000-4000-8000-000000000200'::uuid;
 END LOOP;
END $$;
GRANT SELECT ON actors,cms_cases TO authenticated,anon;

CREATE FUNCTION pg_temp.check_cms03(t text,payload jsonb,writer boolean,can_delete boolean,can_read boolean)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE new_id uuid:=gen_random_uuid(); data jsonb; affected integer; visible boolean;
BEGIN
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1)',t)
  INTO visible USING (payload->>'id')::uuid;
 PERFORM pg_temp.assert03(visible=can_read,'private CMS SELECT '||t);
 data:=payload||jsonb_build_object('id',new_id);
 IF data ? 'user_id' THEN data:=data||jsonb_build_object('user_id',auth.uid()); END IF;
 IF t='website_sections' THEN data:=data||jsonb_build_object('section_key',new_id::text); END IF;
 IF t='website_book_category_links' THEN data:=data||jsonb_build_object('category_id',NULL); END IF;
 BEGIN
  EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I,$1)).*',t,t) USING data;
  PERFORM pg_temp.assert03(writer,'CMS INSERT writer only '||t);
 EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.assert03(NOT writer,'CMS INSERT denied '||t);
 END;
 EXECUTE format('UPDATE public.%I SET id=id WHERE id=$1',t) USING (payload->>'id')::uuid;
 GET DIAGNOSTICS affected=ROW_COUNT;
 PERFORM pg_temp.assert03(affected=CASE WHEN writer THEN 1 ELSE 0 END,'CMS UPDATE '||t);
 EXECUTE format('DELETE FROM public.%I WHERE id=$1',t)
  USING CASE WHEN writer THEN new_id ELSE (payload->>'id')::uuid END;
 GET DIAGNOSTICS affected=ROW_COUNT;
 PERFORM pg_temp.assert03(affected=CASE WHEN can_delete THEN 1 ELSE 0 END,'CMS DELETE restriction '||t);
END;
$$;

DO $$ DECLARE actor record; c record; writer boolean; affected integer; BEGIN
 FOR actor IN SELECT * FROM actors ORDER BY id LOOP
  PERFORM set_config('request.jwt.claim.sub',actor.id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  writer:=actor.active AND actor.role<>'visualizador';
  FOR c IN SELECT * FROM cms_cases LOOP
   PERFORM pg_temp.check_cms03(c.tab,c.payload,writer,
    writer AND (NOT c.admin_delete OR actor.role='admin'),actor.active);
  END LOOP;
  PERFORM pg_temp.assert03((SELECT count(*) FROM public.user_profiles)=1,
    'authenticated sees only own profile');
  PERFORM pg_temp.assert03(EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=auth.uid())=actor.active,
    'membership lookup follows active membership');
  IF writer THEN
   UPDATE public.website_leads SET notes='Writer internal note' WHERE id='93000000-0000-4000-8000-000000000200';
  ELSE
   UPDATE public.website_leads SET notes='Must not change' WHERE id='93000000-0000-4000-8000-000000000200';
  END IF;
  GET DIAGNOSTICS affected=ROW_COUNT;
  PERFORM pg_temp.assert03(affected=CASE WHEN writer THEN 1 ELSE 0 END,'lead UPDATE writer only');
  DELETE FROM public.website_leads WHERE id='93000000-0000-4000-8000-000000000200';
  GET DIAGNOSTICS affected=ROW_COUNT;
  PERFORM pg_temp.assert03(affected=CASE WHEN actor.active AND actor.role='admin' THEN 1 ELSE 0 END,'lead DELETE admin only');
  IF actor.active AND actor.role='admin' THEN
   INSERT INTO public.website_leads(id,organization_id,name,notes)
   VALUES ('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000100','Internal','Private notes');
   INSERT INTO public.organization_members(organization_id,user_id,role,active)
   VALUES ('93000000-0000-4000-8000-000000000100','93000000-0000-4000-8000-000000000005','editor',true);
   UPDATE public.organization_members SET active=false WHERE user_id='93000000-0000-4000-8000-000000000005';
   GET DIAGNOSTICS affected=ROW_COUNT;
   PERFORM pg_temp.assert03(affected=1,'admin updates membership');
   DELETE FROM public.organization_members WHERE user_id='93000000-0000-4000-8000-000000000005';
   GET DIAGNOSTICS affected=ROW_COUNT;
   PERFORM pg_temp.assert03(affected=1,'admin deletes membership');
  ELSE
   BEGIN
    INSERT INTO public.organization_members(organization_id,user_id,role,active)
    VALUES ('93000000-0000-4000-8000-000000000100','93000000-0000-4000-8000-000000000005','admin',true);
    RAISE EXCEPTION 'FAIL: non-admin inserted membership';
   EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: non-admin membership INSERT denied'; END;
   UPDATE public.organization_members SET role='admin' WHERE user_id=auth.uid();
   GET DIAGNOSTICS affected=ROW_COUNT;
   PERFORM pg_temp.assert03(affected=0,'non-admin cannot promote membership');
  END IF;
  EXECUTE 'RESET ROLE';
 END LOOP;
END $$;

-- Unknown roles cannot bypass writer checks, even if a privileged future process
-- disabled the canonical CHECK. This test-only setup is rolled back.
ALTER TABLE public.organization_members DROP CONSTRAINT organization_members_role_canonical_check;
UPDATE public.organization_members SET role='unknown-test' WHERE user_id='93000000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
DO $$ DECLARE c record; affected integer; BEGIN
 FOR c IN SELECT * FROM cms_cases LOOP PERFORM pg_temp.check_cms03(c.tab,c.payload,false,false,true); END LOOP;
 UPDATE public.website_leads SET notes='Unknown must not edit' WHERE id='93000000-0000-4000-8000-000000000200';
 GET DIAGNOSTICS affected=ROW_COUNT;
 PERFORM pg_temp.assert03(affected=0,'unknown cannot edit leads');
END $$;
RESET ROLE;

-- Multi-org: active writer in A, visualizador in B; no writable destination B.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT pg_temp.assert03(public.is_org_writer('93000000-0000-4000-8000-000000000100')
 AND NOT public.is_org_writer('93000000-0000-4000-8000-000000000101'),'multi-org writer scoped');
DO $$ BEGIN
 UPDATE public.website_books SET organization_id='93000000-0000-4000-8000-000000000101'
 WHERE id='93000000-0000-4000-8000-000000000200';
 RAISE EXCEPTION 'FAIL: tenant move to viewer organization';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: tenant move blocked'; END $$;
DO $$ BEGIN
 INSERT INTO public.website_book_category_links(book_id,category_id) VALUES
 ('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000202');
 RAISE EXCEPTION 'FAIL: cross-tenant category';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: cross-tenant category blocked'; END $$;
INSERT INTO public.website_leads(organization_id,name,status,notes,is_test)
VALUES ('93000000-0000-4000-8000-000000000100','Internal writer lead','revisado','Internal',true);
DO $$ BEGIN
 INSERT INTO public.website_leads(organization_id,name,notes)
 VALUES ('93000000-0000-4000-8000-000000000101','Forbidden','Internal');
 RAISE EXCEPTION 'FAIL: writer inserted internal lead in viewer tenant';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: internal leads tenant scoped'; END $$;
RESET ROLE;

-- Public intake contract: ordinary form fields allowed, administrative fields
-- must stay at defaults; default Noveli tenant cannot be overridden to another.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
SELECT pg_temp.assert03((SELECT count(*)=0 FROM public.user_profiles)
 AND (SELECT count(*)=0 FROM public.organization_members)
 AND (SELECT count(*)=0 FROM public.website_leads), 'anon cannot read profiles/members/leads');
DO $$ DECLARE c record; t text; visible boolean; BEGIN
 FOR c IN SELECT * FROM cms_cases LOOP PERFORM pg_temp.check_cms03(c.tab,c.payload,false,false,false); END LOOP;
 FOREACH t IN ARRAY ARRAY['website_books','website_services','website_book_categories','website_book_category_links',
 'website_hero_settings','website_hero_quick_services','website_footer_settings','website_footer_gallery','website_exchange_rates'] LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1)',t)
   INTO visible USING '93000000-0000-4000-8000-000000000201'::uuid;
  PERFORM pg_temp.assert03(visible,'anon publication SELECT '||t);
 END LOOP;
END $$;
SELECT pg_temp.assert03(NOT EXISTS(SELECT 1 FROM public.website_book_category_links
 WHERE id IN ('93000000-0000-4000-8000-000000000200','93000000-0000-4000-8000-000000000202')),
 'anon cannot see private-parent or cross-tenant associations');
INSERT INTO public.website_leads(id,name,email,phone,instagram,service_interest,message,manuscript_info,source,accepted_terms)
VALUES ('93000000-0000-4000-8000-000000000300','Public form','security03a-form@example.invalid',
 'Test phone','@test','Corrección','Test','Test manuscript','website',true);
RESET ROLE;
CREATE FUNCTION pg_temp.reject_lead03(payload jsonb,label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 EXECUTE 'INSERT INTO public.website_leads(organization_id,status,notes,converted_to_proposal,converted_quotation_id,converted_to_prospect,converted_prospect_id,is_test,test_run_id)
 SELECT organization_id,status,notes,converted_to_proposal,converted_quotation_id,converted_to_prospect,converted_prospect_id,is_test,test_run_id
 FROM jsonb_populate_record(NULL::public.website_leads,$1)'
 USING jsonb_build_object('organization_id','11111111-1111-1111-1111-111111111111','status','nuevo',
 'converted_to_proposal',false,'converted_to_prospect',false,'is_test',false)||payload;
 RAISE EXCEPTION 'FAIL: public lead accepted %',label;
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: public lead rejects %',label;
END;
$$;
SET LOCAL ROLE anon;
SELECT pg_temp.reject_lead03('{"organization_id":"93000000-0000-4000-8000-000000000101"}','foreign tenant');
SELECT pg_temp.reject_lead03('{"organization_id":null}','NULL tenant');
SELECT pg_temp.reject_lead03('{"status":"aprobado"}','internal status');
SELECT pg_temp.reject_lead03('{"notes":"internal injection"}','notes');
SELECT pg_temp.reject_lead03('{"converted_to_proposal":true}','conversion flag');
SELECT pg_temp.reject_lead03('{"converted_quotation_id":"93000000-0000-4000-8000-000000000999"}','conversion reference');
SELECT pg_temp.reject_lead03('{"converted_to_prospect":true}','prospect flag');
SELECT pg_temp.reject_lead03('{"converted_prospect_id":"93000000-0000-4000-8000-000000000999"}','prospect reference');
SELECT pg_temp.reject_lead03('{"is_test":true}','test flag');
SELECT pg_temp.reject_lead03('{"test_run_id":"injected"}','test run');
RESET ROLE;
SELECT pg_temp.assert03(EXISTS(SELECT 1 FROM public.website_leads WHERE id='93000000-0000-4000-8000-000000000300'
 AND organization_id='11111111-1111-1111-1111-111111111111' AND status='nuevo' AND notes IS NULL),
 'valid public lead persisted with trusted initial tenant/state');
SELECT pg_temp.assert03((SELECT count(*)=284 FROM pg_policies WHERE schemaname='public')
 AND (SELECT count(*)=126 FROM pg_policies WHERE schemaname='public' AND permissive='RESTRICTIVE'),
 '284 total policies and all 126 guards retained');
ROLLBACK;
\echo SECURITY_03A_ALL_CHECKS_PASSED_AND_ROLLED_BACK
