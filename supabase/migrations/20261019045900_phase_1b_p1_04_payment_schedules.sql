BEGIN;

-- P1-04 only: obligations calendar. No payment/refund/allocation ledger is created.
CREATE TABLE public.payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  currency text NOT NULL CHECK (currency IN ('CLP','USD')),
  expected_amount numeric(18,2) NOT NULL CHECK (
    expected_amount > 0
    AND noveli_private.money_valid(expected_amount,currency)
  ),
  due_kind text NOT NULL CHECK (due_kind IN ('fixed_date','milestone')),
  due_date date,
  milestone_key text,
  lifecycle_status text NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft','scheduled','cancelled')),
  published_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  label text,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,order_id,sequence),
  FOREIGN KEY (organization_id,order_id)
    REFERENCES public.orders(organization_id,id) ON DELETE RESTRICT,
  CHECK (
    (lifecycle_status='draft' AND published_at IS NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL)
    OR
    (lifecycle_status='scheduled' AND published_at IS NOT NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL
      AND ((due_kind='fixed_date' AND due_date IS NOT NULL) OR (due_kind='milestone' AND nullif(btrim(milestone_key),'') IS NOT NULL)))
    OR
    (lifecycle_status='cancelled' AND published_at IS NOT NULL AND cancelled_at IS NOT NULL AND nullif(btrim(cancellation_reason),'') IS NOT NULL)
  ),
  CHECK (due_date IS NULL OR due_kind IN ('fixed_date','milestone')),
  CHECK (milestone_key IS NULL OR (due_kind='milestone' AND nullif(btrim(milestone_key),'') IS NOT NULL))
);

CREATE INDEX phase1b_schedules_due
  ON public.payment_schedules (organization_id,due_date,order_id,sequence)
  WHERE lifecycle_status='scheduled';

ALTER TABLE public.payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_schedules FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_schedules FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.payment_schedules TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.payment_schedules TO noveli_orders_executor;

CREATE POLICY p1b_schedules_read ON public.payment_schedules
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) AND (public.is_org_admin(organization_id) OR public.is_org_finance(organization_id)));
CREATE POLICY p1b_schedules_executor ON public.payment_schedules
  FOR ALL TO noveli_orders_executor
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY p1b_schedules_tenant_fence ON public.payment_schedules
  AS RESTRICTIVE FOR ALL TO authenticated,noveli_orders_executor
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

GRANT CREATE ON SCHEMA noveli_private TO noveli_orders_executor;

CREATE FUNCTION noveli_private.payment_schedule_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE order_currency text;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.lifecycle_status<>'draft' THEN
      RAISE EXCEPTION 'P1-04: published or cancelled schedules are immutable' USING ERRCODE='42501';
    END IF;
    RETURN OLD;
  END IF;

  SELECT o.currency INTO order_currency
  FROM public.orders o
  WHERE o.organization_id=NEW.organization_id AND o.id=NEW.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'P1-04: order not found in organization' USING ERRCODE='23503';
  END IF;
  IF NEW.currency IS DISTINCT FROM order_currency THEN
    RAISE EXCEPTION 'P1-04: schedule currency must match order currency' USING ERRCODE='23514';
  END IF;

  IF TG_OP='INSERT' THEN
    IF NEW.lifecycle_status<>'draft' OR NEW.published_at IS NOT NULL OR NEW.cancelled_at IS NOT NULL
       OR NEW.created_by IS DISTINCT FROM noveli_private.actor_uid() THEN
      RAISE EXCEPTION 'P1-04: schedules must be actor-owned drafts' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(NEW.id,NEW.organization_id,NEW.order_id,NEW.created_by,NEW.created_at)
     IS DISTINCT FROM ROW(OLD.id,OLD.organization_id,OLD.order_id,OLD.created_by,OLD.created_at) THEN
    RAISE EXCEPTION 'P1-04: immutable schedule identity' USING ERRCODE='23514';
  END IF;
  IF OLD.lifecycle_status<>'draft' THEN
    RAISE EXCEPTION 'P1-04: published or cancelled schedules are immutable' USING ERRCODE='42501';
  END IF;
  IF NEW.lifecycle_status NOT IN ('draft','scheduled') THEN
    RAISE EXCEPTION 'P1-04: unsupported schedule transition' USING ERRCODE='23514';
  END IF;
  IF NEW.lifecycle_status='scheduled' AND
     ROW(NEW.sequence,NEW.currency,NEW.expected_amount,NEW.due_kind,NEW.due_date,NEW.milestone_key,NEW.label,NEW.notes)
     IS DISTINCT FROM
     ROW(OLD.sequence,OLD.currency,OLD.expected_amount,OLD.due_kind,OLD.due_date,OLD.milestone_key,OLD.label,OLD.notes) THEN
    RAISE EXCEPTION 'P1-04: publication cannot change schedule terms' USING ERRCODE='23514';
  END IF;
  NEW.updated_at=now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION noveli_private.payment_schedule_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER p1b_payment_schedule_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.payment_schedules
  FOR EACH ROW EXECUTE FUNCTION noveli_private.payment_schedule_guard();
