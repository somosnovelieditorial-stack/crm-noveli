"""LOCAL only: independently reconstruct A, A+B, then A+B+C. No linked flags."""
import json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
out=root/'docs/noveli-2/phase-1'
versions=['20261018214233','20261018214235','20261018214237']
results=[]
for index,version in enumerate(versions,1):
 r=subprocess.run(['powershell','-NoProfile','-Command','supabase db reset --local --no-seed --version '+version],cwd=root,capture_output=True)
 log=(r.stdout+r.stderr).decode('utf-8',errors='replace')
 (out/('phase-1a-reset-stage-'+str(index)+'.log')).write_text(log,encoding='utf-8')
 if r.returncode:
  print(log[-3500:]);raise SystemExit(r.returncode)
 query="""SELECT jsonb_build_object(
 'orders',(SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN('orders','order_items')),
 'snapshots',to_regclass('noveli_private.quotation_acceptance_snapshots') IS NOT NULL,
 'entrypoints',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'phase1a_%'),
 'executor_create',has_schema_privilege('noveli_orders_executor','noveli_private','CREATE'),
 'price',(noveli_private.price('CLP','[{"name":"stage check","quantity":"1","unit_price":"100","tax_rate":"19","tax_mode":"added"}]'::jsonb)->>'total')::numeric,
 'capabilities_enabled',(SELECT count(*) FROM noveli_private.order_capabilities WHERE enabled),
 'history',(SELECT count(*) FROM supabase_migrations.schema_migrations))"""
 check=subprocess.run(['docker','exec','-i','supabase_db_CRM_NOVELI','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-qAt'],input=query.encode(),capture_output=True,check=True)
 state=json.loads(check.stdout)
 assert state['orders']==(0 if index==1 else 2) and state['snapshots']==(index==3),state
 assert state['entrypoints']==[0,8,12][index-1] and not state['executor_create'],state
 assert state['price']==119 and state['capabilities_enabled']==0 and state['history']==8+index,state
 results.append({'stage':index,'version':version,'exit_code':0,'assertions':state})
 (out/'phase-1a-migration-stage-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
 print('PASS independent migration stage',index,version,flush=True)
print('PHASE1A_THREE_STAGES_PASS')
