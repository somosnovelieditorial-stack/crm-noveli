// Presentation only. PostgreSQL remains the authority for prices and transitions.
export const ORDER_STATES = Object.freeze({
  commercial: { draft: 'Borrador', pending_acceptance: 'Pendiente de aceptación', accepted: 'Aceptada', cancelled: 'Cancelada' },
  payment: { unpaid: 'Sin pagar', partially_paid: 'Pagada parcialmente', paid: 'Pagada', partially_refunded: 'Reembolsada parcialmente', refunded: 'Reembolsada' },
  operational: { pending: 'Pendiente', preparing: 'En preparación', in_progress: 'En curso', waiting_client: 'En espera del cliente', review: 'En revisión', delivered: 'Entregada', completed: 'Completada', paused: 'Pausada', cancelled: 'Cancelada' },
});
export const ORDERS_PATH = '/admin/ordenes';
export const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
export const orderPath = id => `${ORDERS_PATH}/${id}`;
export const quotationPath = id => `/propuestas-comerciales?quotation=${encodeURIComponent(id)}`;
export const isOrdersPath = path => /^\/admin\/ordenes(?:\/[^/]+)?\/?$/i.test(path);
export const orderIdFromPath = path => path.replace(/\/$/, '').split('/')[3] || null;
export const canConvertQuotation = role => ['admin', 'editor'].includes(role);

// No binary floating point, no repricing, no loss of unit-price precision.
export function formatOrderMoney(value, currency, { unitPrice = false } = {}) {
  if (!['CLP', 'USD'].includes(currency)) return '—';
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value ?? ''));
  if (!match) return '—';
  const scale = currency === 'CLP' ? 0 : 2;
  let fraction = (match[2] || '').replace(/0+$/, '');
  if (!unitPrice && fraction.length > scale) return '—';
  fraction = fraction.padEnd(scale, '0');
  const integer = new Intl.NumberFormat('es-CL').format(BigInt(match[1]));
  const symbol = currency === 'USD' ? 'US$' : '$';
  const amount = `${symbol} ${integer}${fraction ? ',' + fraction : ''}`;
  return currency === 'CLP' ? `${amount} CLP` : amount;
}
export function formatOrderQuantity(value) {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value ?? ''));
  if (!match) return '—';
  const fraction = (match[2] || '').replace(/0+$/, '');
  return `${new Intl.NumberFormat('es-CL').format(BigInt(match[1]))}${fraction ? ',' + fraction : ''}`;
}
export function orderDate(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
export function filterOrders(rows, filters) {
  const query = (filters.search || '').trim().toLocaleLowerCase('es');
  return rows.filter(row =>
    (!query || [row.order_number, row.client?.name, row.quotation?.quote_number].some(v => String(v || '').toLocaleLowerCase('es').includes(query))) &&
    (!filters.currency || row.currency === filters.currency) &&
    (!filters.commercial || row.commercial_status === filters.commercial) &&
    (!filters.operational || row.operational_status === filters.operational) &&
    (!filters.payment || row.payment.payment_status === filters.payment)
  ).sort((a, b) => filters.sort === 'oldest' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at));
}
export function orderErrorMessage(error) {
  if (error?.code === '42501' || error?.status === 403) return 'No tienes permiso o la función no está habilitada para tu organización.';
  if (error?.code === '40001') return 'La cotización cambió. Vuelve a abrirla y revisa su aceptación antes de convertirla.';
  if (error?.code === '23505') return 'La cotización ya tiene una conversión o una operación en conflicto. Vuelve a abrirla para consultar la orden existente.';
  if (['23514', '22023'].includes(error?.code)) return 'La cotización no cumple las condiciones de aceptación, cliente o precios. Revisa los datos guardados.';
  if (['P0002', 'PGRST116'].includes(error?.code)) return 'El registro no existe o no está disponible para tu organización.';
  if (['PGRST202', '42P01'].includes(error?.code)) return 'Órdenes todavía no está disponible en este entorno.';
  return 'No se pudo completar la solicitud. Comprueba tu conexión e inténtalo nuevamente.';
}

// Shares an in-flight request; keeps the key across retries after a lost response.
export function createConversionRequest(rpc, operationKey = crypto.randomUUID()) {
  let pending;
  return payload => {
    if (pending) return pending;
    pending = Promise.resolve().then(() => rpc('phase1a_convert_quotation_to_order', { ...payload, p_operation_key: operationKey }))
      .then(({ data, error }) => { if (error) throw error; if (!isUuid(data?.id)) throw new Error('Invalid conversion response'); return data; })
      .finally(() => { pending = null; });
    return pending;
  };
}
