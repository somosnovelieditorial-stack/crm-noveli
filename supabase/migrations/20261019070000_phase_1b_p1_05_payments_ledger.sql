BEGIN;

-- P1-05 frozen ledger structure only. No public write commands, backfill,
-- accounting linkage, capabilities, or production data.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='noveli_payments_executor') THEN
    CREATE ROLE noveli_payments_executor NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
GRANT noveli_payments_executor TO postgres WITH INHERIT FALSE, SET TRUE;
GRANT USAGE ON SCHEMA public,noveli_private TO noveli_payments_executor;

-- Required candidate key for the tenant-scoped evidence FK. documents.id
-- remains the primary key; this adds no rows and does not change Storage/RLS.
CREATE UNIQUE INDEX phase1b_documents_org_id
  ON public.documents(organization_id,id);

GRANT SELECT ON public.organization_members TO noveli_payments_executor;
CREATE POLICY p1b_payments_executor_members ON public.organization_members
  FOR SELECT TO noveli_payments_executor USING(user_id=(SELECT noveli_private.actor_uid()) AND active);

-- UPDATE column grants are needed by PostgreSQL's SELECT ... FOR UPDATE
-- privilege check. No UPDATE RLS policy is granted to this role on parents.
GRANT SELECT,UPDATE(commercial_status) ON public.orders TO noveli_payments_executor;
CREATE POLICY p1b_payments_executor_orders ON public.orders
  FOR SELECT TO noveli_payments_executor USING(public.is_org_member(organization_id));
CREATE POLICY p1b_payments_lock_orders ON public.orders
  FOR UPDATE TO noveli_payments_executor USING(public.is_org_member(organization_id)) WITH CHECK(false);
GRANT SELECT,UPDATE(lifecycle_status) ON public.payment_schedules TO noveli_payments_executor;
CREATE POLICY p1b_payments_executor_schedules ON public.payment_schedules
  FOR SELECT TO noveli_payments_executor USING(public.is_org_member(organization_id));
