import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { ordersApi } from '../../services/orders';
import { ORDERS_PATH, formatOrderMoney, formatOrderQuantity, isUuid, orderDate, orderErrorMessage, quotationPath } from '../../utils/orders';
import { OrderCard, OrderError, OrderLoading, OrderStates } from './OrderPrimitives';

export default function OrderDetail({ organizationId, orderId, onNavigate, notice }) {
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    (isUuid(orderId) ? ordersApi(supabase).detail(organizationId, orderId) : Promise.resolve(null))
      .then(order => { if (current) setState({ order }); }).catch(error => { if (current) setState({ error: orderErrorMessage(error) }); });
    return () => { current = false; };
  }, [organizationId, orderId, attempt]);
  const order = state.order;
  const actor = id => id ? order.members?.find(member => member.user_id === id)?.full_name || id : '—';
  return <div className="space-y-6 text-slate-800 dark:text-slate-100 animate-fade-in" data-testid="order-detail">
    <a href={ORDERS_PATH} onClick={event => { event.preventDefault(); onNavigate(ORDERS_PATH); }} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600"><ArrowLeft size={16} />Volver a órdenes</a>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}
    {state.loading ? <OrderLoading /> : state.error ? <OrderError message={state.error} onRetry={() => { setState({ loading: true }); setAttempt(n => n + 1); }} /> : !order ? <OrderCard><h1 className="text-xl font-bold">Orden no disponible</h1><p className="mt-2 text-slate-500">La orden no existe o no tienes acceso desde tu organización.</p></OrderCard> : <>
      <header className="space-y-4"><h1 className="break-words text-3xl font-bold tracking-tight">{order.order_number}</h1><p className="text-lg">{order.client?.name || 'Cliente no disponible'}</p><p className="text-2xl font-bold">{formatOrderMoney(order.total, order.currency)}</p><OrderStates order={order} /></header>
      <OrderCard title="Resumen"><dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{[['Creada', orderDate(order.created_at)], ['Aceptada', orderDate(order.accepted_at)], ['Creada por', actor(order.created_by)], ['Aceptada por', actor(order.accepted_by)], ['Moneda', order.currency]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl></OrderCard>
      <OrderCard title="Ítems de la orden"><p className="mb-4 text-xs text-slate-500">Condiciones guardadas al crear la orden.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Ítem', 'Cantidad', 'Precio unitario', 'Subtotal', 'Descuento', 'Impuestos', 'Total'].map(label => <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 dark:border-slate-700" key={label}>{label}</th>)}</tr></thead><tbody>{order.items.map(item => <tr key={item.id} data-testid="order-item"><td className="min-w-52 border-b border-slate-100 px-3 py-4 dark:border-slate-800"><strong>{item.name}</strong><p className="mt-1 whitespace-pre-wrap text-slate-500 dark:text-slate-400">{item.description}</p></td><td className="px-3 py-4">{formatOrderQuantity(item.quantity)}</td>{[['unit_price', true], ['subtotal'], ['discount'], ['tax'], ['total']].map(([field, unitPrice]) => <td key={field} className="whitespace-nowrap px-3 py-4">{formatOrderMoney(item[field], item.currency, { unitPrice })}</td>)}</tr>)}</tbody></table></div>
        <dl className="ml-auto mt-5 max-w-sm space-y-2 text-sm">{[['Subtotal', order.subtotal], ['Descuento', order.discount], ['Impuestos', order.tax], ['Total', order.total]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd className="font-bold">{formatOrderMoney(value, order.currency)}</dd></div>)}</dl>
      </OrderCard>
      <div className="grid gap-5 lg:grid-cols-2"><OrderCard title="Notas"><p className="whitespace-pre-wrap break-words text-sm">{order.notes || 'Sin notas.'}</p></OrderCard><OrderCard title="Notas internas"><p className="whitespace-pre-wrap break-words text-sm">{order.internal_notes || 'Sin notas internas.'}</p></OrderCard></div>
      <OrderCard title="Origen">{order.quotation_id ? <a href={quotationPath(order.quotation_id)} onClick={event => { event.preventDefault(); onNavigate(quotationPath(order.quotation_id)); }} className="text-sm font-semibold text-brand-600">Abrir cotización {order.quotation?.quote_number || order.quotation_id}</a> : <p className="text-sm text-slate-500">Sin cotización de origen.</p>}</OrderCard>
      <OrderCard title="Actividad">{order.activityUnavailable ? <p className="text-sm text-slate-500">La actividad no está disponible con tus permisos actuales.</p> : order.activity?.length ? <ol className="space-y-3 text-sm">{order.activity.map(event => <li key={event.id}><time className="text-xs text-slate-500">{orderDate(event.created_at)}</time><p className="break-words">{event.description}</p></li>)}</ol> : <p className="text-sm text-slate-500">No hay actividad visible. Se muestran hasta 50 eventos recientes.</p>}</OrderCard>
    </>}
  </div>;
}
