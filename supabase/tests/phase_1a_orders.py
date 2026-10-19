"""Phase1A integration tests. Only fixed local Docker database; synthetic persistent fixtures.
No production URLs/keys, no external dependencies. Rebuild local DB to remove fixtures.
"""
import concurrent.futures
import json
import subprocess
import threading
import uuid
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "docs/noveli-2/phase-1/phase-1a-test-results.json"
checks = []
def uid(): return str(uuid.uuid4())
def lit(v):
    if v is None: return "NULL"
    return "'" + str(v).replace("'", "''") + "'"
def js(v): return lit(json.dumps(v, ensure_ascii=False)) + "::jsonb"
def sql(query, actor=None, role="authenticated", fail=None):
    if actor:
        query = ("BEGIN; SET LOCAL ROLE " + role + "; SELECT set_config('request.jwt.claim.sub'," + lit(actor) +
                 ",true); SELECT set_config('request.jwt.claims'," + js({"sub":actor,"role":role}) + "::text,true); " +
                 query + "; COMMIT;")
    elif role == "anon":
        query = "BEGIN; SET LOCAL ROLE anon; " + query + "; COMMIT;"
    r = subprocess.run(["docker","exec","-i","supabase_db_CRM_NOVELI","psql","-X","-U","postgres","-d","postgres",
                        "-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose","-qAt"],input=query.encode(),capture_output=True)
    out, err = r.stdout.decode(errors="replace"), r.stderr.decode(errors="replace")
    if fail:
        assert r.returncode != 0 and fail in err, (fail,err,out)
        return err
    if r.returncode: raise AssertionError(err)
    lines=[s for s in out.strip().splitlines() if s.strip()]
    return lines[-1] if lines else ""
def check(label, ok=True):
    assert ok, label
    checks.append({"test":label,"status":"PASS"})
    EVIDENCE.write_text(json.dumps({"environment":"LOCAL Docker only","checks":checks,"passed":len(checks)},indent=2),encoding="utf-8")
    print("PASS:",label,flush=True)
def rpc(actor, name, args):
    result=json.loads(sql("SELECT to_jsonb(public.phase1a_"+name+"("+",".join(args)+"))",actor))
    if isinstance(result,dict):
        for key in ('subtotal','discount','tax','total','retained_cash','outstanding_amount'):
            if key in result and isinstance(result[key],str):result[key]=Decimal(result[key])
    return result
def item(**overrides):
    d={"name":"Synthetic Noveli service","quantity":"1","unit_price":"100","tax_rate":"19","tax_mode":"added"}
    d.update(overrides); return d

org, other, disabled_org = uid(),uid(),uid()
roles=["admin","editor","diseñador","corrector","finanzas","visualizador","inactive","unknown"]
users={r:uid() for r in roles}
client, client_b, client_disabled, catalog = uid(),uid(),uid(),uid()
setup = "INSERT INTO public.organizations(id,name) VALUES "+",".join("("+lit(o)+",'Phase1A synthetic')" for o in [org,other,disabled_org])+";"
setup += "INSERT INTO auth.users(id,email) VALUES "+",".join("("+lit(u)+","+lit(u+"@example.invalid")+")" for u in users.values())+";"
setup += "INSERT INTO public.organization_members(organization_id,user_id,role,active) VALUES "+",".join(
    "("+lit(org)+","+lit(u)+","+lit("editor" if r=="inactive" else r)+","+("false" if r=="inactive" else "true")+")"
    for r,u in users.items() if r!="unknown")+";"
setup += "INSERT INTO public.organization_members(organization_id,user_id,role,active) VALUES("+lit(disabled_org)+","+lit(users["admin"])+",'admin',true);"
setup += "INSERT INTO public.clients(id,organization_id,user_id,name) VALUES "+",".join(
    "("+lit(c)+","+lit(o)+","+lit(users["admin"])+",'Synthetic client')" for c,o in [(client,org),(client_b,other),(client_disabled,disabled_org)])+";"
