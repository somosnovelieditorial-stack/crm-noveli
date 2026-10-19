-- Phase 1A B: orders domain only. No payments/contracts, no frontend changes.
BEGIN;
GRANT CREATE ON SCHEMA noveli_private TO noveli_orders_executor;
CREATE TABLE public.orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 client_id uuid NOT NULL,
 quotation_id uuid,
 quotation_acceptance_snapshot_id uuid,
 creation_operation_key uuid NOT NULL, creation_request_hash text NOT NULL CHECK(length(creation_request_hash)=64),
 order_number text NOT NULL,number_year smallint NOT NULL,number_sequence integer NOT NULL CHECK(number_sequence BETWEEN 1 AND 999999),
 commercial_status text NOT NULL DEFAULT 'draft' CHECK(commercial_status IN('draft','pending_acceptance','accepted','cancelled')),
 operational_status text NOT NULL DEFAULT 'pending' CHECK(operational_status IN('pending','preparing','in_progress','waiting_client','review','delivered','completed','paused','cancelled')),
 currency text NOT NULL CHECK(currency IN('CLP','USD')),
 subtotal numeric(18,2) NOT NULL,discount numeric(18,2) NOT NULL,tax numeric(18,2) NOT NULL,total numeric(18,2) NOT NULL,
 pricing_version smallint NOT NULL DEFAULT 1 CHECK(pricing_version=1),
 pricing_metadata jsonb NOT NULL DEFAULT '{"schema_version":1,"rounding":"half_away_from_zero","allocation":"largest_remainder"}' CHECK(jsonb_typeof(pricing_metadata)='object'),
 accepted_at timestamptz,accepted_by uuid REFERENCES auth.users(id),acceptance_evidence jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(acceptance_evidence)='object'),
 cancelled_at timestamptz,cancelled_by uuid REFERENCES auth.users(id),cancellation_reason text,
 notes text,internal_notes text,
 created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(organization_id,order_number),UNIQUE(organization_id,number_year,number_sequence),
 UNIQUE(organization_id,quotation_id),UNIQUE(organization_id,creation_operation_key),
 FOREIGN KEY(organization_id,client_id) REFERENCES public.clients(organization_id,id),
 FOREIGN KEY(organization_id,quotation_id) REFERENCES public.quotations(organization_id,id),
 CHECK((quotation_id IS NULL)=(quotation_acceptance_snapshot_id IS NULL)),
 CHECK(order_number='NOV-ORD-'||number_year::text||'-'||lpad(number_sequence::text,6,'0') AND number_year BETWEEN 2000 AND 9999),
 CHECK(discount<=subtotal AND total=subtotal-discount+tax),
 CHECK(noveli_private.money_valid(subtotal,currency) AND noveli_private.money_valid(discount,currency) AND noveli_private.money_valid(tax,currency) AND noveli_private.money_valid(total,currency)),
 CHECK((accepted_at IS NULL)=(accepted_by IS NULL)),
 CHECK(commercial_status<>'accepted' OR (accepted_at IS NOT NULL AND acceptance_evidence<>'{}')),
 CHECK((commercial_status='cancelled')=(cancelled_at IS NOT NULL) AND (cancelled_at IS NULL)=(cancelled_by IS NULL)),
 CHECK(commercial_status<>'cancelled' OR (nullif(btrim(cancellation_reason),'') IS NOT NULL AND operational_status='cancelled'))
);
CREATE TABLE public.order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),order_id uuid NOT NULL,
 position integer NOT NULL CHECK(position>0),
 item_type text NOT NULL DEFAULT 'noveli_service' CHECK(item_type='noveli_service'),
 catalog_id uuid,pack_id uuid,source_quotation_item_id uuid,
 name text NOT NULL CHECK(nullif(btrim(name),'') IS NOT NULL),description text NOT NULL DEFAULT '',
 quantity numeric(12,3) NOT NULL CHECK(quantity>0 AND quantity::text NOT IN('NaN','Infinity','-Infinity')),
 unit_price numeric(30,12) NOT NULL CHECK(unit_price>=0 AND unit_price::text NOT IN('NaN','Infinity','-Infinity')),
 rounding_adjustment numeric(18,2) NOT NULL DEFAULT 0,
 subtotal numeric(18,2) NOT NULL,discount numeric(18,2) NOT NULL,tax numeric(18,2) NOT NULL,total numeric(18,2) NOT NULL,
 currency text NOT NULL CHECK(currency IN('CLP','USD')),tax_rate numeric(7,4) NOT NULL CHECK(tax_rate BETWEEN 0 AND 100),
 tax_mode text NOT NULL CHECK(tax_mode IN('net','added','included','exempt')),
 pricing_version smallint NOT NULL DEFAULT 1 CHECK(pricing_version=1),pricing_metadata jsonb NOT NULL DEFAULT '{"schema_version":1}' CHECK(jsonb_typeof(pricing_metadata)='object'),
 created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(organization_id,order_id,position),
 FOREIGN KEY(organization_id,order_id) REFERENCES public.orders(organization_id,id),
 FOREIGN KEY(organization_id,catalog_id) REFERENCES public.service_catalog(organization_id,id) ON DELETE SET NULL(catalog_id),
 FOREIGN KEY(organization_id,pack_id) REFERENCES public.service_packs(organization_id,id) ON DELETE SET NULL(pack_id),
 CHECK(catalog_id IS NULL OR pack_id IS NULL),
 CHECK(tax_mode<>'exempt' OR (tax_rate=0 AND tax=0)),
 CHECK(discount<=subtotal AND total=subtotal-discount+tax),
 CHECK(abs(rounding_adjustment)<=power(10::numeric,-noveli_private.currency_scale(currency)) AND rounding_adjustment=round(rounding_adjustment,noveli_private.currency_scale(currency))),
 CHECK(subtotal=round(quantity*unit_price,noveli_private.currency_scale(currency))+rounding_adjustment),
 CHECK(noveli_private.money_valid(subtotal,currency) AND noveli_private.money_valid(discount,currency) AND noveli_private.money_valid(tax,currency) AND noveli_private.money_valid(total,currency))
);
CREATE UNIQUE INDEX phase1a_source_item ON public.order_items(organization_id,order_id,source_quotation_item_id) WHERE source_quotation_item_id IS NOT NULL;
CREATE INDEX phase1a_orders_created ON public.orders(organization_id,created_at DESC,id);
CREATE INDEX phase1a_orders_client ON public.orders(organization_id,client_id,created_at DESC);
CREATE INDEX phase1a_orders_status ON public.orders(organization_id,commercial_status,operational_status);
CREATE INDEX phase1a_items_catalog ON public.order_items(organization_id,catalog_id) WHERE catalog_id IS NOT NULL;
CREATE INDEX phase1a_items_pack ON public.order_items(organization_id,pack_id) WHERE pack_id IS NOT NULL;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders,public.order_items FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.orders,public.order_items TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.orders TO noveli_orders_executor;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.order_items TO noveli_orders_executor;
CREATE POLICY phase1a_order_read ON public.orders FOR SELECT TO authenticated USING(public.is_org_member(organization_id));
CREATE POLICY phase1a_item_read ON public.order_items FOR SELECT TO authenticated USING(public.is_org_member(organization_id));
CREATE POLICY phase1a_order_fence ON public.orders AS RESTRICTIVE TO authenticated,noveli_orders_executor USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));
CREATE POLICY phase1a_item_fence ON public.order_items AS RESTRICTIVE TO authenticated,noveli_orders_executor USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));
CREATE POLICY phase1a_executor_orders ON public.orders TO noveli_orders_executor USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));
CREATE POLICY phase1a_executor_items ON public.order_items TO noveli_orders_executor USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));

