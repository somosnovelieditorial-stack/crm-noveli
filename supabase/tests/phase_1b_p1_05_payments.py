"""P1-05 frozen ledger schema/domain/RLS tests; synthetic local data only."""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import json
from pathlib import Path
import subprocess
import threading
import time
import uuid

checks = []
CONTAINER = "supabase_db_CRM_NOVELI"

def uid(): return str(uuid.uuid4())
def lit(v):
    if v is None: return "NULL"
    return "'" + str(v).replace("'", "''") + "'"
def jsql(v): return lit(json.dumps(v, ensure_ascii=False)) + "::jsonb"
def sql(query, actor=None, role="authenticated", fail=None):
    if actor:
        claims = jsql({"sub": actor, "role": "authenticated"}) + "::text"
        query = ("BEGIN; SET LOCAL ROLE " + role + "; SELECT set_config('request.jwt.claim.sub'," + lit(actor) +
                 ",true); SELECT set_config('request.jwt.claims'," + claims + ",true); " + query + "; COMMIT;")
    elif role:
        query = "BEGIN; SET LOCAL ROLE " + role + "; " + query + "; COMMIT;"
    p = subprocess.run(["docker", "exec", "-i", CONTAINER, "psql", "-X", "-U", "postgres", "-d", "postgres",
                        "-v", "ON_ERROR_STOP=1", "-qAt"], input=query.encode(), capture_output=True)
    out, err = p.stdout.decode(errors="replace"), p.stderr.decode(errors="replace")
    if fail is not None:
        assert p.returncode != 0 and (not fail or fail in err), (fail, err, out)
        return err
    if p.returncode:
        raise AssertionError(err)
    lines = [x for x in out.strip().splitlines() if x.strip()]
    return lines[-1] if lines else ""
def check(name, ok=True):
    assert ok, name
    checks.append(name)
    print("PASS:", name, flush=True)
def internal(actor, statement):
    return sql(statement, actor, "noveli_payments_executor")

org, other = uid(), uid()
roles = ["admin", "editor", "diseñador", "corrector", "finanzas", "visualizador"]
users = {role: uid() for role in roles}
other_admin = uid()
client, other_client = uid(), uid()
setup = "INSERT INTO public.organizations(id,name) VALUES(" + lit(org) + ",'P1-05 test'),(" + lit(other) + ",'P1-05 other');"
setup += "INSERT INTO auth.users(id,email) VALUES " + ",".join("(" + lit(u) + "," + lit(u + "@example.invalid") + ")" for u in list(users.values()) + [other_admin]) + ";"
setup += "INSERT INTO public.organization_members(organization_id,user_id,role,active) VALUES " + ",".join(
    "(" + lit(org) + "," + lit(users[r]) + "," + lit(r) + ",true)" for r in roles) + ",(" + lit(other) + "," + lit(other_admin) + ",'admin',true);"
setup += "INSERT INTO public.clients(id,organization_id,user_id,name) VALUES(" + lit(client) + "," + lit(org) + "," + lit(users['admin']) + ",'P1-05 test'),(" + lit(other_client) + "," + lit(other) + "," + lit(other_admin) + ",'P1-05 other');"
setup += "INSERT INTO noveli_private.order_capabilities(organization_id,capability,enabled) VALUES(" + lit(org) + ",'orders',true),(" + lit(other) + ",'orders',true);"
sql(setup, role="postgres")

def create_order(actor, org_id, client_id, price="100", currency="CLP", accept=True):
    item = [{"name": "Synthetic ledger service", "quantity": "1", "unit_price": price, "tax_rate": "0", "tax_mode": "exempt"}]
    out = sql("SELECT public.phase1a_create_order_draft(" + ",".join([lit(org_id), lit(client_id), lit(uid()), lit(currency), jsql(item)]) + ")", actor)
    order = json.loads(out)
    if accept:
        sql("SELECT public.phase1a_submit_order(" + lit(org_id) + "," + lit(order['id']) + ")", actor)
        sql("SELECT public.phase1a_accept_order(" + lit(org_id) + "," + lit(order['id']) + "," + jsql({"channel": "synthetic local fixture"}) + ")", actor)
    return order

def publish_schedule(actor, org_id, order_id, items):
    sql("SELECT public.phase1b_save_payment_schedule_draft(" + ",".join([lit(org_id), lit(order_id), jsql(items)]) + ")", actor)
    sql("SELECT public.phase1b_publish_payment_schedule_plan(" + lit(org_id) + "," + lit(order_id) + ")", actor)
    return json.loads(sql("SELECT json_agg(json_build_object('id',id,'sequence',sequence,'amount',expected_amount::text) ORDER BY sequence) FROM public.payment_schedules WHERE organization_id=" + lit(org_id) + " AND order_id=" + lit(order_id), actor))

