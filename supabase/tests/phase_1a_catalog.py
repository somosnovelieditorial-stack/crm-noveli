"""Catalog security regression: original policies/functions and migration files unchanged."""
from pathlib import Path
import hashlib,json,re,subprocess
root=Path(__file__).resolve().parents[2]
ref=json.loads((root/'docs/noveli-2/phase-1/catalog-audit.json').read_text(encoding='utf-8-sig'))
manifest=json.loads((root/'docs/noveli-2/phase-1/REVIEW-MANIFEST.json').read_text(encoding='utf-8-sig'))
query="""SELECT jsonb_build_object(
'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public'),
'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'),
'flags',(SELECT jsonb_object_agg(id,public) FROM storage.buckets),
'storage_policies',(SELECT count(*) FROM pg_policies WHERE schemaname='storage'),
'rls',(SELECT bool_and(relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'),
'history',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations))"""
r=subprocess.run(['docker','exec','-i','supabase_db_CRM_NOVELI','psql','-X','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],input=query.encode(),capture_output=True,check=True)
now=json.loads(r.stdout)
key=lambda p:(p['schemaname'],p['tablename'],p['policyname'])
norm=lambda x:re.sub(r'\s+',' ',x).strip() if isinstance(x,str) else x
current={key(p):p for p in now['policies']}
for p in ref['policies']:
 assert {k:norm(v) for k,v in current[key(p)].items()}=={k:norm(v) for k,v in p.items()},p['policyname']
functions={f['name']:norm(f['definition']) for f in now['functions']}
for f in ref['functions']:assert functions[f['name']]==norm(f['definition']),f['name']
for f in manifest['existing_migrations']:
 assert hashlib.sha256((root/'supabase/migrations'/f['file']).read_bytes()).hexdigest()==f['sha256'],f['file']
assert now['flags']=={'documents':False,'brand-assets':True} and now['storage_policies']==16 and now['rls']
assert len(now['history'])==11 and now['history'][-1]=='20261018214237'
report={'legacy_public_policies_unchanged':len(ref['policies']),'legacy_public_functions_unchanged':len(ref['functions']),'original_migration_hashes_unchanged':8,'storage_policies':16,'bucket_flags':now['flags'],'all_public_tables_rls':True,'local_migration_history':now['history'],'status':'PASS'}
(root/'docs/noveli-2/phase-1/phase-1a-catalog-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
schema_query="""SELECT jsonb_build_object(
 'environment','LOCAL Docker only',
 'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'acl',c.relacl::text)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND (n.nspname='noveli_private' OR (n.nspname='public' AND c.relname IN('orders','order_items')))),
 'columns',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull)) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind='r' AND (n.nspname='noveli_private' OR (n.nspname='public' AND c.relname IN('orders','order_items')))),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid))) FROM pg_constraint WHERE connamespace='noveli_private'::regnamespace OR conname LIKE 'phase1a_%' OR conrelid IN('public.orders'::regclass,'public.order_items'::regclass)),
 'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='noveli_private' OR policyname LIKE 'phase1a_%'),
 'indexes',(SELECT jsonb_agg(to_jsonb(i)) FROM pg_indexes i WHERE schemaname='noveli_private' OR (schemaname='public' AND tablename IN('orders','order_items'))),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'name',tgname,'definition',pg_get_triggerdef(oid))) FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'phase1a_%'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'returns',pg_get_function_result(p.oid),'security_definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),'config',p.proconfig,'acl',p.proacl::text)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='noveli_private' OR (n.nspname='public' AND p.proname LIKE 'phase1a_%')))
"""
schema_result=subprocess.run(['docker','exec','-i','supabase_db_CRM_NOVELI','psql','-X','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],input=schema_query.encode(),capture_output=True,check=True)
(root/'docs/noveli-2/phase-1/phase-1a-schema.json').write_text(json.dumps(json.loads(schema_result.stdout),indent=2),encoding='utf-8')
