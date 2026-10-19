-- Phase 1A C: explicit accepted revisions and atomic conversion.
BEGIN;
GRANT CREATE ON SCHEMA noveli_private TO noveli_orders_executor;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.quotation_items TO noveli_orders_executor;
GRANT SELECT,UPDATE ON public.quotations TO noveli_orders_executor;
CREATE POLICY phase1a_executor_quotes ON public.quotations TO noveli_orders_executor USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));
CREATE POLICY phase1a_executor_quote_items ON public.quotation_items TO noveli_orders_executor USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));

-- Statement-level mutex is acquired BEFORE row locks, including legacy writes.
-- Conservative low-volume quotation domain: no child-row/parent-row inversion.
CREATE FUNCTION noveli_private.quotation_write_barrier() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN PERFORM pg_advisory_xact_lock(184101,1); RETURN NULL; END $$;
CREATE TRIGGER phase1a_quote_write_barrier BEFORE INSERT OR UPDATE OR DELETE ON public.quotations FOR EACH STATEMENT EXECUTE FUNCTION noveli_private.quotation_write_barrier();
CREATE TRIGGER phase1a_item_write_barrier BEFORE INSERT OR UPDATE OR DELETE ON public.quotation_items FOR EACH STATEMENT EXECUTE FUNCTION noveli_private.quotation_write_barrier();

CREATE TABLE noveli_private.quotation_acceptance_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,quotation_id uuid NOT NULL,revision_no integer NOT NULL CHECK(revision_no>0),
 client_id uuid NOT NULL,accepted_at timestamptz NOT NULL,accepted_by uuid NOT NULL REFERENCES auth.users(id),
 acceptance_evidence jsonb NOT NULL CHECK(jsonb_typeof(acceptance_evidence)='object' AND acceptance_evidence<>'{}'),
 canonical_pricing_version smallint NOT NULL DEFAULT 1 CHECK(canonical_pricing_version=1),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),snapshot_sha256 text NOT NULL CHECK(length(snapshot_sha256)=64),
 legacy_source_fingerprint text NOT NULL CHECK(length(legacy_source_fingerprint)=64),
 created_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES auth.users(id),
 UNIQUE(organization_id,quotation_id,revision_no),UNIQUE(organization_id,quotation_id,id),
 FOREIGN KEY(organization_id,quotation_id) REFERENCES public.quotations(organization_id,id),
 FOREIGN KEY(organization_id,client_id) REFERENCES public.clients(organization_id,id)
);
ALTER TABLE noveli_private.quotation_acceptance_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON noveli_private.quotation_acceptance_snapshots FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON noveli_private.quotation_acceptance_snapshots TO noveli_orders_executor;
CREATE POLICY phase1a_snapshots ON noveli_private.quotation_acceptance_snapshots TO noveli_orders_executor USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));
CREATE FUNCTION noveli_private.snapshot_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Phase1A: acceptance snapshot immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER phase1a_snapshot_immutable BEFORE UPDATE OR DELETE ON noveli_private.quotation_acceptance_snapshots FOR EACH ROW EXECUTE FUNCTION noveli_private.snapshot_immutable();
ALTER TABLE public.orders ADD CONSTRAINT phase1a_order_acceptance_revision
 FOREIGN KEY(organization_id,quotation_id,quotation_acceptance_snapshot_id) REFERENCES noveli_private.quotation_acceptance_snapshots(organization_id,quotation_id,id);
CREATE INDEX phase1a_orders_snapshot ON public.orders(organization_id,quotation_id,quotation_acceptance_snapshot_id);

CREATE FUNCTION noveli_private.quotation_fingerprint(org uuid,qid uuid) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('header',to_jsonb(q),'items',
 (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.display_order,i.id),'[]') FROM public.quotation_items i WHERE i.quotation_id=q.id))::text,'UTF8')),'hex')
 FROM public.quotations q WHERE q.id=qid AND q.organization_id=org
$$;