def payment(actor, order_id, *, amount="100", currency="CLP", provider="manual", scope="manual", ext_id=None,
            idem=None, fee="0", method="transfer", evidence=None, succeed=True, organization_id=None):
    organization_id = organization_id or org
    idem = idem or uid()
    fields = ["organization_id", "order_id", "gross_amount", "provider_fee", "currency", "provider", "provider_account_scope",
              "provider_payment_id", "method", "idempotency_key", "request_hash", "evidence_document_id", "created_by"]
    vals = [lit(organization_id), lit(order_id), amount, fee, lit(currency), lit(provider), lit(scope), lit(ext_id), lit(method), lit(idem),
            lit("sha256-v1:" + "a" * 64), lit(evidence), lit(actor)]
    out = internal(actor, "INSERT INTO public.payments(" + ",".join(fields) + ") VALUES(" + ",".join(vals) + ") RETURNING id")
    pid = out
    if succeed:
        internal(actor, "UPDATE public.payments SET status='succeeded',received_at=now() WHERE organization_id=" + lit(org) + " AND id=" + lit(pid))
    return pid, idem

def payment_insert_sql(**overrides):
    values = {
        "organization_id": org, "order_id": order1["id"], "gross_amount": "1", "provider_fee": "0",
        "currency": "CLP", "provider": "manual", "provider_account_scope": "manual",
        "provider_payment_id": None, "method": "cash", "idempotency_key": uid(),
        "request_hash": "sha256-v1:" + "a" * 64, "evidence_document_id": None, "created_by": admin,
    }
    values.update(overrides)
    columns = list(values)
    encoded = [values[k] if k in ("gross_amount", "provider_fee") else lit(values[k]) for k in columns]
    return "INSERT INTO public.payments(" + ",".join(columns) + ") VALUES(" + ",".join(encoded) + ")"

def allocation(actor, pid, schedule_id, order_id, amount, *, direction="apply", reversal=None, refund=None, op=None, pos=1):
    return internal(actor, "INSERT INTO public.payment_allocations(organization_id,payment_id,payment_schedule_id,order_id,currency,amount,created_by,direction,reversal_of_id,refund_event_id,operation_key,operation_position) VALUES(" + ",".join([
        lit(org), lit(pid), lit(schedule_id), lit(order_id), lit("CLP"), amount, lit(actor), lit(direction), lit(reversal), lit(refund), lit(op or uid()), str(pos)]) + ") RETURNING id")

admin, finance = users['admin'], users['finanzas']
order1 = create_order(admin, org, client, "100")
schedules1 = publish_schedule(admin, org, order1['id'], [
    {"sequence": 1, "expected_amount": "40", "due_kind": "fixed_date", "due_date": "2026-12-01"},
    {"sequence": 2, "expected_amount": "60", "due_kind": "fixed_date", "due_date": "2027-01-01"}])

shape = json.loads(sql("SELECT json_build_object('tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN('payments','payment_refunds','payment_allocations')),'rls',(SELECT count(*) FROM pg_class WHERE oid IN('public.payments'::regclass,'public.payment_refunds'::regclass,'public.payment_allocations'::regclass) AND relrowsecurity AND relforcerowsecurity),'generated',(SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='net_amount' AND is_generated='ALWAYS' AND generation_expression LIKE '%gross_amount%provider_fee%'),'functions',(SELECT count(*) FROM pg_proc WHERE pronamespace='noveli_private'::regnamespace AND proname LIKE 'p1b_%'),'definer_functions',(SELECT count(*) FROM pg_proc WHERE pronamespace='noveli_private'::regnamespace AND proname LIKE 'p1b_%' AND prosecdef))", role="postgres"))
check("three tables, FORCE RLS, stored generated net, no SECURITY DEFINER guards", shape == {"tables": 3, "rls": 3, "generated": 1, "functions": 5, "definer_functions": 0})
metadata_query = """
SELECT COALESCE(json_agg(json_build_object(
  'table',c.relname,'name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
  'nullable',NOT a.attnotnull,'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),
  'generated',a.attgenerated,'collation',coll.collname
) ORDER BY c.relname,a.attnum),'[]'::json)
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
LEFT JOIN pg_catalog.pg_collation coll ON coll.oid=a.attcollation
WHERE n.nspname='public' AND c.relname IN ('payments','payment_refunds','payment_allocations')
  AND a.attnum>0 AND NOT a.attisdropped
"""
actual_columns = json.loads(sql(metadata_query, role="postgres"))
frozen = json.loads(Path("docs/noveli-2/phase-1/PHASE-1B-P1-05-PHYSICAL-DESIGN.json").read_text(encoding="utf-8"))
expected_columns = [(table, col) for table, spec in frozen["tables"].items() for col in spec["columns"]]
expected_columns.sort(key=lambda item: item[0])
def normalize_sql(value):
    return " ".join((value or "").replace("::text", "").strip().strip("()").lower().split())