setup += "INSERT INTO public.service_catalog(id,organization_id,user_id,name,base_price,category) VALUES("+lit(catalog)+","+lit(org)+","+lit(users["admin"])+",'Original catalog',100,'editorial');"
setup += "INSERT INTO noveli_private.order_capabilities VALUES("+lit(org)+",'orders',true),("+lit(org)+",'quotation_conversion',true);"
sql(setup)
admin=users["admin"]
def draft(actor=admin, lines=None, op=None, currency="CLP", c=client, tenant=org, discount="0"):
    return rpc(actor,"create_order_draft",[lit(tenant),lit(c),lit(op or uid()),lit(currency),js(lines if lines is not None else [item()]),lit(discount)])
o=draft(lines=[item(catalog_id=catalog)])
check("create draft; exact gross and independent actor",o["commercial_status"]=="draft" and o["total"]==119 and o["created_by"]==admin and o["accepted_by"] is None)
o2=draft()
check("number sequence increments",o2["number_sequence"]==o["number_sequence"]+1 and o["order_number"].endswith("000001"))
key=uid(); same=draft(op=key); again=draft(op=key)
check("manual creation idempotency",same["id"]==again["id"])
sql("SELECT public.phase1a_create_order_draft("+",".join([lit(org),lit(client),lit(key),"'CLP'",js([item(unit_price="101")])])+")",admin,fail="23505")
check("idempotency conflict rejects different payload")
barrier=threading.Barrier(2)
def concurrent_draft(_):
    barrier.wait();return draft()
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex: pair=list(ex.map(concurrent_draft,range(2)))
check("real two-connection numbering concurrency",len({r["order_number"] for r in pair})==2 and abs(pair[0]["number_sequence"]-pair[1]["number_sequence"])==1)
for actor in [users["finanzas"],users["diseñador"],users["corrector"],users["visualizador"],users["inactive"],users["unknown"]]:
    sql("SELECT public.phase1a_create_order_draft("+",".join([lit(org),lit(client),lit(uid()),"'CLP'",js([item()])])+")",actor,fail="42501")
check("all noncommercial roles denied create")
check("editor can create",draft(users["editor"])["created_by"]==users["editor"])
sql("SELECT public.phase1a_create_order_draft("+",".join([lit(other),lit(client_b),lit(uid()),"'CLP'",js([item()])])+")",admin,fail="42501")
sql("SELECT public.phase1a_create_order_draft("+",".join([lit(org),lit(client_b),lit(uid()),"'CLP'",js([item()])])+")",admin,fail="42501")
check("cross-tenant org and client denied")
sql("SELECT public.phase1a_create_order_draft("+",".join([lit(disabled_org),lit(client_disabled),lit(uid()),"'CLP'",js([item()])])+")",admin,fail="42501")
check("capability defaults disabled")
sql("SELECT * FROM public.orders",role="anon",fail="42501")
sql("SELECT public.phase1a_order_payment_summary("+lit(org)+","+lit(o["id"])+")",role="anon",fail="42501")
check("anon table and RPC denied")
check("viewer reads order",sql("SELECT count(*) FROM public.orders WHERE id="+lit(o["id"]),users["visualizador"])=="1")
check("nonmember sees no order",sql("SELECT count(*) FROM public.orders",users["unknown"])=="0")
for role in roles:
    sql("UPDATE public.orders SET total=0 WHERE id="+lit(o["id"]),users[role],fail="42501")
    sql("DELETE FROM public.orders WHERE id="+lit(o["id"]),users[role],fail="42501")
check("every application role denied direct DML/delete")
for bad in [item(quantity="0"),item(unit_price="-1"),item(quantity="1.0001"),item(unit_price="NaN"),item(discount="101"),item(tax_rate="101"),item(tax_mode="exempt"),item(unit_price="10000000000")]:
    sql("SELECT public.phase1a_create_order_draft("+",".join([lit(org),lit(client),lit(uid()),"'CLP'",js([bad])])+")",admin,fail="22023")
