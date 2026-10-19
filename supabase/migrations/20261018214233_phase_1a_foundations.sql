-- Phase 1A A: foundations only. No remote operations or legacy data changes.
BEGIN;
CREATE SCHEMA noveli_private;
REVOKE ALL ON SCHEMA noveli_private FROM PUBLIC, anon;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='noveli_orders_executor') THEN
  CREATE ROLE noveli_orders_executor NOLOGIN NOINHERIT NOBYPASSRLS;
 ELSIF EXISTS(SELECT FROM pg_roles WHERE rolname='noveli_orders_executor' AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)) THEN
  RAISE EXCEPTION 'Phase1A: unexpected executor role privileges';
 END IF;
END $$;
GRANT noveli_orders_executor TO postgres WITH INHERIT FALSE, SET TRUE;
GRANT USAGE ON SCHEMA public,noveli_private TO noveli_orders_executor;
GRANT USAGE ON SCHEMA noveli_private TO authenticated;

CREATE TABLE noveli_private.order_capabilities (
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 capability text NOT NULL CHECK(capability IN ('orders','quotation_conversion')),
 enabled boolean NOT NULL DEFAULT false,
 PRIMARY KEY(organization_id,capability)
);
CREATE TABLE noveli_private.order_number_counters (
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 year smallint NOT NULL CHECK(year BETWEEN 2000 AND 9999),
 last_value integer NOT NULL CHECK(last_value BETWEEN 1 AND 999999),
 PRIMARY KEY(organization_id,year)
);
ALTER TABLE noveli_private.order_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE noveli_private.order_number_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA noveli_private FROM PUBLIC,anon,authenticated;
GRANT SELECT ON noveli_private.order_capabilities TO noveli_orders_executor;
GRANT SELECT,INSERT,UPDATE ON noveli_private.order_number_counters TO noveli_orders_executor;
CREATE FUNCTION noveli_private.actor_uid() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
GRANT SELECT ON public.organization_members TO noveli_orders_executor;
CREATE POLICY phase1a_executor_members ON public.organization_members FOR SELECT TO noveli_orders_executor
 USING(user_id=(SELECT noveli_private.actor_uid()) AND active);
CREATE POLICY phase1a_capabilities ON noveli_private.order_capabilities FOR SELECT TO noveli_orders_executor
 USING(public.is_org_member(organization_id));
CREATE POLICY phase1a_counters ON noveli_private.order_number_counters TO noveli_orders_executor
 USING(public.is_org_member(organization_id)) WITH CHECK(public.is_org_member(organization_id));

ALTER TABLE public.clients ADD CONSTRAINT phase1a_clients_tenant_id UNIQUE(organization_id,id);
ALTER TABLE public.service_catalog ADD CONSTRAINT phase1a_catalog_tenant_id UNIQUE(organization_id,id);
ALTER TABLE public.service_packs ADD CONSTRAINT phase1a_packs_tenant_id UNIQUE(organization_id,id);
ALTER TABLE public.quotations ADD CONSTRAINT phase1a_quotes_tenant_id UNIQUE(organization_id,id);
GRANT SELECT ON public.clients,public.service_catalog,public.service_packs,public.service_pack_items TO noveli_orders_executor;
CREATE POLICY phase1a_executor_clients ON public.clients FOR SELECT TO noveli_orders_executor USING(public.is_org_member(organization_id));
CREATE POLICY phase1a_executor_catalog ON public.service_catalog FOR SELECT TO noveli_orders_executor USING(public.is_org_member(organization_id));
CREATE POLICY phase1a_executor_packs ON public.service_packs FOR SELECT TO noveli_orders_executor USING(public.is_org_member(organization_id));
CREATE POLICY phase1a_executor_pack_items ON public.service_pack_items FOR SELECT TO noveli_orders_executor USING(public.is_org_member(organization_id));
GRANT INSERT ON public.activity_log TO noveli_orders_executor;
CREATE POLICY phase1a_executor_activity ON public.activity_log FOR INSERT TO noveli_orders_executor
 WITH CHECK(public.is_org_member(organization_id) AND user_id=(SELECT noveli_private.actor_uid()));

CREATE FUNCTION noveli_private.actor_role(org uuid) RETURNS text LANGUAGE sql STABLE SET search_path=''
AS $$ SELECT role FROM public.organization_members WHERE organization_id=org AND user_id=(SELECT noveli_private.actor_uid()) AND active $$;
CREATE FUNCTION noveli_private.authorize(org uuid, roles text[], capability text DEFAULT 'orders')
RETURNS void LANGUAGE plpgsql STABLE SET search_path='' AS $$
BEGIN
 IF noveli_private.actor_uid() IS NULL OR NOT coalesce(noveli_private.actor_role(org)=ANY(roles),false) THEN
  RAISE EXCEPTION 'Phase1A: permission denied' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM noveli_private.order_capabilities c WHERE c.organization_id=org AND c.capability=authorize.capability AND c.enabled) THEN
  RAISE EXCEPTION 'Phase1A: capability disabled' USING ERRCODE='42501';
 END IF;