metadata_matches = len(actual_columns) == len(expected_columns)
for actual, (table, expected) in zip(actual_columns, expected_columns):
    expected_type = expected["type"].replace(' COLLATE "C"', "").replace(" COLLATE C", "")
    expected_type = expected_type.replace("timestamptz", "timestamp with time zone")
    default = expected["default"]
    generated = "GENERATED ALWAYS AS" in (default or "")
    metadata_matches &= actual["table"] == table and actual["name"] == expected["name"]
    metadata_matches &= actual["type"] == expected_type and actual["nullable"] == expected["nullable"]
    metadata_matches &= actual["generated"] == ("s" if generated else "")
    if generated:
        metadata_matches &= normalize_sql(actual["default"]).replace(" ", "") == "gross_amount-provider_fee"
    else:
        metadata_matches &= normalize_sql(actual["default"]) == normalize_sql(default)
    if "COLLATE C" in expected["type"] or 'COLLATE "C"' in expected["type"]:
        metadata_matches &= actual["collation"] == "C"
if not metadata_matches:
    print("COLUMN METADATA DIAGNOSTIC:", flush=True)
    for actual, (table, expected) in zip(actual_columns, expected_columns):
        expected_type = expected["type"].replace(' COLLATE "C"', "").replace(" COLLATE C", "")
        expected_type = expected_type.replace("timestamptz", "timestamp with time zone")
        generated_expected = "GENERATED ALWAYS AS" in (expected["default"] or "")
        collation_mismatch = ("COLLATE C" in expected["type"] or 'COLLATE "C"' in expected["type"]) and actual["collation"] != "C"
        default_mismatch = (normalize_sql(actual["default"]).replace(" ", "") != "gross_amount-provider_fee" if generated_expected
                            else normalize_sql(actual["default"]) != normalize_sql(expected["default"]))
        if (actual["table"] != table or actual["name"] != expected["name"] or actual["type"] != expected_type
                or actual["nullable"] != expected["nullable"] or default_mismatch or collation_mismatch
                or actual["generated"] != ("s" if generated_expected else "")):
            print(json.dumps({"actual": actual, "expected_table": table, "expected_column": expected}, ensure_ascii=False), flush=True)