-- Canonical RPC representation: decimal strings, never client-side float arithmetic.
CREATE FUNCTION noveli_private.order_json(o public.orders) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT to_jsonb(o)||jsonb_build_object('subtotal',o.subtotal::text,'discount',o.discount::text,'tax',o.tax::text,'total',o.total::text)
$$;
CREATE FUNCTION noveli_private.order_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Phase1A: orders cannot be deleted' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.created_by IS DISTINCT FROM noveli_private.actor_uid() THEN RAISE EXCEPTION 'Phase1A: actor mismatch' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.organization_id,NEW.created_by,NEW.created_at,NEW.order_number,NEW.number_year,NEW.number_sequence,NEW.creation_operation_key,NEW.creation_request_hash)
 IS DISTINCT FROM ROW(OLD.id,OLD.organization_id,OLD.created_by,OLD.created_at,OLD.order_number,OLD.number_year,OLD.number_sequence,OLD.creation_operation_key,OLD.creation_request_hash) THEN
  RAISE EXCEPTION 'Phase1A: immutable identity' USING ERRCODE='23514';
 END IF;
 IF OLD.commercial_status<>'draft' AND
 (to_jsonb(NEW)-ARRAY['commercial_status','operational_status','notes','internal_notes','updated_at','accepted_at','accepted_by','acceptance_evidence','cancelled_at','cancelled_by','cancellation_reason'])
 IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['commercial_status','operational_status','notes','internal_notes','updated_at','accepted_at','accepted_by','acceptance_evidence','cancelled_at','cancelled_by','cancellation_reason']) THEN
  RAISE EXCEPTION 'Phase1A: frozen commercial snapshot' USING ERRCODE='23514';
 END IF;
 IF OLD.accepted_at IS NOT NULL AND ROW(NEW.accepted_at,NEW.accepted_by,NEW.acceptance_evidence) IS DISTINCT FROM ROW(OLD.accepted_at,OLD.accepted_by,OLD.acceptance_evidence) THEN
  RAISE EXCEPTION 'Phase1A: immutable acceptance' USING ERRCODE='23514';
 END IF;
 IF OLD.commercial_status='cancelled' THEN RAISE EXCEPTION 'Phase1A: cancelled is terminal' USING ERRCODE='23514'; END IF;
 IF OLD.operational_status IN('completed','cancelled') AND NEW.operational_status IS DISTINCT FROM OLD.operational_status THEN
  RAISE EXCEPTION 'Phase1A: operational terminal state' USING ERRCODE='23514';
 END IF;
 IF NEW.commercial_status IS DISTINCT FROM OLD.commercial_status AND NOT (
  (OLD.commercial_status='draft' AND NEW.commercial_status IN('pending_acceptance','cancelled')) OR
  (OLD.commercial_status='draft' AND NEW.commercial_status='accepted' AND NEW.quotation_id IS NOT NULL) OR
  (OLD.commercial_status='pending_acceptance' AND NEW.commercial_status IN('accepted','cancelled')) OR
  (OLD.commercial_status='accepted' AND NEW.commercial_status='cancelled')) THEN
  RAISE EXCEPTION 'Phase1A: invalid commercial transition' USING ERRCODE='23514';
 END IF;
 IF NEW.operational_status NOT IN('pending','cancelled') AND NEW.commercial_status<>'accepted' THEN
  RAISE EXCEPTION 'Phase1A: operation requires accepted order' USING ERRCODE='23514';
 END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER phase1a_order_guard BEFORE INSERT OR UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION noveli_private.order_guard();