check("negative zero scale NaN discount tax and overflow rejected")
sql("SELECT public.phase1a_create_order_draft("+",".join([lit(org),lit(client),lit(uid()),"'EUR'",js([item()])])+")",admin,fail="22023")
check("unsupported currency rejected")
p=draft(lines=[item(unit_price="0.025",tax_rate="0",tax_mode="exempt")],currency="USD")
check("USD half away rounding",p["subtotal"]==Decimal('0.03'))
p=draft(lines=[item(unit_price="0.5",tax_rate="0",tax_mode="exempt")])
check("CLP half away rounding",p["subtotal"]==1)
p=draft(lines=[item(unit_price="1",tax_rate="0",tax_mode="exempt") for _ in range(3)],discount="1")
parts=json.loads(sql("SELECT json_agg(discount ORDER BY position) FROM public.order_items WHERE order_id="+lit(p["id"])))
check("largest remainder discount stable",parts==[1,0,0] and p["total"]==2)
rpc(admin,"submit_order",[lit(org),lit(o["id"])])
rpc(admin,"accept_order",[lit(org),lit(o["id"]),js({"channel":"local synthetic","accepted_by":"test client"})])
check("accepted_by distinct field and acceptance evidence",json.loads(sql("SELECT to_jsonb(t) FROM public.orders t WHERE id="+lit(o["id"])))["accepted_by"]==admin)
sql("SELECT public.phase1a_edit_order_draft("+",".join([lit(org),lit(o["id"]),"'CLP'",js([item(unit_price="999")])])+")",admin,fail="23514")
sql("UPDATE public.orders SET total=1 WHERE id="+lit(o["id"]),fail="23514")
sql("DELETE FROM public.orders WHERE id="+lit(o["id"]),fail="42501")
sql("UPDATE public.order_items SET name='Corrupted' WHERE order_id="+lit(o["id"]),fail="23514")
check("accepted order/items immutable even privileged SQL")
sql("UPDATE public.service_catalog SET name='Changed',base_price=999 WHERE id="+lit(catalog)+";DELETE FROM public.service_catalog WHERE id="+lit(catalog))
snap=json.loads(sql("SELECT to_jsonb(i) FROM public.order_items i WHERE order_id="+lit(o["id"])))
check("catalog SET NULL retains tenant/name/pricing",snap["catalog_id"] is None and snap["organization_id"]==org and snap["unit_price"]==100 and snap["name"]=="Synthetic Noveli service")
for r in ["admin","editor","diseñador","corrector"]:
    target={"admin":"preparing","editor":"in_progress","diseñador":"review","corrector":"in_progress"}[r]
    rpc(users[r],"advance_order_operation",[lit(org),lit(o["id"]),lit(target)])
check("writer operational permissions")
rpc(users["diseñador"],"advance_order_operation",[lit(org),lit(o["id"]),"'paused'"])
sql("SELECT public.phase1a_advance_order_operation("+",".join([lit(org),lit(o["id"]),"'completed'"])+")",users["diseñador"],fail="23514")
rpc(users["diseñador"],"advance_order_operation",[lit(org),lit(o["id"]),"'in_progress'"])
rpc(users["finanzas"],"update_order_notes",[lit(org),lit(o["id"]),"'Financial operator note'"])
sql("SELECT public.phase1a_advance_order_operation("+",".join([lit(org),lit(o["id"]),"'review'"])+")",users["finanzas"],fail="42501")
sql("SELECT public.phase1a_update_order_notes("+",".join([lit(org),lit(o["id"]),"'Forbidden'"])+")",users["visualizador"],fail="42501")
check("pause return, finance notes-only, viewer readonly")
check("no fake ledger summary",rpc(users["visualizador"],"order_payment_summary",[lit(org),lit(o["id"])])["ledger_available"] is False)
def quote(accepted=True, price=490000, adjustment=30):
    qid,iid=uid(),uid()
    total=round(price*(1+adjustment/100)*1.19)
    sql("INSERT INTO public.quotations(id,user_id,organization_id,client_id,status,accepted_at,currency,total,discount,iva_mode,tax_rate,extension_adjustment_type,extension_adjustment_value) VALUES("+
        ",".join([lit(qid),lit(admin),lit(org),lit(client),lit("aceptada" if accepted else "borrador"),"now()" if accepted else "NULL","'CLP'",str(total),"0","'+ IVA'","19","'percentage'",str(adjustment)])+");"+
        "INSERT INTO public.quotation_items(id,user_id,organization_id,quotation_id,concept,unit_price,quantity) VALUES("+",".join([lit(iid),lit(admin),lit(org),lit(qid),"'Historical service'",str(price),"1"])+")")
    return qid,iid
