-- Security 03B: scoped commercial/editorial consolidation. No financial policies/data changed.
-- Keep all Security 02 restrictive guards. See docs/noveli-2/security-03b-validation.md.
BEGIN;

-- Parent tenant reassignment would invalidate otherwise valid child references.
-- SECURITY INVOKER: no privilege elevation, no table access; applies to these 15 tables only.
CREATE OR REPLACE FUNCTION public.security03b_preserve_tenant() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Security 03B: organization_id is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.security03b_preserve_tenant() FROM PUBLIC, anon, authenticated;

-- clients
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
DROP POLICY IF EXISTS "clients_org_delete" ON public.clients;
DROP POLICY IF EXISTS "clients_org_insert" ON public.clients;
DROP POLICY IF EXISTS "clients_org_select" ON public.clients;
DROP POLICY IF EXISTS "clients_org_update" ON public.clients;
DROP POLICY IF EXISTS security03b_select ON public.clients;
DROP POLICY IF EXISTS security03b_insert ON public.clients;
DROP POLICY IF EXISTS security03b_update ON public.clients;
DROP POLICY IF EXISTS security03b_delete ON public.clients;
CREATE POLICY security03b_select ON public.clients FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.clients FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id));
CREATE POLICY security03b_update ON public.clients FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id));
CREATE POLICY security03b_delete ON public.clients FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.clients;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.clients FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- prospects
DROP POLICY IF EXISTS "Users can manage their own prospects" ON public.prospects;
DROP POLICY IF EXISTS "prospects_org_delete" ON public.prospects;
DROP POLICY IF EXISTS "prospects_org_insert" ON public.prospects;
DROP POLICY IF EXISTS "prospects_org_select" ON public.prospects;
DROP POLICY IF EXISTS "prospects_org_update" ON public.prospects;
DROP POLICY IF EXISTS security03b_select ON public.prospects;
DROP POLICY IF EXISTS security03b_insert ON public.prospects;
DROP POLICY IF EXISTS security03b_update ON public.prospects;
DROP POLICY IF EXISTS security03b_delete ON public.prospects;
CREATE POLICY security03b_select ON public.prospects FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.prospects FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id)
  AND (converted_client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = prospects.converted_client_id AND parent.organization_id = prospects.organization_id))
  AND (converted_to_client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = prospects.converted_to_client_id AND parent.organization_id = prospects.organization_id)));
CREATE POLICY security03b_update ON public.prospects FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id)
  AND (converted_client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = prospects.converted_client_id AND parent.organization_id = prospects.organization_id))
  AND (converted_to_client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = prospects.converted_to_client_id AND parent.organization_id = prospects.organization_id)));