CREATE FUNCTION noveli_private.item_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE parent public.orders;
BEGIN
 SELECT * INTO parent FROM public.orders WHERE id=coalesce(NEW.order_id,OLD.order_id) FOR UPDATE;
 IF TG_OP='UPDATE' AND
  (to_jsonb(NEW)-ARRAY['catalog_id','pack_id'])=(to_jsonb(OLD)-ARRAY['catalog_id','pack_id']) AND
  ((OLD.catalog_id IS NOT NULL AND NEW.catalog_id IS NULL AND NOT EXISTS(SELECT FROM public.service_catalog WHERE id=OLD.catalog_id)) OR
   (OLD.pack_id IS NOT NULL AND NEW.pack_id IS NULL AND NOT EXISTS(SELECT FROM public.service_packs WHERE id=OLD.pack_id))) THEN RETURN NEW;
 END IF;
 IF parent.id IS NULL OR parent.commercial_status<>'draft' THEN RAISE EXCEPTION 'Phase1A: item snapshot frozen' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.organization_id<>parent.organization_id OR NEW.currency<>parent.currency OR NEW.created_by IS DISTINCT FROM noveli_private.actor_uid() THEN
  RAISE EXCEPTION 'Phase1A: item context/actor mismatch' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.id,NEW.order_id,NEW.organization_id,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.order_id,OLD.organization_id,OLD.created_by,OLD.created_at) THEN
  RAISE EXCEPTION 'Phase1A: item identity immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER phase1a_item_guard BEFORE INSERT OR UPDATE OR DELETE ON public.order_items FOR EACH ROW EXECUTE FUNCTION noveli_private.item_guard();

