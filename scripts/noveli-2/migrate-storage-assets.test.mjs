import test from 'node:test';
import assert from 'node:assert/strict';
import { runMigration, validateManifest } from './migrate-storage-assets.mjs';

function fixture() {
  const id = n => `a4000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const manifest = { schemaVersion: 1, projectRef: 'local-fixture', baseUrl: 'http://127.0.0.1:54321',
    organizationId: id(1), assets: [] };
  const rows = [], objects = new Map(), counters = { copy: 0, update: 0 };
  for (let i = 0; i < 14; i++) {
    const path = `${id(1)}/website/services/synthetic-${i}.png`;
    const asset = { sourceObjectId: id(100 + i), sourcePath: path, destinationPath: path,
      references: [{ table: 'website_services', id: id(200 + i), column: 'image_url', organizationId: id(1) }] };
    if (i === 0) asset.references.push(...['cover_url', 'cover_image_url'].map(column =>
      ({ table: 'website_books', id: id(300), column, organizationId: id(1) })));
    manifest.assets.push(asset);
    objects.set('documents/' + path, { id: asset.sourceObjectId, metadata: { size: 42, eTag: `hash-${i}`, mimetype: 'image/png' } });
    for (const ref of asset.references) rows.push({ table_name: ref.table, row_id: ref.id,
      organization_id: ref.organizationId, column_name: ref.column,
      url: `${manifest.baseUrl}/storage/v1/object/public/documents/${path}` });
  }
  const adapter = {
    async inventory() { return structuredClone(rows); },
    async info(bucket, path) { return objects.get(bucket + '/' + path) || null; },
    async head(path) { const m = objects.get('brand-assets/' + path)?.metadata;
      return { status: m ? 200 : 404, length: m?.size, tag: m?.eTag }; },
    async copy(source, destination) {
      counters.copy++;
      objects.set('brand-assets/' + destination, structuredClone(objects.get('documents/' + source)));
    },
    async updateReference(ref) {
      const row = rows.find(row => row.table_name === ref.table && row.row_id === ref.id && row.column_name === ref.column);
      if (row.url !== ref.source) throw new Error('CAS conflict');
      counters.update++;
      row.url = ref.destination;
    },
  };
  return { manifest, adapter, rows, objects, counters };
}

test('dry-run inspects 14 assets/16 references without changing Storage or DB', async () => {
  const f = fixture(), before = structuredClone(f.rows);
  const result = await runMigration({ ...f, mode: 'dry-run' });
  assert.equal(result.pendingCopies, 14);
  assert.equal(result.pendingReferences, 16);
  assert.deepEqual(f.counters, { copy: 0, update: 0 });
  assert.deepEqual(f.rows, before);
  assert.equal(f.objects.size, 14);
});

test('apply then repeat then verify is idempotent and preserves all sources', async () => {
  const f = fixture();
  assert.deepEqual(await runMigration({ ...f, mode: 'apply' }),
    { mode: 'apply', assets: 14, references: 16, copied: 14, updated: 16, pendingCopies: 0, pendingReferences: 0 });
  const again = await runMigration({ ...f, mode: 'apply' });
  assert.equal(again.copied, 0);
  assert.equal(again.updated, 0);
  await runMigration({ ...f, mode: 'verify' });
  assert.equal(f.objects.size, 28);
  assert.equal([...f.objects.keys()].filter(key => key.startsWith('documents/')).length, 14);
});

test('unexpected reference, tenant drift and missing/changed field abort before mutation', async () => {
  for (const change of [
    f => f.rows.push({ ...f.rows[0], row_id: 'a4000000-0000-4000-8000-000000009999' }),
    f => { f.rows[0].organization_id = 'a4000000-0000-4000-8000-000000009999'; },
    f => { f.rows[0].url = 'https://unexpected.example/image.png'; },
    f => { f.objects.get('documents/' + f.manifest.assets[0].sourcePath).id = 'replaced'; },
  ]) {
    const f = fixture(); change(f);
    await assert.rejects(runMigration({ ...f, mode: 'apply' }));
    assert.deepEqual(f.counters, { copy: 0, update: 0 });
  }
});

test('destination collisions and failed verification never overwrite destination', async () => {
  const f = fixture();
  f.objects.set('brand-assets/' + f.manifest.assets[0].destinationPath,
    { id: 'other', metadata: { size: 13, eTag: 'different', mimetype: 'image/png' } });
  await assert.rejects(runMigration({ ...f, mode: 'apply' }), /collision/);
  assert.deepEqual(f.counters, { copy: 0, update: 0 });
  await assert.rejects(runMigration({ ...fixture(), mode: 'verify' }), /Missing destination/);
});

test('stopped CAS sequence resumes only expected references; no recopy/deletion', async () => {
  const f = fixture(), original = f.adapter.updateReference;
  f.adapter.updateReference = async ref => {
    if (f.counters.update === 3) throw new Error('CAS conflict');
    return original(ref);
  };
  await assert.rejects(runMigration({ ...f, mode: 'apply' }), /CAS conflict/);
  f.adapter.updateReference = original;
  const result = await runMigration({ ...f, mode: 'apply' });
  assert.equal(result.copied, 0);
  assert.equal(result.updated, 13);
  assert.equal(f.objects.size, 28);
});

test('scope is fixed: private/legacy paths and non-reviewed counts/columns are rejected', () => {
  for (const change of [
    f => { f.manifest.assets[0].sourcePath = 'default-org/private/file.png'; },
    f => { f.manifest.assets[0].references[0].table = 'documents'; },
    f => { f.manifest.assets.pop(); },
  ]) {
    const f = fixture(); change(f);
    assert.throws(() => validateManifest(f.manifest));
  }
});
