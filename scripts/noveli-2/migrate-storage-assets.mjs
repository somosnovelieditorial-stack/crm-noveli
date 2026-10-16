import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedColumns = {
  website_books: ['cover_url', 'cover_image_url'],
  website_services: ['image_url'],
  website_hero_settings: ['side_image_url'],
  website_settings: ['logo_url', 'logo_dark_url', 'logo_light_url', 'favicon_url'],
};
const location = ref => `${ref.table}/${ref.id}/${ref.column}`;
const publicUrl = (manifest, bucket, path) => `${manifest.baseUrl}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
const normalizeTag = tag => String(tag || '').replace(/^W\//, '').replaceAll('"', '').toLowerCase();

export function validateManifest(manifest) {
  if (manifest.schemaVersion !== 1 || manifest.assets?.length !== 14 || !uuid.test(manifest.organizationId))
    throw new Error('Expected the reviewed 14-asset manifest and one canonical tenant UUID.');
  const sources = new Set(), references = new Set();
  for (const asset of manifest.assets) {
    if (!uuid.test(asset.sourceObjectId) || asset.sourcePath !== asset.destinationPath ||
        !asset.sourcePath.startsWith(`${manifest.organizationId}/website/`) ||
        asset.sourcePath.split('/').some(part => !part || part === '.' || part === '..') ||
        !/\.(png|jpe?g|webp|gif|avif|ico)$/i.test(asset.sourcePath) || sources.has(asset.sourcePath))
      throw new Error('Invalid, duplicate or non-CMS source/destination in manifest.');
    sources.add(asset.sourcePath);
    for (const ref of asset.references) {
      if (!uuid.test(ref.id) || ref.organizationId !== manifest.organizationId ||
          !allowedColumns[ref.table]?.includes(ref.column) || references.has(location(ref)))
        throw new Error('Invalid/duplicate or out-of-scope PostgreSQL reference.');
      references.add(location(ref));
    }
  }
  if (references.size !== 16) throw new Error('Expected exactly 16 reviewed references.');
}

function expectedReferences(manifest) {
  return manifest.assets.flatMap(asset => asset.references.map(ref => ({ ...ref,
    source: publicUrl(manifest, 'documents', asset.sourcePath),
    destination: publicUrl(manifest, 'brand-assets', asset.destinationPath),
  })));
}

async function referenceState(manifest, adapter) {
  const expected = expectedReferences(manifest);
  const byLocation = new Map(expected.map(ref => [location(ref), ref]));
  const sourceUrls = new Set(expected.map(ref => ref.source));
  const destinationUrls = new Set(expected.map(ref => ref.destination));
  const actual = new Map();
  for (const row of await adapter.inventory()) {
    const key = `${row.table_name}/${row.row_id}/${row.column_name}`;
    const url = row.url;
    if (!sourceUrls.has(url) && !destinationUrls.has(url)) {
      if (url.includes('/storage/v1/object/public/documents/'))
        throw new Error(`Unexpected public documents asset reference: ${key}`);
      continue; // Unrelated/new brand-assets are not part of the 14-object migration.
    }
    const ref = byLocation.get(key);
    if (!ref || ![ref.source, ref.destination].includes(url) || row.organization_id !== ref.organizationId)
      throw new Error(`Unexpected reference or tenant: ${key}`);
    if (actual.has(key) && actual.get(key) !== url) throw new Error(`Ambiguous reference: ${key}`);
    actual.set(key, url);
  }
  for (const ref of expected) {
    if (!actual.has(location(ref))) throw new Error(`Missing/changed expected reference: ${location(ref)}`);
  }
  return expected.map(ref => ({ ...ref, current: actual.get(location(ref)) }));
}

function fingerprint(object) {
  const metadata = object?.metadata || {};
  const size = Number(metadata.size ?? metadata.contentLength);
  const tag = normalizeTag(metadata.eTag ?? metadata.etag);
  const mime = String(metadata.mimetype ?? metadata.contentType ?? '').toLowerCase();
  if (!object || !Number.isFinite(size) || size < 0 || !tag || !mime)
    throw new Error('Cannot prove object identity from size, ETag and MIME metadata.');
  return { size, tag, mime };
}

async function validateDestination(adapter, asset, source, destination) {
  if (JSON.stringify(fingerprint(source)) !== JSON.stringify(fingerprint(destination)))
    throw new Error(`Destination collision or changed bytes: ${asset.destinationPath}`);
  const head = await adapter.head(asset.destinationPath);
  const expected = fingerprint(source);
  if (head.status !== 200 || Number(head.length) !== expected.size || normalizeTag(head.tag) !== expected.tag)
    throw new Error(`Public destination HEAD verification failed: ${asset.destinationPath}`);
}

export async function runMigration({ manifest, adapter, mode = 'dry-run', log = () => {} }) {
  validateManifest(manifest);
  if (!['dry-run', 'apply', 'verify'].includes(mode)) throw new Error('Unknown mode.');
  let references = await referenceState(manifest, adapter);
  const objects = [];
  // Complete read-only preflight before ANY copy or PostgreSQL update.
  for (const asset of manifest.assets) {
    const source = await adapter.info('documents', asset.sourcePath);
    if (source?.id !== asset.sourceObjectId) throw new Error(`Missing/replaced source object: ${asset.sourcePath}`);
    fingerprint(source);
    const destination = await adapter.info('brand-assets', asset.destinationPath);
    if (destination) await validateDestination(adapter, asset, source, destination);
    if (mode === 'verify' && !destination) throw new Error(`Missing destination: ${asset.destinationPath}`);
    objects.push({ asset, source, destination });
  }
  let copied = 0, updated = 0;
  for (const item of objects) {
    const { asset, source } = item;
    log({ event: item.destination ? 'copy_already_verified' : 'copy_planned',
      source: `documents/${asset.sourcePath}`, destination: `brand-assets/${asset.destinationPath}` });
    if (!item.destination && mode === 'apply') {
      await adapter.copy(asset.sourcePath, asset.destinationPath);
      item.destination = await adapter.info('brand-assets', asset.destinationPath);
      await validateDestination(adapter, asset, source, item.destination);
      copied++;
      log({ event: 'copied_and_verified', source: asset.sourcePath, destination: asset.destinationPath });
    }
  }
  // Detect new/unexpected references introduced during copying before touching PostgreSQL.
  references = await referenceState(manifest, adapter);
  for (const ref of references) {
    log({ event: ref.current === ref.destination ? 'reference_already_updated' : 'reference_planned',
      reference: location(ref), source: ref.source, destination: ref.destination });
    if (mode === 'verify' && ref.current !== ref.destination)
      throw new Error(`Reference still points to source: ${location(ref)}`);
    if (mode === 'apply' && ref.current === ref.source) {
      // Compare-and-swap protects concurrent changes. Never overwrite an unexpected value.
      await adapter.updateReference(ref);
      updated++;
      log({ event: 'reference_updated', reference: location(ref), source: ref.source, destination: ref.destination });
    }
  }
  if (mode === 'apply') {
    const final = await referenceState(manifest, adapter);
    if (final.some(ref => ref.current !== ref.destination)) throw new Error('Final PostgreSQL verification failed.');
  }
  const summary = { mode, assets: 14, references: 16, copied, updated,
    pendingCopies: objects.filter(item => !item.destination).length,
    pendingReferences: references.filter(ref => ref.current !== ref.destination).length };
  if (mode === 'apply') summary.pendingReferences = 0;
  log({ event: 'summary', ...summary });
  return summary;
}

export function createAdapter(client, manifest) {
  return {
    async inventory() {
      const { data, error } = await client.rpc('security04_asset_reference_inventory');
      if (error) throw error;
      return data || [];
    },
    async info(bucket, path) {
      const slash = path.lastIndexOf('/'), prefix = path.slice(0, slash), filename = path.slice(slash + 1);
      for (let offset = 0; offset < 10000; offset += 100) {
        const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 100, offset, search: filename });
        if (error) throw error;
        const found = data?.find(object => object.name === filename);
        if (found) return found;
        if (!data || data.length < 100) return null;
      }
      throw new Error('Object metadata listing exceeded safe pagination limit.');
    },
    async head(path) {
      const response = await fetch(publicUrl(manifest, 'brand-assets', path), { method: 'HEAD', redirect: 'error', cache: 'no-store' });
      return { status: response.status, length: response.headers.get('content-length'), tag: response.headers.get('etag') };
    },
    async copy(source, destination) {
      const { error } = await client.storage.from('documents').copy(source, destination, { destinationBucket: 'brand-assets' });
      if (error) throw error;
    },
    async updateReference(ref) {
      const { data, error } = await client.from(ref.table).update({ [ref.column]: ref.destination })
        .eq('id', ref.id).eq('organization_id', ref.organizationId).eq(ref.column, ref.source).select('id');
      if (error) throw error;
      if (data?.length !== 1) throw new Error(`Concurrent reference change; stopped at ${location(ref)}`);
    },
  };
}

async function main() {
  const args = process.argv.slice(2), modes = args.filter(arg => ['--dry-run', '--apply', '--verify'].includes(arg));
  if (modes.length > 1) throw new Error('Select exactly one mode. Default is --dry-run.');
  const mode = (modes[0] || '--dry-run').slice(2);
  let manifestPath = fileURLToPath(new URL('./storage-assets-manifest.json', import.meta.url));
  let confirmProject;
  for (let i = 0; i < args.length; i++) {
    if (['--dry-run', '--apply', '--verify'].includes(args[i])) continue;
    if (args[i] === '--manifest' && args[i + 1]) manifestPath = resolve(args[++i]);
    else if (args[i] === '--confirm-project' && args[i + 1]) confirmProject = args[++i];
    else throw new Error('Unknown or incomplete argument.');
  }
  const baseUrl = process.env.NOVELI_SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.NOVELI_SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error('Set NOVELI_SUPABASE_URL and NOVELI_SUPABASE_SERVICE_ROLE_KEY outside the repository.');
  const url = new URL(baseUrl), local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:')))
    throw new Error('Unsafe Supabase endpoint.');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.baseUrl !== baseUrl) throw new Error('Endpoint must match reviewed manifest exactly.');
  if (!local && (manifestPath !== fileURLToPath(new URL('./storage-assets-manifest.json', import.meta.url)) ||
      url.hostname !== `${manifest.projectRef}.supabase.co`))
    throw new Error('Remote endpoint requires the original reviewed manifest/project. Fixture overrides are LOCAL only.');
  if (mode === 'apply' && confirmProject !== manifest.projectRef)
    throw new Error('--apply requires --confirm-project matching the reviewed project.');
  const client = createClient(baseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  await runMigration({ manifest, mode, adapter: createAdapter(client, manifest), log: event => console.log(JSON.stringify(event)) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    const secret = process.env.NOVELI_SUPABASE_SERVICE_ROLE_KEY || '';
    const message = secret ? String(error.message).replaceAll(secret, '[REDACTED]') : String(error.message);
    console.error(JSON.stringify({ event: 'aborted', message: message.slice(0, 700) }));
    process.exitCode = 1;
  });
}