CREATE FUNCTION noveli_private.order_totals_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE oid uuid; o public.orders; sums record;
BEGIN
 IF TG_TABLE_NAME='order_items' AND TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['catalog_id','pack_id'])=(to_jsonb(OLD)-ARRAY['catalog_id','pack_id']) THEN RETURN NULL; END IF;
 END IF;
 IF TG_TABLE_NAME='orders' THEN oid:=coalesce(NEW.id,OLD.id);
 ELSE oid:=coalesce(NEW.order_id,OLD.order_id); END IF;
 SELECT * INTO o FROM public.orders WHERE id=oid FOR UPDATE;
 IF o.id IS NULL THEN RAISE EXCEPTION 'Phase1A: totals parent not visible' USING ERRCODE='42501'; END IF;
 SELECT count(*) n,coalesce(sum(subtotal),0) subtotal,coalesce(sum(discount),0) discount,coalesce(sum(tax),0) tax,coalesce(sum(total),0) total INTO sums FROM public.order_items WHERE order_id=oid;
 IF ROW(o.subtotal,o.discount,o.tax,o.total) IS DISTINCT FROM ROW(sums.subtotal,sums.discount,sums.tax,sums.total) OR
 (o.commercial_status IN('pending_acceptance','accepted') AND sums.n=0) THEN
  RAISE EXCEPTION 'Phase1A: order totals/items mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER phase1a_order_totals AFTER INSERT OR UPDATE ON public.orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION noveli_private.order_totals_guard();
CREATE CONSTRAINT TRIGGER phase1a_item_totals AFTER INSERT OR UPDATE OR DELETE ON public.order_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION noveli_private.order_totals_guard();

CREATE FUNCTION noveli_private.write_items(org uuid,oid uuid,priced jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE x jsonb;
BEGIN
 FOR x IN SELECT value FROM jsonb_array_elements(priced->'items') LOOP
  INSERT INTO public.order_items(organization_id,order_id,position,name,description,quantity,unit_price,rounding_adjustment,subtotal,discount,tax,total,currency,tax_rate,tax_mode,catalog_id,pack_id,source_quotation_item_id,pricing_metadata,created_by)
  VALUES(org,oid,(x->>'position')::integer,x->>'name',x->>'description',(x->>'quantity')::numeric,(x->>'unit_price')::numeric,(x->>'rounding_adjustment')::numeric,
   (x->>'subtotal')::numeric,(x->>'discount')::numeric,(x->>'tax')::numeric,(x->>'total')::numeric,x->>'currency',(x->>'tax_rate')::numeric,x->>'tax_mode',
   (x->>'catalog_id')::uuid,(x->>'pack_id')::uuid,(x->>'source_quotation_item_id')::uuid,x->'pricing_metadata',noveli_private.actor_uid());
 END LOOP;
END $$;
CREATE FUNCTION noveli_private.log_order(org uuid,oid uuid,action text,detail text) RETURNS void LANGUAGE sql SET search_path=''
AS $$ INSERT INTO public.activity_log(organization_id,user_id,module,action,description,entity_id) VALUES(org,noveli_private.actor_uid(),'orders',action,detail,oid) $$;

CREATE FUNCTION noveli_private.insert_order(org uuid,client uuid,op uuid,request_hash text,priced jsonb,notes text,internal_notes text)
RETURNS public.orders LANGUAGE plpgsql SET search_path='' AS $$
DECLARE o public.orders; num record;
BEGIN
 IF op IS NULL THEN RAISE EXCEPTION 'Phase1A: operation key required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text||op::text,0));
 SELECT * INTO o FROM public.orders WHERE organization_id=org AND creation_operation_key=op;
 IF FOUND THEN
  IF o.creation_request_hash<>request_hash THEN RAISE EXCEPTION 'Phase1A: idempotency conflict' USING ERRCODE='23505'; END IF;
  RETURN o;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE organization_id=org AND id=client) THEN RAISE EXCEPTION 'Phase1A: client unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO num FROM noveli_private.next_order_number(org);
 INSERT INTO public.orders(organization_id,client_id,creation_operation_key,creation_request_hash,order_number,number_year,number_sequence,currency,subtotal,discount,tax,total,notes,internal_notes,created_by)
 VALUES(org,client,op,request_hash,num.order_number,num.number_year,num.number_sequence,priced->>'currency',(priced->>'subtotal')::numeric,(priced->>'discount')::numeric,(priced->>'tax')::numeric,(priced->>'total')::numeric,notes,internal_notes,noveli_private.actor_uid()) RETURNING * INTO o;
 PERFORM noveli_private.write_items(org,o.id,priced);
 PERFORM noveli_private.log_order(org,o.id,'created','Order created');
 RETURN o;