END $$;
CREATE FUNCTION noveli_private.currency_scale(currency text) RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
 IF currency='CLP' THEN RETURN 0; ELSIF currency='USD' THEN RETURN 2; END IF;
 RAISE EXCEPTION 'Phase1A: unsupported currency' USING ERRCODE='22023';
END $$;
CREATE FUNCTION noveli_private.decimal_value(raw text, places integer, ceiling numeric DEFAULT 9999999999.99)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v numeric;
BEGIN
 IF raw IS NULL THEN RAISE EXCEPTION 'Phase1A: missing decimal' USING ERRCODE='22023'; END IF;
 v:=raw::numeric;
 IF v::text IN ('NaN','Infinity','-Infinity') OR v<0 OR v>ceiling OR v<>trunc(v,places) THEN
  RAISE EXCEPTION 'Phase1A: decimal range/scale invalid' USING ERRCODE='22023';
 END IF;
 RETURN v;
END $$;
CREATE FUNCTION noveli_private.money_valid(v numeric,currency text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=''
AS $$ SELECT v IS NOT NULL AND v::text NOT IN ('NaN','Infinity','-Infinity') AND v>=0 AND v<=9999999999.99 AND v=round(v,noveli_private.currency_scale(currency)) $$;
CREATE FUNCTION noveli_private.next_order_number(org uuid) RETURNS TABLE(number_year smallint,number_sequence integer,order_number text)
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE y smallint:=extract(year FROM now() AT TIME ZONE 'UTC'); seq integer;
BEGIN
 INSERT INTO noveli_private.order_number_counters(organization_id,year,last_value) VALUES(org,y,1)
 ON CONFLICT(organization_id,year) DO UPDATE SET last_value=noveli_private.order_number_counters.last_value+1
 RETURNING last_value INTO seq;
 RETURN QUERY SELECT y,seq,'NOV-ORD-'||y::text||'-'||lpad(seq::text,6,'0');
END $$;

-- Canonical net pricing, all amounts in currency minor units; no legacy aliases.
CREATE FUNCTION noveli_private.enrich_items(org uuid,items jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE x jsonb; result jsonb:='[]'; composition jsonb;
BEGIN
 IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Phase1A: items array required' USING ERRCODE='22023'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(items) LOOP
  IF nullif(x->>'pack_id','') IS NOT NULL THEN
   SELECT jsonb_build_object('pack_id',p.id,'name',p.name,'description',p.description,'components',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('catalog_id',c.id,'name',c.name,'description',c.description) ORDER BY c.id),'[]')
     FROM public.service_pack_items pi JOIN public.service_catalog c ON c.organization_id=pi.organization_id AND c.id=pi.service_id
     WHERE pi.organization_id=org AND pi.pack_id=p.id)) INTO composition FROM public.service_packs p WHERE p.organization_id=org AND p.id=(x->>'pack_id')::uuid;
   IF NOT FOUND THEN RAISE EXCEPTION 'Phase1A: pack unavailable' USING ERRCODE='42501'; END IF;
   x:=x||jsonb_build_object('pricing_metadata',coalesce(x->'pricing_metadata','{}')||jsonb_build_object('composition',composition));
  END IF;
  result:=result||jsonb_build_array(x);
 END LOOP;
 RETURN result;
END $$;
CREATE FUNCTION noveli_private.price(currency text,items jsonb,global_discount text DEFAULT '0')
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
#variable_conflict use_column
DECLARE scale integer:=noveli_private.currency_scale(currency); quantum numeric:=power(10::numeric,-scale);
 x jsonb; out_items jsonb:='[]'; q numeric; u numeric; adj numeric; base numeric; disc numeric; rate numeric; mode text;
 totalbase numeric:=0; fixed_discount numeric:=0; extra numeric; n integer:=0; result jsonb;