-- One explicit versioned adapter, no fallback to price/gross_amount/includes_vat.
CREATE FUNCTION noveli_private.normalize_quotation(org uuid,qid uuid,check_total boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE q public.quotations; x record; raw_sub numeric; adjust numeric; raw_base numeric; raw_discount numeric;
 rate numeric; mode text; places integer; quantum numeric; base_net numeric; after_net numeric; net_discount numeric;
 legacy_total numeric; legacy_tax numeric; items jsonb:='[]'; priced jsonb; allocation numeric; u numeric; residual numeric;
BEGIN
 SELECT * INTO STRICT q FROM public.quotations WHERE organization_id=org AND id=qid;
 places:=noveli_private.currency_scale(q.currency); quantum:=power(10::numeric,-places);
 IF NOT EXISTS(SELECT FROM public.quotation_items WHERE quotation_id=qid) OR EXISTS(SELECT FROM public.quotation_items WHERE quotation_id=qid AND organization_id IS DISTINCT FROM org) THEN
  RAISE EXCEPTION 'Phase1A: missing/cross-tenant quotation items' USING ERRCODE='23514'; END IF;
 SELECT sum(noveli_private.decimal_value(unit_price::text,12)*noveli_private.decimal_value(quantity::text,3,999999999.999)) INTO raw_sub FROM public.quotation_items WHERE quotation_id=qid;
 adjust:=noveli_private.decimal_value(q.extension_adjustment_value::text,4);
 IF lower(coalesce(q.extension_adjustment_type,'')) IN('percentage','percent','porcentaje','ajuste porcentaje (%)') THEN adjust:=round(raw_sub*adjust/100,0); END IF;
 raw_base:=raw_sub+adjust; raw_discount:=noveli_private.decimal_value(q.discount::text,places);
 IF raw_discount>raw_base OR (raw_sub=0 AND raw_base<>0) THEN RAISE EXCEPTION 'Phase1A: ambiguous/empty legacy pricing' USING ERRCODE='23514'; END IF;
 rate:=noveli_private.decimal_value(q.tax_rate::text,4,100);
 mode:=q.iva_mode;
 IF mode IN('included','IVA incluido') THEN
  base_net:=round(raw_base/(1+rate/100),places);
  after_net:=round((raw_base-raw_discount)/(1+rate/100),places);
  legacy_total:=raw_base-raw_discount; legacy_tax:=legacy_total-after_net; mode:='included';
 ELSIF mode IN('plus','+ IVA') THEN
  base_net:=raw_base;after_net:=raw_base-raw_discount;legacy_tax:=round(after_net*rate/100,places);legacy_total:=after_net+legacy_tax;mode:='added';
 ELSIF mode IN('exempt','Exento / sin IVA','Exento','exento') THEN
  rate:=0;base_net:=raw_base;after_net:=raw_base-raw_discount;legacy_total:=after_net;legacy_tax:=0;mode:='exempt';
 ELSE RAISE EXCEPTION 'Phase1A: unknown legacy tax mode' USING ERRCODE='23514';
 END IF;
 net_discount:=base_net-after_net;
 FOR x IN
  WITH src AS(SELECT i.*,i.unit_price*i.quantity weight FROM public.quotation_items i WHERE quotation_id=qid),
  shares AS(SELECT *,CASE WHEN raw_sub=0 THEN 0 ELSE base_net/quantum*weight/raw_sub END units FROM src),
  ranked AS(SELECT *,row_number() OVER(ORDER BY units-floor(units) DESC,display_order,id) rn,base_net/quantum-sum(floor(units)) OVER() remaining FROM shares)
  SELECT *,(floor(units)+CASE WHEN rn<=remaining THEN 1 ELSE 0 END)*quantum allocated FROM ranked ORDER BY display_order,id
 LOOP
  IF x.quantity<=0 OR nullif(btrim(coalesce(x.concept,x.custom_name)), '') IS NULL OR
   (x.catalog_id IS NOT NULL AND x.service_id IS NOT NULL AND x.catalog_id<>x.service_id) THEN
   RAISE EXCEPTION 'Phase1A: ambiguous item identity/quantity' USING ERRCODE='23514'; END IF;
  allocation:=x.allocated; u:=round(allocation/x.quantity,12);residual:=allocation-round(u*x.quantity,places);
  items:=items||jsonb_build_array(jsonb_build_object('name',coalesce(x.concept,x.custom_name),'description',coalesce(x.description,''),'quantity',x.quantity,'unit_price',u,
   'rounding_adjustment',residual,'tax_rate',rate,'tax_mode',mode,'catalog_id',coalesce(x.catalog_id,x.service_id),'pack_id',x.pack_id,'source_quotation_item_id',x.id,
   'pricing_metadata',jsonb_build_object('schema_version',1,'original_unit_price',x.unit_price,'original_tax_mode',q.iva_mode,'original_tax_rate',q.tax_rate,
    'extension_adjustment',adjust,'provenance','quotation_adapter_v1')));
 END LOOP;
 priced:=noveli_private.price(q.currency,noveli_private.enrich_items(org,items),net_discount::text);
 IF (priced->>'total')::numeric<>legacy_total OR (check_total AND q.total IS DISTINCT FROM legacy_total) THEN
  RAISE EXCEPTION 'Phase1A: accepted totals cannot be reconciled' USING ERRCODE='23514';
 END IF;
 priced:=priced||jsonb_build_object('quotation_terms',jsonb_build_object(
  'object',q.object,'payment_terms',q.payment_terms,'work_timeline',q.work_timeline,'scope_notes',q.scope_notes,
  'includes_notes',q.includes_notes,'excludes_notes',q.excludes_notes,'start_conditions',q.start_conditions,
  'legal_notes',q.legal_notes,'other_notes',q.other_notes));
 RETURN jsonb_build_object('pricing',priced,'source_subtotal',raw_sub,'legacy_total',legacy_total,'legacy_tax',legacy_tax,'legacy_net',after_net);
END $$;

CREATE FUNCTION noveli_private.quotation_review_source(org uuid,qid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.quotations;
BEGIN
 PERFORM noveli_private.authorize(org,ARRAY['admin','editor'],'quotation_conversion');
 PERFORM pg_advisory_xact_lock(184101,1);
 SELECT * INTO STRICT q FROM public.quotations WHERE organization_id=org AND id=qid FOR UPDATE;
 RETURN jsonb_build_object('quotation_id',qid,'fingerprint',noveli_private.quotation_fingerprint(org,qid),'header',to_jsonb(q),
 'items',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY display_order,id),'[]') FROM public.quotation_items i WHERE quotation_id=qid));
