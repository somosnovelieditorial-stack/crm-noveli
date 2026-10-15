-- Security 03A: WEB/membership RLS only. Preserve every Security 02 guard.
-- No CRM policy cleanup, schema/data/index changes or frontend contract changes.
-- Source comparisons: docs/noveli-2/security-03a-validation.md.

DROP POLICY IF EXISTS "Manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Select members" ON public.organization_members;
DROP POLICY IF EXISTS "Manage profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Select profile" ON public.user_profiles;
DROP POLICY IF EXISTS "profiles_self_access" ON public.user_profiles;
CREATE POLICY "profiles_self_access" ON public.user_profiles FOR ALL TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

-- website_settings: active membership reads; writers edit; preserve admin-only DELETE where present.
DROP POLICY IF EXISTS "Delete settings" ON public.website_settings;
DROP POLICY IF EXISTS "Insert settings" ON public.website_settings;
DROP POLICY IF EXISTS "Select settings" ON public.website_settings;
DROP POLICY IF EXISTS "Update settings" ON public.website_settings;
DROP POLICY IF EXISTS "website_settings_org_delete" ON public.website_settings;
DROP POLICY IF EXISTS "website_settings_org_insert" ON public.website_settings;
DROP POLICY IF EXISTS "website_settings_org_select" ON public.website_settings;
DROP POLICY IF EXISTS "website_settings_org_update" ON public.website_settings;
DROP POLICY IF EXISTS "website_settings_cms_select" ON public.website_settings;
CREATE POLICY "website_settings_cms_select" ON public.website_settings FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "website_settings_cms_insert" ON public.website_settings;
CREATE POLICY "website_settings_cms_insert" ON public.website_settings FOR INSERT TO authenticated
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_settings_cms_update" ON public.website_settings;
CREATE POLICY "website_settings_cms_update" ON public.website_settings FOR UPDATE TO authenticated
USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_settings_cms_delete" ON public.website_settings;
CREATE POLICY "website_settings_cms_delete" ON public.website_settings FOR DELETE TO authenticated
USING (public.is_org_admin(organization_id));

-- website_sections: active membership reads; writers edit; preserve admin-only DELETE where present.
DROP POLICY IF EXISTS "Delete sections" ON public.website_sections;
DROP POLICY IF EXISTS "Insert sections" ON public.website_sections;
DROP POLICY IF EXISTS "Select sections" ON public.website_sections;
DROP POLICY IF EXISTS "Update sections" ON public.website_sections;
DROP POLICY IF EXISTS "website_sections_org_delete" ON public.website_sections;
DROP POLICY IF EXISTS "website_sections_org_insert" ON public.website_sections;
DROP POLICY IF EXISTS "website_sections_org_select" ON public.website_sections;
DROP POLICY IF EXISTS "website_sections_org_update" ON public.website_sections;
DROP POLICY IF EXISTS "website_sections_cms_select" ON public.website_sections;
CREATE POLICY "website_sections_cms_select" ON public.website_sections FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "website_sections_cms_insert" ON public.website_sections;
CREATE POLICY "website_sections_cms_insert" ON public.website_sections FOR INSERT TO authenticated
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_sections_cms_update" ON public.website_sections;
CREATE POLICY "website_sections_cms_update" ON public.website_sections FOR UPDATE TO authenticated
USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_sections_cms_delete" ON public.website_sections;
CREATE POLICY "website_sections_cms_delete" ON public.website_sections FOR DELETE TO authenticated
USING (public.is_org_admin(organization_id));

-- website_services: active membership reads; writers edit; preserve admin-only DELETE where present.
DROP POLICY IF EXISTS "Delete services" ON public.website_services;
DROP POLICY IF EXISTS "Insert services" ON public.website_services;
DROP POLICY IF EXISTS "Select services" ON public.website_services;
DROP POLICY IF EXISTS "Update services" ON public.website_services;
DROP POLICY IF EXISTS "website_services_org_all" ON public.website_services;
DROP POLICY IF EXISTS "website_services_org_delete" ON public.website_services;
DROP POLICY IF EXISTS "website_services_org_insert" ON public.website_services;
DROP POLICY IF EXISTS "website_services_org_select" ON public.website_services;
DROP POLICY IF EXISTS "website_services_org_update" ON public.website_services;
DROP POLICY IF EXISTS "website_services_cms_select" ON public.website_services;
CREATE POLICY "website_services_cms_select" ON public.website_services FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "website_services_cms_insert" ON public.website_services;
CREATE POLICY "website_services_cms_insert" ON public.website_services FOR INSERT TO authenticated
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_services_cms_update" ON public.website_services;
CREATE POLICY "website_services_cms_update" ON public.website_services FOR UPDATE TO authenticated
USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_services_cms_delete" ON public.website_services;
CREATE POLICY "website_services_cms_delete" ON public.website_services FOR DELETE TO authenticated
USING (public.is_org_admin(organization_id));

