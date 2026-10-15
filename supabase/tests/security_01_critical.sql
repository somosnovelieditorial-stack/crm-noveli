-- Run ONLY against the local Docker database using psql -v ON_ERROR_STOP=1.
-- Synthetic auth users, memberships, profiles and rates are rolled back.
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.assert_true(ok boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF ok IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'FAIL: %', label;
    END IF;
    RAISE NOTICE 'PASS: %', label;
END;
$$;

-- SECURITY INVOKER: all DML below runs with the caller's actual SET ROLE.
CREATE FUNCTION pg_temp.check_rate_access(can_write boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE affected integer;
BEGIN
    PERFORM pg_temp.assert_true(
        EXISTS (SELECT 1 FROM public.website_exchange_rates
                WHERE id = '90000000-0000-4000-8000-000000000201'),
        label || ': public active rate remains readable');
    BEGIN
        INSERT INTO public.website_exchange_rates
            (id, target_currency, rate, active)
        VALUES ('90000000-0000-4000-8000-000000000203', 'AUDIT01', 1, true);
        PERFORM pg_temp.assert_true(can_write, label || ': INSERT allowed only for active admin');
    EXCEPTION WHEN insufficient_privilege THEN
        PERFORM pg_temp.assert_true(NOT can_write, label || ': INSERT denied');
    END;

    UPDATE public.website_exchange_rates SET rate = rate + 1
    WHERE id = '90000000-0000-4000-8000-000000000201';
    GET DIAGNOSTICS affected = ROW_COUNT;
    PERFORM pg_temp.assert_true(affected = CASE WHEN can_write THEN 1 ELSE 0 END,
                               label || ': UPDATE access');

    DELETE FROM public.website_exchange_rates
    WHERE id = '90000000-0000-4000-8000-000000000201';
    GET DIAGNOSTICS affected = ROW_COUNT;
    PERFORM pg_temp.assert_true(affected = CASE WHEN can_write THEN 1 ELSE 0 END,
                               label || ': DELETE access');
    IF can_write THEN
        -- Restore fixture for subsequent scenarios, still within the rollback.
        INSERT INTO public.website_exchange_rates
            (id, target_currency, rate, active)
        VALUES ('90000000-0000-4000-8000-000000000201', 'AUDIT01', 1, true);
        DELETE FROM public.website_exchange_rates
        WHERE id = '90000000-0000-4000-8000-000000000203';
    END IF;
END;
$$;

SELECT pg_temp.assert_true(
    (SELECT count(*) = 46 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind IN ('r','p')), '46 public tables');
SELECT pg_temp.assert_true(
    (SELECT count(*) = 5 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prokind='f'), '5 public functions retained');
SELECT pg_temp.assert_true(
    NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname='public' AND c.relkind IN ('r','p')
                  AND NOT c.relrowsecurity), 'RLS enabled on all public tables');
SELECT pg_temp.assert_true(
    (SELECT count(*) = 164 FROM pg_policies WHERE schemaname='public'), '164 policies');
SELECT pg_temp.assert_true(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='payroll_payments'
                AND policyname='Payroll payments org access')
    AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='payroll_payments' AND policyname='Payroll org access')
    AND (SELECT count(*)=5 FROM pg_policies WHERE schemaname='public'
          AND tablename='payroll_payments'), 'only exact payroll duplicate removed');
SELECT pg_temp.assert_true(
    NOT has_function_privilege('anon','public.get_public_schema_columns()','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.get_public_schema_columns()','EXECUTE')
    AND has_function_privilege('postgres','public.get_public_schema_columns()','EXECUTE')
    AND has_function_privilege('service_role','public.get_public_schema_columns()','EXECUTE'),
    'metadata function restricted to trusted roles');
SELECT pg_temp.assert_true(
    (SELECT count(*)=4 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public'
       AND p.proname IN ('get_user_org_id','get_user_role','is_org_member','is_org_admin')
       AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""']
       AND has_function_privilege('anon',p.oid,'EXECUTE')
       AND has_function_privilege('authenticated',p.oid,'EXECUTE')),
    'four RLS helpers keep SECURITY DEFINER, safe path and EXECUTE');