CREATE POLICY security03b_delete ON public.prospects FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.prospects;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- quotations
DROP POLICY IF EXISTS "Users can manage their own quotations" ON public.quotations;
DROP POLICY IF EXISTS "quotations_org_delete" ON public.quotations;
DROP POLICY IF EXISTS "quotations_org_insert" ON public.quotations;
DROP POLICY IF EXISTS "quotations_org_select" ON public.quotations;
DROP POLICY IF EXISTS "quotations_org_update" ON public.quotations;
DROP POLICY IF EXISTS security03b_select ON public.quotations;
DROP POLICY IF EXISTS security03b_insert ON public.quotations;
DROP POLICY IF EXISTS security03b_update ON public.quotations;
DROP POLICY IF EXISTS security03b_delete ON public.quotations;
CREATE POLICY security03b_select ON public.quotations FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.quotations FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id)
  AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = quotations.client_id AND parent.organization_id = quotations.organization_id))
  AND (prospect_id IS NULL OR EXISTS (SELECT 1 FROM public.prospects AS parent WHERE parent.id = quotations.prospect_id AND parent.organization_id = quotations.organization_id))
  AND (converted_client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = quotations.converted_client_id AND parent.organization_id = quotations.organization_id))
  AND (converted_prospect_id IS NULL OR EXISTS (SELECT 1 FROM public.prospects AS parent WHERE parent.id = quotations.converted_prospect_id AND parent.organization_id = quotations.organization_id))
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services AS parent WHERE parent.id = quotations.service_id AND parent.organization_id = quotations.organization_id)));
CREATE POLICY security03b_update ON public.quotations FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id)
  AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = quotations.client_id AND parent.organization_id = quotations.organization_id))
  AND (prospect_id IS NULL OR EXISTS (SELECT 1 FROM public.prospects AS parent WHERE parent.id = quotations.prospect_id AND parent.organization_id = quotations.organization_id))
  AND (converted_client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = quotations.converted_client_id AND parent.organization_id = quotations.organization_id))
  AND (converted_prospect_id IS NULL OR EXISTS (SELECT 1 FROM public.prospects AS parent WHERE parent.id = quotations.converted_prospect_id AND parent.organization_id = quotations.organization_id))
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services AS parent WHERE parent.id = quotations.service_id AND parent.organization_id = quotations.organization_id)));
CREATE POLICY security03b_delete ON public.quotations FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.quotations;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- quotation_items
DROP POLICY IF EXISTS "Users can manage their own quotation_items" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_org_delete" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_org_insert" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_org_select" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_org_update" ON public.quotation_items;
DROP POLICY IF EXISTS security03b_select ON public.quotation_items;
DROP POLICY IF EXISTS security03b_insert ON public.quotation_items;
DROP POLICY IF EXISTS security03b_update ON public.quotation_items;
DROP POLICY IF EXISTS security03b_delete ON public.quotation_items;
CREATE POLICY security03b_select ON public.quotation_items FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.quotation_items FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id)
  AND (quotation_id IS NULL OR EXISTS (SELECT 1 FROM public.quotations AS parent WHERE parent.id = quotation_items.quotation_id AND parent.organization_id = quotation_items.organization_id))
  AND (catalog_id IS NULL OR EXISTS (SELECT 1 FROM public.service_catalog AS parent WHERE parent.id = quotation_items.catalog_id AND parent.organization_id = quotation_items.organization_id))
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.service_catalog AS parent WHERE parent.id = quotation_items.service_id AND parent.organization_id = quotation_items.organization_id))
  AND (pack_id IS NULL OR EXISTS (SELECT 1 FROM public.service_packs AS parent WHERE parent.id = quotation_items.pack_id AND parent.organization_id = quotation_items.organization_id)));
CREATE POLICY security03b_update ON public.quotation_items FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id)
  AND (quotation_id IS NULL OR EXISTS (SELECT 1 FROM public.quotations AS parent WHERE parent.id = quotation_items.quotation_id AND parent.organization_id = quotation_items.organization_id))
  AND (catalog_id IS NULL OR EXISTS (SELECT 1 FROM public.service_catalog AS parent WHERE parent.id = quotation_items.catalog_id AND parent.organization_id = quotation_items.organization_id))
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.service_catalog AS parent WHERE parent.id = quotation_items.service_id AND parent.organization_id = quotation_items.organization_id))
  AND (pack_id IS NULL OR EXISTS (SELECT 1 FROM public.service_packs AS parent WHERE parent.id = quotation_items.pack_id AND parent.organization_id = quotation_items.organization_id)));
CREATE POLICY security03b_delete ON public.quotation_items FOR DELETE TO authenticated USING (public.is_org_writer(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.quotation_items;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.quotation_items FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- providers
DROP POLICY IF EXISTS "Users can manage their own providers" ON public.providers;
DROP POLICY IF EXISTS security03b_select ON public.providers;
DROP POLICY IF EXISTS security03b_insert ON public.providers;
DROP POLICY IF EXISTS security03b_update ON public.providers;
DROP POLICY IF EXISTS security03b_delete ON public.providers;
CREATE POLICY security03b_select ON public.providers FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.providers FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id));
CREATE POLICY security03b_update ON public.providers FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id));
CREATE POLICY security03b_delete ON public.providers FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.providers;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.providers FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- services
DROP POLICY IF EXISTS "Users can manage their own services" ON public.services;
DROP POLICY IF EXISTS "services_org_delete" ON public.services;
DROP POLICY IF EXISTS "services_org_insert" ON public.services;
DROP POLICY IF EXISTS "services_org_select" ON public.services;
DROP POLICY IF EXISTS "services_org_update" ON public.services;
DROP POLICY IF EXISTS security03b_select ON public.services;
DROP POLICY IF EXISTS security03b_insert ON public.services;
DROP POLICY IF EXISTS security03b_update ON public.services;
DROP POLICY IF EXISTS security03b_delete ON public.services;
CREATE POLICY security03b_select ON public.services FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.services FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id)
  AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = services.client_id AND parent.organization_id = services.organization_id)));