def review(qid):
    source=rpc(admin,"quotation_review_source",[lit(org),lit(qid)])
    return rpc(admin,"review_and_accept_quotation",[lit(org),lit(qid),lit(client),js({"channel":"approved synthetic acceptance"}),lit(source["fingerprint"])])
def convert(qid,s,op=None):
    return rpc(admin,"convert_quotation_to_order",[lit(org),lit(qid),lit(s["id"]),lit(s["snapshot_sha256"]),lit(op or uid())])
qid,iid=quote(); s=review(qid); op=uid()
converted=convert(qid,s,op)
check("quotation canonical conversion preserves extension and tax",converted["subtotal"]==637000 and converted["tax"]==121030 and converted["total"]==758030 and converted["quotation_id"]==qid and converted["commercial_status"]=="accepted")
check("conversion idempotency same and new key",convert(qid,s,op)["id"]==converted["id"] and convert(qid,s)["id"]==converted["id"])
check("one conversion activity",sql("SELECT count(*) FROM public.activity_log WHERE entity_id="+lit(converted["id"])+" AND action='quotation_converted'")=="1")
check("quote remains accepted and no legacy flags changed",sql("SELECT status='aceptada' AND NOT converted_to_service AND NOT converted_to_client AND NOT converted_to_prospect FROM public.quotations WHERE id="+lit(qid))=="t")
qid2,_=quote(); s2=review(qid2)
barrier=threading.Barrier(2)
def concurrent_conversion(_):
    barrier.wait();return convert(qid2,s2)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex: results=list(ex.map(concurrent_conversion,range(2)))
check("real concurrent conversions produce ONE order",len({r["id"] for r in results})==1 and sql("SELECT count(*) FROM public.orders WHERE quotation_id="+lit(qid2))=="1")
qid3,_=quote(); s3=review(qid3)
sql("UPDATE public.quotations SET notes='legacy edit after approval' WHERE id="+lit(qid3))
sql("SELECT public.phase1a_convert_quotation_to_order("+",".join([lit(org),lit(qid3),lit(s3["id"]),lit(s3["snapshot_sha256"]),lit(uid())])+")",admin,fail="40001")
check("legacy change invalidates pending conversion")
qd,_=quote(False)
source=rpc(admin,"quotation_review_source",[lit(org),lit(qd)])
sql("SELECT public.phase1a_review_and_accept_quotation("+",".join([lit(org),lit(qd),lit(client),js({"ok":True}),lit(source["fingerprint"])])+")",admin,fail="23514")
check("unaccepted legacy quote blocked without mutation")
saved=rpc(admin,"save_and_accept_quotation",[lit(org),lit(qd),lit(client),js({"currency":"CLP","iva_mode":"+ IVA","tax_rate":"19","discount":"0","extension_adjustment_value":"0"}),
 js([{"name":"Atomic saved service","quantity":"1","unit_price":"100"}]),js({"channel":"atomic save"}),lit(source["fingerprint"])])
check("atomic opt-in save+accept+revision",convert(qd,saved)["total"]==119)
qf,_=quote(); sf=review(qf)
before=json.loads(sql("SELECT jsonb_build_object('counter',(SELECT last_value FROM noveli_private.order_number_counters WHERE organization_id="+lit(org)+"),'orders',(SELECT count(*) FROM public.orders),'log',(SELECT count(*) FROM public.activity_log))"))
sql("CREATE FUNCTION public.phase1a_test_fail_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='quotation_converted' THEN RAISE EXCEPTION 'injected conversion log failure'; END IF; RETURN NEW; END $$;CREATE TRIGGER phase1a_test_fail_log BEFORE INSERT ON public.activity_log FOR EACH ROW EXECUTE FUNCTION public.phase1a_test_fail_log();")
try:
    sql("SELECT public.phase1a_convert_quotation_to_order("+",".join([lit(org),lit(qf),lit(sf["id"]),lit(sf["snapshot_sha256"]),lit(uid())])+")",admin,fail="injected conversion log failure")
