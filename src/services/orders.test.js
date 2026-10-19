import test from 'node:test';
import assert from 'node:assert/strict';
import { ordersApi } from './orders.js';
function fakeClient(tables, rpcData = { payment_status: 'unpaid', ledger_available: false }) {
  const calls = [];
  return { calls, rpc: async (name, args) => { calls.push({ name, args }); return { data: rpcData }; }, from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const query = { select(fields) { call.fields = fields; return this; }, eq(key, value) { call.filters.push([key, value]); return this; }, in(key, value) { call.filters.push([key, value]); return this; }, order() { return this; }, limit() { return this; }, range(start, end) { call.range = [start, end]; return this; }, maybeSingle() { call.single = true; return this; }, then(resolve, reject) { const rows = tables[table] || []; const data = call.single ? rows[0] || null : call.range ? rows.slice(call.range[0], call.range[1] + 1) : rows; return Promise.resolve({ data }).then(resolve, reject); } }; return query;
  } };
}
test('list reads canonical decimal strings and backend payment status, scoped to organization', async () => {
  const client = fakeClient({ orders: [{ id: 'o', total: '119.00' }] });
  const result = await ordersApi(client).list('tenant');
  assert.equal(result[0].total, '119.00'); assert.equal(result[0].payment.payment_status, 'unpaid');
  assert.ok(client.calls[0].fields.includes('total:total::text'));
  assert.deepEqual(client.calls[0].filters, [['organization_id', 'tenant']]);
});
test('detail renders stored snapshots even when catalog FK is null; no catalog lookup', async () => {
  const client = fakeClient({ orders: [{ id: 'o', created_by: 'actor', total: '12.34' }], order_items: [{ name: 'Historical name', catalog_id: null, unit_price: '12.34' }] });
  const detail = await ordersApi(client).detail('tenant', 'o');
  assert.equal(detail.items[0].name, 'Historical name'); assert.equal(detail.items[0].catalog_id, null);
  assert.ok(!client.calls.some(call => call.table === 'service_catalog'));
  assert.ok(client.calls.filter(call => call.table).every(call => call.filters.some(([key, value]) => key === 'organization_id' && value === 'tenant')));
});
test('list pagination does not silently truncate at API page limit', async () => {
  const client = fakeClient({ orders: Array.from({ length: 201 }, (_, i) => ({ id: 'o' + i })) });
  const rows = await ordersApi(client).list('tenant'); assert.equal(rows.length, 201);
  assert.equal(client.calls.filter(call => call.table === 'orders').length, 2);
});
test('missing order returns null without related requests', async () => {
  const client = fakeClient({}); assert.equal(await ordersApi(client).detail('tenant', 'missing'), null); assert.equal(client.calls.length, 1);
});
test('existing conversion is retrieved by quotation and tenant without mutation', async () => {
  const client = fakeClient({ orders: [{ id: 'existing' }] });
  assert.equal((await ordersApi(client).existingOrder('tenant', 'q')).id, 'existing');
  assert.deepEqual(client.calls[0].filters, [['organization_id', 'tenant'], ['quotation_id', 'q']]);
});
test('acceptance preparation uses existing RPC, fingerprint and explicit evidence', async () => {
  const client = fakeClient({});
  await ordersApi(client).prepare('tenant', 'q', { fingerprint: 'sha', header: { client_id: 'client' } }, ' Email approval ');
  assert.deepEqual(client.calls[0], { name: 'phase1a_review_and_accept_quotation', args: { p_org: 'tenant', p_quotation: 'q', p_client: 'client', p_expected_fingerprint: 'sha', p_evidence: { reference: 'Email approval', reviewed_in: 'phase1a_crm' } } });
});
test('read-only backend errors propagate to safe presentation handler', async () => {
  const client = fakeClient({ orders: [{ id: 'o' }] }); client.rpc = async () => ({ error: { code: '42501' } });
  await assert.rejects(ordersApi(client).list('tenant'), error => error.code === '42501');
});