END $$;

CREATE FUNCTION noveli_private.review_and_accept_quotation(org uuid,qid uuid,client uuid,evidence jsonb,expected_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.quotations; normalized jsonb; fingerprint text; rev integer; s noveli_private.quotation_acceptance_snapshots;
BEGIN
 PERFORM noveli_private.authorize(org,ARRAY['admin','editor'],'quotation_conversion');
 PERFORM pg_advisory_xact_lock(184101,1);
 SELECT * INTO STRICT q FROM public.quotations WHERE organization_id=org AND id=qid FOR UPDATE;
 fingerprint:=noveli_private.quotation_fingerprint(org,qid);
 IF fingerprint IS DISTINCT FROM expected_fingerprint THEN RAISE EXCEPTION 'Phase1A: stale quotation review' USING ERRCODE='40001'; END IF;
 IF q.status<>'aceptada' OR q.accepted_at IS NULL OR q.accepted_at>now() OR jsonb_typeof(evidence)<>'object' OR evidence='{}' THEN RAISE EXCEPTION 'Phase1A: acceptance/evidence required' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT FROM public.clients WHERE id=client AND organization_id=org) OR (q.client_id IS NOT NULL AND q.client_id<>client) THEN RAISE EXCEPTION 'Phase1A: ambiguous client' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT FROM public.orders WHERE organization_id=org AND quotation_id=qid) THEN RAISE EXCEPTION 'Phase1A: quotation already converted' USING ERRCODE='23505'; END IF;
 normalized:=noveli_private.normalize_quotation(org,qid);
 SELECT * INTO s FROM noveli_private.quotation_acceptance_snapshots WHERE organization_id=org AND quotation_id=qid ORDER BY revision_no DESC LIMIT 1;
 IF FOUND AND s.legacy_source_fingerprint=fingerprint AND s.client_id=client AND s.acceptance_evidence=evidence THEN
  RETURN jsonb_build_object('id',s.id,'snapshot_sha256',s.snapshot_sha256,'revision_no',s.revision_no);
 END IF;
 rev:=coalesce(s.revision_no,0)+1;
 INSERT INTO noveli_private.quotation_acceptance_snapshots(organization_id,quotation_id,revision_no,client_id,accepted_at,accepted_by,acceptance_evidence,snapshot,snapshot_sha256,legacy_source_fingerprint,created_by)
 VALUES(org,qid,rev,client,q.accepted_at,noveli_private.actor_uid(),evidence,normalized->'pricing',encode(sha256(convert_to((normalized->'pricing')::text,'UTF8')),'hex'),fingerprint,noveli_private.actor_uid()) RETURNING * INTO s;
 INSERT INTO public.activity_log(organization_id,user_id,module,action,description,entity_id) VALUES(org,noveli_private.actor_uid(),'quotations','accepted_revision','Canonical acceptance revision '||rev,qid);
 RETURN jsonb_build_object('id',s.id,'snapshot_sha256',s.snapshot_sha256,'revision_no',rev);