END $$;

CREATE FUNCTION noveli_private.create_order_draft(org uuid,client uuid,op uuid,currency text,items jsonb,discount text,notes text,internal_notes text)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE priced jsonb; h text; existing public.orders;
BEGIN
 PERFORM noveli_private.authorize(org,ARRAY['admin','editor']);
 h:=encode(sha256(convert_to(jsonb_build_object('kind','manual','client',client,'currency',currency,'items',items,'discount',discount,'notes',notes,'internal_notes',internal_notes)::text,'UTF8')),'hex');
 IF op IS NULL THEN RAISE EXCEPTION 'Phase1A: operation key required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text||op::text,0));
 SELECT * INTO existing FROM public.orders WHERE organization_id=org AND creation_operation_key=op;
 IF FOUND THEN
  IF existing.creation_request_hash<>h THEN RAISE EXCEPTION 'Phase1A: idempotency conflict' USING ERRCODE='23505'; END IF;
  RETURN existing;
 END IF;
 priced:=noveli_private.price(currency,noveli_private.enrich_items(org,items),discount);
 RETURN noveli_private.insert_order(org,client,op,h,priced,notes,internal_notes);
END $$;

CREATE FUNCTION noveli_private.edit_order_draft(org uuid,oid uuid,currency text,items jsonb,discount text,notes text,internal_notes text)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders; priced jsonb;
BEGIN
 PERFORM noveli_private.authorize(org,ARRAY['admin','editor']);
 SELECT * INTO STRICT o FROM public.orders WHERE organization_id=org AND id=oid FOR UPDATE;
 IF o.commercial_status<>'draft' OR o.quotation_id IS NOT NULL THEN RAISE EXCEPTION 'Phase1A: not editable draft' USING ERRCODE='23514'; END IF;
 priced:=noveli_private.price(currency,noveli_private.enrich_items(org,items),discount);
 DELETE FROM public.order_items WHERE organization_id=org AND order_id=oid;
 UPDATE public.orders SET currency=priced->>'currency',subtotal=(priced->>'subtotal')::numeric,discount=(priced->>'discount')::numeric,tax=(priced->>'tax')::numeric,total=(priced->>'total')::numeric,notes=edit_order_draft.notes,internal_notes=edit_order_draft.internal_notes WHERE id=oid RETURNING * INTO o;
 PERFORM noveli_private.write_items(org,oid,priced);
 PERFORM noveli_private.log_order(org,oid,'draft_edited','Draft pricing revision');
 RETURN o;
END $$;

CREATE FUNCTION noveli_private.transition_order(org uuid,oid uuid,target text,evidence jsonb,reason text)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders; occurred_at timestamptz;
BEGIN
 PERFORM noveli_private.authorize(org,ARRAY['admin','editor']);
 SELECT * INTO STRICT o FROM public.orders WHERE organization_id=org AND id=oid FOR UPDATE;
 IF target='cancelled' AND o.commercial_status='accepted' AND noveli_private.actor_role(org)<>'admin' THEN RAISE EXCEPTION 'Phase1A: admin cancellation required' USING ERRCODE='42501'; END IF;
 IF o.commercial_status=target THEN RETURN o; END IF;
 IF target='pending_acceptance' AND o.commercial_status='draft' THEN
  UPDATE public.orders SET commercial_status=target WHERE id=oid RETURNING * INTO o;
 ELSIF target='accepted' AND o.commercial_status='pending_acceptance' AND jsonb_typeof(evidence)='object' AND evidence<>'{}' THEN
  occurred_at:=coalesce((evidence->>'accepted_at')::timestamptz,now());
  IF occurred_at>now() THEN RAISE EXCEPTION 'Phase1A: future acceptance not allowed' USING ERRCODE='22023'; END IF;
  UPDATE public.orders SET commercial_status=target,accepted_at=occurred_at,accepted_by=noveli_private.actor_uid(),acceptance_evidence=evidence WHERE id=oid RETURNING * INTO o;
 ELSIF target='cancelled' AND nullif(btrim(reason),'') IS NOT NULL THEN
  UPDATE public.orders SET commercial_status=target,operational_status='cancelled',cancelled_at=now(),cancelled_by=noveli_private.actor_uid(),cancellation_reason=reason WHERE id=oid RETURNING * INTO o;
 ELSE RAISE EXCEPTION 'Phase1A: invalid transition/evidence' USING ERRCODE='23514';
 END IF;
 PERFORM noveli_private.log_order(org,oid,target,'Commercial transition');
 RETURN o;