-- website_books: active membership reads; writers edit; preserve admin-only DELETE where present.
DROP POLICY IF EXISTS "Delete books" ON public.website_books;
DROP POLICY IF EXISTS "Insert books" ON public.website_books;
DROP POLICY IF EXISTS "Select books" ON public.website_books;
DROP POLICY IF EXISTS "Update books" ON public.website_books;
DROP POLICY IF EXISTS "website_books_org_all" ON public.website_books;
DROP POLICY IF EXISTS "website_books_org_delete" ON public.website_books;
DROP POLICY IF EXISTS "website_books_org_insert" ON public.website_books;
DROP POLICY IF EXISTS "website_books_org_select" ON public.website_books;
DROP POLICY IF EXISTS "website_books_org_update" ON public.website_books;
DROP POLICY IF EXISTS "website_books_cms_select" ON public.website_books;
CREATE POLICY "website_books_cms_select" ON public.website_books FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "website_books_cms_insert" ON public.website_books;
CREATE POLICY "website_books_cms_insert" ON public.website_books FOR INSERT TO authenticated
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_books_cms_update" ON public.website_books;
CREATE POLICY "website_books_cms_update" ON public.website_books FOR UPDATE TO authenticated
USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_books_cms_delete" ON public.website_books;
CREATE POLICY "website_books_cms_delete" ON public.website_books FOR DELETE TO authenticated
USING (public.is_org_admin(organization_id));

-- website_links: active membership reads; writers edit; preserve admin-only DELETE where present.
DROP POLICY IF EXISTS "Delete links" ON public.website_links;
DROP POLICY IF EXISTS "Insert links" ON public.website_links;
DROP POLICY IF EXISTS "Select links" ON public.website_links;
DROP POLICY IF EXISTS "Update links" ON public.website_links;
DROP POLICY IF EXISTS "website_links_org_delete" ON public.website_links;
DROP POLICY IF EXISTS "website_links_org_insert" ON public.website_links;
DROP POLICY IF EXISTS "website_links_org_select" ON public.website_links;
DROP POLICY IF EXISTS "website_links_org_update" ON public.website_links;
DROP POLICY IF EXISTS "website_links_cms_select" ON public.website_links;
CREATE POLICY "website_links_cms_select" ON public.website_links FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "website_links_cms_insert" ON public.website_links;
CREATE POLICY "website_links_cms_insert" ON public.website_links FOR INSERT TO authenticated
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_links_cms_update" ON public.website_links;
CREATE POLICY "website_links_cms_update" ON public.website_links FOR UPDATE TO authenticated
USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_links_cms_delete" ON public.website_links;
CREATE POLICY "website_links_cms_delete" ON public.website_links FOR DELETE TO authenticated
USING (public.is_org_admin(organization_id));

-- website_book_categories: active membership reads; writers edit; preserve admin-only DELETE where present.
DROP POLICY IF EXISTS "website_book_categories_org_all" ON public.website_book_categories;
DROP POLICY IF EXISTS "website_book_categories_cms_select" ON public.website_book_categories;
CREATE POLICY "website_book_categories_cms_select" ON public.website_book_categories FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "website_book_categories_cms_insert" ON public.website_book_categories;
CREATE POLICY "website_book_categories_cms_insert" ON public.website_book_categories FOR INSERT TO authenticated
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_book_categories_cms_update" ON public.website_book_categories;
CREATE POLICY "website_book_categories_cms_update" ON public.website_book_categories FOR UPDATE TO authenticated
USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_book_categories_cms_delete" ON public.website_book_categories;
CREATE POLICY "website_book_categories_cms_delete" ON public.website_book_categories FOR DELETE TO authenticated
USING (public.is_org_writer(organization_id));