CREATE POLICY p1b_payments_lock_schedules ON public.payment_schedules
  FOR UPDATE TO noveli_payments_executor USING(public.is_org_member(organization_id)) WITH CHECK(false);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  order_id uuid NOT NULL,
  gross_amount numeric(18,2) NOT NULL,
  provider_fee numeric(18,2) NOT NULL,
  net_amount numeric(18,2) GENERATED ALWAYS AS (gross_amount-provider_fee) STORED NOT NULL,
  currency text COLLATE "C" NOT NULL,
  provider text COLLATE "C" NOT NULL,
  provider_account_scope text COLLATE "C" NOT NULL,
  provider_payment_id text COLLATE "C",
  method text NOT NULL,
  idempotency_key uuid NOT NULL,
  request_hash text COLLATE "C" NOT NULL,
  external_reference text,
  received_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  evidence_document_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT p1b_payments_org_id_key UNIQUE(organization_id,id),
  CONSTRAINT p1b_payments_org_id_currency_key UNIQUE(organization_id,id,currency),
  CONSTRAINT p1b_payments_idempotency_key UNIQUE(organization_id,idempotency_key),
  CONSTRAINT p1b_payments_order_fk FOREIGN KEY(organization_id,order_id)
    REFERENCES public.orders(organization_id,id) ON DELETE RESTRICT,
  CONSTRAINT p1b_payments_evidence_fk FOREIGN KEY(organization_id,evidence_document_id)
    REFERENCES public.documents(organization_id,id) ON DELETE RESTRICT,
  CONSTRAINT p1b_payments_actor_fk FOREIGN KEY(created_by)
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT p1b_payments_currency_check CHECK(currency IN ('CLP','USD')),
  CONSTRAINT p1b_payments_gross_check CHECK(gross_amount>0 AND noveli_private.money_valid(gross_amount,currency)),
  CONSTRAINT p1b_payments_fee_check CHECK(provider_fee>=0 AND provider_fee<=gross_amount AND noveli_private.money_valid(provider_fee,currency)),
  CONSTRAINT p1b_payments_provider_check CHECK(provider<>'' AND provider=btrim(provider) AND provider=lower(provider)),
  CONSTRAINT p1b_payments_scope_check CHECK(provider_account_scope<>'' AND provider_account_scope=btrim(provider_account_scope)),
  CONSTRAINT p1b_payments_provider_id_check CHECK(provider_payment_id IS NULL OR provider_payment_id<>''),
  CONSTRAINT p1b_payments_method_check CHECK(method IN ('transfer','card','cash','other')),
  CONSTRAINT p1b_payments_hash_check CHECK(request_hash ~ '^sha256-v1:[0-9a-f]{64}$'),
  CONSTRAINT p1b_payments_status_check CHECK(status IN ('pending','succeeded','failed','cancelled')),
  CONSTRAINT p1b_payments_received_check CHECK((status='succeeded')=(received_at IS NOT NULL))
);
CREATE UNIQUE INDEX p1b_payments_provider_identity
  ON public.payments(organization_id,provider,provider_account_scope,provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE INDEX p1b_payments_order_history
  ON public.payments(organization_id,order_id,received_at DESC,id);

CREATE TABLE public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  currency text COLLATE "C" NOT NULL,
  refund_key uuid NOT NULL,
  event_sequence integer NOT NULL,
  previous_event_id uuid,
  amount numeric(18,2) NOT NULL,
  reason text NOT NULL,
  status text NOT NULL,
  processed_at timestamptz,
  provider_refund_id text COLLATE "C",
  external_reference text,
  operation_key uuid NOT NULL,
  request_hash text COLLATE "C" NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT p1b_refunds_org_id_key UNIQUE(organization_id,id),
  CONSTRAINT p1b_refunds_org_id_currency_key UNIQUE(organization_id,id,currency),
  CONSTRAINT p1b_refunds_payment_event_key UNIQUE(organization_id,payment_id,id),
  CONSTRAINT p1b_refunds_chain_sequence_key UNIQUE(organization_id,refund_key,event_sequence),
  CONSTRAINT p1b_refunds_operation_key UNIQUE(organization_id,operation_key),
  CONSTRAINT p1b_refunds_payment_fk FOREIGN KEY(organization_id,payment_id,currency)
    REFERENCES public.payments(organization_id,id,currency) ON DELETE RESTRICT,
  CONSTRAINT p1b_refunds_previous_fk FOREIGN KEY(organization_id,previous_event_id)
    REFERENCES public.payment_refunds(organization_id,id) ON DELETE RESTRICT,
  CONSTRAINT p1b_refunds_actor_fk FOREIGN KEY(created_by)
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT p1b_refunds_currency_check CHECK(currency IN ('CLP','USD')),
  CONSTRAINT p1b_refunds_sequence_check CHECK(event_sequence>0 AND ((event_sequence=1 AND previous_event_id IS NULL) OR (event_sequence>1 AND previous_event_id IS NOT NULL))),
  CONSTRAINT p1b_refunds_amount_check CHECK(amount>0 AND noveli_private.money_valid(amount,currency)),
  CONSTRAINT p1b_refunds_reason_check CHECK(reason<>'' AND reason=btrim(reason)),
  CONSTRAINT p1b_refunds_status_check CHECK(status IN ('requested','processing','succeeded','failed','cancelled')),
  CONSTRAINT p1b_refunds_processed_check CHECK((status IN ('requested','processing'))=(processed_at IS NULL)),
  CONSTRAINT p1b_refunds_provider_id_check CHECK(provider_refund_id IS NULL OR provider_refund_id<>''),
  CONSTRAINT p1b_refunds_hash_check CHECK(request_hash ~ '^sha256-v1:[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX p1b_refunds_previous_unique
  ON public.payment_refunds(organization_id,previous_event_id) WHERE previous_event_id IS NOT NULL;
CREATE INDEX p1b_refunds_payment_history
  ON public.payment_refunds(organization_id,payment_id,created_at DESC,id);
CREATE INDEX p1b_refunds_provider_identity
  ON public.payment_refunds(organization_id,provider_refund_id) WHERE provider_refund_id IS NOT NULL;

CREATE TABLE public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  payment_schedule_id uuid NOT NULL,
  order_id uuid NOT NULL,
  currency text COLLATE "C" NOT NULL,
  amount numeric(18,2) NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  direction text NOT NULL,
  reversal_of_id uuid,
  refund_event_id uuid,
  operation_key uuid NOT NULL,
  operation_position integer NOT NULL,
  CONSTRAINT p1b_allocations_org_id_key UNIQUE(organization_id,id),
  CONSTRAINT p1b_allocations_operation_position_key UNIQUE(organization_id,operation_key,operation_position),
  CONSTRAINT p1b_allocations_payment_fk FOREIGN KEY(organization_id,payment_id)
    REFERENCES public.payments(organization_id,id) ON DELETE RESTRICT,
  CONSTRAINT p1b_allocations_schedule_fk FOREIGN KEY(organization_id,payment_schedule_id)
    REFERENCES public.payment_schedules(organization_id,id) ON DELETE RESTRICT,
  CONSTRAINT p1b_allocations_order_fk FOREIGN KEY(organization_id,order_id)
    REFERENCES public.orders(organization_id,id) ON DELETE RESTRICT,
  CONSTRAINT p1b_allocations_refund_fk FOREIGN KEY(organization_id,payment_id,refund_event_id)
    REFERENCES public.payment_refunds(organization_id,payment_id,id) ON DELETE RESTRICT,
  CONSTRAINT p1b_allocations_reversal_fk FOREIGN KEY(organization_id,reversal_of_id)
    REFERENCES public.payment_allocations(organization_id,id) ON DELETE RESTRICT,
  CONSTRAINT p1b_allocations_actor_fk FOREIGN KEY(created_by)
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT p1b_allocations_currency_check CHECK(currency IN ('CLP','USD')),
  CONSTRAINT p1b_allocations_amount_check CHECK(amount>0 AND noveli_private.money_valid(amount,currency)),
  CONSTRAINT p1b_allocations_direction_check CHECK(direction IN ('apply','reverse')),
  CONSTRAINT p1b_allocations_position_check CHECK(operation_position>0),
  CONSTRAINT p1b_allocations_shape_check CHECK(
    (direction='apply' AND reversal_of_id IS NULL AND refund_event_id IS NULL) OR
    (direction='reverse' AND reversal_of_id IS NOT NULL AND refund_event_id IS NOT NULL))
);
CREATE UNIQUE INDEX p1b_allocations_refund_reverse_unique
  ON public.payment_allocations(organization_id,refund_event_id,reversal_of_id)
  WHERE direction='reverse';
CREATE INDEX p1b_allocations_payment ON public.payment_allocations(organization_id,payment_id);
CREATE INDEX p1b_allocations_schedule ON public.payment_allocations(organization_id,payment_schedule_id);
CREATE INDEX p1b_allocations_reversal ON public.payment_allocations(organization_id,reversal_of_id) WHERE direction='reverse';

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_refunds FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.payments,public.payment_refunds,public.payment_allocations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.payments,public.payment_refunds,public.payment_allocations TO authenticated;
GRANT SELECT,INSERT ON public.payments,public.payment_refunds,public.payment_allocations TO noveli_payments_executor;
GRANT UPDATE(status,received_at,notes) ON public.payments TO noveli_payments_executor;
REVOKE DELETE ON public.payments,public.payment_refunds,public.payment_allocations FROM noveli_payments_executor;
GRANT EXECUTE ON FUNCTION noveli_private.money_valid(numeric,text),noveli_private.currency_scale(text),
  noveli_private.actor_uid() TO noveli_payments_executor;

CREATE POLICY p1b_payments_read ON public.payments FOR SELECT TO authenticated
  USING(public.is_org_member(organization_id) AND (public.is_org_admin(organization_id) OR public.is_org_finance(organization_id)));
CREATE POLICY p1b_payments_executor ON public.payments FOR ALL TO noveli_payments_executor
  USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));
