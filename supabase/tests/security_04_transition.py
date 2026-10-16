"""LOCAL integration: A -> dry-run/apply/verify -> legacy gate -> B.

All IDs, paths, bytes and rows are synthetic. Production manifest is not used.
Only metadata/HEAD is read; fixture copies run server-side through Storage API.
"""
from pathlib import Path
import json
import os
import subprocess
import tempfile
import uuid
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlparse, quote

config = json.loads(subprocess.run(
    ['powershell', '-NoProfile', '-Command', 'supabase status -o json'],
    capture_output=True, text=True, check=True).stdout)
base = config['API_URL'].rstrip('/')
assert urlparse(base).hostname in ('localhost', '127.0.0.1') and base.startswith('http://')
service, anon = config['SERVICE_ROLE_KEY'], config['ANON_KEY']
org, client_id, expense_id = (str(uuid.uuid4()) for _ in range(3))
objects, users, checks = set(), [], 0
manifest_path = None
evidence = {}


def check(ok, label):
    global checks
    if not ok:
        raise AssertionError(label)
    checks += 1
    print('PASS:', label, flush=True)


def request(method, path, token=service, payload=None, content=None):
    assert path.startswith('/') and not path.startswith('//')
    headers = {'apikey': anon, 'Authorization': 'Bearer ' + token} if token else {'apikey': anon}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        headers['Content-Type'] = 'application/json'
    if content is not None:
        data = content
        headers['Content-Type'] = 'image/png' if path.endswith('.png') else 'application/octet-stream'
    try:
        with urlopen(Request(base + path, data=data, headers=headers, method=method), timeout=30) as response:
            if method == 'HEAD':
                return response.status, None
            return response.status, json.loads(response.read())
    except HTTPError as error:
        error.close()
        return error.code, None


def sql(query):
    result = subprocess.run(['docker', 'exec', '-i', 'supabase_db_CRM_NOVELI', 'psql', '-U', 'postgres',
                             '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'],
                            input=query.encode(), capture_output=True, check=True)
    return result.stdout.decode().strip()


def upload(bucket, path, label):
    code, data = request('POST', '/storage/v1/object/' + bucket + '/' + quote(path, safe='/'),
                         content=('LOCAL SYNTHETIC ' + label).encode())
    if code not in (200, 201):
        raise AssertionError('Synthetic upload failed: ' + label)
    objects.add((bucket, path))
    return sql(f"SELECT id FROM storage.objects WHERE bucket_id='{bucket}' AND name='{path}';")


def head(bucket, path):
    return request('HEAD', '/storage/v1/object/public/' + bucket + '/' + quote(path, safe='/'), token=None)[0]


def upgrade(expected_error=None):
    result = subprocess.run(['powershell', '-NoProfile', '-Command', 'supabase migration up --local'],
                            capture_output=True, text=True)
    output = result.stdout + result.stderr
    if expected_error:
        check(result.returncode != 0 and expected_error in output, '04B gate: ' + expected_error)
        check(sql("SELECT public FROM storage.buckets WHERE id='documents'") == 't', 'blocked 04B leaves documents public')
    else:
        if result.returncode:
            print(output)
        check(result.returncode == 0, '04B applied through LOCAL migration history')


def node(mode, expect_failure=False):
    environment = os.environ.copy()
    environment['NOVELI_SUPABASE_URL'] = base
    environment['NOVELI_SUPABASE_SERVICE_ROLE_KEY'] = service
    command = ['node', 'scripts/noveli-2/migrate-storage-assets.mjs', '--' + mode, '--manifest', str(manifest_path)]
    if mode == 'apply':
        command += ['--confirm-project', 'local-fixture']
    result = subprocess.run(command, env=environment, capture_output=True, text=True)
    if expect_failure:
        check(result.returncode != 0, 'asset tool rejects unexpected reference')
        return None
    if result.returncode:
        print(result.stdout, result.stderr)
    check(result.returncode == 0, 'asset CLI ' + mode)
    records = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
    return next(row for row in records if row.get('event') == 'summary')