INSERT INTO auth.users (id, email) VALUES
('90000000-0000-4000-8000-000000000001','audit-admin@example.invalid'),
('90000000-0000-4000-8000-000000000002','audit-editor@example.invalid'),
('90000000-0000-4000-8000-000000000003','audit-inactive@example.invalid'),
('90000000-0000-4000-8000-000000000004','audit-legacy@example.invalid'),
('90000000-0000-4000-8000-000000000005','audit-outsider@example.invalid'),
('90000000-0000-4000-8000-000000000006','audit-multiorg@example.invalid');
INSERT INTO public.organizations (id,name) VALUES
('90000000-0000-4000-8000-000000000100','Security test A'),
('90000000-0000-4000-8000-000000000101','Security test B');
INSERT INTO public.organization_members (organization_id,user_id,role,active) VALUES
('90000000-0000-4000-8000-000000000100','90000000-0000-4000-8000-000000000001','admin',true),
('90000000-0000-4000-8000-000000000100','90000000-0000-4000-8000-000000000002','editor',true),
('90000000-0000-4000-8000-000000000100','90000000-0000-4000-8000-000000000003','admin',false),
('90000000-0000-4000-8000-000000000100','90000000-0000-4000-8000-000000000004','administrador',true),
('90000000-0000-4000-8000-000000000100','90000000-0000-4000-8000-000000000006','editor',true),
('90000000-0000-4000-8000-000000000101','90000000-0000-4000-8000-000000000006','admin',true);
INSERT INTO public.user_profiles (id,full_name) VALUES
('90000000-0000-4000-8000-000000000001','Test admin'),
('90000000-0000-4000-8000-000000000002','Test editor'),
('90000000-0000-4000-8000-000000000003','Test inactive');
INSERT INTO public.website_exchange_rates (id,target_currency,rate,active) VALUES
('90000000-0000-4000-8000-000000000201','AUDIT01',1,true),
('90000000-0000-4000-8000-000000000202','AUDIT02',2,false);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.user_profiles),
                           'anon cannot list profiles');
SELECT pg_temp.assert_true(NOT public.is_org_member('90000000-0000-4000-8000-000000000100')
                           AND NOT public.is_org_admin('90000000-0000-4000-8000-000000000100'),
                           'anon is neither member nor admin');
SELECT pg_temp.check_rate_access(false,'anon');
DO $$ BEGIN
    PERFORM public.get_public_schema_columns();
    RAISE EXCEPTION 'FAIL: anon metadata RPC allowed';
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon metadata RPC denied';
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.user_profiles)
    AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id=auth.uid()),
    'authenticated can read own profile only');
UPDATE public.user_profiles SET full_name='Own profile updated' WHERE id=auth.uid();
SELECT pg_temp.assert_true(EXISTS (SELECT 1 FROM public.user_profiles
    WHERE id=auth.uid() AND full_name='Own profile updated'), 'own profile update retained');
SELECT pg_temp.assert_true(EXISTS (SELECT 1 FROM public.organization_members
    WHERE user_id=auth.uid() AND active=true AND role='editor'),
    'login membership role/org query remains functional');
SELECT pg_temp.assert_true(public.is_org_member('90000000-0000-4000-8000-000000000100')
    AND NOT public.is_org_admin('90000000-0000-4000-8000-000000000100')
    AND public.get_user_org_id()='90000000-0000-4000-8000-000000000100'::uuid
    AND public.get_user_role()='editor', 'active editor helpers preserved');
SELECT pg_temp.check_rate_access(false,'active non-admin');
DO $$ BEGIN
    PERFORM public.get_public_schema_columns();
    RAISE EXCEPTION 'FAIL: authenticated metadata RPC allowed';
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated metadata RPC denied';
END $$;

SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT pg_temp.assert_true(NOT public.is_org_member('90000000-0000-4000-8000-000000000100')
    AND NOT public.is_org_admin('90000000-0000-4000-8000-000000000100')
    AND public.get_user_org_id() IS NULL AND public.get_user_role() IS NULL,
    'inactive admin fails all membership helpers');
SELECT pg_temp.check_rate_access(false,'inactive admin');

SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
SELECT pg_temp.assert_true(public.is_org_member('90000000-0000-4000-8000-000000000100')
    AND NOT public.is_org_admin('90000000-0000-4000-8000-000000000100')
    AND public.get_user_role()='administrador', 'legacy role preserved, not promoted to admin');
SELECT pg_temp.check_rate_access(false,'legacy administrador');

SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000005',true);
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
SELECT pg_temp.assert_true(NOT public.is_org_member('90000000-0000-4000-8000-000000000100')
    AND NOT public.is_org_admin('90000000-0000-4000-8000-000000000100'),
    'authenticated without membership is not admin');
SELECT pg_temp.check_rate_access(false,'authenticated without membership');

SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT pg_temp.assert_true(public.is_org_admin('90000000-0000-4000-8000-000000000100')
    AND public.is_org_member('90000000-0000-4000-8000-000000000100')
    AND public.get_user_role()='admin', 'active admin recognized');
SELECT pg_temp.assert_true(EXISTS (SELECT 1 FROM public.website_exchange_rates
    WHERE id='90000000-0000-4000-8000-000000000202'), 'admin can manage inactive rates');
SELECT pg_temp.check_rate_access(true,'active admin');

SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000006',true);
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
SELECT pg_temp.assert_true(public.is_org_admin('90000000-0000-4000-8000-000000000101')
    AND NOT public.is_org_admin('90000000-0000-4000-8000-000000000100'),
    'multi-org admin recognized only in own admin organization');
SELECT pg_temp.check_rate_access(true,'multi-org active admin');

RESET ROLE;
ROLLBACK;
\echo SECURITY_01_CRITICAL_ALL_CHECKS_PASSED_AND_ROLLED_BACK
