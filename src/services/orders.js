// The client is injected so reads and exact RPC payloads can be tested in isolation.
const header = 'id,organization_id,order_number,client_id,quotation_id,commercial_status,operational_status,currency,subtotal:subtotal::text,discount:discount::text,tax:tax::text,total:total::text,created_at,accepted_at,created_by,accepted_by,notes,internal_notes,client:clients(name),quotation:quotations(quote_number)';
const itemFields = 'id,position,item_type,catalog_id,pack_id,name,description,quantity:quantity::text,unit_price:unit_price::text,subtotal:subtotal::text,discount:discount::text,tax:tax::text,total:total::text,currency,pricing_version,pricing_metadata';
function unwrap(result) { if (result.error) throw result.error; return result.data; }
async function allRows(query) {
  const rows = [];
  for (let offset = 0; ; offset += 200) {
    const batch = unwrap(await query().range(offset, offset + 199)) || [];
    rows.push(...batch);
    if (batch.length < 200) return rows;
  }
}
// Bounded parallelism avoids a burst of payment-summary RPCs on large tenants.
async function withPaymentSummary(client, org, rows) {
  const result = new Array(rows.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async () => {
    while (index < rows.length) {
      const current = index++;
      const row = rows[current];
      const payment = unwrap(await client.rpc('phase1a_order_payment_summary', { p_org: org, p_order: row.id }));
      result[current] = { ...row, payment };
    }
  }));
  return result;
}
export function ordersApi(client) {
  if (typeof client.rpc !== 'function') throw { code: 'PGRST202' };
  return {
    async list(org) {
      const rows = await allRows(() => client.from('orders').select(header).eq('organization_id', org).order('created_at', { ascending: false }).order('id'));
      return withPaymentSummary(client, org, rows);
    },
    async detail(org, id) {
      const order = unwrap(await client.from('orders').select(header).eq('organization_id', org).eq('id', id).maybeSingle());
      if (!order) return null;
      const [items, payment, activity, members] = await Promise.all([
        allRows(() => client.from('order_items').select(itemFields).eq('organization_id', org).eq('order_id', id).order('position')),
        client.rpc('phase1a_order_payment_summary', { p_org: org, p_order: id }).then(unwrap),
        client.from('activity_log').select('id,action,description,user_id,created_at').eq('organization_id', org).eq('entity_id', id).order('created_at', { ascending: false }).limit(50),
        client.from('organization_members').select('user_id,full_name').eq('organization_id', org).in('user_id', [...new Set([order.created_by, order.accepted_by].filter(Boolean))]),
      ]);
      // Optional attribution/activity may be hidden by existing RLS. Never fail the order itself.
      return { ...order, items, payment, activity: activity.error ? null : activity.data, members: members.error ? [] : members.data, activityUnavailable: Boolean(activity.error) };
    },
    async quotation(org, id) {
      return unwrap(await client.from('quotations').select('id,quote_number,status,client_id,accepted_at,author_name,object,currency,total:total::text').eq('organization_id', org).eq('id', id).maybeSingle());
    },
    async existingOrder(org, quotation) {
      return unwrap(await client.from('orders').select('id,order_number').eq('organization_id', org).eq('quotation_id', quotation).maybeSingle());
    },
    async review(org, quotation) {
      return unwrap(await client.rpc('phase1a_quotation_review_source', { p_org: org, p_quotation: quotation }));
    },
    async prepare(org, quotation, source, reference) {
      return unwrap(await client.rpc('phase1a_review_and_accept_quotation', { p_org: org, p_quotation: quotation, p_client: source.header.client_id,
        p_expected_fingerprint: source.fingerprint, p_evidence: { reference: reference.trim(), reviewed_in: 'phase1a_crm' } }));
    },
  };
}
