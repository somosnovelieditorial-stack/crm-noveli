"""P1-04 local-only domain/RLS checks; uses synthetic tenants and a clean local DB."""
import concurrent.futures
from decimal import Decimal
import json
import subprocess
import threading
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
checks = []

def uid(): return str(uuid.uuid4())
def lit(v):
    if v is None: return "NULL"
    return "'" + str(v).replace("'", "''") + "'"
def js(v): return lit(json.dumps(v, ensure_ascii=False)) + "::jsonb"
def money_text(value, currency):
    scale = Decimal("1") if currency == "CLP" else Decimal("0.01")
    return format(Decimal(str(value)).quantize(scale),"f")
def sql(query, actor=None, role="authenticated", fail=None):
    if actor:
        query = ("BEGIN; SET LOCAL ROLE " + role + "; SELECT set_config('request.jwt.claim.sub'," + lit(actor) +
                 ",true); SELECT set_config('request.jwt.claims'," + js({"sub":actor,"role":role}) + "::text,true); " + query + "; COMMIT;")
    elif role == "anon":
        query = "BEGIN; SET LOCAL ROLE anon; " + query + "; COMMIT;"
    p = subprocess.run(["docker","exec","-i","supabase_db_CRM_NOVELI","psql","-X","-U","postgres","-d","postgres",
                        "-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose","-qAt"], input=query.encode(), capture_output=True)
    out, err = p.stdout.decode(errors="replace"), p.stderr.decode(errors="replace")
    if fail:
        assert p.returncode != 0 and fail in err, (fail,err,out)
        return err
    if p.returncode: raise AssertionError(err)
    lines=[x for x in out.strip().splitlines() if x.strip()]
    return lines[-1] if lines else ""
def check(name, ok=True):
    assert ok, name
    checks.append(name)
    print("PASS:",name,flush=True)
def rpc(actor, fn, args):
    return json.loads(sql("SELECT public.phase1b_"+fn+"("+",".join(args)+")",actor))
def order(actor, client, currency, unit_price, organization=None, accept=True):
    organization = organization or org
    items=[{"name":"Synthetic P1-04 item","quantity":"1","unit_price":unit_price,"tax_rate":"19","tax_mode":"added"}]
    result=json.loads(sql("SELECT public.phase1a_create_order_draft("+",".join([lit(organization),lit(client),lit(uid()),lit(currency),js(items)])+")",actor))
    if accept:
        sql("SELECT public.phase1a_submit_order("+lit(organization)+","+lit(result["id"])+")",actor)
        sql("SELECT public.phase1a_accept_order("+lit(organization)+","+lit(result["id"])+","+js({"channel":"synthetic local fixture"})+")",actor)
    return result

org, other = uid(),uid()
other_admin=uid()
users={r:uid() for r in ["admin","editor","diseñador","corrector","finanzas","visualizador","inactive","unknown"]}
clients={org:uid(),other:uid()}
setup="INSERT INTO public.organizations(id,name) VALUES "+",".join("("+lit(x)+",'P1-04 synthetic')" for x in (org,other))+";"
setup+="INSERT INTO auth.users(id,email) VALUES "+",".join("("+lit(u)+","+lit(u+"@example.invalid")+")" for u in users.values())+";"
setup+="INSERT INTO auth.users(id,email) VALUES("+lit(other_admin)+","+lit(other_admin+"@example.invalid")+");"
setup+="INSERT INTO public.organization_members(organization_id,user_id,role,active) VALUES "+",".join(
    "("+lit(org)+","+lit(u)+","+lit(r if r!='inactive' else 'finanzas')+","+('false' if r=='inactive' else 'true')+")"
    for r,u in users.items() if r!='unknown')+";"
setup+="INSERT INTO public.organization_members(organization_id,user_id,role,active) VALUES("+lit(other)+","+lit(other_admin)+",'admin',true);"
setup+="INSERT INTO public.clients(id,organization_id,user_id,name) VALUES "+",".join(
    "("+lit(clients[o])+","+lit(o)+","+lit(users['admin'] if o==org else other_admin)+",'Synthetic client')" for o in (org,other))+";"
