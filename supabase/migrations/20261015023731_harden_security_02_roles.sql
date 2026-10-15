-- Security 02: approved role aliases and restrictive authenticated write guards.
-- Baseline and Security 01 remain immutable. Public SELECT policies are untouched.
-- Unknown stored roles abort BEFORE normalization; never coerce them into writers.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE role NOT IN ('admin','editor','diseñador','corrector','finanzas','visualizador',
                           'administrador','direccion','maquetador','asistente','contador','solo lectura')
    ) THEN
        RAISE EXCEPTION 'Unmapped organization_members.role: review before applying Security 02';
    END IF;
END;
$$;

UPDATE public.organization_members
SET role = CASE role
    WHEN 'administrador' THEN 'admin'
    WHEN 'direccion' THEN 'admin'
    WHEN 'maquetador' THEN 'diseñador'
    WHEN 'asistente' THEN 'editor'
    WHEN 'contador' THEN 'finanzas'
    WHEN 'solo lectura' THEN 'visualizador'
    ELSE role
END
WHERE role IN ('administrador','direccion','maquetador','asistente','contador','solo lectura');

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                   WHERE conrelid='public.organization_members'::regclass
                     AND conname='organization_members_role_canonical_check') THEN
        ALTER TABLE public.organization_members
        ADD CONSTRAINT organization_members_role_canonical_check
        CHECK (role IN ('admin','editor','diseñador','corrector','finanzas','visualizador'));
    END IF;
END;
$$;

-- SECURITY DEFINER is necessary: this helper is itself called by guards on
-- organization_members. An invoker body would recurse into its own RLS.
-- Fully qualified table, empty path; no client/JWT role claim is trusted.
CREATE OR REPLACE FUNCTION public.is_org_writer(org_uuid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT org_uuid IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.organization_members AS membership
        WHERE membership.organization_id = org_uuid
          AND membership.user_id = auth.uid()
          AND membership.active = true
          AND membership.role IN ('admin','editor','diseñador','corrector','finanzas')
    );
$$;
ALTER FUNCTION public.is_org_writer(uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_writer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_writer(uuid) TO authenticated, service_role, postgres;

-- Normalize the two legacy admin literals that would otherwise strand admin
-- access after the data mapping. Preserve the existing scope of both policies.
ALTER POLICY "Manage organization" ON public.organizations
USING (id = public.get_user_org_id() AND public.get_user_role() = 'admin')
WITH CHECK (id = public.get_user_org_id() AND public.get_user_role() = 'admin');
ALTER POLICY "Manage members" ON public.organization_members
USING (organization_id = public.get_user_org_id() AND public.get_user_role() = 'admin')
WITH CHECK (organization_id = public.get_user_org_id() AND public.get_user_role() = 'admin');

-- Guards add AND to every old permissive write path. No SELECT guard and no
-- permissive-policy consolidation. Explicit inventory avoids touching future
-- orders/payments/projects or public intake. Three policies per listed table.
DO $$
DECLARE target_table text;
BEGIN
    FOREACH target_table IN ARRAY ARRAY[
        'activity_log',
        'agenda_events',
        'client_funds',
        'clients',
        'company_settings',
        'documents',
        'editorial_stages',
        'exchange_rates',
        'expenses',
        'fund_movements',
        'income_allocations',
        'income_distributions',
        'income_tax_reservations',
        'incomes',
        'notifications',
        'operational_reserve_movements',
        'organization_members',
        'payroll_payments',
        'prospects',
        'providers',
        'quick_replies',
        'quotation_items',
        'quotations',
        'service_catalog',
        'service_checklists',
        'service_pack_items',
        'service_packs',
        'service_stages',
        'services',
        'settings',
        'staff',
        'website_book_categories',
        'website_books',
        'website_footer_gallery',
        'website_footer_settings',
        'website_hero_quick_services',
        'website_hero_settings',
        'website_links',
        'website_sections',
        'website_services',
        'website_settings'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS security02_writer_insert ON public.%I', target_table);
        EXECUTE format('CREATE POLICY security02_writer_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id))', target_table);
        EXECUTE format('DROP POLICY IF EXISTS security02_writer_update ON public.%I', target_table);
        EXECUTE format('CREATE POLICY security02_writer_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id))', target_table);
        EXECUTE format('DROP POLICY IF EXISTS security02_writer_delete ON public.%I', target_table);
        EXECUTE format('CREATE POLICY security02_writer_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_org_writer(organization_id))', target_table);
    END LOOP;
END;
$$;

-- Child table has no organization_id. Resolve its parent book explicitly so a
-- visualizador cannot bypass read-only by modifying book/category associations.
DROP POLICY IF EXISTS security02_writer_insert ON public.website_book_category_links;
CREATE POLICY security02_writer_insert ON public.website_book_category_links
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.website_books AS book
                   WHERE book.id = book_id AND public.is_org_writer(book.organization_id)));