END $$;

CREATE TABLE noveli_private.order_operation_pauses (
 organization_id uuid NOT NULL,order_id uuid NOT NULL,previous_status text NOT NULL,
 PRIMARY KEY(organization_id,order_id),FOREIGN KEY(organization_id,order_id) REFERENCES public.orders(organization_id,id)
);
ALTER TABLE noveli_private.order_operation_pauses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON noveli_private.order_operation_pauses FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON noveli_private.order_operation_pauses TO noveli_orders_executor;
CREATE POLICY phase1a_pauses ON noveli_private.order_operation_pauses TO noveli_orders_executor USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));
CREATE FUNCTION noveli_private.advance_order(org uuid,oid uuid,target text) RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders; prior text; allowed boolean:=false;
BEGIN
 PERFORM noveli_private.authorize(org,ARRAY['admin','editor','diseñador','corrector']);
 SELECT * INTO STRICT o FROM public.orders WHERE organization_id=org AND id=oid FOR UPDATE;
 IF o.commercial_status<>'accepted' THEN RAISE EXCEPTION 'Phase1A: accepted required' USING ERRCODE='23514'; END IF;
 IF o.operational_status=target THEN RETURN o; END IF;
 allowed:=CASE o.operational_status WHEN 'pending' THEN target='preparing' WHEN 'preparing' THEN target='in_progress' WHEN 'in_progress' THEN target='review' WHEN 'review' THEN target IN('in_progress','delivered') WHEN 'delivered' THEN target IN('review','completed') ELSE false END;
 IF o.operational_status IN('preparing','in_progress','review') AND target IN('paused','waiting_client') THEN
  INSERT INTO noveli_private.order_operation_pauses VALUES(org,oid,o.operational_status) ON CONFLICT(organization_id,order_id) DO UPDATE SET previous_status=excluded.previous_status; allowed:=true;
 ELSIF o.operational_status IN('paused','waiting_client') THEN
  SELECT previous_status INTO prior FROM noveli_private.order_operation_pauses WHERE organization_id=org AND order_id=oid;
  allowed:=target=prior;
  IF allowed THEN DELETE FROM noveli_private.order_operation_pauses WHERE organization_id=org AND order_id=oid; END IF;
 END IF;
 IF NOT coalesce(allowed,false) THEN RAISE EXCEPTION 'Phase1A: invalid operational transition' USING ERRCODE='23514'; END IF;
 UPDATE public.orders SET operational_status=target WHERE id=oid RETURNING * INTO o;
 PERFORM noveli_private.log_order(org,oid,'operation',target); RETURN o;
END $$;

CREATE FUNCTION noveli_private.update_order_notes(org uuid,oid uuid,notes text) RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders;
BEGIN
 PERFORM noveli_private.authorize(org,ARRAY['admin','editor','diseñador','corrector','finanzas']);
 UPDATE public.orders SET notes=update_order_notes.notes WHERE organization_id=org AND id=oid RETURNING * INTO STRICT o;
 PERFORM noveli_private.log_order(org,oid,'notes','Operational notes updated'); RETURN o;