END $$;

CREATE FUNCTION noveli_private.save_and_accept_quotation(org uuid,qid uuid,client uuid,header jsonb,items jsonb,evidence jsonb,expected_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.quotations; x jsonb; normalized jsonb; pos integer:=0;
BEGIN
 PERFORM noveli_private.authorize(org,ARRAY['admin','editor'],'quotation_conversion');
 PERFORM pg_advisory_xact_lock(184101,1);
 SELECT * INTO STRICT q FROM public.quotations WHERE organization_id=org AND id=qid FOR UPDATE;
 IF noveli_private.quotation_fingerprint(org,qid) IS DISTINCT FROM expected_fingerprint THEN RAISE EXCEPTION 'Phase1A: stale save' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT FROM public.orders WHERE organization_id=org AND quotation_id=qid) OR jsonb_typeof(header)<>'object' OR jsonb_typeof(items)<>'array' OR jsonb_array_length(items) NOT BETWEEN 1 AND 200 THEN
  RAISE EXCEPTION 'Phase1A: invalid save/already converted' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT FROM public.clients WHERE organization_id=org AND id=client) THEN RAISE EXCEPTION 'Phase1A: client unavailable' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT FROM jsonb_object_keys(header) k WHERE k NOT IN('currency','discount','iva_mode','tax_rate','extension_adjustment_type','extension_adjustment_value','notes')) THEN
  RAISE EXCEPTION 'Phase1A: unsupported quotation header field' USING ERRCODE='22023'; END IF;
 UPDATE public.quotations SET client_id=client,currency=header->>'currency',discount=noveli_private.decimal_value(coalesce(header->>'discount','0'),noveli_private.currency_scale(header->>'currency')),
 iva_mode=header->>'iva_mode',tax_rate=noveli_private.decimal_value(coalesce(header->>'tax_rate','0'),2,100),
 extension_adjustment_type=coalesce(header->>'extension_adjustment_type','none'),extension_adjustment_value=noveli_private.decimal_value(coalesce(header->>'extension_adjustment_value','0'),2),
 notes=header->>'notes' WHERE id=qid;
 DELETE FROM public.quotation_items WHERE organization_id=org AND quotation_id=qid;
 FOR x IN SELECT value FROM jsonb_array_elements(items) LOOP
  INSERT INTO public.quotation_items(id,organization_id,user_id,quotation_id,catalog_id,pack_id,concept,description,quantity,unit_price,total,source_type,display_order)
  VALUES(coalesce(nullif(x->>'id','')::uuid,gen_random_uuid()),org,noveli_private.actor_uid(),qid,nullif(x->>'catalog_id','')::uuid,nullif(x->>'pack_id','')::uuid,x->>'name',coalesce(x->>'description',''),
   noveli_private.decimal_value(x->>'quantity',0,2147483647)::integer,noveli_private.decimal_value(x->>'unit_price',2),
   noveli_private.decimal_value(x->>'quantity',0,2147483647)*noveli_private.decimal_value(x->>'unit_price',2),coalesce(x->>'source_type','custom'),pos);
  pos:=pos+1;
 END LOOP;
 normalized:=noveli_private.normalize_quotation(org,qid,false);
 UPDATE public.quotations SET subtotal=(normalized->>'source_subtotal')::numeric,total=(normalized->>'legacy_total')::numeric,
 net_amount=(normalized->>'legacy_net')::numeric,tax_amount=(normalized->>'legacy_tax')::numeric,status='aceptada',accepted_at=now(),updated_at=now() WHERE id=qid;
 RETURN noveli_private.review_and_accept_quotation(org,qid,client,evidence,noveli_private.quotation_fingerprint(org,qid));