check("all frozen column names/types/nullability/defaults/generated expressions/provider collations match PostgreSQL catalog", bool(metadata_matches))
required_constraints = [
    "p1b_payments_org_id_key","p1b_payments_org_id_currency_key","p1b_payments_idempotency_key","p1b_payments_order_fk","p1b_payments_evidence_fk","p1b_payments_actor_fk",
    "p1b_payments_currency_check","p1b_payments_gross_check","p1b_payments_fee_check","p1b_payments_provider_check","p1b_payments_scope_check","p1b_payments_provider_id_check","p1b_payments_method_check","p1b_payments_hash_check","p1b_payments_status_check","p1b_payments_received_check",
    "p1b_refunds_org_id_key","p1b_refunds_org_id_currency_key","p1b_refunds_payment_event_key","p1b_refunds_chain_sequence_key","p1b_refunds_operation_key","p1b_refunds_payment_fk","p1b_refunds_previous_fk","p1b_refunds_actor_fk","p1b_refunds_currency_check","p1b_refunds_sequence_check","p1b_refunds_amount_check","p1b_refunds_reason_check","p1b_refunds_status_check","p1b_refunds_processed_check","p1b_refunds_provider_id_check","p1b_refunds_hash_check",
    "p1b_allocations_org_id_key","p1b_allocations_operation_position_key","p1b_allocations_payment_fk","p1b_allocations_schedule_fk","p1b_allocations_order_fk","p1b_allocations_refund_fk","p1b_allocations_reversal_fk","p1b_allocations_actor_fk","p1b_allocations_currency_check","p1b_allocations_amount_check","p1b_allocations_direction_check","p1b_allocations_position_check","p1b_allocations_shape_check",
]
constraint_sql = "SELECT count(*) FROM pg_catalog.pg_constraint WHERE connamespace='public'::regnamespace AND conname=ANY(ARRAY[" + ",".join(lit(x) for x in required_constraints) + "]::name[])"
check("frozen FK/unique/check constraints are present in PostgreSQL catalog", sql(constraint_sql, role="postgres") == str(len(required_constraints)))
check("approved documents tenant evidence index exists", sql("SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='documents' AND indexname='phase1b_documents_org_id'", role="postgres") == "1")
check("payment schedule and orders schema untouched", sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name IN('orders','payment_schedules') AND column_name IN('paid_amount','payment_status','payment_id')", role="postgres") == "0")
sql("UPDATE public.orders SET commercial_status='cancelled' WHERE id="+lit(order1['id']),admin,"noveli_payments_executor",fail="")
sql("UPDATE public.payment_schedules SET lifecycle_status='cancelled' WHERE id="+lit(schedules1[0]['id']),admin,"noveli_payments_executor",fail="")
check("internal row-lock parent grants do not permit order or schedule mutation")
check("API roles cannot SET internal executor",sql("SELECT NOT pg_has_role('authenticated','noveli_payments_executor','SET') AND NOT pg_has_role('service_role','noveli_payments_executor','SET')",role="postgres")=="t")
check("no P1-06 public write RPCs", sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('phase1b_record_payment','phase1b_confirm_payment','phase1b_allocate_payment','phase1b_record_refund','phase1b_process_refund')", role="postgres") == "0")

pid, idem = payment(admin, order1['id'], amount="100", ext_id="external-" + "x" * 500)
check("CLP payment succeeds; exact long external ID retained", sql("SELECT length(provider_payment_id)||':'||(provider_payment_id='external-'||repeat('x',500)) FROM public.payments WHERE id=" + lit(pid), role="postgres") == "509:true")
check("generated net is 100 with zero fee", sql("SELECT net_amount::text FROM public.payments WHERE id=" + lit(pid), role="postgres") == "100.00")
net_case_payment, _ = payment(admin, order1['id'], amount="100", fee="20", ext_id="net-case-20")
check("generated net is 80 for gross 100 and fee 20", sql("SELECT net_amount::text FROM public.payments WHERE id=" + lit(net_case_payment), role="postgres") == "80.00")
usd_order = create_order(admin, org, client, "12.50", "USD")
usd_schedule = publish_schedule(admin, org, usd_order['id'], [{"sequence": 1, "expected_amount": "12.50", "due_kind": "fixed_date", "due_date": "2026-12-01"}])
usd_pid, _ = payment(admin, usd_order['id'], amount="12.50", fee="0.50", currency="USD", provider="manual", scope="manual")
check("USD payment and generated net are exact", sql("SELECT gross_amount::text||':'||provider_fee::text||':'||net_amount::text FROM public.payments WHERE id=" + lit(usd_pid), role="postgres") == "12.50:0.50:12.00")
check("fee zero accepted explicitly", payment(admin, order1['id'], amount="1", ext_id="fee-zero")[0] != "")
same_external_other_scope, _ = payment(admin, order1['id'], amount="1", provider="manual", scope="manual-archive", ext_id="external-" + "x" * 500)
check("same provider ID in a distinct account scope remains valid", same_external_other_scope != "")

invalids = [
    ("zero gross rejected", "gross_amount,provider_fee", "0,0"),
    ("negative gross rejected", "gross_amount,provider_fee", "-1,0"),
    ("negative fee rejected", "gross_amount,provider_fee", "1,-0.01"),
    ("fee over gross rejected", "gross_amount,provider_fee", "1,1.01"),
]
for label, _, values in invalids:
    g, f = values.split(",")
    query = "INSERT INTO public.payments(organization_id,order_id,gross_amount,provider_fee,currency,provider,provider_account_scope,method,idempotency_key,request_hash,created_by) VALUES(" + ",".join([lit(org),lit(order1['id']),g,f,lit('CLP'),lit('manual'),lit('manual'),lit('cash'),lit(uid()),lit('sha256-v1:'+'b'*64),lit(admin)]) + ")"
    internal(admin, query) if label.startswith("fee zero") else sql(query, admin, "noveli_payments_executor", fail="")
    if not label.startswith("fee zero"): check(label)
check("invalid currency rejected", sql("INSERT INTO public.payments(organization_id,order_id,gross_amount,provider_fee,currency,provider,provider_account_scope,method,idempotency_key,request_hash,created_by) VALUES(" + ",".join([lit(org),lit(order1['id']),"1","0",lit('EUR'),lit('manual'),lit('manual'),lit('cash'),lit(uid()),lit('sha256-v1:'+'b'*64),lit(admin)]) + ")", admin, "noveli_payments_executor", fail="") is not None)
for bad_hash in ["SHA256-V1:"+"a"*64, "sha256-v1:"+"a"*63, "sha256-v1:"+"g"*64, "wrong:"+"a"*64]:
    q = "INSERT INTO public.payments(organization_id,order_id,gross_amount,provider_fee,currency,provider,provider_account_scope,method,idempotency_key,request_hash,created_by) VALUES(" + ",".join([lit(org),lit(order1['id']),"1","0",lit('CLP'),lit('manual'),lit('manual'),lit('cash'),lit(uid()),lit(bad_hash),lit(admin)]) + ")"
    sql(q, admin, "noveli_payments_executor", fail="")
check("malformed request hash rejected in four representations")
sql(payment_insert_sql(request_hash="sha256-v1:" + "a" * 65), admin, "noveli_payments_executor", fail="")
check("overlong request hash rejected")
for label, changes in [
    ("empty provider rejected", {"provider": ""}),
    ("mixed-case provider rejected", {"provider": "Manual"}),
    ("padded provider rejected", {"provider": " manual "}),
    ("empty provider account scope rejected", {"provider_account_scope": ""}),
    ("empty external provider ID rejected", {"provider_payment_id": ""}),
]:
    sql(payment_insert_sql(**changes), admin, "noveli_payments_executor", fail="")
    check(label)
for label, changes in [
    ("CLP fractional gross rejected", {"gross_amount": "1.01"}),
    ("payment above frozen business maximum rejected", {"gross_amount": "10000000000", "provider_fee": "0"}),
    ("USD amount beyond frozen precision rejected", {"currency": "USD", "gross_amount": "1.001"}),
]:
    sql(payment_insert_sql(**changes), admin, "noveli_payments_executor", fail="")
    check(label)
base_payment_insert = payment_insert_sql()
payment_columns, payment_values = base_payment_insert.split(") VALUES(", 1)
forged_net = payment_columns + ",net_amount) VALUES (" + payment_values[:-1] + ",0)"
sql(forged_net, admin, "noveli_payments_executor", fail="cannot insert a non-DEFAULT value")
check("generated net cannot be supplied or forged by INSERT")

try:
    payment(admin, order1['id'], amount="1", provider="manual", scope="manual", ext_id=sql("SELECT provider_payment_id FROM public.payments WHERE id="+lit(pid), role="postgres"))
    raise AssertionError("provider duplicate accepted")
except AssertionError as e:
    if str(e)=="provider duplicate accepted": raise
check("provider identity duplicate rejected")
sql("INSERT INTO public.payments(organization_id,order_id,gross_amount,provider_fee,currency,provider,provider_account_scope,method,idempotency_key,request_hash,created_by) VALUES(" + ",".join([lit(org),lit(order1['id']),"1","0",lit('CLP'),lit('manual'),lit('manual'),lit('cash'),lit(idem),lit('sha256-v1:'+'c'*64),lit(admin)]) + ")", admin, "noveli_payments_executor", fail="")
check("idempotency key unique per organization")
manual_a, _ = payment(admin, order1['id'], amount="1", ext_id=None)
manual_b, _ = payment(admin, order1['id'], amount="1", ext_id=None)
check("manual NULL external identities may repeat under distinct idempotency keys", manual_a != manual_b)
pending_pid, _ = payment(admin, order1['id'], amount="2", ext_id="pending-transition", succeed=False)
internal(admin, "UPDATE public.payments SET notes='pending note' WHERE id=" + lit(pending_pid))
internal(admin, "UPDATE public.payments SET status='failed' WHERE id=" + lit(pending_pid))
sql("UPDATE public.payments SET notes='terminal edit' WHERE id=" + lit(pending_pid), admin, "noveli_payments_executor", fail="")
check("pending payment lifecycle and pending notes allowed; terminal payment immutable")
sql("UPDATE public.payments SET gross_amount=2 WHERE id=" + lit(pid), admin, "noveli_payments_executor", fail="")
sql("DELETE FROM public.payments WHERE id=" + lit(pid), admin, "noveli_payments_executor", fail="")
check("payment financial terms immutable and DELETE prohibited")
sql("UPDATE public.payments SET currency='USD' WHERE id=" + lit(pid), admin, "noveli_payments_executor", fail="")
check("payment currency immutable")

other_order = create_order(other_admin, other, other_client, "25")
sql("INSERT INTO noveli_private.order_capabilities(organization_id,capability,enabled) VALUES("+lit(other)+",'orders',true) ON CONFLICT DO NOTHING", role="postgres")
other_schedules = publish_schedule(other_admin, other, other_order['id'], [{"sequence": 1, "expected_amount": "25", "due_kind": "fixed_date", "due_date": "2026-12-15"}])
same_external_other_tenant, _ = payment(other_admin, other_order['id'], amount="1", provider="manual", scope="manual", ext_id="external-" + "x" * 500, organization_id=other, succeed=False)
same_idem_other_tenant, _ = payment(other_admin, other_order['id'], amount="1", provider="manual", scope="manual", ext_id=None, idem=idem, organization_id=other, succeed=False)
check("provider and idempotency identities are tenant-scoped, not globally unique", bool(same_external_other_tenant and same_idem_other_tenant))
cross_pay = "INSERT INTO public.payments(organization_id,order_id,gross_amount,provider_fee,currency,provider,provider_account_scope,method,idempotency_key,request_hash,created_by) VALUES(" + ",".join([lit(org),lit(other_order['id']),"1","0",lit('CLP'),lit('manual'),lit('manual'),lit('cash'),lit(uid()),lit('sha256-v1:'+'d'*64),lit(admin)]) + ")"
sql(cross_pay, admin, "noveli_payments_executor", fail="")
check("cross-tenant order/payment rejected")
foreign_payment, _ = payment(other_admin, other_order['id'], amount="25", organization_id=other, ext_id="foreign-payment")
sql("INSERT INTO public.payment_refunds(organization_id,payment_id,currency,refund_key,event_sequence,amount,reason,status,operation_key,request_hash,created_by) VALUES("+",".join([lit(org),lit(foreign_payment),lit('CLP'),lit(uid()),"1","1",lit('foreign'),lit('requested'),lit(uid()),lit('sha256-v1:'+'a'*64),lit(admin)])+")",admin,"noveli_payments_executor",fail="")
check("cross-tenant refund/payment rejected")
sql("INSERT INTO public.payment_allocations(organization_id,payment_id,payment_schedule_id,order_id,currency,amount,created_by,direction,operation_key,operation_position) VALUES("+",".join([lit(org),lit(foreign_payment),lit(schedules1[0]['id']),lit(order1['id']),lit('CLP'),"1",lit(admin),lit('apply'),lit(uid()),"1"])+")",admin,"noveli_payments_executor",fail="")
check("cross-tenant allocation/payment rejected")
cross_tenant_schedule_sql = "INSERT INTO public.payment_allocations(organization_id,payment_id,payment_schedule_id,order_id,currency,amount,created_by,direction,operation_key,operation_position) VALUES(" + ",".join([lit(org),lit(pid),lit(other_schedules[0]['id']),lit(order1['id']),lit('CLP'),"1",lit(admin),lit('apply'),lit(uid()),"1"]) + ")"
sql(cross_tenant_schedule_sql, admin, "noveli_payments_executor", fail="P1-05: allocation parent tenant/order/currency mismatch")
check("valid payment and valid foreign-tenant schedule cannot be cross-linked")

doc_id, other_doc_id = uid(), uid()
sql("INSERT INTO public.documents(id,user_id,organization_id,file_path,mime_type) VALUES("+lit(doc_id)+","+lit(admin)+","+lit(org)+",'local/test.pdf','application/pdf'),("+lit(other_doc_id)+","+lit(other_admin)+","+lit(other)+",'local/other.pdf','application/pdf')", role="postgres")
evidence_pid, _ = payment(admin, order1['id'], amount="1", evidence=doc_id)
check("same-tenant document evidence accepted", evidence_pid != "")
bad_evidence = "INSERT INTO public.payments(organization_id,order_id,gross_amount,provider_fee,currency,provider,provider_account_scope,method,idempotency_key,request_hash,evidence_document_id,created_by) VALUES(" + ",".join([lit(org),lit(order1['id']),"1","0",lit('CLP'),lit('manual'),lit('manual'),lit('cash'),lit(uid()),lit('sha256-v1:'+'e'*64),lit(other_doc_id),lit(admin)]) + ")"
sql(bad_evidence, admin, "noveli_payments_executor", fail="")
check("cross-tenant document evidence rejected")
invalid_evidence = payment_insert_sql(evidence_document_id=uid())
sql(invalid_evidence, admin, "noveli_payments_executor", fail="")
check("nonexistent evidence document rejected by composite FK")

def refund(actor, payment_id, refund_key, seq=1, previous=None, amount="10", status="requested", provider_refund_id=None, processed_at=None):
    return internal(actor, "INSERT INTO public.payment_refunds(organization_id,payment_id,currency,refund_key,event_sequence,previous_event_id,amount,reason,status,processed_at,provider_refund_id,operation_key,request_hash,created_by) VALUES(" + ",".join([
        lit(org),lit(payment_id),lit('CLP'),lit(refund_key),str(seq),lit(previous),amount,lit('customer request'),lit(status),("now()" if processed_at else "NULL"),lit(provider_refund_id),lit(uid()),lit('sha256-v1:'+'f'*64),lit(actor)]) + ") RETURNING id")

refund_payment, _ = payment(admin, order1['id'], amount="20", ext_id="refund-source")
rk=uid(); r1=refund(admin,refund_payment,rk,amount="10",provider_refund_id="refund-identity")
r2=refund(admin,refund_payment,rk,2,r1,"10","processing","refund-identity")
r3=refund(admin,refund_payment,rk,3,r2,"10","succeeded","refund-identity",True)
check("refund requested/processing/succeeded append chain valid", sql("SELECT string_agg(status,',' ORDER BY event_sequence) FROM public.payment_refunds WHERE refund_key="+lit(rk), role="postgres")=="requested,processing,succeeded")
sql("INSERT INTO public.payment_refunds(organization_id,payment_id,currency,refund_key,event_sequence,amount,reason,status,operation_key,request_hash,created_by) VALUES("+",".join([lit(org),lit(refund_payment),lit('CLP'),lit(uid()),"1","21",lit('too much'),lit('requested'),lit(uid()),lit('sha256-v1:'+'f'*64),lit(admin)])+")",admin,"noveli_payments_executor",fail="")
check("refund reservation above payment gross rejected by deferred guard")
sql("UPDATE public.payment_refunds SET reason='changed' WHERE id="+lit(r1), admin, "noveli_payments_executor", fail="")
check("refund UPDATE prohibited")
sql("DELETE FROM public.payment_refunds WHERE id="+lit(r1), admin, "noveli_payments_executor", fail="")
check("refund DELETE prohibited")
for bad in [("zero refund rejected","0"),("negative refund rejected","-1")]:
    sql("INSERT INTO public.payment_refunds(organization_id,payment_id,currency,refund_key,event_sequence,amount,reason,status,operation_key,request_hash,created_by) VALUES("+",".join([lit(org),lit(refund_payment),lit('CLP'),lit(uid()),"1",bad[1],lit('bad'),lit('requested'),lit(uid()),lit('sha256-v1:'+'f'*64),lit(admin)])+")", admin,"noveli_payments_executor",fail="")
    check(bad[0])
wrong_currency_refund="INSERT INTO public.payment_refunds(organization_id,payment_id,currency,refund_key,event_sequence,amount,reason,status,operation_key,request_hash,created_by) VALUES("+",".join([lit(org),lit(refund_payment),lit('USD'),lit(uid()),"1","1",lit('bad'),lit('requested'),lit(uid()),lit('sha256-v1:'+'f'*64),lit(admin)])+")"
sql(wrong_currency_refund,admin,"noveli_payments_executor",fail="")
check("refund currency mismatch rejected")
branch="INSERT INTO public.payment_refunds(organization_id,payment_id,currency,refund_key,event_sequence,previous_event_id,amount,reason,status,processed_at,operation_key,request_hash,created_by) VALUES("+",".join([lit(org),lit(refund_payment),lit('CLP'),lit(rk),"4",lit(r2),"10",lit('customer request'),lit('failed'),lit('now()'),lit(uid()),lit('sha256-v1:'+'f'*64),lit(admin)])+")"
sql(branch,admin,"noveli_payments_executor",fail="")
check("refund chain branch and terminal successor rejected")

pay_a, _ = payment(admin, order1['id'], amount="40", provider="gateway", scope="merchant-a", ext_id="provider-A")
pay_b, _ = payment(admin, order1['id'], amount="40", provider="gateway", scope="merchant-a", ext_id="provider-B")
refund(admin,pay_a,uid(),amount="1",provider_refund_id="global-refund-id")
sql("INSERT INTO public.payment_refunds(organization_id,payment_id,currency,refund_key,event_sequence,amount,reason,status,provider_refund_id,operation_key,request_hash,created_by) VALUES("+",".join([lit(org),lit(pay_b),lit('CLP'),lit(uid()),"1","1",lit('customer request'),lit('requested'),lit('global-refund-id'),lit(uid()),lit('sha256-v1:'+'f'*64),lit(admin)])+")",admin,"noveli_payments_executor",fail="")
check("provider refund identity dedupe spans payments in provider/account namespace")

reservation_payment, _ = payment(admin, order1['id'], amount="100", ext_id="concurrent-refund-reservation")
refund_barrier=threading.Barrier(2)
def concurrent_refund_reservation(_):
    refund_barrier.wait(timeout=10)
    q="INSERT INTO public.payment_refunds(organization_id,payment_id,currency,refund_key,event_sequence,amount,reason,status,operation_key,request_hash,created_by) VALUES("+",".join([lit(org),lit(reservation_payment),lit('CLP'),lit(uid()),"1","60",lit('concurrent reservation'),lit('requested'),lit(uid()),lit('sha256-v1:'+'9'*64),lit(admin)])+")"
    try:
        internal(admin,q)
        return "committed"
    except AssertionError as error:
        assert "P1-05: payment retained balance/refund reservation invariant failed" in str(error), str(error)
        return "rejected"
with ThreadPoolExecutor(max_workers=2) as pool:
    refund_outcomes=list(pool.map(concurrent_refund_reservation,["writer-a","writer-b"]))
active_reserved=sql("SELECT coalesce(sum(r.amount),0)::text FROM public.payment_refunds r WHERE r.payment_id="+lit(reservation_payment)+" AND r.status IN('requested','processing') AND NOT EXISTS(SELECT 1 FROM public.payment_refunds n WHERE n.previous_event_id=r.id)",role="postgres")
check("concurrent refund reservations serialize below gross",sorted(refund_outcomes)==["committed","rejected"] and Decimal(active_reserved)==Decimal("60"))

ap1=allocation(admin,pid,schedules1[0]['id'],order1['id'],"30")
ap2=allocation(admin,pid,schedules1[1]['id'],order1['id'],"60",op=uid())
check("one payment applies across multiple schedules",sql("SELECT count(*) FROM public.payment_allocations WHERE payment_id="+lit(pid)+" AND direction='apply'",role="postgres")=="2")
pay_c,_=payment(admin,order1['id'],amount="1",ext_id="another-payment")
allocation(admin,pay_c,schedules1[0]['id'],order1['id'],"1")
check("multiple payments may apply to the same schedule",sql("SELECT count(DISTINCT payment_id) FROM public.payment_allocations WHERE payment_schedule_id="+lit(schedules1[0]['id'])+" AND direction='apply'",role="postgres")=="2")
pay_d,_=payment(admin,order1['id'],amount="20",ext_id="over-schedule")
sql("INSERT INTO public.payment_allocations(organization_id,payment_id,payment_schedule_id,order_id,currency,amount,created_by,direction,operation_key,operation_position) VALUES("+",".join([lit(org),lit(pay_d),lit(schedules1[0]['id']),lit(order1['id']),lit('CLP'),"10",lit(admin),lit('apply'),lit(uid()),"1"])+")",admin,"noveli_payments_executor",fail="")
check("schedule cap blocks over-allocation from another payment")
sql("UPDATE public.payment_allocations SET amount=1 WHERE id="+lit(ap1),admin,"noveli_payments_executor",fail="")
check("allocation UPDATE prohibited")
sql("DELETE FROM public.payment_allocations WHERE id="+lit(ap1),admin,"noveli_payments_executor",fail="")
check("allocation DELETE prohibited")
sql("INSERT INTO public.payment_allocations(organization_id,payment_id,payment_schedule_id,order_id,currency,amount,created_by,direction,operation_key,operation_position) VALUES("+",".join([lit(org),lit(pid),lit(schedules1[0]['id']),lit(order1['id']),lit('CLP'),"0",lit(admin),lit('apply'),lit(uid()),"1"])+")",admin,"noveli_payments_executor",fail="")
check("non-positive allocation amount rejected")
sql("INSERT INTO public.payment_allocations(organization_id,payment_id,payment_schedule_id,order_id,currency,amount,created_by,direction,operation_key,operation_position) VALUES("+",".join([lit(org),lit(pay_a),lit(usd_schedule[0]['id']),lit(order1['id']),lit('CLP'),"1",lit(admin),lit('apply'),lit(uid()),"1"])+")",admin,"noveli_payments_executor",fail="")
check("wrong order/schedule/payment parent rejected")

for role in roles:
    u=users[role]
    n=sql("SELECT count(*) FROM public.payments",u,"authenticated")
    should=role in ("admin","finanzas")
    check("RLS SELECT role "+role, (int(n)>0)==should)
    denied="INSERT INTO public.payments(organization_id,order_id,gross_amount,provider_fee,currency,provider,provider_account_scope,method,idempotency_key,request_hash,created_by) VALUES("+",".join([lit(org),lit(order1['id']),"1","0",lit('CLP'),lit('manual'),lit('manual'),lit('cash'),lit(uid()),lit('sha256-v1:'+'a'*64),lit(u)])+")"
    sql(denied,u,"authenticated",fail="")
    check("direct INSERT denied "+role)
    targets = [
        ("payments", pid, "notes='forbidden'"),
        ("payment_refunds", r1, "reason='forbidden'"),
        ("payment_allocations", ap1, "amount=1"),
    ]
    for table, row_id, assignment in targets:
        sql("UPDATE public."+table+" SET "+assignment+" WHERE id="+lit(row_id),u,"authenticated",fail="")
        check("direct UPDATE denied "+role+" "+table)
        sql("DELETE FROM public."+table+" WHERE id="+lit(row_id),u,"authenticated",fail="")
        check("direct DELETE denied "+role+" "+table)
check("anon has no ledger SELECT",sql("SELECT count(*) FROM public.payments",role="anon",fail="") is not None)
check("service_role has no direct ledger SELECT",sql("SELECT count(*) FROM public.payments",role="service_role",fail="") is not None)
for role in ("anon", "service_role"):
    for table, row_id, assignment in [
        ("payments", pid, "notes='forbidden'"),
        ("payment_refunds", r1, "reason='forbidden'"),
        ("payment_allocations", ap1, "amount=1"),
    ]:
        sql("UPDATE public."+table+" SET "+assignment+" WHERE id="+lit(row_id),role=role,fail="")
        check("direct UPDATE denied "+role+" "+table)
        sql("DELETE FROM public."+table+" WHERE id="+lit(row_id),role=role,fail="")
        check("direct DELETE denied "+role+" "+table)
check("internal executor sees only active tenant rows",internal(admin,"SELECT count(*) FROM public.payments") == sql("SELECT count(*) FROM public.payments WHERE organization_id="+lit(org),role="postgres"))

# A separate transaction race: each writer is individually valid (60 <= 119),
# but the schedule aggregate must serialize and reject the second commit.
race_order=create_order(admin,org,client,"119")
race_schedule=publish_schedule(admin,org,race_order['id'],[{"sequence":1,"expected_amount":"119","due_kind":"fixed_date","due_date":"2026-12-10"}])[0]
race_payment,_=payment(admin,race_order['id'],amount="200",ext_id="race-payment")
def race_insert(actor_name):
    actor=admin
    barrier.wait(timeout=10)
    q="INSERT INTO public.payment_allocations(organization_id,payment_id,payment_schedule_id,order_id,currency,amount,created_by,direction,operation_key,operation_position) VALUES("+",".join([lit(org),lit(race_payment),lit(race_schedule['id']),lit(race_order['id']),lit('CLP'),"60",lit(actor),lit('apply'),lit(uid()),"1"])+")"
    try:
        internal(actor,q)
        return "committed"
    except AssertionError as error:
        assert "P1-05: schedule allocation cap exceeded" in str(error), str(error)
        return "rejected"
barrier=threading.Barrier(2)
with ThreadPoolExecutor(max_workers=2) as pool:
    outcomes=list(pool.map(race_insert,["writer-a","writer-b"]))
effective=sql("SELECT COALESCE(sum(CASE direction WHEN 'apply' THEN amount ELSE -amount END),0)::text FROM public.payment_allocations WHERE payment_id="+lit(race_payment),role="postgres")
check("concurrent over-allocation serialized; one commit and one rejected",sorted(outcomes)==["committed","rejected"] and Decimal(effective)==Decimal("60"))

check("income/payment accounting tables unchanged by P1-05 tests",sql("SELECT (SELECT count(*) FROM public.incomes)||':'||(SELECT count(*) FROM public.income_allocations)||':'||(SELECT count(*) FROM public.income_distributions)||':'||(SELECT count(*) FROM public.expenses)",role="postgres")=="0:0:0:0")
print("P1-05 LOCAL TESTS: PASS; checks="+str(len(checks)),flush=True)