DROP POLICY IF EXISTS security02_writer_update ON public.website_book_category_links;
CREATE POLICY security02_writer_update ON public.website_book_category_links
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.website_books AS book
              WHERE book.id = book_id AND public.is_org_writer(book.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.website_books AS book
                   WHERE book.id = book_id AND public.is_org_writer(book.organization_id)));
DROP POLICY IF EXISTS security02_writer_delete ON public.website_book_category_links;
CREATE POLICY security02_writer_delete ON public.website_book_category_links
AS RESTRICTIVE FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.website_books AS book
              WHERE book.id = book_id AND public.is_org_writer(book.organization_id)));

-- Replace only the 15 unsafe legacy website write predicates, retaining names.
-- Existing SELECT/publication policies and public leads remain unchanged.
ALTER POLICY "Insert settings" ON public.website_settings
TO authenticated WITH CHECK (public.is_org_writer(organization_id));
ALTER POLICY "Update settings" ON public.website_settings
TO authenticated USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));
ALTER POLICY "Delete settings" ON public.website_settings
TO authenticated USING (public.is_org_writer(organization_id));

ALTER POLICY "Insert sections" ON public.website_sections
TO authenticated WITH CHECK (public.is_org_writer(organization_id));
ALTER POLICY "Update sections" ON public.website_sections
TO authenticated USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));
ALTER POLICY "Delete sections" ON public.website_sections
TO authenticated USING (public.is_org_writer(organization_id));

ALTER POLICY "Insert services" ON public.website_services
TO authenticated WITH CHECK (public.is_org_writer(organization_id));
ALTER POLICY "Update services" ON public.website_services
TO authenticated USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));
ALTER POLICY "Delete services" ON public.website_services
TO authenticated USING (public.is_org_writer(organization_id));

ALTER POLICY "Insert books" ON public.website_books
TO authenticated WITH CHECK (public.is_org_writer(organization_id));
ALTER POLICY "Update books" ON public.website_books
TO authenticated USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));
ALTER POLICY "Delete books" ON public.website_books
TO authenticated USING (public.is_org_writer(organization_id));

ALTER POLICY "Insert links" ON public.website_links
TO authenticated WITH CHECK (public.is_org_writer(organization_id));
ALTER POLICY "Update links" ON public.website_links
TO authenticated USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));
ALTER POLICY "Delete links" ON public.website_links
TO authenticated USING (public.is_org_writer(organization_id));

-- Exclusions: website_leads (public intake, entire flow deferred), user_profiles
-- (own-account operations from Security 01), organizations (admin-only existing
-- write policy, literal aligned above), website_exchange_rates (global admin-only
-- writes from Security 01). No schema/index/commercial-structure changes.

-- TRUNCATE bypasses RLS. API roles share one SQL role, so revoke this privilege
-- for everyone using anon/authenticated, including admins; normal CRUD remains.
-- Explicit baseline inventory: never touch future commercial tables implicitly.
REVOKE TRUNCATE ON TABLE
    public.activity_log,
    public.agenda_events,
    public.client_funds,
    public.clients,
    public.company_settings,
    public.documents,
    public.editorial_stages,
    public.exchange_rates,
    public.expenses,
    public.fund_movements,
    public.income_allocations,
    public.income_distributions,
    public.income_tax_reservations,
    public.incomes,
    public.notifications,
    public.operational_reserve_movements,
    public.organization_members,
    public.organizations,
    public.payroll_payments,
    public.prospects,
    public.providers,
    public.quick_replies,
    public.quotation_items,
    public.quotations,
    public.service_catalog,
    public.service_checklists,
    public.service_pack_items,
    public.service_packs,
    public.service_stages,
    public.services,
    public.settings,
    public.staff,
    public.user_profiles,
    public.website_book_categories,
    public.website_book_category_links,
    public.website_books,
    public.website_exchange_rates,
    public.website_footer_gallery,
    public.website_footer_settings,
    public.website_hero_quick_services,
    public.website_hero_settings,
    public.website_leads,
    public.website_links,
    public.website_sections,
    public.website_services,
    public.website_settings
FROM anon, authenticated;