END $$;

CREATE FUNCTION noveli_private.convert_quotation_to_order(org uuid,qid uuid,snapshot_id uuid,expected_sha text,operation_key uuid)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.quotations; s noveli_private.quotation_acceptance_snapshots; o public.orders; h text;
BEGIN
 PERFORM noveli_private.authorize(org,ARRAY['admin','editor'],'quotation_conversion');
 PERFORM noveli_private.authorize(org,ARRAY['admin','editor'],'orders');
 PERFORM pg_advisory_xact_lock(184101,1);
 SELECT * INTO STRICT q FROM public.quotations WHERE organization_id=org AND id=qid FOR UPDATE;
 SELECT * INTO STRICT s FROM noveli_private.quotation_acceptance_snapshots WHERE organization_id=org AND quotation_id=qid AND id=snapshot_id;
 IF s.snapshot_sha256 IS DISTINCT FROM expected_sha THEN RAISE EXCEPTION 'Phase1A: acceptance hash mismatch' USING ERRCODE='23514'; END IF;
 h:=encode(sha256(convert_to(jsonb_build_object('kind','quotation','quotation',qid,'snapshot',snapshot_id,'sha',expected_sha)::text,'UTF8')),'hex');
 IF operation_key IS NULL THEN RAISE EXCEPTION 'Phase1A: operation key required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text||operation_key::text,0));
 IF EXISTS(SELECT FROM public.orders WHERE organization_id=org AND creation_operation_key=operation_key AND creation_request_hash<>h) THEN RAISE EXCEPTION 'Phase1A: operation key conflict' USING ERRCODE='23505'; END IF;
 SELECT * INTO o FROM public.orders WHERE organization_id=org AND quotation_id=qid;
 IF FOUND THEN
  IF o.quotation_acceptance_snapshot_id<>snapshot_id OR o.creation_request_hash<>h THEN RAISE EXCEPTION 'Phase1A: conversion conflict' USING ERRCODE='23505'; END IF;
  RETURN o;
 END IF;
 IF q.status<>'aceptada' OR q.accepted_at IS NULL OR s.accepted_at<>q.accepted_at OR
 s.legacy_source_fingerprint IS DISTINCT FROM noveli_private.quotation_fingerprint(org,qid) OR
 EXISTS(SELECT FROM noveli_private.quotation_acceptance_snapshots WHERE organization_id=org AND quotation_id=qid AND revision_no>s.revision_no) THEN
  RAISE EXCEPTION 'Phase1A: stale/nonaccepted quotation' USING ERRCODE='40001'; END IF;
 -- The composite FK takes the referential key lock when the order is inserted.
 -- Do not grant UPDATE on legacy clients merely to request SELECT FOR KEY SHARE.
 PERFORM 1 FROM public.clients WHERE organization_id=org AND id=s.client_id;
 IF NOT FOUND OR (q.client_id IS NOT NULL AND q.client_id<>s.client_id) THEN RAISE EXCEPTION 'Phase1A: client unavailable' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.quotation_items WHERE quotation_id=qid ORDER BY id FOR UPDATE;
 IF encode(sha256(convert_to(s.snapshot::text,'UTF8')),'hex')<>s.snapshot_sha256 OR jsonb_array_length(s.snapshot->'items')=0 THEN RAISE EXCEPTION 'Phase1A: corrupted revision' USING ERRCODE='23514'; END IF;
 o:=noveli_private.insert_order(org,s.client_id,operation_key,h,s.snapshot,q.notes,NULL);
 UPDATE public.orders SET quotation_id=qid,quotation_acceptance_snapshot_id=s.id,commercial_status='accepted',
 accepted_at=s.accepted_at,accepted_by=s.accepted_by,acceptance_evidence=s.acceptance_evidence WHERE id=o.id RETURNING * INTO o;
 PERFORM noveli_private.log_order(org,o.id,'quotation_converted','Quotation '||qid||' snapshot '||s.id);
 RETURN o;