GRANT EXECUTE ON FUNCTION noveli_private.payment_schedule_guard() TO noveli_orders_executor;
ALTER FUNCTION noveli_private.payment_schedule_guard() OWNER TO noveli_orders_executor;

CREATE FUNCTION noveli_private.save_payment_schedule_draft(p_org uuid,p_order uuid,p_schedules jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_order public.orders;
  v_item jsonb;
  v_sequence integer;
  v_sequences integer[]:='{}';
  v_amount_text text;
  v_amount numeric;
  v_due_kind text;
  v_due_date date;
  v_milestone text;
  v_label text;
  v_notes text;
  v_actor_role text;
  v_changed boolean:=false;
  v_rows integer;
  v_result jsonb;
BEGIN
  v_actor_role:=noveli_private.actor_role(p_org);
  IF noveli_private.actor_uid() IS NULL OR coalesce(v_actor_role,'') NOT IN ('admin','finanzas') THEN
    RAISE EXCEPTION 'P1-04: forbidden' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_schedules) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'P1-04: schedules must be an array' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_schedules)>120 THEN
    RAISE EXCEPTION 'P1-04: schedules array exceeds 120 entries' USING ERRCODE='22023';
  END IF;
  SELECT * INTO STRICT v_order FROM public.orders
   WHERE organization_id=p_org AND id=p_order FOR UPDATE;
  IF v_order.commercial_status='cancelled' THEN
    RAISE EXCEPTION 'P1-04: cancelled order cannot have a schedule plan' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_schedules s WHERE s.organization_id=p_org AND s.order_id=p_order AND s.lifecycle_status<>'draft') THEN
    RAISE EXCEPTION 'P1-04: published schedule plan cannot be replaced' USING ERRCODE='23514';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_schedules) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR (v_item-ARRAY['sequence','expected_amount','due_kind','due_date','milestone_key','label','notes'])<>'{}'::jsonb
       OR jsonb_typeof(v_item->'sequence') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_item->'expected_amount') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item->'due_kind') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'P1-04: malformed schedule entry' USING ERRCODE='22023';
    END IF;
    v_sequence:=(v_item->>'sequence')::integer;
    v_amount_text:=v_item->>'expected_amount';
    IF v_amount_text !~ '^[0-9]+(\.[0-9]+)?$'
       OR (position('.' IN v_amount_text)>0
           AND length(split_part(v_amount_text,'.',2))>noveli_private.currency_scale(v_order.currency)) THEN
      RAISE EXCEPTION 'P1-04: expected_amount has invalid decimal scale' USING ERRCODE='22023';
    END IF;
    v_amount:=v_amount_text::numeric;
    v_due_kind:=v_item->>'due_kind';
    v_due_date:=nullif(v_item->>'due_date','')::date;
    v_milestone:=nullif(btrim(v_item->>'milestone_key'),'');
    v_label:=nullif(btrim(v_item->>'label'),'');
    v_notes:=nullif(btrim(v_item->>'notes'),'');
    IF v_sequence<=0 OR v_sequence=ANY(v_sequences) THEN
      RAISE EXCEPTION 'P1-04: duplicate or invalid sequence' USING ERRCODE='23505';
    END IF;
    IF v_amount<=0 OR NOT noveli_private.money_valid(v_amount,v_order.currency) THEN
      RAISE EXCEPTION 'P1-04: expected_amount must be positive valid currency precision' USING ERRCODE='22023';
    END IF;
    IF coalesce(v_due_kind,'') NOT IN ('fixed_date','milestone') OR (v_milestone IS NOT NULL AND v_due_kind<>'milestone') THEN
      RAISE EXCEPTION 'P1-04: invalid due kind or milestone key' USING ERRCODE='22023';
    END IF;
    v_sequences:=array_append(v_sequences,v_sequence);
    INSERT INTO public.payment_schedules(organization_id,order_id,sequence,currency,expected_amount,due_kind,due_date,milestone_key,label,notes,created_by)
    VALUES(p_org,p_order,v_sequence,v_order.currency,v_amount,v_due_kind,v_due_date,v_milestone,v_label,v_notes,noveli_private.actor_uid())
    ON CONFLICT (organization_id,order_id,sequence) DO UPDATE
      SET currency=EXCLUDED.currency,expected_amount=EXCLUDED.expected_amount,due_kind=EXCLUDED.due_kind,
          due_date=EXCLUDED.due_date,milestone_key=EXCLUDED.milestone_key,label=EXCLUDED.label,notes=EXCLUDED.notes,updated_at=now()
      WHERE public.payment_schedules.lifecycle_status='draft'
        AND ROW(public.payment_schedules.currency,public.payment_schedules.expected_amount,public.payment_schedules.due_kind,
                public.payment_schedules.due_date,public.payment_schedules.milestone_key,public.payment_schedules.label,public.payment_schedules.notes)
            IS DISTINCT FROM ROW(EXCLUDED.currency,EXCLUDED.expected_amount,EXCLUDED.due_kind,EXCLUDED.due_date,
                                 EXCLUDED.milestone_key,EXCLUDED.label,EXCLUDED.notes);
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows>0 THEN v_changed:=true; END IF;
  END LOOP;

  DELETE FROM public.payment_schedules s
   WHERE s.organization_id=p_org AND s.order_id=p_order AND s.lifecycle_status='draft'
     AND NOT (s.sequence=ANY(v_sequences));
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows>0 THEN v_changed:=true; END IF;

  IF v_changed THEN
    INSERT INTO public.activity_log(organization_id,user_id,module,action,description,entity_id)
    VALUES(p_org,noveli_private.actor_uid(),'payments','schedule_draft_saved','Draft payment schedule plan saved',p_order);
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('expected_amount',s.expected_amount::text) ORDER BY s.sequence),'[]'::jsonb)
    INTO v_result FROM public.payment_schedules s WHERE s.organization_id=p_org AND s.order_id=p_order;
  RETURN jsonb_build_object('order_id',p_order,'currency',v_order.currency,'total',v_order.total::text,'schedules',v_result,'changed',v_changed);