CREATE POLICY security03b_update ON public.services FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id)
  AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = services.client_id AND parent.organization_id = services.organization_id)));
CREATE POLICY security03b_delete ON public.services FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.services;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.services FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- service_catalog
DROP POLICY IF EXISTS "Users can manage their own service_catalog" ON public.service_catalog;
DROP POLICY IF EXISTS "service_catalog_org_access" ON public.service_catalog;
DROP POLICY IF EXISTS "service_catalog_org_delete" ON public.service_catalog;
DROP POLICY IF EXISTS "service_catalog_org_insert" ON public.service_catalog;
DROP POLICY IF EXISTS "service_catalog_org_select" ON public.service_catalog;
DROP POLICY IF EXISTS "service_catalog_org_update" ON public.service_catalog;
DROP POLICY IF EXISTS security03b_select ON public.service_catalog;
DROP POLICY IF EXISTS security03b_insert ON public.service_catalog;
DROP POLICY IF EXISTS security03b_update ON public.service_catalog;
DROP POLICY IF EXISTS security03b_delete ON public.service_catalog;
CREATE POLICY security03b_select ON public.service_catalog FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.service_catalog FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id));
CREATE POLICY security03b_update ON public.service_catalog FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id));
CREATE POLICY security03b_delete ON public.service_catalog FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.service_catalog;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.service_catalog FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- service_packs
DROP POLICY IF EXISTS "Users can manage their own service_packs" ON public.service_packs;
DROP POLICY IF EXISTS "service_packs_org_access" ON public.service_packs;
DROP POLICY IF EXISTS "service_packs_org_delete" ON public.service_packs;
DROP POLICY IF EXISTS "service_packs_org_insert" ON public.service_packs;
DROP POLICY IF EXISTS "service_packs_org_select" ON public.service_packs;
DROP POLICY IF EXISTS "service_packs_org_update" ON public.service_packs;
DROP POLICY IF EXISTS security03b_select ON public.service_packs;
DROP POLICY IF EXISTS security03b_insert ON public.service_packs;
DROP POLICY IF EXISTS security03b_update ON public.service_packs;
DROP POLICY IF EXISTS security03b_delete ON public.service_packs;
CREATE POLICY security03b_select ON public.service_packs FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.service_packs FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id));
CREATE POLICY security03b_update ON public.service_packs FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id));
CREATE POLICY security03b_delete ON public.service_packs FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.service_packs;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.service_packs FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- service_pack_items
DROP POLICY IF EXISTS "Users can manage their own service_pack_items" ON public.service_pack_items;
DROP POLICY IF EXISTS security03b_select ON public.service_pack_items;
DROP POLICY IF EXISTS security03b_insert ON public.service_pack_items;
DROP POLICY IF EXISTS security03b_update ON public.service_pack_items;
DROP POLICY IF EXISTS security03b_delete ON public.service_pack_items;
CREATE POLICY security03b_select ON public.service_pack_items FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.service_pack_items FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id)
  AND (pack_id IS NULL OR EXISTS (SELECT 1 FROM public.service_packs AS parent WHERE parent.id = service_pack_items.pack_id AND parent.organization_id = service_pack_items.organization_id))
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.service_catalog AS parent WHERE parent.id = service_pack_items.service_id AND parent.organization_id = service_pack_items.organization_id)));
CREATE POLICY security03b_update ON public.service_pack_items FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id)
  AND (pack_id IS NULL OR EXISTS (SELECT 1 FROM public.service_packs AS parent WHERE parent.id = service_pack_items.pack_id AND parent.organization_id = service_pack_items.organization_id))
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.service_catalog AS parent WHERE parent.id = service_pack_items.service_id AND parent.organization_id = service_pack_items.organization_id)));
CREATE POLICY security03b_delete ON public.service_pack_items FOR DELETE TO authenticated USING (public.is_org_writer(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.service_pack_items;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.service_pack_items FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- service_checklists
DROP POLICY IF EXISTS "Users can manage their own service_checklists" ON public.service_checklists;
DROP POLICY IF EXISTS security03b_select ON public.service_checklists;
DROP POLICY IF EXISTS security03b_insert ON public.service_checklists;
DROP POLICY IF EXISTS security03b_update ON public.service_checklists;
DROP POLICY IF EXISTS security03b_delete ON public.service_checklists;
CREATE POLICY security03b_select ON public.service_checklists FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.service_checklists FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id)
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services AS parent WHERE parent.id = service_checklists.service_id AND parent.organization_id = service_checklists.organization_id)));
CREATE POLICY security03b_update ON public.service_checklists FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id)
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services AS parent WHERE parent.id = service_checklists.service_id AND parent.organization_id = service_checklists.organization_id)));
CREATE POLICY security03b_delete ON public.service_checklists FOR DELETE TO authenticated USING (public.is_org_writer(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.service_checklists;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.service_checklists FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- service_stages
DROP POLICY IF EXISTS "Users can manage their own service_stages" ON public.service_stages;
DROP POLICY IF EXISTS "service_stages_org_delete" ON public.service_stages;
DROP POLICY IF EXISTS "service_stages_org_insert" ON public.service_stages;
DROP POLICY IF EXISTS "service_stages_org_select" ON public.service_stages;
DROP POLICY IF EXISTS "service_stages_org_update" ON public.service_stages;
DROP POLICY IF EXISTS security03b_select ON public.service_stages;
DROP POLICY IF EXISTS security03b_insert ON public.service_stages;
DROP POLICY IF EXISTS security03b_update ON public.service_stages;
DROP POLICY IF EXISTS security03b_delete ON public.service_stages;
CREATE POLICY security03b_select ON public.service_stages FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.service_stages FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id)
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services AS parent WHERE parent.id = service_stages.service_id AND parent.organization_id = service_stages.organization_id)));
CREATE POLICY security03b_update ON public.service_stages FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id)
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services AS parent WHERE parent.id = service_stages.service_id AND parent.organization_id = service_stages.organization_id)));
CREATE POLICY security03b_delete ON public.service_stages FOR DELETE TO authenticated USING (public.is_org_writer(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.service_stages;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.service_stages FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- editorial_stages
DROP POLICY IF EXISTS "Users can manage their own editorial_stages" ON public.editorial_stages;
DROP POLICY IF EXISTS security03b_select ON public.editorial_stages;
DROP POLICY IF EXISTS security03b_insert ON public.editorial_stages;
DROP POLICY IF EXISTS security03b_update ON public.editorial_stages;
DROP POLICY IF EXISTS security03b_delete ON public.editorial_stages;
CREATE POLICY security03b_select ON public.editorial_stages FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.editorial_stages FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id));
CREATE POLICY security03b_update ON public.editorial_stages FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id));
CREATE POLICY security03b_delete ON public.editorial_stages FOR DELETE TO authenticated USING (public.is_org_writer(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.editorial_stages;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.editorial_stages FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- documents
DROP POLICY IF EXISTS "Users can manage their own documents" ON public.documents;
DROP POLICY IF EXISTS "documents_org_delete" ON public.documents;
DROP POLICY IF EXISTS "documents_org_insert" ON public.documents;
DROP POLICY IF EXISTS "documents_org_select" ON public.documents;
DROP POLICY IF EXISTS "documents_org_update" ON public.documents;
DROP POLICY IF EXISTS security03b_select ON public.documents;
DROP POLICY IF EXISTS security03b_insert ON public.documents;
DROP POLICY IF EXISTS security03b_update ON public.documents;
DROP POLICY IF EXISTS security03b_delete ON public.documents;
CREATE POLICY security03b_select ON public.documents FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id)
  AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = documents.client_id AND parent.organization_id = documents.organization_id))
  AND (provider_id IS NULL OR EXISTS (SELECT 1 FROM public.providers AS parent WHERE parent.id = documents.provider_id AND parent.organization_id = documents.organization_id))
  AND (income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes AS parent WHERE parent.id = documents.income_id AND parent.organization_id = documents.organization_id))
  AND (expense_id IS NULL OR EXISTS (SELECT 1 FROM public.expenses AS parent WHERE parent.id = documents.expense_id AND parent.organization_id = documents.organization_id))
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services AS parent WHERE parent.id = documents.service_id AND parent.organization_id = documents.organization_id))
  AND (quotation_id IS NULL OR EXISTS (SELECT 1 FROM public.quotations AS parent WHERE parent.id = documents.quotation_id AND parent.organization_id = documents.organization_id)));