CREATE POLICY p1b_payments_tenant_fence ON public.payments AS RESTRICTIVE FOR ALL TO authenticated,noveli_payments_executor
  USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));
CREATE POLICY p1b_refunds_read ON public.payment_refunds FOR SELECT TO authenticated
  USING(public.is_org_member(organization_id) AND (public.is_org_admin(organization_id) OR public.is_org_finance(organization_id)));
CREATE POLICY p1b_refunds_executor ON public.payment_refunds FOR ALL TO noveli_payments_executor
  USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));
CREATE POLICY p1b_refunds_tenant_fence ON public.payment_refunds AS RESTRICTIVE FOR ALL TO authenticated,noveli_payments_executor
  USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));
CREATE POLICY p1b_allocations_read ON public.payment_allocations FOR SELECT TO authenticated
  USING(public.is_org_member(organization_id) AND (public.is_org_admin(organization_id) OR public.is_org_finance(organization_id)));
CREATE POLICY p1b_allocations_executor ON public.payment_allocations FOR ALL TO noveli_payments_executor
  USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));
CREATE POLICY p1b_allocations_tenant_fence ON public.payment_allocations AS RESTRICTIVE FOR ALL TO authenticated,noveli_payments_executor
  USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));

CREATE OR REPLACE FUNCTION noveli_private.p1b_lock_order(p_org uuid,p_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM public.orders o WHERE o.organization_id=p_org AND o.id=p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'P1-05: order context not found' USING ERRCODE='23503'; END IF;
  PERFORM 1 FROM public.payments p WHERE p.organization_id=p_org AND p.order_id=p_order ORDER BY p.id FOR UPDATE;
END $$;

CREATE OR REPLACE FUNCTION noveli_private.p1b_payment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'P1-05: payments are append-only' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN
    PERFORM noveli_private.p1b_lock_order(NEW.organization_id,NEW.order_id);
    SELECT * INTO v_order FROM public.orders o WHERE o.organization_id=NEW.organization_id AND o.id=NEW.order_id;
    IF NEW.currency IS DISTINCT FROM v_order.currency THEN RAISE EXCEPTION 'P1-05: payment currency/order mismatch' USING ERRCODE='23514'; END IF;
    IF NEW.created_by IS DISTINCT FROM noveli_private.actor_uid() OR NEW.status<>'pending' OR NEW.received_at IS NOT NULL THEN
      RAISE EXCEPTION 'P1-05: new payments must be actor-owned pending records' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;
  PERFORM noveli_private.p1b_lock_order(OLD.organization_id,OLD.order_id);
  IF ROW(NEW.id,NEW.organization_id,NEW.order_id,NEW.gross_amount,NEW.provider_fee,NEW.currency,NEW.provider,
         NEW.provider_account_scope,NEW.provider_payment_id,NEW.method,NEW.idempotency_key,NEW.request_hash,
         NEW.external_reference,NEW.evidence_document_id,NEW.created_by,NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id,OLD.organization_id,OLD.order_id,OLD.gross_amount,OLD.provider_fee,OLD.currency,OLD.provider,
         OLD.provider_account_scope,OLD.provider_payment_id,OLD.method,OLD.idempotency_key,OLD.request_hash,
         OLD.external_reference,OLD.evidence_document_id,OLD.created_by,OLD.created_at) THEN
    RAISE EXCEPTION 'P1-05: payment identity and financial terms are immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.status<>'pending' THEN RAISE EXCEPTION 'P1-05: terminal payment is immutable' USING ERRCODE='23514'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('succeeded','failed','cancelled') THEN
    RAISE EXCEPTION 'P1-05: invalid payment lifecycle transition' USING ERRCODE='23514';
  END IF;
  IF NEW.status=OLD.status AND NEW.received_at IS DISTINCT FROM OLD.received_at THEN
    RAISE EXCEPTION 'P1-05: received_at changes only on success' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION noveli_private.p1b_refund_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_payment public.payments%ROWTYPE; v_previous public.payment_refunds%ROWTYPE; v_order uuid; v_provider text; v_scope text; v_conflict boolean;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'P1-05: refund events are append-only' USING ERRCODE='42501'; END IF;
  SELECT p.* INTO v_payment FROM public.payments p WHERE p.organization_id=NEW.organization_id AND p.id=NEW.payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'P1-05: payment context not found' USING ERRCODE='23503'; END IF;
  PERFORM noveli_private.p1b_lock_order(NEW.organization_id,v_payment.order_id);
  SELECT p.* INTO v_payment FROM public.payments p WHERE p.organization_id=NEW.organization_id AND p.id=NEW.payment_id FOR UPDATE;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.organization_id::text||':'||NEW.refund_key::text,1));
  IF NEW.created_by IS DISTINCT FROM noveli_private.actor_uid() THEN RAISE EXCEPTION 'P1-05: refund actor mismatch' USING ERRCODE='42501'; END IF;
  IF NEW.currency IS DISTINCT FROM v_payment.currency THEN RAISE EXCEPTION 'P1-05: refund currency mismatch' USING ERRCODE='23514'; END IF;
  IF NEW.previous_event_id IS NULL THEN
    IF NEW.event_sequence<>1 OR NEW.status<>'requested' OR EXISTS(SELECT 1 FROM public.payment_refunds r WHERE r.organization_id=NEW.organization_id AND r.refund_key=NEW.refund_key) THEN
      RAISE EXCEPTION 'P1-05: refund chain must start with one requested event' USING ERRCODE='23514';
    END IF;
  ELSE
    SELECT r.* INTO v_previous FROM public.payment_refunds r WHERE r.organization_id=NEW.organization_id AND r.id=NEW.previous_event_id;
    IF NOT FOUND OR v_previous.payment_id IS DISTINCT FROM NEW.payment_id OR v_previous.refund_key IS DISTINCT FROM NEW.refund_key
       OR v_previous.currency IS DISTINCT FROM NEW.currency OR v_previous.amount IS DISTINCT FROM NEW.amount OR v_previous.reason IS DISTINCT FROM NEW.reason
       OR (v_previous.provider_refund_id IS NOT NULL AND NEW.provider_refund_id IS DISTINCT FROM v_previous.provider_refund_id)
       OR NEW.event_sequence<>v_previous.event_sequence+1 OR v_previous.status NOT IN ('requested','processing')
       OR NOT ((v_previous.status='requested' AND NEW.status IN ('processing','succeeded','failed','cancelled'))
            OR (v_previous.status='processing' AND NEW.status IN ('succeeded','failed','cancelled'))) THEN
      RAISE EXCEPTION 'P1-05: invalid refund event chain transition' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.provider_refund_id IS NOT NULL THEN
    v_provider:=v_payment.provider; v_scope:=v_payment.provider_account_scope;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.organization_id::text||':'||v_provider||':'||v_scope||':'||NEW.provider_refund_id,0));
    SELECT EXISTS(SELECT 1 FROM public.payment_refunds r JOIN public.payments p ON p.organization_id=r.organization_id AND p.id=r.payment_id
      WHERE r.organization_id=NEW.organization_id AND r.provider_refund_id=NEW.provider_refund_id
        AND p.provider=v_provider AND p.provider_account_scope=v_scope
        AND r.refund_key IS DISTINCT FROM NEW.refund_key) INTO v_conflict;
    IF v_conflict THEN RAISE EXCEPTION 'P1-05: provider refund identity already used in namespace' USING ERRCODE='23505'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION noveli_private.p1b_allocation_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_payment public.payments%ROWTYPE; v_schedule public.payment_schedules%ROWTYPE; v_order public.orders%ROWTYPE; v_apply public.payment_allocations%ROWTYPE; v_refund public.payment_refunds%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'P1-05: allocations are append-only' USING ERRCODE='42501'; END IF;
  PERFORM noveli_private.p1b_lock_order(NEW.organization_id,NEW.order_id);
  SELECT * INTO v_payment FROM public.payments p WHERE p.organization_id=NEW.organization_id AND p.id=NEW.payment_id FOR UPDATE;
  SELECT * INTO v_schedule FROM public.payment_schedules s WHERE s.organization_id=NEW.organization_id AND s.id=NEW.payment_schedule_id;
  SELECT * INTO v_order FROM public.orders o WHERE o.organization_id=NEW.organization_id AND o.id=NEW.order_id;
  IF v_payment.id IS NULL OR v_schedule.id IS NULL OR v_order.id IS NULL
     OR v_payment.order_id IS DISTINCT FROM NEW.order_id OR v_schedule.order_id IS DISTINCT FROM NEW.order_id
     OR v_payment.currency IS DISTINCT FROM NEW.currency OR v_schedule.currency IS DISTINCT FROM NEW.currency
     OR v_order.currency IS DISTINCT FROM NEW.currency THEN
    RAISE EXCEPTION 'P1-05: allocation parent tenant/order/currency mismatch' USING ERRCODE='23514';
  END IF;
  IF v_payment.status<>'succeeded' OR v_schedule.lifecycle_status<>'scheduled' THEN
    RAISE EXCEPTION 'P1-05: allocation requires succeeded payment and published schedule' USING ERRCODE='23514';
  END IF;
  IF NEW.created_by IS DISTINCT FROM noveli_private.actor_uid() THEN RAISE EXCEPTION 'P1-05: allocation actor mismatch' USING ERRCODE='42501'; END IF;
  IF NEW.direction='apply' THEN
    IF EXISTS(SELECT 1 FROM public.payment_refunds r WHERE r.organization_id=NEW.organization_id AND r.payment_id=NEW.payment_id
      AND r.status IN ('requested','processing') AND NOT EXISTS(SELECT 1 FROM public.payment_refunds n WHERE n.organization_id=r.organization_id AND n.previous_event_id=r.id)) THEN
      RAISE EXCEPTION 'P1-05: applications are frozen while refund reservation is pending' USING ERRCODE='23514';
    END IF;
  ELSE
    SELECT * INTO v_refund FROM public.payment_refunds r WHERE r.organization_id=NEW.organization_id AND r.payment_id=NEW.payment_id AND r.id=NEW.refund_event_id;
    IF v_refund.id IS NULL THEN RAISE EXCEPTION 'P1-05: refund event context not found' USING ERRCODE='23503'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.organization_id::text||':'||v_refund.refund_key::text,1));
    SELECT * INTO v_apply FROM public.payment_allocations a WHERE a.organization_id=NEW.organization_id AND a.id=NEW.reversal_of_id FOR UPDATE;
    IF v_apply.id IS NULL OR v_apply.direction<>'apply' OR v_apply.payment_id IS DISTINCT FROM NEW.payment_id
       OR v_apply.payment_schedule_id IS DISTINCT FROM NEW.payment_schedule_id OR v_apply.order_id IS DISTINCT FROM NEW.order_id
       OR v_apply.currency IS DISTINCT FROM NEW.currency OR v_refund.id IS NULL OR v_refund.status<>'succeeded' THEN
      RAISE EXCEPTION 'P1-05: reverse must reference same-context apply and succeeded refund' USING ERRCODE='23514';
    END IF;
  END IF;
  PERFORM 1 FROM public.payment_schedules s WHERE s.organization_id=NEW.organization_id AND s.id=NEW.payment_schedule_id FOR UPDATE;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION noveli_private.p1b_deferred_totals_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_org uuid; v_order uuid; v_payment uuid; v_chain uuid; v_bad boolean;
