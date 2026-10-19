import { ORDER_STATES } from '../../utils/orders';

export function OrderBadge({ kind, status }) {
  const label = ORDER_STATES[kind]?.[status];
  const color = ['accepted', 'paid', 'completed', 'delivered'].includes(status) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' :
    ['cancelled', 'refunded'].includes(status) ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return <span data-order-state={kind} className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${color}`}>{label || 'No disponible'}</span>;
}
export function OrderCard({ title, children }) {
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">{title && <h2 className="mb-4 text-lg font-bold">{title}</h2>}{children}</section>;
}
export function OrderLoading() {
  return <div role="status" className="flex items-center justify-center gap-3 py-12 text-slate-500"><span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />Cargando órdenes…</div>;
}
export function OrderError({ message, onRetry }) {
  return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"><p>{message}</p>{onRetry && <button type="button" onClick={onRetry} className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold">Reintentar</button>}</div>;
}
export function OrderStates({ order }) {
  return <dl className="flex flex-wrap gap-5">{[['commercial', 'Comercial', order.commercial_status], ['payment', 'Pago', order.payment?.payment_status], ['operational', 'Operativo', order.operational_status]].map(([kind, name, state]) => <div key={kind}><dt className="mb-1 text-xs text-slate-500 dark:text-slate-400">{name}</dt><dd><OrderBadge kind={kind} status={state} /></dd></div>)}</dl>;
}
