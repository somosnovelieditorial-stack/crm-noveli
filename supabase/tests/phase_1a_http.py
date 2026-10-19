"""PostgREST/Auth Phase1A checks, fixed LOCAL API only; secrets stay in memory."""
import json,subprocess,uuid,time
from decimal import Decimal
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from urllib.parse import urlparse
from pathlib import Path
config=json.loads(subprocess.run(["powershell","-NoProfile","-Command","supabase status -o json"],capture_output=True,text=True,check=True).stdout)
base=config["API_URL"].rstrip("/")
assert urlparse(base).hostname in ("localhost","127.0.0.1") and urlparse(base).scheme=="http","LOCAL ONLY"
anon,service=config["ANON_KEY"],config["SERVICE_ROLE_KEY"]
checks=[]
def check(label,ok):
 assert ok,label
 checks.append({"test":label,"status":"PASS"}); print("PASS:",label,flush=True)
def api(method,path,token=None,payload=None):
 assert path.startswith("/") and not path.startswith("//")
 req=Request(base+path,data=None if payload is None else json.dumps(payload).encode(),
 headers={"apikey":anon,"Authorization":"Bearer "+(token or anon),"Content-Type":"application/json","Prefer":"return=representation"},method=method)
 try:
  with urlopen(req,timeout=20) as r:
   b=r.read();return r.status,json.loads(b) if b else None
 except HTTPError as e:
  try: detail=json.loads(e.read()).get('msg','')
  except (ValueError,AttributeError): detail=''
  e.close();return e.code,{'error_message':detail}
def uid():return str(uuid.uuid4())
def sql(q):
 r=subprocess.run(["docker","exec","-i","supabase_db_CRM_NOVELI","psql","-X","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-qAt"],input=q.encode(),capture_output=True)
 assert not r.returncode,r.stderr.decode(errors="replace")
 return r.stdout.decode().strip()
def lit(s):return "'"+s.replace("'","''")+"'"
sql("NOTIFY pgrst,'reload schema';")
for readiness_attempt in range(60):
 code,_=api('GET','/auth/v1/admin/users?page=1&per_page=1',service)
 if code==200:break
 if code not in (502,503):raise AssertionError(('Unexpected Auth readiness failure',code))
 time.sleep(0.5)
assert code==200,'LOCAL Auth gateway not ready after database reset'
org,other=uid(),uid()
api("POST","/rest/v1/organizations",service,[{"id":org,"name":"Phase1A HTTP"},{"id":other,"name":"Other HTTP"}])
tokens={};ids={}
for role in ["admin","editor","diseñador","corrector","finanzas","visualizador","inactive","unknown"]:
 email=uid()+"@example.invalid";password="Synthetic-local!"+uid()
 code,u=api("POST","/auth/v1/admin/users",service,{"email":email,"password":password,"email_confirm":True})
 assert code in (200,201),(code,u)
 ids[role]=u["id"]
 if role!="unknown":
  code,_=api("POST","/rest/v1/organization_members",service,{"organization_id":org,"user_id":u["id"],"role":"editor" if role=="inactive" else role,"active":role!="inactive"})
  assert code in (200,201)
 code,session=api("POST","/auth/v1/token?grant_type=password",None,{"email":email,"password":password});assert code==200
 tokens[role]=session["access_token"]
sql("INSERT INTO noveli_private.order_capabilities VALUES("+lit(org)+",'orders',true),("+lit(org)+",'quotation_conversion',true);")
code,c=api("POST","/rest/v1/clients",tokens["admin"],{"organization_id":org,"user_id":ids["admin"],"name":"HTTP synthetic client"})
assert code in (200,201);client=c[0]["id"]
def rpc(role,name,payload):return api("POST","/rest/v1/rpc/phase1a_"+name,tokens[role] if role else None,payload)
def payload(tenant=org):
 return {"p_org":tenant,"p_client":client,"p_operation_key":uid(),"p_currency":"CLP","p_items":[{"name":"HTTP item","quantity":"1","unit_price":"100","tax_mode":"added","tax_rate":"19"}]}
code,o=rpc("admin","create_order_draft",payload())
assert code in (200,201),(code,o)
if isinstance(o,list):o=o[0]
oid=o["id"]
check("HTTP admin creates canonical decimal-string order",isinstance(o['total'],str) and Decimal(o['total'])==119)
for role in tokens:
 code,rows=api("GET","/rest/v1/orders?select=id&organization_id=eq."+org,tokens[role])
 check("HTTP RLS read "+role,code==200 and (bool(rows) if role not in ("inactive","unknown") else rows==[]))
 code,_=api("PATCH","/rest/v1/orders?id=eq."+oid,tokens[role],{"total":0})
 check("HTTP direct mutation denied "+role,code in (401,403))
 if role not in ("admin","editor"):
  code,_=rpc(role,"create_order_draft",payload())
  check("HTTP RPC create denied "+role,code in (401,403))