CREATE POLICY security03b_update ON public.documents FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id)
  AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = documents.client_id AND parent.organization_id = documents.organization_id))
  AND (provider_id IS NULL OR EXISTS (SELECT 1 FROM public.providers AS parent WHERE parent.id = documents.provider_id AND parent.organization_id = documents.organization_id))
  AND (income_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes AS parent WHERE parent.id = documents.income_id AND parent.organization_id = documents.organization_id))
  AND (expense_id IS NULL OR EXISTS (SELECT 1 FROM public.expenses AS parent WHERE parent.id = documents.expense_id AND parent.organization_id = documents.organization_id))
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services AS parent WHERE parent.id = documents.service_id AND parent.organization_id = documents.organization_id))
  AND (quotation_id IS NULL OR EXISTS (SELECT 1 FROM public.quotations AS parent WHERE parent.id = documents.quotation_id AND parent.organization_id = documents.organization_id)));
CREATE POLICY security03b_delete ON public.documents FOR DELETE TO authenticated USING (public.is_org_writer(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.documents;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.documents FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- agenda_events
DROP POLICY IF EXISTS "Users can manage their own agenda_events" ON public.agenda_events;
DROP POLICY IF EXISTS security03b_select ON public.agenda_events;
DROP POLICY IF EXISTS security03b_insert ON public.agenda_events;
DROP POLICY IF EXISTS security03b_update ON public.agenda_events;
DROP POLICY IF EXISTS security03b_delete ON public.agenda_events;
CREATE POLICY security03b_select ON public.agenda_events FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.agenda_events FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id)
  AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = agenda_events.client_id AND parent.organization_id = agenda_events.organization_id))
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services AS parent WHERE parent.id = agenda_events.service_id AND parent.organization_id = agenda_events.organization_id))
  AND (stage_id IS NULL OR EXISTS (SELECT 1 FROM public.service_stages AS parent WHERE parent.id = agenda_events.stage_id AND parent.organization_id = agenda_events.organization_id)));
