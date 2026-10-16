import test from 'node:test';
import assert from 'node:assert/strict';
import { getDocumentPath, createDocumentUrl, DOCUMENT_URL_TTL } from './storageDocuments.js';

test('legacy public/signed URLs become a path without retaining credentials', () => {
  const path = '11111111-1111-1111-1111-111111111111/clientes/a/comprobante de pago/a%.pdf';
  assert.equal(getDocumentPath(path), path);
  for (const kind of ['public', 'sign', 'authenticated']) {
    assert.equal(getDocumentPath(`https://example.supabase.co/storage/v1/object/${kind}/documents/${encodeURI(path)}?token=discard`), path);
  }
});

test('reject empty, foreign bucket and traversal paths; preserve literal encoded file names', () => {
  for (const path of ['', null, '/absolute/file', 'org/../secret', 'org//file', 'https://example.com/file',
    'https://example.supabase.co/storage/v1/object/public/brand-assets/logo.png']) {
    assert.throws(() => getDocumentPath(path));
  }
  assert.equal(getDocumentPath('org/general/literal%20name.pdf'), 'org/general/literal%20name.pdf');
});

test('sign canonical path for five minutes; permission errors never fall back to public URL', async () => {
  let calls = 0;
  const storage = { from(bucket) {
    assert.equal(bucket, 'documents');
    return { async createSignedUrl(path, ttl) {
      calls++;
      assert.equal(path, 'org/general/test.pdf');
      assert.equal(ttl, DOCUMENT_URL_TTL);
      return { data: { signedUrl: 'temporary-signed-url' }, error: null };
    } };
  } };
  assert.equal(await createDocumentUrl(storage, { file_path: 'org/general/test.pdf', file_url: 'old-public-url' }), 'temporary-signed-url');
  assert.equal(calls, 1);
  await assert.rejects(createDocumentUrl({ from: () => ({ createSignedUrl: async () => ({ error: new Error('denied') }) }) },
    { file_path: 'org/general/test.pdf' }), /denied/);
});
