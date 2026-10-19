import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { ordersApi } from '../../services/orders';
import { ORDER_STATES, filterOrders, formatOrderMoney, orderDate, orderErrorMessage, orderPath } from '../../utils/orders';
import { OrderCard, OrderError, OrderLoading, OrderStates } from './OrderPrimitives';

export default function Orders({ organizationId, onNavigate }) {
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState({ search: '', commercial: '', operational: '', payment: '', currency: '', sort: 'newest' });
  useEffect(() => {
    let current = true;
    ordersApi(supabase).list(organizationId).then(rows => { if (current) setState({ rows }); })
      .catch(error => { if (current) setState({ error: orderErrorMessage(error) }); });
    return () => { current = false; };
  }, [organizationId, attempt]);
  const rows = useMemo(() => filterOrders(state.rows || [], filters), [state.rows, filters]);
  const setFilter = (name, value) => setFilters(old => ({ ...old, [name]: value }));
  const controlClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950';
  return <div className="space-y-6 text-slate-800 dark:text-slate-100 animate-fade-in" data-testid="orders-list">
    <header><h1 className="text-3xl font-bold tracking-tight">Órdenes</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Órdenes Noveli y sus estados comercial, de pago y operativo.</p></header>
    {state.loading ? <OrderLoading /> : state.error ? <OrderError message={state.error} onRetry={() => { setState({ loading: true }); setAttempt(n => n + 1); }} /> : <>
      <OrderCard><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-xs font-semibold"><span className="mb-1 flex items-center gap-1"><Search size={14} />Buscar</span><input aria-label="Buscar órdenes" value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="Número, cliente o cotización" className={controlClass} /></label>
        {Object.entries({ commercial: 'Estado comercial', payment: 'Estado de pago', operational: 'Estado operativo' }).map(([kind, label]) => <label key={kind} className="text-xs font-semibold">{label}<select aria-label={label} value={filters[kind]} onChange={e => setFilter(kind, e.target.value)} className={controlClass}><option value="">Todos</option>{Object.entries(ORDER_STATES[kind]).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}
        <label className="text-xs font-semibold">Moneda<select aria-label="Moneda" value={filters.currency} onChange={e => setFilter('currency', e.target.value)} className={controlClass}><option value="">Todas</option><option>CLP</option><option>USD</option></select></label>
        <label className="text-xs font-semibold">Ordenar<select aria-label="Ordenar" value={filters.sort} onChange={e => setFilter('sort', e.target.value)} className={controlClass}><option value="newest">Más recientes primero</option><option value="oldest">Más antiguas primero</option></select></label>
      </div></OrderCard>
      {!rows.length ? <OrderCard><p role="status" className="py-9 text-center text-slate-500">{state.rows.length ? 'No hay órdenes que coincidan con los filtros.' : 'Todavía no hay órdenes. Las cotizaciones aceptadas y revisadas podrán convertirse en órdenes.'}</p></OrderCard> : <>
        <p className="text-sm text-slate-500">{rows.length} {rows.length === 1 ? 'orden' : 'órdenes'}</p>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950"><tr>{['Orden / fecha', 'Cliente', 'Total', 'Estados', 'Cotización origen'].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map(order => <tr key={order.id}><td className="p-4"><a className="font-bold text-brand-600 dark:text-brand-400" href={orderPath(order.id)} onClick={event => { event.preventDefault(); onNavigate(orderPath(order.id)); }}>{order.order_number}</a><p className="mt-1 text-xs text-slate-500">{orderDate(order.created_at)}</p></td><td className="p-4">{order.client?.name || 'Cliente no disponible'}</td><td className="whitespace-nowrap p-4 font-bold">{formatOrderMoney(order.total, order.currency)}</td><td className="p-4"><OrderStates order={order} /></td><td className="p-4">{order.quotation?.quote_number || 'Sin cotización'}</td></tr>)}</tbody></table></div>
        <div className="space-y-3 md:hidden">{rows.map(order => <OrderCard key={order.id}><a href={orderPath(order.id)} onClick={event => { event.preventDefault(); onNavigate(orderPath(order.id)); }} className="font-bold text-brand-600">{order.order_number}</a><p className="my-2">{order.client?.name || 'Cliente no disponible'}</p><p className="font-bold">{formatOrderMoney(order.total, order.currency)}</p><p className="my-2 text-xs text-slate-500">{orderDate(order.created_at)} · {order.quotation?.quote_number || 'Sin cotización'}</p><OrderStates order={order} /></OrderCard>)}</div>
      </>}
    </>}
  </div>;
}
