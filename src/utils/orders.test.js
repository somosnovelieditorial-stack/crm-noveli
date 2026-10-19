import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_STATES, formatOrderMoney, formatOrderQuantity, filterOrders, canConvertQuotation, createConversionRequest, orderErrorMessage, isOrdersPath, orderIdFromPath, quotationPath } from './orders.js';
import { canRoleAccessModule, canRolePerformAction } from './roles.js';
const id = '11111111-1111-4111-8111-111111111111';
test('CLP canonical strings, scale and large amounts remain exact', () => {
  assert.equal(formatOrderMoney('9999999999.00', 'CLP'), '$ 9.999.999.999 CLP');
  assert.equal(formatOrderMoney('1000', 'CLP'), '$ 1.000 CLP');
  assert.equal(formatOrderMoney('1.1', 'CLP'), '—');
});
test('USD decimals and unit-price precision are preserved without floating arithmetic', () => {
  assert.equal(formatOrderMoney('1234.50', 'USD'), 'US$ 1.234,50');
  assert.equal(formatOrderMoney('0.123456789012', 'CLP', { unitPrice: true }), '$ 0,123456789012 CLP');
  assert.equal(formatOrderQuantity('2.125'), '2,125');
  assert.equal(formatOrderMoney(null, 'USD'), '—');
  assert.equal(formatOrderMoney('1', 'EUR'), '—');
});
test('all three status vocabularies remain independent', () => {
  assert.equal(Object.keys(ORDER_STATES.commercial).length, 4);
  assert.equal(Object.keys(ORDER_STATES.payment).length, 5);
  assert.equal(Object.keys(ORDER_STATES.operational).length, 9);
});
test('search, each status, currency and deterministic date sorting', () => {
  const a = { id: 'a', order_number: 'NOV-ORD-2026-000001', client: { name: 'Autora' }, quotation: { quote_number: 'Q-42' }, currency: 'CLP', commercial_status: 'accepted', operational_status: 'pending', payment: { payment_status: 'unpaid' }, created_at: '2026-10-17' };
  const b = { ...a, id: 'b', currency: 'USD', created_at: '2026-10-18' };
  assert.deepEqual(filterOrders([a, b], {}).map(row => row.id), ['b', 'a']);
  for (const search of ['autora', 'q-42', 'nov-ord']) assert.equal(filterOrders([a], { search }).length, 1);
  assert.equal(filterOrders([a, b], { commercial: 'accepted', operational: 'pending', payment: 'unpaid', currency: 'USD' })[0].id, 'b');
  for (const filters of [{ search: 'missing' }, { commercial: 'draft' }, { operational: 'completed' }, { payment: 'paid' }]) assert.equal(filterOrders([a], filters).length, 0);
  assert.equal(filterOrders([], {}).length, 0);
  assert.equal(filterOrders([a, b], { sort: 'oldest' })[0].id, 'a');
});
test('six roles can read Orders; only admin/editor presentation permits conversion', () => {
  for (const role of ['admin', 'editor', 'diseñador', 'corrector', 'finanzas', 'visualizador']) {
    assert.equal(canRoleAccessModule(role, 'orders'), true);
    assert.equal(canRolePerformAction(role, 'orders'), ['admin', 'editor'].includes(role));
    assert.equal(canConvertQuotation(role), ['admin', 'editor'].includes(role));
  }
  assert.equal(canRoleAccessModule(null, 'orders'), false);
  assert.equal(canConvertQuotation('unknown'), false);
});
test('direct detail route and original quotation link', () => {
  assert.ok(isOrdersPath('/admin/ordenes/' + id));
  assert.equal(orderIdFromPath('/admin/ordenes/' + id), id);
  assert.equal(orderIdFromPath('/admin/ordenes'), null);
  assert.equal(quotationPath(id), '/propuestas-comerciales?quotation=' + id);
});
test('double click shares one RPC; successful response retains the original identity', async () => {
  let resolve, calls = 0;
  const request = createConversionRequest(async (name, payload) => {
    calls++; assert.equal(name, 'phase1a_convert_quotation_to_order'); assert.equal(payload.p_operation_key, id);
    return new Promise(done => { resolve = done; });
  }, id);
  const first = request({ p_quotation: id }), second = request({ p_quotation: id });
  assert.equal(first, second); await Promise.resolve(); assert.equal(calls, 1);
  resolve({ data: { id }, error: null }); assert.equal((await first).id, id);
});
test('failed or lost RPC response retries with the same idempotency key', async () => {
  const keys = []; let fail = true;
  const request = createConversionRequest(async (_name, payload) => { keys.push(payload.p_operation_key); return fail ? { error: { code: '40001' } } : { data: { id } }; }, id);
  await assert.rejects(request({})); fail = false;
  assert.equal((await request({})).id, id); assert.deepEqual(keys, [id, id]);
});
test('errors never disclose raw SQL, internal messages or secrets', () => {
  for (const code of ['42501', '40001', '23505', '23514', 'P0002', 'PGRST202', 'XX000']) {
    const message = orderErrorMessage({ code, message: 'SELECT secret FROM auth.users' });
    assert.ok(message.length > 20); assert.ok(!message.includes('SELECT')); assert.ok(!message.includes('secret'));
  }
});