code,_=rpc("editor","create_order_draft",payload());check("HTTP editor creates",code==200)
code,_=rpc(None,"create_order_draft",payload());check("HTTP anon RPC denied",code in (401,403))
code,_=api("GET","/rest/v1/orders",None);check("HTTP anon table denied",code in (401,403))
code,_=rpc("admin","create_order_draft",payload(other));check("HTTP cross-tenant denied",code in (401,403))
code,_=rpc("visualizador","order_payment_summary",{"p_org":org,"p_order":oid});check("HTTP viewer summary authorized",code==200)
code,_=rpc("visualizador","submit_order",{"p_org":org,"p_order":oid});check("HTTP viewer cannot publish",code in (401,403))
code,_=rpc("admin","submit_order",{"p_org":org,"p_order":oid});check("HTTP submit",code==200)
code,_=rpc("admin","accept_order",{"p_org":org,"p_order":oid,"p_evidence":{"channel":"HTTP local client acceptance"}});check("HTTP accept",code==200)
code,_=api("DELETE","/rest/v1/orders?id=eq."+oid,tokens["admin"]);check("HTTP admin delete denied",code in (401,403))
catalog=uid()
code,_=api('POST','/rest/v1/service_catalog',tokens['admin'],{'id':catalog,'organization_id':org,'user_id':ids['admin'],'name':'HTTP catalog source','category':'editorial','base_price':100})
assert code in (200,201)
catalog_request=payload();catalog_request['p_items'][0]['catalog_id']=catalog
code,catalog_order=rpc('admin','create_order_draft',catalog_request);assert code==200
if isinstance(catalog_order,list):catalog_order=catalog_order[0]
rpc('admin','submit_order',{'p_org':org,'p_order':catalog_order['id']})
rpc('admin','accept_order',{'p_org':org,'p_order':catalog_order['id'],'p_evidence':{'channel':'catalog snapshot'}})
code,_=api('DELETE','/rest/v1/service_catalog?id=eq.'+catalog,tokens['admin'])
check('HTTP authenticated catalog deletion remains allowed',code in (200,204))
code,catalog_rows=api('GET','/rest/v1/order_items?order_id=eq.'+catalog_order['id'],tokens['admin'])
check('HTTP accepted snapshot survives RI SET NULL',code==200 and catalog_rows[0]['catalog_id'] is None and catalog_rows[0]['total']==119)
qid,iid=uid(),uid()
sql("INSERT INTO public.quotations(id,user_id,organization_id,client_id,status,accepted_at,currency,total,discount,iva_mode,tax_rate,extension_adjustment_type,extension_adjustment_value) VALUES("+','.join([lit(qid),lit(ids['admin']),lit(org),lit(client),"'aceptada'",'now()',"'CLP'",'119','0',"'+ IVA'",'19',"'none'",'0'])+");INSERT INTO public.quotation_items(id,user_id,organization_id,quotation_id,concept,quantity,unit_price,total) VALUES("+','.join([lit(iid),lit(ids['admin']),lit(org),lit(qid),"'HTTP quotation source'",'1','100','100'])+")")
code,source=rpc('admin','quotation_review_source',{'p_org':org,'p_quotation':qid});assert code==200
code,revision=rpc('admin','review_and_accept_quotation',{'p_org':org,'p_quotation':qid,'p_client':client,'p_evidence':{'channel':'HTTP quotation approval'},'p_expected_fingerprint':source['fingerprint']})
check('HTTP immutable quotation revision',code==200 and bool(revision.get('id')))
conversion={'p_org':org,'p_quotation':qid,'p_snapshot':revision['id'],'p_expected_sha':revision['snapshot_sha256'],'p_operation_key':uid()}
code,converted=rpc('admin','convert_quotation_to_order',conversion);assert code==200
if isinstance(converted,list):converted=converted[0]
check('HTTP conversion canonical and accepted',converted['commercial_status']=='accepted' and isinstance(converted['total'],str) and Decimal(converted['total'])==119)
code,retry=rpc('admin','convert_quotation_to_order',conversion)
if isinstance(retry,list):retry=retry[0]
check('HTTP conversion replay returns same order',code==200 and retry['id']==converted['id'])
code,_=rpc('visualizador','convert_quotation_to_order',conversion);check('HTTP viewer conversion denied',code in (401,403))
for token in tokens.values():api("POST","/auth/v1/logout?scope=local",token)
Path("docs/noveli-2/phase-1/phase-1a-http-results.json").write_text(json.dumps({"environment":"LOCAL","passed":len(checks),"checks":checks,"credentials_persisted":False},indent=2),encoding="utf-8")
tokens.clear();print("PHASE1A_HTTP_PASS",len(checks))