END $$;
CREATE FUNCTION noveli_private.order_payment_summary(org uuid,oid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders;
BEGIN
 IF noveli_private.actor_uid() IS NULL OR NOT public.is_org_member(org) THEN RAISE EXCEPTION 'Phase1A: forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT o FROM public.orders WHERE organization_id=org AND id=oid;
 RETURN jsonb_build_object('order_id',oid,'payment_status',CASE WHEN o.total=0 AND o.commercial_status='accepted' THEN 'paid' ELSE 'unpaid' END,
 'retained_cash','0','outstanding_amount',o.total::text,'ledger_available',false);
END $$;

CREATE FUNCTION public.phase1a_create_order_draft(p_org uuid,p_client uuid,p_operation_key uuid,p_currency text,p_items jsonb,p_discount text DEFAULT '0',p_notes text DEFAULT NULL,p_internal_notes text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT noveli_private.order_json(noveli_private.create_order_draft(p_org,p_client,p_operation_key,p_currency,p_items,p_discount,p_notes,p_internal_notes)) $$;
REVOKE ALL ON FUNCTION public.phase1a_create_order_draft(uuid,uuid,uuid,text,jsonb,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1a_create_order_draft(uuid,uuid,uuid,text,jsonb,text,text,text) TO authenticated;

CREATE FUNCTION public.phase1a_edit_order_draft(p_org uuid,p_order uuid,p_currency text,p_items jsonb,p_discount text DEFAULT '0',p_notes text DEFAULT NULL,p_internal_notes text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT noveli_private.order_json(noveli_private.edit_order_draft(p_org,p_order,p_currency,p_items,p_discount,p_notes,p_internal_notes)) $$;
REVOKE ALL ON FUNCTION public.phase1a_edit_order_draft(uuid,uuid,text,jsonb,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1a_edit_order_draft(uuid,uuid,text,jsonb,text,text,text) TO authenticated;

CREATE FUNCTION public.phase1a_submit_order(p_org uuid,p_order uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT noveli_private.order_json(noveli_private.transition_order(p_org,p_order,'pending_acceptance','{}',NULL)) $$;
REVOKE ALL ON FUNCTION public.phase1a_submit_order(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1a_submit_order(uuid,uuid) TO authenticated;

CREATE FUNCTION public.phase1a_accept_order(p_org uuid,p_order uuid,p_evidence jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT noveli_private.order_json(noveli_private.transition_order(p_org,p_order,'accepted',p_evidence,NULL)) $$;
REVOKE ALL ON FUNCTION public.phase1a_accept_order(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1a_accept_order(uuid,uuid,jsonb) TO authenticated;

CREATE FUNCTION public.phase1a_cancel_order(p_org uuid,p_order uuid,p_reason text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT noveli_private.order_json(noveli_private.transition_order(p_org,p_order,'cancelled','{}',p_reason)) $$;
REVOKE ALL ON FUNCTION public.phase1a_cancel_order(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1a_cancel_order(uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.phase1a_advance_order_operation(p_org uuid,p_order uuid,p_target text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT noveli_private.order_json(noveli_private.advance_order(p_org,p_order,p_target)) $$;
REVOKE ALL ON FUNCTION public.phase1a_advance_order_operation(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1a_advance_order_operation(uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.phase1a_update_order_notes(p_org uuid,p_order uuid,p_notes text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT noveli_private.order_json(noveli_private.update_order_notes(p_org,p_order,p_notes)) $$;
REVOKE ALL ON FUNCTION public.phase1a_update_order_notes(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1a_update_order_notes(uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.phase1a_order_payment_summary(p_org uuid,p_order uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT noveli_private.order_payment_summary(p_org,p_order) $$;
REVOKE ALL ON FUNCTION public.phase1a_order_payment_summary(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1a_order_payment_summary(uuid,uuid) TO authenticated;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA noveli_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA noveli_private TO noveli_orders_executor;
GRANT EXECUTE ON FUNCTION noveli_private.create_order_draft(uuid,uuid,uuid,text,jsonb,text,text,text),
 noveli_private.edit_order_draft(uuid,uuid,text,jsonb,text,text,text),
 noveli_private.transition_order(uuid,uuid,text,jsonb,text),noveli_private.advance_order(uuid,uuid,text),
 noveli_private.update_order_notes(uuid,uuid,text),noveli_private.order_payment_summary(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION noveli_private.order_json(public.orders) TO authenticated;
ALTER FUNCTION noveli_private.create_order_draft(uuid,uuid,uuid,text,jsonb,text,text,text) OWNER TO noveli_orders_executor;
ALTER FUNCTION noveli_private.edit_order_draft(uuid,uuid,text,jsonb,text,text,text) OWNER TO noveli_orders_executor;
ALTER FUNCTION noveli_private.transition_order(uuid,uuid,text,jsonb,text) OWNER TO noveli_orders_executor;
ALTER FUNCTION noveli_private.advance_order(uuid,uuid,text) OWNER TO noveli_orders_executor;
ALTER FUNCTION noveli_private.update_order_notes(uuid,uuid,text) OWNER TO noveli_orders_executor;
ALTER FUNCTION noveli_private.order_payment_summary(uuid,uuid) OWNER TO noveli_orders_executor;
ALTER FUNCTION noveli_private.order_totals_guard() OWNER TO noveli_orders_executor;
REVOKE CREATE ON SCHEMA noveli_private FROM noveli_orders_executor;
COMMIT;