try:
    check(sql("SELECT public FROM storage.buckets WHERE id='documents'") == 't', 'State A: documents public')
    check(sql("SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261016013221'") == '0', '04B not yet applied')
    code, user = request('POST', '/auth/v1/admin/users', payload={
        'email': f'transition04-{uuid.uuid4().hex}@example.invalid', 'password': 'Local-fixture!' + uuid.uuid4().hex,
        'email_confirm': True})
    assert code in (200, 201)
    uid = str(uuid.UUID(user['id']))
    users.append(uid)
    sql(f"INSERT INTO public.organizations(id,name) VALUES ('{org}','Synthetic transition tenant'); "
        f"INSERT INTO public.organization_members(organization_id,user_id,role,active) VALUES ('{org}','{uid}','admin',true); "
        f"INSERT INTO public.clients(id,organization_id,user_id,name) VALUES ('{client_id}','{org}','{uid}','Synthetic client'); "
        f"INSERT INTO public.expenses(id,organization_id,user_id,category) VALUES ('{expense_id}','{org}','{uid}','Synthetic legacy expense');")
    manifest = {'schemaVersion': 1, 'projectRef': 'local-fixture', 'baseUrl': base,
                'organizationId': org, 'assets': []}
    # 9 services, one book with two fields, one hero, three identity objects/four fields.
    layouts = [('services', [('website_services', 'image_url')]) for _ in range(9)]
    layouts += [('covers', [('website_books', 'cover_url'), ('website_books', 'cover_image_url')]),
                ('hero', [('website_hero_settings', 'side_image_url')]),
                ('identity', [('website_settings', 'logo_url'), ('website_settings', 'logo_dark_url')]),
                ('identity', [('website_settings', 'logo_light_url')]),
                ('identity', [('website_settings', 'favicon_url')])]
    row_ids = {table: str(uuid.uuid4()) for table in ['website_books', 'website_hero_settings', 'website_settings']}
    rows = {}
    for i, (folder, fields) in enumerate(layouts):
        path = f'{org}/website/{folder}/synthetic_active_{i:02}.png'
        object_id = upload('documents', path, 'active-' + str(i))
        asset = {'sourceObjectId': object_id, 'sourcePath': path, 'destinationPath': path, 'references': []}
        for table, column in fields:
            row_id = str(uuid.uuid4()) if table == 'website_services' else row_ids[table]
            ref = {'table': table, 'id': row_id, 'column': column, 'organizationId': org}
            asset['references'].append(ref)
            key = (table, row_id)
            rows.setdefault(key, {'id': row_id, 'organization_id': org})[column] = base + '/storage/v1/object/public/documents/' + path
        manifest['assets'].append(asset)
        objects.add(('brand-assets', path))  # Cleanup only this run's possible copy destinations.
    for (table, _), row in rows.items():
        if table == 'website_services':
            row.update(title='Synthetic service', active=True, visible_on_website=True)
        elif table == 'website_books':
            row.update(title='Synthetic book', author='Synthetic author', active=True, visible=True)
        values = [str(value).lower() if isinstance(value, bool) else str(value) for value in row.values()]
        sql(f"INSERT INTO public.{table}({','.join(row)}) VALUES ({','.join(chr(39)+value+chr(39) for value in values)});")
    private_paths = []
    for i in range(6):
        path = f'{org}/clientes/{client_id}/manuscrito/synthetic_private_{i}.txt'
        upload('documents', path, 'private-' + str(i))
        private_paths.append(path)
        sql(f"INSERT INTO public.documents(id,organization_id,user_id,client_id,file_path,file_url) VALUES "
            f"('{uuid.uuid4()}','{org}','{uid}','{client_id}','{path}','{base}/storage/v1/object/public/documents/{path}');")
    unreferenced = []
    for i in range(14):
        path = f'{org}/website/covers/synthetic_unreferenced_{i}.png'
        upload('documents', path, 'unreferenced-' + str(i))
        unreferenced.append(path)
    legacy = f'default-org/proveedores/general/gastos/{expense_id}/comprobante de pago/synthetic_legacy.png'
    legacy_id = upload('documents', legacy, 'legacy')
    for i in range(5):
        upload('brand-assets', f'{org}/logo_synthetic_{i}.png', 'existing-brand-' + str(i))
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', suffix='.json', prefix='noveli-local-fixture-', delete=False) as file:
        manifest_path = Path(file.name)
        json.dump(manifest, file)
    check(sql("SELECT count(*) FROM storage.objects WHERE bucket_id='documents'") == '35', '35 synthetic source objects')
    check(all(head('documents', asset['sourcePath']) == 200 for asset in manifest['assets']), 'State A old web URLs still public')
    check(all(head('documents', path) == 200 for path in private_paths), 'State A preserves all six existing URLs (not private yet)')
    upgrade('public website references still point to documents')
    before = sql('SELECT json_agg(row_to_json(r) ORDER BY table_name,row_id,column_name) FROM public.security04_asset_reference_inventory() r;')
    dry = node('dry-run')
    evidence['dryRun'] = dry
    check(dry['pendingCopies'] == 14 and dry['pendingReferences'] == 16 and dry['copied'] == 0 and dry['updated'] == 0, 'dry-run plans exactly 14/16')
    check(sql("SELECT count(*) FROM storage.objects WHERE bucket_id='brand-assets'") == '5', 'dry-run creates no objects')
    check(sql('SELECT json_agg(row_to_json(r) ORDER BY table_name,row_id,column_name) FROM public.security04_asset_reference_inventory() r;') == before, 'dry-run changes no references')
    # Simulate an unsafe/manual URL rewrite without copies: 04B must still refuse.
    for asset in manifest['assets']:
        for ref in asset['references']:
            target_url = base + '/storage/v1/object/public/brand-assets/' + asset['destinationPath']
            sql(f"UPDATE public.{ref['table']} SET {ref['column']}='{target_url}' WHERE id='{ref['id']}';")
    upgrade('referenced public asset destination is missing')
    for asset in manifest['assets']:
        for ref in asset['references']:
            source_url = base + '/storage/v1/object/public/documents/' + asset['sourcePath']
            sql(f"UPDATE public.{ref['table']} SET {ref['column']}='{source_url}' WHERE id='{ref['id']}';")
    unexpected = str(uuid.uuid4())
    sql(f"INSERT INTO public.website_sections(id,organization_id,section_key,image_url) VALUES ('{unexpected}','{org}','synthetic-unexpected','{rows[next(iter(rows))]['image_url']}');")
    node('apply', expect_failure=True)
    check(sql("SELECT count(*) FROM storage.objects WHERE bucket_id='brand-assets'") == '5', 'unexpected reference aborts before copies')
    sql(f"DELETE FROM public.website_sections WHERE id='{unexpected}';")
    applied = node('apply')
    evidence['apply'] = applied
    check(applied['copied'] == 14 and applied['updated'] == 16, 'apply copies 14 and updates exactly 16')
    verified = node('verify')
    check(verified['pendingCopies'] == 0 and verified['pendingReferences'] == 0, 'all targets and references verified')
    repeated = node('apply')
    evidence['repeatApply'] = repeated
    check(repeated['copied'] == 0 and repeated['updated'] == 0, 'repeat apply is a verified no-op')
    check(sql("SELECT count(*) FROM storage.objects WHERE bucket_id='documents'") == '35', 'all originals/private/unreferenced/legacy preserved')
    upgrade('default-org object requires')
    # Manual synthetic reconciliation fixture ONLY; asset migration tool never handles legacy.
    target = f'{org}/expenses/{expense_id}/{legacy_id}_legacy.png'
    code, _ = request('POST', '/storage/v1/object/copy', payload={
        'bucketId': 'documents', 'sourceKey': legacy, 'destinationBucket': 'documents', 'destinationKey': target})
    assert code in (200, 201)
    objects.add(('documents', target))
    sql(f"INSERT INTO public.documents(id,organization_id,user_id,expense_id,file_path) VALUES ('{uuid.uuid4()}','{org}','{uid}','{expense_id}','{target}');")
    upgrade()
    check(sql("SELECT public FROM storage.buckets WHERE id='documents'") == 'f', 'State B: documents private')
    check(all(head('brand-assets', asset['destinationPath']) == 200 for asset in manifest['assets']), 'State B all migrated web images remain public')
    check(all(head('documents', path) != 200 for path in private_paths + unreferenced + [legacy]), 'State B private/unreferenced/legacy bytes not public')
    check(sql(f"SELECT count(*) FROM public.documents WHERE organization_id='{org}' AND expense_id IS NULL") == '6', 'six original attachments retain metadata')
    check(sql(f"SELECT count(*) FROM public.documents WHERE organization_id='{org}' AND file_path IN ({','.join(chr(39)+p+chr(39) for p in private_paths)})") == '6', 'six original paths unchanged')
    check(all(request('POST', '/storage/v1/object/sign/documents/' + quote(path, safe='/'),
                      payload={'expiresIn': 300})[0] == 200 for path in private_paths), 'State B six original paths can be signed')
    code, public_book = request('GET', '/rest/v1/website_books?id=eq.' + row_ids['website_books'] + '&select=cover_url,cover_image_url', token=None)
    check(code == 200 and len(public_book) == 1 and all('/public/brand-assets/' in url for url in public_book[0].values()), 'public book keeps both migrated image fields')
    evidence.update({'checks': checks, 'stateA': 'PASS', 'stateB': 'PASS', 'productionUsed': False})
    Path('.security04-transition-evidence.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')
    print('SECURITY_04_TRANSITION_PASSED', checks, 'checks; synthetic data only', flush=True)
finally:
    for bucket, path in objects:
        request('DELETE', '/storage/v1/object/' + bucket, payload={'prefixes': [path]})
    for table in ['documents', 'website_sections', 'website_services', 'website_books', 'website_settings', 'website_hero_settings', 'expenses', 'clients', 'organization_members']:
        sql(f"DELETE FROM public.{table} WHERE organization_id='{org}';")
    sql(f"DELETE FROM public.organizations WHERE id='{org}';")
    for uid in users:
        request('DELETE', '/auth/v1/admin/users/' + uid)
    if manifest_path:
        manifest_path.unlink(missing_ok=True)
    print('LOCAL transition fixtures cleaned; no production calls', flush=True)
