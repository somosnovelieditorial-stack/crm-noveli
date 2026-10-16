"""LOCAL Storage HTTP verification. Never downloads document bodies.

Keys/tokens remain in memory; only synthetic objects/users created by this run
are cleaned through local APIs. HEAD verifies public/private and signed URLs.
"""
import json
import subprocess
import time
import sys
import uuid
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlparse, quote

status = subprocess.run(['powershell', '-NoProfile', '-Command', 'supabase status -o json'],
                        capture_output=True, text=True, check=True)
config = json.loads(status.stdout)
base = config['API_URL'].rstrip('/')
assert urlparse(base).hostname in ('127.0.0.1', 'localhost'), 'REFUSE NONLOCAL API'
assert base.startswith('http://'), 'Expected local HTTP only'
anon, service = config['ANON_KEY'], config['SERVICE_ROLE_KEY']
org_a, org_b = str(uuid.uuid4()), str(uuid.uuid4())
run_id = uuid.uuid4().hex
users, objects = [], set()
passed = 0


def check(ok, label):
    global passed
    if not ok:
        raise AssertionError(label)
    passed += 1
    print('PASS:', label)


def request(method, path, token=None, payload=None, binary=None):
    # All destinations are fixed local base + relative API paths, never returned remote URLs.
    assert path.startswith('/') and not path.startswith('//')
    headers = {'apikey': anon}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = None
    if payload is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(payload).encode()
    elif binary is not None:
        headers['Content-Type'] = 'application/octet-stream'
        data = binary
    req = Request(base + path, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=20) as response:
            # Never read a body from object retrieval routes, even synthetic ones.
            if method == 'HEAD':
                return response.status, None
            body = response.read()
            try:
                return response.status, json.loads(body)
            except (ValueError, UnicodeDecodeError):
                return response.status, None
    except HTTPError as error:
        error.close()
        return error.code, None


def sql(query):
    result = subprocess.run(['docker', 'exec', '-i', 'supabase_db_CRM_NOVELI',
                             'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'],
                            input=query.encode(), capture_output=True, check=True)
    return result.stdout.decode()


def upload(bucket, path, token, method='POST'):
    code, _ = request(method, '/storage/v1/object/' + bucket + '/' + quote(path, safe='/'),
                      token, binary=b'LOCAL SECURITY04 SYNTHETIC FIXTURE ONLY')
    if 200 <= code < 300:
        objects.add((bucket, path))
    return 200 <= code < 300


def remove(bucket, path, token):
    return request('DELETE', '/storage/v1/object/' + bucket, token, {'prefixes': [path]})


def exists(bucket, path):
    code, _ = request('HEAD', '/storage/v1/object/authenticated/' + bucket + '/' + quote(path, safe='/'), service)
    return code == 200