BEGIN
 IF jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items)>200 THEN RAISE EXCEPTION 'Phase1A: items array required/max200' USING ERRCODE='22023'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(items) LOOP
  n:=n+1;
  IF jsonb_typeof(x)<>'object' OR nullif(btrim(x->>'name'),'') IS NULL OR coalesce(x->>'item_type','noveli_service')<>'noveli_service' THEN
   RAISE EXCEPTION 'Phase1A: invalid item/name/type' USING ERRCODE='22023';
  END IF;
  q:=noveli_private.decimal_value(x->>'quantity',3,999999999.999);
  IF q=0 THEN RAISE EXCEPTION 'Phase1A: quantity must be positive' USING ERRCODE='22023'; END IF;
  u:=noveli_private.decimal_value(x->>'unit_price',12,999999999999999999.999999999999);
  adj:=coalesce(x->>'rounding_adjustment','0')::numeric;
  IF adj::text IN ('NaN','Infinity','-Infinity') OR abs(adj)>quantum OR adj<>round(adj,scale) THEN RAISE EXCEPTION 'Phase1A: invalid rounding adjustment' USING ERRCODE='22023'; END IF;
  base:=round(q*u,scale)+adj;
  IF NOT noveli_private.money_valid(base,currency) THEN RAISE EXCEPTION 'Phase1A: subtotal range' USING ERRCODE='22023'; END IF;
  disc:=noveli_private.decimal_value(coalesce(x->>'discount','0'),scale);
  IF disc>base THEN RAISE EXCEPTION 'Phase1A: discount exceeds base' USING ERRCODE='22023'; END IF;
  rate:=noveli_private.decimal_value(coalesce(x->>'tax_rate','0'),4,100);
  mode:=coalesce(x->>'tax_mode','exempt');
  IF mode NOT IN ('net','added','included','exempt') OR (mode='exempt' AND rate<>0) THEN RAISE EXCEPTION 'Phase1A: invalid tax treatment' USING ERRCODE='22023'; END IF;
  IF coalesce(x->>'currency',currency)<>currency OR (nullif(x->>'catalog_id','') IS NOT NULL AND nullif(x->>'pack_id','') IS NOT NULL) OR
    (x ? 'pricing_version' AND (x->>'pricing_version')::integer<>1) OR jsonb_typeof(coalesce(x->'pricing_metadata','{}'))<>'object' THEN
   RAISE EXCEPTION 'Phase1A: invalid item context/version' USING ERRCODE='22023';
  END IF;
  out_items:=out_items||jsonb_build_array(jsonb_build_object('position',n,'name',x->>'name','description',coalesce(x->>'description',''),
   'quantity',q,'unit_price',u,'rounding_adjustment',adj,'subtotal',base,'discount',disc,'tax_rate',rate,'tax_mode',mode,'currency',currency,
   'catalog_id',nullif(x->>'catalog_id','')::uuid,'pack_id',nullif(x->>'pack_id','')::uuid,
   'source_quotation_item_id',nullif(x->>'source_quotation_item_id','')::uuid,'item_type','noveli_service','pricing_version',1,
   'pricing_metadata',coalesce(x->'pricing_metadata','{}')||jsonb_build_object('schema_version',1,'source_catalog_id',x->>'catalog_id','source_pack_id',x->>'pack_id')));
  totalbase:=totalbase+base; fixed_discount:=fixed_discount+disc;
 END LOOP;
 extra:=noveli_private.decimal_value(global_discount,scale);
 IF extra>totalbase-fixed_discount THEN RAISE EXCEPTION 'Phase1A: global discount exceeds base' USING ERRCODE='22023'; END IF;
 WITH lines AS(SELECT value x,(value->>'position')::integer pos,(value->>'subtotal')::numeric b,(value->>'discount')::numeric d FROM jsonb_array_elements(out_items)),
 shares AS(SELECT *,CASE WHEN totalbase=fixed_discount THEN 0 ELSE extra/quantum*(b-d)/(totalbase-fixed_discount) END units FROM lines),
 ranked AS(SELECT *,row_number() OVER(ORDER BY units-floor(units) DESC,pos) rn,extra/quantum-sum(floor(units)) OVER() remaining FROM shares),
 discounted AS(SELECT x||jsonb_build_object('discount',d+(floor(units)+CASE WHEN rn<=remaining THEN 1 ELSE 0 END)*quantum) x,pos FROM ranked),
 taxable AS(SELECT *,((x->>'subtotal')::numeric-(x->>'discount')::numeric)*(x->>'tax_rate')::numeric/100/quantum units FROM discounted),
 taxes AS(SELECT *,row_number() OVER(PARTITION BY x->>'tax_rate',x->>'tax_mode' ORDER BY units-floor(units) DESC,pos) rn,
 round(sum(units) OVER(PARTITION BY x->>'tax_rate',x->>'tax_mode'),0)-sum(floor(units)) OVER(PARTITION BY x->>'tax_rate',x->>'tax_mode') remaining FROM taxable),
 finished AS(SELECT x||jsonb_build_object('tax',(floor(units)+CASE WHEN rn<=remaining THEN 1 ELSE 0 END)*quantum,
 'total',(x->>'subtotal')::numeric-(x->>'discount')::numeric+(floor(units)+CASE WHEN rn<=remaining THEN 1 ELSE 0 END)*quantum) x,pos FROM taxes)
 SELECT jsonb_build_object('currency',currency,'pricing_version',1,'items',coalesce(jsonb_agg(x ORDER BY pos),'[]'),
 'subtotal',coalesce(sum((x->>'subtotal')::numeric),0),'discount',coalesce(sum((x->>'discount')::numeric),0),
 'tax',coalesce(sum((x->>'tax')::numeric),0),'total',coalesce(sum((x->>'total')::numeric),0)) INTO result FROM finished;
 IF NOT noveli_private.money_valid((result->>'total')::numeric,currency) OR NOT noveli_private.money_valid((result->>'subtotal')::numeric,currency) THEN
  RAISE EXCEPTION 'Phase1A: order limit exceeded' USING ERRCODE='22023';
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA noveli_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA noveli_private TO noveli_orders_executor;
COMMIT;
