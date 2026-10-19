import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { ordersApi } from '../../services/orders';
import { canConvertQuotation, createConversionRequest, formatOrderMoney, isUuid, orderErrorMessage, orderPath } from '../../utils/orders';
import { OrderError, OrderLoading } from './OrderPrimitives';

export default function QuotationOrderDialog({ organizationId, quotationId, userRole, onClose, onNavigate }) {
  const [state, setState] = useState({ loading: true });
  const [reference, setReference] = useState('');
  const [prepared, setPrepared] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const busyRef = useRef(false);
  const conversion = useRef(null);
  const mounted = useRef(true);
  const dialog = useRef(null);
  const allowed = canConvertQuotation(userRole);
  useEffect(() => {
    let current = true;
    const api = ordersApi(supabase);
    Promise.all([isUuid(quotationId) ? api.quotation(organizationId, quotationId) : null, isUuid(quotationId) ? api.existingOrder(organizationId, quotationId) : null])
      .then(async ([quote, existing]) => {
        if (!current) return;
        if (!quote || existing || !allowed || quote.status !== 'aceptada' || !quote.accepted_at || !quote.client_id) {
          setState({ quote, existing }); return;
        }
        // Read-only RPC enforces the real membership and tenant capability gate.
        try { const source = await api.review(organizationId, quotationId); if (current) setState({ quote, source }); }
        catch (failure) { if (current) setState({ quote, reviewError: orderErrorMessage(failure) }); }
      }).catch(failure => { if (current) setState({ error: orderErrorMessage(failure) }); });
    return () => { current = false; };
  }, [organizationId, quotationId, allowed]);
  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => { mounted.current = false; previous?.focus?.(); };
  }, []);
  async function prepare() {
    if (busyRef.current || !reference.trim() || !state.source || !allowed) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const result = await ordersApi(supabase).prepare(organizationId, quotationId, state.source, reference);
      if (!isUuid(result?.id) || !/^[a-f0-9]{64}$/.test(result?.snapshot_sha256)) throw new Error('Invalid revision response');
      if (mounted.current) setPrepared(result);
    } catch (failure) { if (mounted.current) setError(orderErrorMessage(failure)); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  async function convert() {
    if (busyRef.current || !prepared || !confirming || !allowed) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (!conversion.current) conversion.current = createConversionRequest(supabase.rpc.bind(supabase));
      const order = await conversion.current({ p_org: organizationId, p_quotation: quotationId, p_snapshot: prepared.id, p_expected_sha: prepared.snapshot_sha256 });
      if (mounted.current) { setSuccess(`Orden ${order.order_number} disponible.`); onNavigate(orderPath(order.id), `Orden ${order.order_number} disponible. La conversión se completó correctamente.`); }
    } catch (failure) {
      if (mounted.current) {
        setError(orderErrorMessage(failure));
        // A successful commit may have lost its HTTP response. Offer the existing
        // order without guessing whether another mutation is necessary.
        try { const existing = await ordersApi(supabase).existingOrder(organizationId, quotationId); if (mounted.current && existing) { setState(old => ({ ...old, existing })); setConfirming(false); } }
        catch { /* Keep the safe original error; a retry uses the same operation key. */ }
      }
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  function keyboard(event) {
    if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') {
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(node => node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  const button = 'rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed';
  const quote = state.quote;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="quotation-order-title" aria-busy={busy} onKeyDown={keyboard} className="max-h-[90dvh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <header className="flex items-start justify-between gap-3"><h2 id="quotation-order-title" className="text-xl font-bold">Cotización y orden Noveli</h2><button type="button" aria-label="Cerrar cotización" disabled={busy} onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"><X size={20} /></button></header>
      {state.loading ? <OrderLoading /> : state.error ? <OrderError message={state.error} /> : !quote ? <p>La cotización no existe o no está disponible para tu organización.</p> : <>
        <div className="space-y-2"><h3 className="text-lg font-bold">{quote.quote_number}</h3><p>{quote.author_name}</p><p className="whitespace-pre-wrap break-words text-sm">{quote.object}</p><p className="font-bold">{formatOrderMoney(quote.total, quote.currency)}</p><p className="text-sm">Estado de cotización: <strong>{quote.status}</strong></p></div>
        {state.existing ? <div className="space-y-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/20"><p>Esta cotización ya fue convertida.</p><button type="button" onClick={() => onNavigate(orderPath(state.existing.id))} className={button}>Abrir orden {state.existing.order_number}</button></div> : !allowed ? <p className="text-sm text-slate-500">Tu rol permite consultar esta información. La conversión requiere un administrador o editor autorizado.</p> : state.reviewError ? <OrderError message={state.reviewError} /> : !state.source ? <p className="text-sm text-slate-500">Esta cotización aún no puede convertirse. Requiere aceptación registrada y un cliente vinculado; no se modificará su estado automáticamente.</p> : <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          {!prepared ? <>
            <h3 className="font-bold">Revisar aceptación registrada</h3><p className="text-sm text-slate-500">Revisa la cotización guardada y registra la referencia de su aceptación real. El backend validará el cliente, los precios y la revisión antes de habilitar la conversión. Esto no acepta una cotización borrador.</p>
            <ul className="space-y-3 text-sm">{state.source.items.map(item => <li key={item.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><strong>{item.concept || item.custom_name}</strong><p className="whitespace-pre-wrap text-slate-500">{item.description}</p><p>Cantidad: {item.quantity} · Precio unitario: {formatOrderMoney(item.unit_price, quote.currency, { unitPrice: true })}</p></li>)}</ul>
            <label className="block text-sm font-semibold">Referencia de aceptación<input aria-label="Referencia de aceptación" maxLength={500} disabled={busy} value={reference} onChange={event => setReference(event.target.value)} placeholder="Ej.: correo del cliente del 18/10/2026" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
            <button type="button" disabled={busy || !reference.trim()} onClick={prepare} className={button}>{busy ? 'Validando revisión…' : 'Validar revisión aceptada'}</button>
          </> : !confirming ? <><p className="text-sm">Revisión aceptada validada. Se conservarán los ítems y precios como historial de la orden.</p><button type="button" onClick={() => setConfirming(true)} className={button}>Convertir en orden</button></> : <div className="space-y-3"><h3 className="font-bold">Confirmar conversión</h3><p className="text-sm">¿Convertir {quote.quote_number} en una orden Noveli aceptada? Se conservará el vínculo con esta cotización. No se registrarán pagos ni contratos.</p><div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={convert} className={button}>{busy ? 'Convirtiendo…' : 'Confirmar conversión'}</button><button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700">Volver</button></div></div>}
        </div>}
      </>}
      {error && <OrderError message={error} />}{success && <p role="status">{success}</p>}
    </section>
  </div>;
}