END $$;

CREATE FUNCTION public.phase1a_quotation_review_source(p_org uuid,p_quotation uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT noveli_private.quotation_review_source(p_org,p_quotation) $$;
REVOKE ALL ON FUNCTION public.phase1a_quotation_review_source(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1a_quotation_review_source(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION noveli_private.quotation_review_source(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION noveli_private.quotation_review_source(uuid,uuid) TO authenticated;

CREATE FUNCTION public.phase1a_review_and_accept_quotation(p_org uuid,p_quotation uuid,p_client uuid,p_evidence jsonb,p_expected_fingerprint text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT noveli_private.review_and_accept_quotation(p_org,p_quotation,p_client,p_evidence,p_expected_fingerprint) $$;
REVOKE ALL ON FUNCTION public.phase1a_review_and_accept_quotation(uuid,uuid,uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1a_review_and_accept_quotation(uuid,uuid,uuid,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION noveli_private.review_and_accept_quotation(uuid,uuid,uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION noveli_private.review_and_accept_quotation(uuid,uuid,uuid,jsonb,text) TO authenticated;

CREATE FUNCTION public.phase1a_save_and_accept_quotation(p_org uuid,p_quotation uuid,p_client uuid,p_header jsonb,p_items jsonb,p_evidence jsonb,p_expected_fingerprint text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT noveli_private.save_and_accept_quotation(p_org,p_quotation,p_client,p_header,p_items,p_evidence,p_expected_fingerprint) $$;
REVOKE ALL ON FUNCTION public.phase1a_save_and_accept_quotation(uuid,uuid,uuid,jsonb,jsonb,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1a_save_and_accept_quotation(uuid,uuid,uuid,jsonb,jsonb,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION noveli_private.save_and_accept_quotation(uuid,uuid,uuid,jsonb,jsonb,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION noveli_private.save_and_accept_quotation(uuid,uuid,uuid,jsonb,jsonb,jsonb,text) TO authenticated;

CREATE FUNCTION public.phase1a_convert_quotation_to_order(p_org uuid,p_quotation uuid,p_snapshot uuid,p_expected_sha text,p_operation_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT noveli_private.order_json(noveli_private.convert_quotation_to_order(p_org,p_quotation,p_snapshot,p_expected_sha,p_operation_key)) $$;
REVOKE ALL ON FUNCTION public.phase1a_convert_quotation_to_order(uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1a_convert_quotation_to_order(uuid,uuid,uuid,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION noveli_private.convert_quotation_to_order(uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION noveli_private.convert_quotation_to_order(uuid,uuid,uuid,text,uuid) TO authenticated;

REVOKE ALL ON FUNCTION noveli_private.quotation_write_barrier(),noveli_private.snapshot_immutable(),noveli_private.quotation_fingerprint(uuid,uuid),noveli_private.normalize_quotation(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION noveli_private.quotation_write_barrier(),noveli_private.snapshot_immutable(),noveli_private.quotation_fingerprint(uuid,uuid),noveli_private.normalize_quotation(uuid,uuid,boolean) TO noveli_orders_executor;
ALTER FUNCTION noveli_private.quotation_review_source(uuid,uuid) OWNER TO noveli_orders_executor;
ALTER FUNCTION noveli_private.review_and_accept_quotation(uuid,uuid,uuid,jsonb,text) OWNER TO noveli_orders_executor;
ALTER FUNCTION noveli_private.save_and_accept_quotation(uuid,uuid,uuid,jsonb,jsonb,jsonb,text) OWNER TO noveli_orders_executor;
ALTER FUNCTION noveli_private.convert_quotation_to_order(uuid,uuid,uuid,text,uuid) OWNER TO noveli_orders_executor;
REVOKE CREATE ON SCHEMA noveli_private FROM noveli_orders_executor;
COMMIT;