END $$;
REVOKE ALL ON FUNCTION noveli_private.save_payment_schedule_draft(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION noveli_private.save_payment_schedule_draft(uuid,uuid,jsonb) TO authenticated;
ALTER FUNCTION noveli_private.save_payment_schedule_draft(uuid,uuid,jsonb) OWNER TO noveli_orders_executor;

CREATE FUNCTION noveli_private.publish_payment_schedule_plan(p_org uuid,p_order uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_order public.orders;
  v_total numeric;
  v_count integer;
  v_drafts integer;
  v_scheduled integer;
  v_actor_role text;
  v_result jsonb;
BEGIN
  v_actor_role:=noveli_private.actor_role(p_org);
  IF noveli_private.actor_uid() IS NULL OR coalesce(v_actor_role,'') NOT IN ('admin','finanzas') THEN
    RAISE EXCEPTION 'P1-04: forbidden' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT v_order FROM public.orders
   WHERE organization_id=p_org AND id=p_order FOR UPDATE;
  IF v_order.commercial_status<>'accepted' THEN
    RAISE EXCEPTION 'P1-04: schedules require an accepted order' USING ERRCODE='23514';
  END IF;
  SELECT count(*),count(*) FILTER (WHERE lifecycle_status='draft'),count(*) FILTER (WHERE lifecycle_status='scheduled'),coalesce(sum(expected_amount),0)
    INTO v_count,v_drafts,v_scheduled,v_total FROM public.payment_schedules WHERE organization_id=p_org AND order_id=p_order;
  IF v_count=0 OR v_order.total<=0 THEN
    RAISE EXCEPTION 'P1-04: positive-total order requires one or more obligations' USING ERRCODE='23514';
  END IF;
  IF v_drafts=0 AND v_scheduled=v_count AND v_count>0 AND v_total=v_order.total THEN
    SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('expected_amount',s.expected_amount::text) ORDER BY s.sequence)
      INTO v_result FROM public.payment_schedules s WHERE s.organization_id=p_org AND s.order_id=p_order;
    RETURN jsonb_build_object('order_id',p_order,'currency',v_order.currency,'total',v_order.total::text,'schedules',v_result,'published',true,'replayed',true);
  END IF;
  IF v_drafts<>v_count OR EXISTS (SELECT 1 FROM public.payment_schedules s WHERE s.organization_id=p_org AND s.order_id=p_order AND s.lifecycle_status<>'draft') THEN
    RAISE EXCEPTION 'P1-04: schedule plan has a non-draft or terminal row' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_schedules s WHERE s.organization_id=p_org AND s.order_id=p_order
      AND (s.currency<>v_order.currency OR (s.due_kind='fixed_date' AND s.due_date IS NULL)
           OR (s.due_kind='milestone' AND nullif(btrim(s.milestone_key),'') IS NULL))) THEN
    RAISE EXCEPTION 'P1-04: schedule terms are incomplete or inconsistent' USING ERRCODE='23514';
  END IF;
  IF v_total<>v_order.total THEN
    RAISE EXCEPTION 'P1-04: published obligations must equal order total' USING ERRCODE='23514';
  END IF;
  UPDATE public.payment_schedules SET lifecycle_status='scheduled',published_at=now(),updated_at=now()
   WHERE organization_id=p_org AND order_id=p_order AND lifecycle_status='draft';
  SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('expected_amount',s.expected_amount::text) ORDER BY s.sequence)
    INTO v_result FROM public.payment_schedules s WHERE s.organization_id=p_org AND s.order_id=p_order;
  INSERT INTO public.activity_log(organization_id,user_id,module,action,description,entity_id)
  VALUES(p_org,noveli_private.actor_uid(),'payments','schedule_plan_published','Payment schedule plan published',p_order);
  RETURN jsonb_build_object('order_id',p_order,'currency',v_order.currency,'total',v_order.total::text,'schedules',v_result,'published',true,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION noveli_private.publish_payment_schedule_plan(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION noveli_private.publish_payment_schedule_plan(uuid,uuid) TO authenticated;
ALTER FUNCTION noveli_private.publish_payment_schedule_plan(uuid,uuid) OWNER TO noveli_orders_executor;

CREATE FUNCTION public.phase1b_save_payment_schedule_draft(p_org uuid,p_order uuid,p_schedules jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT noveli_private.save_payment_schedule_draft(p_org,p_order,p_schedules)
$$;
REVOKE ALL ON FUNCTION public.phase1b_save_payment_schedule_draft(uuid,uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.phase1b_save_payment_schedule_draft(uuid,uuid,jsonb) TO authenticated;

CREATE FUNCTION public.phase1b_publish_payment_schedule_plan(p_org uuid,p_order uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT noveli_private.publish_payment_schedule_plan(p_org,p_order)
$$;
REVOKE ALL ON FUNCTION public.phase1b_publish_payment_schedule_plan(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.phase1b_publish_payment_schedule_plan(uuid,uuid) TO authenticated;

REVOKE CREATE ON SCHEMA noveli_private FROM noveli_orders_executor;

COMMIT;