finally:
    sql("DROP TRIGGER phase1a_test_fail_log ON public.activity_log;DROP FUNCTION public.phase1a_test_fail_log();")
after=json.loads(sql("SELECT jsonb_build_object('counter',(SELECT last_value FROM noveli_private.order_number_counters WHERE organization_id="+lit(org)+"),'orders',(SELECT count(*) FROM public.orders),'log',(SELECT count(*) FROM public.activity_log))"))
check("late log failure rolls back order/items/counter/activity",before==after and sql("SELECT count(*) FROM public.orders WHERE quotation_id="+lit(qf))=="0")
check("conversion retry after rollback succeeds",convert(qf,sf)["quotation_id"]==qf)
sql("UPDATE noveli_private.quotation_acceptance_snapshots SET snapshot='{}' WHERE id="+lit(sf["id"]),fail="23514")
check("accepted revision immutable")
editor_order=draft(users['editor'])
rpc(users['editor'],'submit_order',[lit(org),lit(editor_order['id'])])
accepted=rpc(admin,'accept_order',[lit(org),lit(editor_order['id']),js({'channel':'different recording actor'})])
check('created_by and accepted_by genuinely distinct',accepted['created_by']==users['editor'] and accepted['accepted_by']==admin)
dated=draft()
rpc(admin,'submit_order',[lit(org),lit(dated['id'])])
sql("SELECT public.phase1a_accept_order("+','.join([lit(org),lit(dated['id']),js({'channel':'future invalid','accepted_at':'2099-01-01T00:00:00Z'})])+")",admin,fail='22023')
dated=rpc(admin,'accept_order',[lit(org),lit(dated['id']),js({'channel':'verified historical acceptance','accepted_at':'2026-01-01T12:00:00Z'})])
check('verified acceptance occurrence independent of recording timestamp',dated['accepted_at'].startswith('2026-01-01T12:00:00') and dated['created_at']>dated['accepted_at'])
sql("INSERT INTO noveli_private.order_capabilities VALUES("+lit(disabled_org)+",'orders',true)")
separate=draft(tenant=disabled_org,c=client_disabled)
check('independent organization numbering starts at one',separate['number_sequence']==1 and separate['number_year']==int(sql("SELECT extract(year FROM now() AT TIME ZONE 'UTC')")))
free=draft(lines=[item(unit_price='0',tax_rate='0',tax_mode='exempt')])
rpc(admin,'submit_order',[lit(org),lit(free['id'])])
rpc(admin,'accept_order',[lit(org),lit(free['id']),js({'channel':'free order accepted'})])
check('zero order paid without fake payment',rpc(admin,'order_payment_summary',[lit(org),lit(free['id'])])['payment_status']=='paid')
sql("SELECT public.phase1a_create_order_draft("+','.join([lit(org),lit(client),lit(uid()),"'CLP'","NULL::jsonb"])+")",admin,fail='22023')
check('NULL items explicitly rejected')
taxes=draft(lines=[item(unit_price='1') for _ in range(3)])
tax_parts=json.loads(sql("SELECT json_agg(tax ORDER BY position) FROM public.order_items WHERE order_id="+lit(taxes['id'])))
check('largest remainder tax allocation',tax_parts==[1,0,0] and taxes['tax']==1)
pack,part=uid(),uid()
sql("INSERT INTO public.service_catalog(id,user_id,organization_id,name,category,base_price) VALUES("+','.join([lit(part),lit(admin),lit(org),"'Original component'","'editorial'",'100'])+");INSERT INTO public.service_packs(id,user_id,organization_id,name,price_special) VALUES("+','.join([lit(pack),lit(admin),lit(org),"'Original pack'",'100'])+");INSERT INTO public.service_pack_items(user_id,organization_id,pack_id,service_id) VALUES("+','.join([lit(admin),lit(org),lit(pack),lit(part)])+")")
packed=draft(lines=[item(pack_id=pack)])
sql("UPDATE public.service_catalog SET name='Changed component' WHERE id="+lit(part)+";DELETE FROM public.service_packs WHERE id="+lit(pack))
packed_item=json.loads(sql("SELECT to_jsonb(i) FROM public.order_items i WHERE order_id="+lit(packed['id'])))
check('pack FK SET NULL preserves composition snapshot',packed_item['pack_id'] is None and packed_item['pricing_metadata']['composition']['components'][0]['name']=='Original component')
check('creation retry survives deleted source pack',draft(lines=[item(pack_id=pack)],op=packed['creation_operation_key'])['id']==packed['id'])
edited=draft()
edited=rpc(admin,'edit_order_draft',[lit(org),lit(edited['id']),lit('USD'),js([item(unit_price='12.5',tax_rate='0',tax_mode='exempt')]),lit('0'),lit('Edited draft')])
check('positive draft revision remains canonical',edited['currency']=='USD' and edited['total']==12.5)
cancelled=rpc(users['editor'],'cancel_order',[lit(org),lit(edited['id']),lit('Draft cancellation without deleting history')])
check('draft cancellation uses state and preserves row',cancelled['commercial_status']=='cancelled' and sql('SELECT count(*) FROM public.orders WHERE id='+lit(edited['id']))=='1')
sql('SELECT public.phase1a_cancel_order('+','.join([lit(org),lit(editor_order['id']),lit('editor cannot cancel accepted')])+')',users['editor'],fail='42501')
cancelled=rpc(admin,'cancel_order',[lit(org),lit(editor_order['id']),lit('Accepted cancellation by admin')])
check('accepted cancellation admin-only preserves acceptance',cancelled['commercial_status']=='cancelled' and cancelled['accepted_by']==admin)
for target in ['review','delivered','completed']:rpc(admin,'advance_order_operation',[lit(org),lit(o['id']),lit(target)])
sql('SELECT public.phase1a_cancel_order('+','.join([lit(org),lit(o['id']),lit('Cannot reopen terminal operation')])+')',admin,fail='23514')
check('completed operation terminal even through cancellation')
qzero,_=quote(price=0,adjustment=0)
szero=review(qzero)
check('accepted zero quotation converts coherently',convert(qzero,szero)['total']==0)
sql("SELECT public.phase1a_convert_quotation_to_order("+','.join([lit(org),lit(qzero),lit(szero['id']),lit('0'*64),lit(uid())])+")",admin,fail='23514')
check('forged revision hash rejected even on retry')
qrace,_=quote();srace=review(qrace);barrier=threading.Barrier(2)
def quote_race(kind):
    barrier.wait()
    if kind=='edit':
        sql("BEGIN;UPDATE public.quotations SET notes='concurrent legacy edit' WHERE id="+lit(qrace)+";SELECT pg_sleep(0.15);COMMIT;")
        return 'edited'
    try:return convert(qrace,srace)['id']
    except AssertionError as error:
        assert '40001' in str(error),str(error)
        return 'stale'
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:race_results=list(ex.map(quote_race,['edit','convert']))
check('legacy write vs conversion race has consistent revision or rejects stale',int(sql("SELECT count(*) FROM public.orders WHERE quotation_id="+lit(qrace)))==(0 if race_results[1]=='stale' else 1))
sql("UPDATE noveli_private.order_number_counters SET last_value=999999 WHERE organization_id="+lit(org))
sql("SELECT public.phase1a_create_order_draft("+",".join([lit(org),lit(client),lit(uid()),"'CLP'",js([item()])])+")",admin,fail="23514")
check("counter exhaustion blocks without seven-digit number")
sql("INSERT INTO noveli_private.order_number_counters VALUES("+lit(org)+",2001,9)")
check("number namespace org/year",sql("SELECT count(*) FROM noveli_private.order_number_counters WHERE organization_id="+lit(org))=="2")
check("no payment/contract tables",sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN('payments','payment_schedules','payment_allocations','payment_refunds','contracts','contract_templates')")=="0")
check("dedicated owner no login no bypass",sql("SELECT NOT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper FROM pg_roles WHERE rolname='noveli_orders_executor'")=="t")
check("private helpers not callable by anon",sql("SELECT NOT has_function_privilege('anon','noveli_private.insert_order(uuid,uuid,uuid,text,jsonb,text,text)','EXECUTE')")=="t")
print("PHASE_1A_INTEGRATION_PASS",len(checks))
