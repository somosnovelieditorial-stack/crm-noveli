-- Local-only catalog/security assertions; no fixture or production mutations.
BEGIN;
CREATE FUNCTION pg_temp.phase1a_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
SELECT pg_temp.phase1a_assert((SELECT count(*)=2 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('orders','order_items') AND c.relrowsecurity),'two new public tables with RLS');
SELECT pg_temp.phase1a_assert((SELECT count(*)=1 FROM information_schema.tables WHERE table_schema='public' AND table_name IN('payment_schedules','payments','payment_allocations','payment_refunds','contracts','contract_templates')) AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.payment_schedules'::regclass) AND NOT EXISTS(SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name IN('payments','payment_allocations','payment_refunds','contracts','contract_templates')),'P1-04 schedules only with RLS; later structures absent');
SELECT pg_temp.phase1a_assert(NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='payment_status'),'no fake persisted payment_status');
SELECT pg_temp.phase1a_assert((SELECT count(*)=12 AND bool_and(NOT prosecdef) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'phase1a_%'),'12 public entrypoints all invoker');
SELECT pg_temp.phase1a_assert(NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'phase1a_%' AND has_function_privilege('anon',p.oid,'EXECUTE')),'anon cannot execute new entrypoints');
SELECT pg_temp.phase1a_assert(NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='noveli_private' AND has_function_privilege('anon',p.oid,'EXECUTE')),'anon cannot execute private helpers');
SELECT pg_temp.phase1a_assert((SELECT count(*)=13 AND bool_and(p.proowner='noveli_orders_executor'::regrole AND p.proconfig=ARRAY['search_path=""']::text[]) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='noveli_private' AND p.prosecdef),'all private definers limited owner and safe search_path');
SELECT pg_temp.phase1a_assert((SELECT NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit FROM pg_roles WHERE rolname='noveli_orders_executor'),'executor minimal role flags');
SELECT pg_temp.phase1a_assert(NOT pg_has_role('authenticated','noveli_orders_executor','SET'),'authenticated cannot assume executor role');
SELECT pg_temp.phase1a_assert(NOT has_schema_privilege('noveli_orders_executor','noveli_private','CREATE'),'executor cannot create privileged code after migrations');
SELECT pg_temp.phase1a_assert(NOT has_table_privilege('authenticated','public.orders','INSERT,UPDATE,DELETE') AND NOT has_table_privilege('authenticated','public.order_items','INSERT,UPDATE,DELETE'),'no authenticated direct DML');
SELECT pg_temp.phase1a_assert(NOT has_table_privilege('noveli_orders_executor','public.clients','UPDATE') AND NOT has_table_privilege('noveli_orders_executor','public.orders','DELETE'),'executor cannot update clients or delete orders');
SELECT pg_temp.phase1a_assert(NOT has_table_privilege('authenticated','noveli_private.quotation_acceptance_snapshots','SELECT'),'accepted revisions not directly exposed');
SELECT pg_temp.phase1a_assert((SELECT format_type(atttypid,atttypmod)='numeric(30,12)' FROM pg_attribute WHERE attrelid='public.order_items'::regclass AND attname='unit_price'),'unit_price precision preserved');
SELECT pg_temp.phase1a_assert((SELECT format_type(atttypid,atttypmod)='numeric(18,2)' FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='total'),'canonical money precision');
SELECT pg_temp.phase1a_assert((SELECT count(*)=2 AND bool_and(array_length(confdelsetcols,1)=1) FROM pg_constraint WHERE conrelid='public.order_items'::regclass AND confdeltype='n'),'SET NULL targets only reference column not tenant');
SELECT pg_temp.phase1a_assert((SELECT count(*)=2 AND bool_and(tgdeferrable AND tginitdeferred) FROM pg_trigger WHERE tgname IN('phase1a_order_totals','phase1a_item_totals')),'sum constraints deferred atomically');
SELECT pg_temp.phase1a_assert((SELECT NOT public FROM storage.buckets WHERE id='documents') AND (SELECT public FROM storage.buckets WHERE id='brand-assets'),'04B bucket flags intact');
SELECT pg_temp.phase1a_assert((SELECT count(*)=16 FROM pg_policies WHERE schemaname='storage'),'04B storage policies intact');
SELECT 'PHASE_1A_SQL_PASS_19';
ROLLBACK;