try:
    sql(f"INSERT INTO public.organizations(id,name) VALUES ('{org_a}','Local Storage04 A'),('{org_b}','Local Storage04 B');")
    actors = []
    roles = ['admin', 'editor', 'diseñador', 'corrector', 'finanzas', 'visualizador', 'inactive', 'unknown', 'other_admin']
    for role in roles:
        email = f'storage04-{run_id}-{len(actors)}@example.invalid'
        password = 'Local-Synthetic-04!' + uuid.uuid4().hex
        code, user = request('POST', '/auth/v1/admin/users', service,
                             {'email': email, 'password': password, 'email_confirm': True})
        check(code in (200, 201) and user and user.get('id'), 'local Auth fixture ' + role)
        uid = str(uuid.UUID(user['id']))
        users.append(uid)
        if role != 'unknown':
            org = org_b if role == 'other_admin' else org_a
            canonical = 'admin' if role in ('inactive', 'other_admin') else role
            active = 'false' if role == 'inactive' else 'true'
            sql(f"INSERT INTO public.organization_members(organization_id,user_id,role,active) VALUES ('{org}','{uid}','{canonical}',{active});")
        code, session = request('POST', '/auth/v1/token?grant_type=password', None,
                                {'email': email, 'password': password})
        check(code == 200 and session and session.get('access_token'), 'local session ' + role)
        actors.append((role, session['access_token']))
    admin = actors[0][1]
    other_admin = actors[-1][1]
    path_a, path_b = org_a + '/general/' + run_id + '.txt', org_b + '/general/' + run_id + '.txt'
    brand = org_a + '/logo_' + run_id + '.png'
    check(upload('documents', path_a, admin), 'admin uploads private A')
    check(upload('documents', path_b, other_admin), 'admin uploads private B')
    check(upload('brand-assets', brand, admin), 'admin uploads public brand')
    check(request('HEAD', '/storage/v1/object/public/brand-assets/' + brand)[0] == 200, 'anon HEAD public brand')
    check((request('HEAD', '/storage/v1/object/public/documents/' + path_a)[0] == 200) == ('--prepare' in sys.argv),
          'public byte serving matches explicit PREPARE/LOCKDOWN stage')
    for role, token in actors[:-1] + [('anon', None)]:
        reader = role in roles[:6]
        writer = role in roles[:5]
        code, listed = request('POST', '/storage/v1/object/list/documents', token,
                               {'prefix': org_a + '/general', 'limit': 100})
        check((code == 200 and bool(listed)) == reader, role + ' private listing')
        code, signed = request('POST', '/storage/v1/object/sign/documents/' + path_a, token, {'expiresIn': 300})
        check((code == 200 and bool(signed)) == reader, role + ' can mint signed URL only if readable')
        cross_code, cross = request('POST', '/storage/v1/object/sign/documents/' + path_b, token, {'expiresIn': 300})
        check(cross_code != 200 or not cross, role + ' cannot sign B')
        code, foreign_list = request('POST', '/storage/v1/object/list/documents', token, {'prefix': org_b + '/general', 'limit': 100})
        check(code != 200 or not foreign_list, role + ' cannot list B')
        safe_role = str(roles.index(role)) if role in roles else 'anon'
        candidate = org_a + '/general/' + run_id + '-' + safe_role + '.txt'
        check(upload('documents', candidate, token) == writer, role + ' upload documents')
        check(upload('documents', path_a, token, 'PUT') == writer, role + ' update documents')
        check(not upload('documents', path_b, token, 'PUT'), role + ' cannot update B')
        remove('documents', path_b, token)
        check(exists('documents', path_b), role + ' cannot delete B')
        cms = org_a + '/website/hero/' + run_id + '-' + safe_role + '.png'
        check(upload('brand-assets', cms, token) == writer, role + ' CMS image upload')
        root = org_a + '/logo_' + run_id + '-' + safe_role + '.png'
        check(upload('brand-assets', root, token) == (role == 'admin'), role + ' root brand admin only')
        remove('documents', path_a, token)
        check(exists('documents', path_a) == (not writer), role + ' delete documents follows writer policy')
        if writer:
            check(upload('documents', path_a, admin), 'restore synthetic private fixture')
    code, signed = request('POST', '/storage/v1/object/sign/documents/' + path_a, admin, {'expiresIn': 1})
    check(code == 200, 'short-lived signed URL created')
    signed_path = signed.get('signedURL') or signed.get('signedUrl')
    assert signed_path.startswith('/') and not signed_path.startswith('//')
    if not signed_path.startswith('/storage/v1/'):
        signed_path = '/storage/v1' + signed_path
    check(request('HEAD', signed_path)[0] == 200, 'signed bearer HEAD works without session')
    time.sleep(2.5)
    check(request('HEAD', signed_path)[0] != 200, 'expired signed URL rejected')
    print(f'SECURITY_04_LOCAL_HTTP_PASSED: {passed} assertions; HEAD only, no document body downloaded')
finally:
    for bucket, path in objects:
        remove(bucket, path, service)
    sql(f"DELETE FROM public.organization_members WHERE organization_id IN ('{org_a}','{org_b}'); DELETE FROM public.organizations WHERE id IN ('{org_a}','{org_b}');")
    for uid in users:
        request('DELETE', '/auth/v1/admin/users/' + uid, service)
    print('LOCAL synthetic fixture cleanup completed; no remote calls')