CREATE POLICY security03b_update ON public.agenda_events FOR UPDATE TO authenticated USING (public.is_org_writer(organization_id)) WITH CHECK (public.is_org_writer(organization_id)
  AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients AS parent WHERE parent.id = agenda_events.client_id AND parent.organization_id = agenda_events.organization_id))
  AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services AS parent WHERE parent.id = agenda_events.service_id AND parent.organization_id = agenda_events.organization_id))
  AND (stage_id IS NULL OR EXISTS (SELECT 1 FROM public.service_stages AS parent WHERE parent.id = agenda_events.stage_id AND parent.organization_id = agenda_events.organization_id)));
CREATE POLICY security03b_delete ON public.agenda_events FOR DELETE TO authenticated USING (public.is_org_writer(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.agenda_events;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.agenda_events FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

-- activity_log
DROP POLICY IF EXISTS "Users can manage their own activity_log" ON public.activity_log;
DROP POLICY IF EXISTS security03b_select ON public.activity_log;
DROP POLICY IF EXISTS security03b_insert ON public.activity_log;
DROP POLICY IF EXISTS security03b_update ON public.activity_log;
DROP POLICY IF EXISTS security03b_delete ON public.activity_log;
CREATE POLICY security03b_select ON public.activity_log FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY security03b_insert ON public.activity_log FOR INSERT TO authenticated WITH CHECK (public.is_org_writer(organization_id)
  AND user_id = (SELECT auth.uid()));
-- Normal writers append only; admin maintenance may correct events from any author in its tenant.
CREATE POLICY security03b_update ON public.activity_log FOR UPDATE TO authenticated USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));
CREATE POLICY security03b_delete ON public.activity_log FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
DROP TRIGGER IF EXISTS security03b_preserve_tenant ON public.activity_log;
CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.activity_log FOR EACH ROW EXECUTE FUNCTION public.security03b_preserve_tenant();

COMMIT;
