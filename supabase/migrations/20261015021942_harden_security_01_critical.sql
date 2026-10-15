-- Noveli 2.0 / security 01: narrowly scoped critical fixes.
-- Baseline is immutable. No table/data/index/role-normalization changes.
-- Existing RLS/defaults depend on these SECURITY DEFINER helpers; preserve
-- their ownership, EXECUTE grants, volatility and LIMIT 1 semantics for now.
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT membership.organization_id
    FROM public.organization_members AS membership
    WHERE membership.user_id = auth.uid() AND membership.active = true
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT membership.role
    FROM public.organization_members AS membership
    WHERE membership.user_id = auth.uid() AND membership.active = true
    LIMIT 1;
$$;

-- Baseline bodies already qualify public.organization_members and auth.uid(),
-- require active=true, and is_org_admin(uuid) requires role='admin'. Keep those
-- bodies/role semantics unchanged; remove their unnecessary public search_path.
ALTER FUNCTION public.is_org_member(uuid) SET search_path = '';
ALTER FUNCTION public.is_org_admin(uuid) SET search_path = '';

-- security-audit.md and a fresh src search found no frontend consumer of this
-- metadata RPC. Revoke inherited PUBLIC execution as well as explicit API-role
-- grants. Retain postgres ownership and the existing service_role EXECUTE for
-- trusted operational diagnostics; do not change the four RLS helper ACLs.
REVOKE EXECUTE ON FUNCTION public.get_public_schema_columns()
FROM PUBLIC, anon, authenticated;

-- No frontend use requires a cross-user profile directory. Own-profile access
-- is sufficient; preserve the existing "Manage profile" policy for compatibility.
-- Login/Auth and organization_members policies are not modified.
ALTER POLICY "Select profile" ON public.user_profiles
TO authenticated
USING ((SELECT auth.uid()) = id);

-- Exact duplicate only. "Payroll org access" has the same command, roles,
-- USING and WITH CHECK; retain it and all four granular payroll policies.
DROP POLICY "Payroll payments org access" ON public.payroll_payments;

-- Rates are global (no organization_id). For this phase, an active admin of
-- any organization may manage them. Do not use the ambiguous LIMIT 1 role
-- helper: check membership and role on the same row. The membership subquery
-- remains subject to organization_members RLS; existing helpers break recursion.
-- Keep ALL so authorized admins can still manage inactive rates. Non-admins
-- and anon retain the unchanged public_read SELECT policy for active rates.
ALTER POLICY "website_exchange_rates_auth_manage"
ON public.website_exchange_rates
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.organization_members AS membership
        WHERE membership.user_id = (SELECT auth.uid())
          AND membership.active = true
          AND membership.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.organization_members AS membership
        WHERE membership.user_id = (SELECT auth.uid())
          AND membership.active = true
          AND membership.role = 'admin'
    )
);