-- website_hero_settings: active membership reads; writers edit; preserve admin-only DELETE where present.
DROP POLICY IF EXISTS "website_hero_settings_org_all" ON public.website_hero_settings;
DROP POLICY IF EXISTS "website_hero_settings_cms_select" ON public.website_hero_settings;
CREATE POLICY "website_hero_settings_cms_select" ON public.website_hero_settings FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "website_hero_settings_cms_insert" ON public.website_hero_settings;
CREATE POLICY "website_hero_settings_cms_insert" ON public.website_hero_settings FOR INSERT TO authenticated
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_hero_settings_cms_update" ON public.website_hero_settings;
CREATE POLICY "website_hero_settings_cms_update" ON public.website_hero_settings FOR UPDATE TO authenticated
USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_hero_settings_cms_delete" ON public.website_hero_settings;
CREATE POLICY "website_hero_settings_cms_delete" ON public.website_hero_settings FOR DELETE TO authenticated
USING (public.is_org_writer(organization_id));

-- website_hero_quick_services: active membership reads; writers edit; preserve admin-only DELETE where present.
DROP POLICY IF EXISTS "website_hero_quick_services_org_all" ON public.website_hero_quick_services;
DROP POLICY IF EXISTS "website_hero_quick_services_cms_select" ON public.website_hero_quick_services;
CREATE POLICY "website_hero_quick_services_cms_select" ON public.website_hero_quick_services FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "website_hero_quick_services_cms_insert" ON public.website_hero_quick_services;
CREATE POLICY "website_hero_quick_services_cms_insert" ON public.website_hero_quick_services FOR INSERT TO authenticated
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_hero_quick_services_cms_update" ON public.website_hero_quick_services;
CREATE POLICY "website_hero_quick_services_cms_update" ON public.website_hero_quick_services FOR UPDATE TO authenticated
USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_hero_quick_services_cms_delete" ON public.website_hero_quick_services;
CREATE POLICY "website_hero_quick_services_cms_delete" ON public.website_hero_quick_services FOR DELETE TO authenticated
USING (public.is_org_writer(organization_id));

-- website_footer_settings: active membership reads; writers edit; preserve admin-only DELETE where present.
DROP POLICY IF EXISTS "website_footer_settings_org_all" ON public.website_footer_settings;
DROP POLICY IF EXISTS "website_footer_settings_cms_select" ON public.website_footer_settings;
CREATE POLICY "website_footer_settings_cms_select" ON public.website_footer_settings FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "website_footer_settings_cms_insert" ON public.website_footer_settings;
CREATE POLICY "website_footer_settings_cms_insert" ON public.website_footer_settings FOR INSERT TO authenticated
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_footer_settings_cms_update" ON public.website_footer_settings;
CREATE POLICY "website_footer_settings_cms_update" ON public.website_footer_settings FOR UPDATE TO authenticated
USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_footer_settings_cms_delete" ON public.website_footer_settings;
CREATE POLICY "website_footer_settings_cms_delete" ON public.website_footer_settings FOR DELETE TO authenticated
USING (public.is_org_writer(organization_id));

-- website_footer_gallery: active membership reads; writers edit; preserve admin-only DELETE where present.
DROP POLICY IF EXISTS "website_footer_gallery_org_all" ON public.website_footer_gallery;
DROP POLICY IF EXISTS "website_footer_gallery_cms_select" ON public.website_footer_gallery;
CREATE POLICY "website_footer_gallery_cms_select" ON public.website_footer_gallery FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "website_footer_gallery_cms_insert" ON public.website_footer_gallery;
CREATE POLICY "website_footer_gallery_cms_insert" ON public.website_footer_gallery FOR INSERT TO authenticated
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_footer_gallery_cms_update" ON public.website_footer_gallery;
CREATE POLICY "website_footer_gallery_cms_update" ON public.website_footer_gallery FOR UPDATE TO authenticated
USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_footer_gallery_cms_delete" ON public.website_footer_gallery;
CREATE POLICY "website_footer_gallery_cms_delete" ON public.website_footer_gallery FOR DELETE TO authenticated
USING (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_book_category_links_org_all" ON public.website_book_category_links;
DROP POLICY IF EXISTS "website_book_category_links_cms_select" ON public.website_book_category_links;
CREATE POLICY "website_book_category_links_cms_select" ON public.website_book_category_links FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.website_books AS book
    WHERE book.id = website_book_category_links.book_id
      AND public.is_org_member(book.organization_id)));