setup+="INSERT INTO noveli_private.order_capabilities VALUES("+lit(org)+",'orders',true),("+lit(other)+",'orders',true);"
sql(setup)
admin,finance=users['admin'],users['finanzas']
clp=order(admin,clients[org],'CLP','100')
usd=order(admin,clients[org],'USD','1')
usd2=order(admin,clients[org],'USD','10')
other_order=order(other_admin,clients[other],'CLP','100',organization=other)
draft_order=order(admin,clients[org],'CLP','100',accept=False)
clp_scale_order=order(admin,clients[org],'CLP','100')

shape=json.loads(sql("SELECT json_build_object('exists',to_regclass('public.payment_schedules') IS NOT NULL,'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.payment_schedules'::regclass),'force_rls',(SELECT relforcerowsecurity FROM pg_class WHERE oid='public.payment_schedules'::regclass),'money_type',(SELECT format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid='public.payment_schedules'::regclass AND attname='expected_amount'),'fk_count',(SELECT count(*) FROM pg_constraint WHERE conrelid='public.payment_schedules'::regclass AND contype='f'),'index_count',(SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='payment_schedules'))"))
check("schema, precision, FKs, index and RLS",shape["exists"] and shape["rls"] and shape["force_rls"] and shape["money_type"]=="numeric(18,2)" and shape["fk_count"]==3 and shape["index_count"]>=3)
check("only P1-04 payment structure exists",sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN('payment_schedules','payments','payment_refunds','payment_allocations')")=="1")
check("no persisted paid amount or schedule status cache",sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_schedules' AND column_name IN('paid_amount','status')")=="0")
check("service_role has no direct table or RPC privileges",sql("SELECT NOT has_table_privilege('service_role','public.payment_schedules','SELECT,INSERT,UPDATE,DELETE') AND NOT has_function_privilege('service_role','public.phase1b_save_payment_schedule_draft(uuid,uuid,jsonb)','EXECUTE') AND NOT has_function_privilege('service_role','public.phase1b_publish_payment_schedule_plan(uuid,uuid)','EXECUTE')")=="t")

draft_plan=[{"sequence":1,"expected_amount":"119","due_kind":"milestone","milestone_key":"acceptance"}]
draft_saved=rpc(admin,"save_payment_schedule_draft",[lit(org),lit(draft_order["id"]),js(draft_plan)])
check("draft plan may be prepared before order acceptance",len(draft_saved["schedules"])==1 and draft_saved["schedules"][0]["lifecycle_status"]=="draft")
sql("SELECT public.phase1b_publish_payment_schedule_plan("+lit(org)+","+lit(draft_order["id"])+")",admin,fail="23514")
check("draft order cannot publish its schedule",True)
sql("SELECT public.phase1b_save_payment_schedule_draft("+",".join([lit(org),lit(clp_scale_order["id"]),js([{"sequence":1,"expected_amount":"1.00","due_kind":"milestone","milestone_key":"scale-check"}])])+")",admin,fail="22023")
check("CLP rejects decimal fractions even when trailing zeros",True)

clp_plan=[{"sequence":1,"expected_amount":"60","due_kind":"fixed_date","due_date":"2026-11-01"},{"sequence":2,"expected_amount":"59","due_kind":"milestone","milestone_key":"manuscript_delivery"}]
saved=rpc(admin,"save_payment_schedule_draft",[lit(org),lit(clp["id"]),js(clp_plan)])
replayed=rpc(admin,"save_payment_schedule_draft",[lit(org),lit(clp["id"]),js(clp_plan)])
check("CLP multi-obligation draft and exact replay idempotency",len(saved["schedules"])==2 and saved["changed"] and not replayed["changed"] and [x["id"] for x in saved["schedules"]]==[x["id"] for x in replayed["schedules"]])
check("draft save activity is atomic and replay does not duplicate it",sql("SELECT count(*) FROM public.activity_log WHERE organization_id="+lit(org)+" AND entity_id="+lit(clp["id"])+" AND action='schedule_draft_saved'")=="1")
check("draft currency snapshots CLP and sequences order",all(x["currency"]=="CLP" for x in saved["schedules"]) and [x["sequence"] for x in saved["schedules"]]==[1,2])
published=rpc(finance,"publish_payment_schedule_plan",[lit(org),lit(clp["id"])])
published_again=rpc(admin,"publish_payment_schedule_plan",[lit(org),lit(clp["id"])])
check("publish exact total and idempotent replay",published["published"] and not published["replayed"] and published_again["replayed"] and all(x["lifecycle_status"]=="scheduled" for x in published["schedules"]))
check("publication activity is atomic and replay does not duplicate it",sql("SELECT count(*) FROM public.activity_log WHERE organization_id="+lit(org)+" AND entity_id="+lit(clp["id"])+" AND action='schedule_plan_published'")=="1")
sql("SELECT public.phase1b_save_payment_schedule_draft("+",".join([lit(org),lit(clp["id"]),js(clp_plan)])+")",admin,fail="23514")
check("published schedule plan immutable")

usd_plan=[{"sequence":1,"expected_amount":"1.19","due_kind":"fixed_date","due_date":"2026-12-01"}]
usd_saved=rpc(finance,"save_payment_schedule_draft",[lit(org),lit(usd["id"]),js(usd_plan)])
check("USD single obligation and currency snapshot",len(usd_saved["schedules"])==1 and usd_saved["currency"]=="USD" and usd_saved["schedules"][0]["expected_amount"]=="1.19")
rpc(finance,"publish_payment_schedule_plan",[lit(org),lit(usd["id"])])
check("USD publication reconciles to canonical order total")

other_plan=[{"sequence":1,"expected_amount":money_text(other_order["total"],"CLP"),"due_kind":"fixed_date","due_date":"2026-12-15"}]
rpc(other_admin,"save_payment_schedule_draft",[lit(other),lit(other_order["id"]),js(other_plan)])
rpc(other_admin,"publish_payment_schedule_plan",[lit(other),lit(other_order["id"])])

bad_cases=[
    ([{"sequence":1,"expected_amount":"-1.00","due_kind":"fixed_date","due_date":"2026-11-01"}],"save","22023","negative amount rejected"),
    ([{"sequence":1,"expected_amount":"1.001","due_kind":"fixed_date","due_date":"2026-11-01"}],"save","22023","excess money scale rejected"),
    ([{"sequence":1,"expected_amount":"1.00","due_kind":"fixed_date"}],"publish","23514","missing fixed date rejected on publish"),
    ([{"sequence":1,"expected_amount":"1.00","due_kind":"milestone"}],"publish","23514","missing milestone key rejected on publish"),
    ([{"sequence":1,"expected_amount":"5.95","due_kind":"fixed_date","due_date":"2026-11-01"}],"publish","23514","plan total mismatch rejected"),
    ([{"sequence":1,"expected_amount":"1.00","due_kind":"fixed_date","due_date":"2026-11-01"},{"sequence":1,"expected_amount":"0.19","due_kind":"fixed_date","due_date":"2026-12-01"}],"save","23505","duplicate sequence rejected"),
]
for plan, stage, code, label in bad_cases:
    target=usd2["id"]
    if stage=="save":
        sql("SELECT public.phase1b_save_payment_schedule_draft("+",".join([lit(org),lit(target),js(plan)])+")",admin,fail=code)
    else:
        sql("SELECT public.phase1b_save_payment_schedule_draft("+",".join([lit(org),lit(target),js(plan)])+")",admin)
        sql("SELECT public.phase1b_publish_payment_schedule_plan("+lit(org)+","+lit(target)+")",admin,fail=code)
    check(label)

for role in ("editor","diseñador","corrector","visualizador","inactive","unknown"):
    actor=users[role]
    check(role+" cannot read financial schedule",sql("SELECT count(*) FROM public.payment_schedules WHERE order_id="+lit(clp["id"]),actor)=="0")
    sql("SELECT public.phase1b_save_payment_schedule_draft("+",".join([lit(org),lit(usd2["id"]),js(usd_plan)])+")",actor,fail="42501")
    check(role+" cannot create/modify schedule")
for role in ("admin","finanzas"):
    check(role+" reads tenant schedule",sql("SELECT count(*) FROM public.payment_schedules WHERE order_id="+lit(clp["id"]),users[role])=="2")
    check(role+" reads no other tenant schedule",sql("SELECT count(*) FROM public.payment_schedules WHERE order_id="+lit(other_order["id"]),users[role])=="0")
    sql("INSERT INTO public.payment_schedules(organization_id,order_id,sequence,currency,expected_amount,due_kind,created_by) VALUES("+",".join([lit(org),lit(usd2["id"]),"90","'USD'","1","'fixed_date'",lit(users[role])])+")",users[role],fail="42501")
    check(role+" direct DML denied")
sql("SELECT count(*) FROM public.payment_schedules",role="anon",fail="42501")
sql("SELECT public.phase1b_publish_payment_schedule_plan("+lit(org)+","+lit(usd2["id"])+")",role="anon",fail="42501")
check("anon denied")

sql("SELECT public.phase1b_save_payment_schedule_draft("+",".join([lit(other),lit(usd2["id"]),js(usd_plan)])+")",admin,fail="42501")
check("schedule RPC rejects mismatched tenant/order")

sql("BEGIN; SELECT set_config('request.jwt.claim.sub',"+lit(admin)+",true); SELECT set_config('request.jwt.claims',"+js({"sub":admin,"role":"authenticated"})+"::text,true); INSERT INTO public.payment_schedules(organization_id,order_id,sequence,currency,expected_amount,due_kind,created_by) VALUES("+",".join([lit(org),lit(usd2["id"]),"91","'EUR'","1","'fixed_date'",lit(admin)])+"); ROLLBACK",fail="23514")
sql("BEGIN; SELECT set_config('request.jwt.claim.sub',"+lit(admin)+",true); SELECT set_config('request.jwt.claims',"+js({"sub":admin,"role":"authenticated"})+"::text,true); INSERT INTO public.payment_schedules(organization_id,order_id,sequence,currency,expected_amount,due_kind,created_by) VALUES("+",".join([lit(other),lit(usd2["id"]),"92","'USD'","1","'fixed_date'",lit(admin)])+"); ROLLBACK",fail="23503")
sql("BEGIN; SELECT set_config('request.jwt.claim.sub',"+lit(admin)+",true); SELECT set_config('request.jwt.claims',"+js({"sub":admin,"role":"authenticated"})+"::text,true); INSERT INTO public.payment_schedules(organization_id,order_id,sequence,currency,expected_amount,due_kind,created_by) VALUES("+",".join([lit(org),lit(uid()),"93","'CLP'","1","'fixed_date'",lit(admin)])+"); ROLLBACK",fail="23503")
check("invalid currency, cross-organization and orphan order references rejected")

# A concurrent retry is serialized by a per-order row lock and uniqueness prevents duplicate sequences.
concurrent_order=order(admin,clients[org],"CLP","20")
concurrent_plan=[{"sequence":1,"expected_amount":money_text(concurrent_order["total"],"CLP"),"due_kind":"fixed_date","due_date":"2026-11-15"}]
barrier=threading.Barrier(2)
def concurrent_save(_):
    barrier.wait()
    return rpc(admin,"save_payment_schedule_draft",[lit(org),lit(concurrent_order["id"]),js(concurrent_plan)])
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(concurrent_save,range(2)))
check("concurrent retry leaves one draft row",sql("SELECT count(*) FROM public.payment_schedules WHERE order_id="+lit(concurrent_order["id"]))=="1" and len({r['schedules'][0]['id'] for r in results})==1)

# Hold the parent order row until both publish RPCs are confirmed waiting on it,
# then release them together to exercise the actual publication race.
publish_order=order(admin,clients[org],"CLP","40")
publish_plan=[{"sequence":1,"expected_amount":money_text(publish_order["total"],"CLP"),"due_kind":"fixed_date","due_date":"2026-12-20"}]
rpc(admin,"save_payment_schedule_draft",[lit(org),lit(publish_order["id"]),js(publish_plan)])
lock_sql=("SET application_name='p1_04_publish_lock_holder'; BEGIN; SELECT id FROM public.orders WHERE organization_id="+lit(org)+" AND id="+lit(publish_order["id"])+
          " FOR UPDATE; SELECT pg_sleep(5); COMMIT")
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    lock_holder=pool.submit(sql,lock_sql)
    deadline=time.monotonic()+3
    holder_ready=False
    while time.monotonic()<deadline and not holder_ready:
        holder_ready=sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='p1_04_publish_lock_holder' AND state='active' AND query LIKE '%pg_sleep(5)%'")=="1"
        if not holder_ready: time.sleep(0.05)
    check("concurrency gate holds the order row before publish calls",holder_ready)
    publish_barrier=threading.Barrier(2)
    def concurrent_publish(index):
        publish_barrier.wait()
        query=("SET LOCAL application_name='p1_04_publish_race_"+str(index)+"'; SELECT public.phase1b_publish_payment_schedule_plan("+
               lit(org)+","+lit(publish_order["id"])+")")
        return json.loads(sql(query,admin))
    publish_futures=[pool.submit(concurrent_publish,index) for index in range(2)]
    app_names=["p1_04_publish_race_0","p1_04_publish_race_1"]
    deadline=time.monotonic()+4
    waiting=set()
    while time.monotonic()<deadline and len(waiting)<2:
        quoted=",".join(lit(name) for name in app_names)
        waiting=set(json.loads(sql("SELECT coalesce(json_agg(application_name ORDER BY application_name),'[]'::json) FROM pg_stat_activity WHERE application_name IN ("+quoted+") AND wait_event_type='Lock'")))
        if len(waiting)<2: time.sleep(0.05)
    check("both concurrent publish calls wait on the same order lock",set(waiting)==set(app_names))
    concurrent_published=[future.result(timeout=10) for future in publish_futures]
    lock_holder.result(timeout=10)
final_publish=json.loads(sql("SELECT json_build_object('rows',count(*),'scheduled',count(*) FILTER (WHERE lifecycle_status='scheduled'),'draft',count(*) FILTER (WHERE lifecycle_status='draft'),'sum',coalesce(sum(expected_amount),0)::text,'sequences',array_agg(sequence ORDER BY sequence),'publish_logs',(SELECT count(*) FROM public.activity_log WHERE organization_id="+lit(org)+" AND entity_id="+lit(publish_order["id"])+" AND action='schedule_plan_published')) FROM public.payment_schedules WHERE organization_id="+lit(org)+" AND order_id="+lit(publish_order["id"])))
check("concurrent publish returns one initial result and one idempotent replay",sorted(result["replayed"] for result in concurrent_published)==[False,True])
check("concurrent publish leaves one complete exact-total plan without duplicate rows",final_publish["rows"]==1 and final_publish["scheduled"]==1 and final_publish["draft"]==0 and Decimal(final_publish["sum"])==Decimal(str(publish_order["total"])) and final_publish["sequences"]==[1] and final_publish["publish_logs"]==1)

accounting=sql("SELECT (SELECT count(*) FROM public.incomes)||':'||(SELECT count(*) FROM public.income_allocations)||':'||(SELECT count(*) FROM public.income_distributions)||':'||(SELECT count(*) FROM public.expenses)")
check("legacy accounting unchanged",accounting=="0:0:0:0")
check("P1-04 regressions and role matrix complete",len(checks)>=30)
print("P1-04 LOCAL TESTS: PASS; checks="+str(len(checks)),flush=True)