BEGIN
  v_org:=NEW.organization_id;
  IF TG_TABLE_NAME='payments' THEN v_order:=NEW.order_id; v_payment:=NEW.id;
  ELSIF TG_TABLE_NAME='payment_allocations' THEN v_order:=NEW.order_id; v_payment:=NEW.payment_id;
  ELSE
    v_payment:=NEW.payment_id;
    SELECT p.order_id INTO v_order FROM public.payments p WHERE p.organization_id=v_org AND p.id=v_payment;
  END IF;
  IF v_order IS NULL THEN RETURN NULL; END IF;
  PERFORM noveli_private.p1b_lock_order(v_org,v_order);
  FOR v_chain IN SELECT DISTINCT pr.refund_key FROM public.payment_refunds pr JOIN public.payments p
      ON p.organization_id=pr.organization_id AND p.id=pr.payment_id
      WHERE p.organization_id=v_org AND p.order_id=v_order ORDER BY pr.refund_key
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_org::text||':'||v_chain::text,1));
  END LOOP;
  PERFORM 1 FROM public.payment_schedules s WHERE s.organization_id=v_org AND s.order_id=v_order ORDER BY s.id FOR UPDATE;
  -- One coherent post-write aggregate under the order serialization lock.
  SELECT EXISTS(
    SELECT 1 FROM public.payments p WHERE p.organization_id=v_org AND p.order_id=v_order AND (
      COALESCE((SELECT sum(r.amount) FROM public.payment_refunds r
        WHERE r.organization_id=p.organization_id AND r.payment_id=p.id
          AND r.status='succeeded' AND NOT EXISTS(SELECT 1 FROM public.payment_refunds n WHERE n.organization_id=r.organization_id AND n.previous_event_id=r.id)),0)
      + COALESCE((SELECT sum(r.amount) FROM public.payment_refunds r
        WHERE r.organization_id=p.organization_id AND r.payment_id=p.id
          AND r.status IN ('requested','processing') AND NOT EXISTS(SELECT 1 FROM public.payment_refunds n WHERE n.organization_id=r.organization_id AND n.previous_event_id=r.id)),0)
      > CASE WHEN p.status='succeeded' THEN p.gross_amount ELSE 0 END
      OR COALESCE((SELECT sum(CASE a.direction WHEN 'apply' THEN a.amount ELSE -a.amount END)
        FROM public.payment_allocations a WHERE a.organization_id=p.organization_id AND a.payment_id=p.id),0)
      > CASE WHEN p.status='succeeded' THEN p.gross_amount ELSE 0 END
        - COALESCE((SELECT sum(r.amount) FROM public.payment_refunds r WHERE r.organization_id=p.organization_id AND r.payment_id=p.id
          AND r.status IN ('requested','processing','succeeded') AND NOT EXISTS(SELECT 1 FROM public.payment_refunds n WHERE n.organization_id=r.organization_id AND n.previous_event_id=r.id)),0)
      OR COALESCE((SELECT sum(a.amount) FROM public.payment_allocations a WHERE a.organization_id=p.organization_id AND a.payment_id=p.id AND a.direction='reverse'),0)
        > COALESCE((SELECT sum(a.amount) FROM public.payment_allocations a WHERE a.organization_id=p.organization_id AND a.payment_id=p.id AND a.direction='apply'),0)
      OR EXISTS(SELECT 1 FROM public.payment_allocations ap WHERE ap.organization_id=p.organization_id AND ap.payment_id=p.id AND ap.direction='apply'
        AND (SELECT COALESCE(sum(rv.amount),0) FROM public.payment_allocations rv WHERE rv.organization_id=ap.organization_id AND rv.direction='reverse' AND rv.reversal_of_id=ap.id)>ap.amount)
    )
  ) INTO v_bad;
  IF v_bad THEN RAISE EXCEPTION 'P1-05: payment retained balance/refund reservation invariant failed' USING ERRCODE='23514'; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.payment_schedules s WHERE s.organization_id=v_org AND s.order_id=v_order AND
      COALESCE((SELECT sum(CASE a.direction WHEN 'apply' THEN a.amount ELSE -a.amount END) FROM public.payment_allocations a
        WHERE a.organization_id=s.organization_id AND a.payment_schedule_id=s.id),0)>s.expected_amount
  ) INTO v_bad;
  IF v_bad THEN RAISE EXCEPTION 'P1-05: schedule allocation cap exceeded' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION noveli_private.p1b_lock_order(uuid,uuid),noveli_private.p1b_payment_guard(),
  noveli_private.p1b_refund_guard(),noveli_private.p1b_allocation_guard(),noveli_private.p1b_deferred_totals_guard()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION noveli_private.p1b_lock_order(uuid,uuid),noveli_private.p1b_payment_guard(),
  noveli_private.p1b_refund_guard(),noveli_private.p1b_allocation_guard(),noveli_private.p1b_deferred_totals_guard()
  TO noveli_payments_executor;

CREATE TRIGGER p1b_payment_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION noveli_private.p1b_payment_guard();
CREATE TRIGGER p1b_refund_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION noveli_private.p1b_refund_guard();
CREATE TRIGGER p1b_allocation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION noveli_private.p1b_allocation_guard();
CREATE CONSTRAINT TRIGGER p1b_payment_totals AFTER INSERT OR UPDATE ON public.payments
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION noveli_private.p1b_deferred_totals_guard();
CREATE CONSTRAINT TRIGGER p1b_refund_totals AFTER INSERT ON public.payment_refunds
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION noveli_private.p1b_deferred_totals_guard();
CREATE CONSTRAINT TRIGGER p1b_allocation_totals AFTER INSERT ON public.payment_allocations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION noveli_private.p1b_deferred_totals_guard();

REVOKE CREATE ON SCHEMA noveli_private FROM noveli_payments_executor;
COMMIT;