DROP POLICY IF EXISTS "website_book_category_links_cms_insert" ON public.website_book_category_links;
CREATE POLICY "website_book_category_links_cms_insert" ON public.website_book_category_links FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.website_books AS book
    WHERE book.id = website_book_category_links.book_id
      AND public.is_org_writer(book.organization_id)
      AND (website_book_category_links.category_id IS NULL OR EXISTS (
          SELECT 1 FROM public.website_book_categories AS category
          WHERE category.id = website_book_category_links.category_id
            AND category.organization_id = book.organization_id))));

DROP POLICY IF EXISTS "website_book_category_links_cms_update" ON public.website_book_category_links;
CREATE POLICY "website_book_category_links_cms_update" ON public.website_book_category_links FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.website_books AS book
    WHERE book.id = website_book_category_links.book_id
      AND public.is_org_writer(book.organization_id)
      AND (website_book_category_links.category_id IS NULL OR EXISTS (
          SELECT 1 FROM public.website_book_categories AS category
          WHERE category.id = website_book_category_links.category_id
            AND category.organization_id = book.organization_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.website_books AS book
    WHERE book.id = website_book_category_links.book_id
      AND public.is_org_writer(book.organization_id)
      AND (website_book_category_links.category_id IS NULL OR EXISTS (
          SELECT 1 FROM public.website_book_categories AS category
          WHERE category.id = website_book_category_links.category_id
            AND category.organization_id = book.organization_id))));

DROP POLICY IF EXISTS "website_book_category_links_cms_delete" ON public.website_book_category_links;
CREATE POLICY "website_book_category_links_cms_delete" ON public.website_book_category_links FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.website_books AS book
    WHERE book.id = website_book_category_links.book_id
      AND public.is_org_writer(book.organization_id)));

-- Public associations must not disclose private/inactive parents or cross-tenant
-- relationships. Keep existing public role set and existing publication semantics.
ALTER POLICY website_book_category_links_public_read ON public.website_book_category_links
USING (EXISTS (
    SELECT 1 FROM public.website_books AS book
    JOIN public.website_book_categories AS category
      ON category.id = website_book_category_links.category_id
     AND category.organization_id = book.organization_id
    WHERE book.id = website_book_category_links.book_id
      AND book.active IS DISTINCT FROM false
      AND book.visible IS DISTINCT FROM false
      AND category.active = true
));

-- website_exchange_rates already has public active SELECT and active-admin ALL
-- from Security 01. Retain both unchanged: a writer is NOT necessarily an admin.
-- website_leads is intake, not ordinary CMS: no public SELECT or general guard.

DROP POLICY IF EXISTS "website_leads_org_update" ON public.website_leads;
DROP POLICY IF EXISTS "website_leads_public_insert" ON public.website_leads;
-- The baseline already defaults public intake to this Noveli tenant. Pin it,
-- rather than trusting a client-selected organization. Existing form fields and
-- explicit initial defaults remain accepted. No INSERT RETURNING/SELECT grant.
-- A different public-tenant deployment requires a deliberate configuration change.
-- No assigned_to column exists in the baseline. Timestamps/source/consent remain
-- client-submitted for compatibility; rate limiting/CAPTCHA is a separate phase.

DROP POLICY IF EXISTS "website_leads_public_submit" ON public.website_leads;
CREATE POLICY "website_leads_public_submit" ON public.website_leads FOR INSERT TO anon, authenticated
WITH CHECK (organization_id = '11111111-1111-1111-1111-111111111111'::uuid
    AND status IS NOT DISTINCT FROM 'nuevo'::text
    AND notes IS NULL
    AND converted_to_proposal IS NOT DISTINCT FROM false
    AND converted_quotation_id IS NULL
    AND converted_to_prospect IS NOT DISTINCT FROM false
    AND converted_prospect_id IS NULL
    AND is_test IS NOT DISTINCT FROM false
    AND test_run_id IS NULL);

DROP POLICY IF EXISTS "website_leads_internal_insert" ON public.website_leads;
CREATE POLICY "website_leads_internal_insert" ON public.website_leads FOR INSERT TO authenticated
WITH CHECK (public.is_org_writer(organization_id));

DROP POLICY IF EXISTS "website_leads_internal_update" ON public.website_leads;
CREATE POLICY "website_leads_internal_update" ON public.website_leads FOR UPDATE TO authenticated
USING (public.is_org_writer(organization_id))
WITH CHECK (public.is_org_writer(organization_id));

-- Existing website_leads_org_select (active member) and _org_delete (admin)
-- remain unchanged. No data migration or default/column changes are necessary.
