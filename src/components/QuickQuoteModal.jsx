import { useEffect, useState } from 'react';
import { supabase, getValidOrgId } from '../supabaseClient';
import { formatCurrency, calculateVatSplit } from '../utils';
import { 
  X, Plus, Trash2, Percent, DollarSign, Check, FileText, AlertTriangle, ClipboardCheck 
} from 'lucide-react';

export default function QuickQuoteModal({ 
  isOpen, 
  onClose, 
  clientId = null, 
  prospectId = null, 
  entityName = '', 
  preferredCurrency = 'CLP',
  onSuccess 
}) {
  const [catalog, setCatalog] = useState([]);
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection/form items
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedPackId, setSelectedPackId] = useState('');
  
  // Form Header State
  const [formHeader, setFormHeader] = useState({
    manuscript_pages: 0,
    extension_adjustment_type: 'percentage', // 'percentage' or 'fixed'
    extension_adjustment_value: 0,
    discount: 0,
    currency: preferredCurrency || 'CLP',
    includes_iva: true,
    status: 'borrador',
    notes: ''
  });

  // Selected Items State
  const [formItems, setFormItems] = useState([]);
  
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      // Reset form states
      setFormHeader({
        manuscript_pages: 0,
        extension_adjustment_type: 'percentage',
        extension_adjustment_value: 0,
        discount: 0,
        currency: preferredCurrency || 'CLP',
        includes_iva: true,
        status: 'borrador',
        notes: ''
      });
      setFormItems([]);
      setFormError('');
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catalogRes, packsRes] = await Promise.all([
        supabase.from('service_catalog').select('*').eq('active', true).order('name', { ascending: true }),
        supabase.from('service_packs').select('*').eq('active', true).order('name', { ascending: true })
      ]);

      if (catalogRes.error) throw catalogRes.error;
      if (packsRes.error) throw packsRes.error;

      setCatalog(catalogRes.data || []);
      setPacks(packsRes.data || []);
    } catch (err) {
      console.error("Error loading QuickQuoteModal data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Extension suggestion helper
  const getExtensionSuggestion = (pages) => {
    if (!pages || pages <= 80) return { pct: 0, text: "Ajuste sugerido: 0% (Extensión base)", warning: false };
    if (pages >= 81 && pages <= 150) return { pct: 20, text: "Ajuste sugerido: +15% a +25% (Aprox +20%)", warning: false };
    if (pages >= 151 && pages <= 250) return { pct: 40, text: "Ajuste sugerido: +30% a +50% (Aprox +40%)", warning: false };
    return { pct: 0, text: "Cotización personalizada obligatoria (libro extenso)", warning: true };
  };

  const handlePagesChange = (pagesVal) => {
    const suggestion = getExtensionSuggestion(pagesVal);
    setFormHeader(prev => ({
      ...prev,
      manuscript_pages: pagesVal,
      // Auto-set percentage adjustment if it's within standard pages range
      extension_adjustment_value: (prev.extension_adjustment_type === 'percentage' && !suggestion.warning) 
        ? suggestion.pct 
        : prev.extension_adjustment_value
    }));
  };

  const handleAddCatalogItem = () => {
    if (!selectedServiceId) return;
    const service = catalog.find(c => c.id === selectedServiceId);
    if (!service) return;

    // Check if already added
    if (formItems.some(item => item.catalog_id === service.id)) {
      setFormError('Este servicio ya está agregado en la cotización.');
      return;
    }

    setFormItems([...formItems, {
      id: `service-${Date.now()}`,
      catalog_id: service.id,
      pack_id: null,
      concept: service.name,
      description: service.description || '',
      unit_price: Number(service.base_price) || 0,
      quantity: 1,
      source_type: 'catalog'
    }]);
    setSelectedServiceId('');
    setFormError('');
  };

  const handleAddPackItem = () => {
    if (!selectedPackId) return;
    const pack = packs.find(p => p.id === selectedPackId);
    if (!pack) return;

    // Check if already added
    if (formItems.some(item => item.pack_id === pack.id)) {
      setFormError('Este pack ya está agregado en la cotización.');
      return;
    }

    setFormItems([...formItems, {
      id: `pack-${Date.now()}`,
      catalog_id: null,
      pack_id: pack.id,
      concept: pack.name,
      description: pack.description || '',
      unit_price: Number(pack.price_special) || 0,
      quantity: 1,
      source_type: 'pack'
    }]);
    setSelectedPackId('');
    setFormError('');
  };

  const handleUpdateItemField = (itemId, field, value) => {
    setFormItems(formItems.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, [field]: value };
        return updated;
      }
      return item;
    }));
  };

  const handleRemoveItem = (itemId) => {
    setFormItems(formItems.filter(item => item.id !== itemId));
  };

  // Math Calculations
  const getTotals = () => {
    const subtotal = formItems.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity)), 0);
    const adjType = formHeader.extension_adjustment_type;
    const adjVal = Number(formHeader.extension_adjustment_value) || 0;
    
    let adjustmentAmount = 0;
    if (adjType === 'percentage') {
      adjustmentAmount = Math.round(subtotal * (adjVal / 100));
    } else {
      adjustmentAmount = adjVal;
    }

    const subtotalAdjusted = subtotal + adjustmentAmount;
    const discount = Number(formHeader.discount) || 0;
    const total = Math.max(0, subtotalAdjusted - discount);

    const split = calculateVatSplit(total, formHeader.includes_iva);

    return {
      subtotal,
      adjustmentAmount,
      subtotalAdjusted,
      discount,
      net: split.net,
      vat: split.vat,
      total
    };
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (formItems.length === 0) {
      setFormError('Debe agregar al menos un servicio o pack editorial.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const orgId = await getValidOrgId();
      const totals = getTotals();

      const quotPayload = {
        organization_id: orgId,
        client_id: clientId || null,
        prospect_id: prospectId || null,
        manuscript_pages: Number(formHeader.manuscript_pages) || 0,
        extension_adjustment_type: formHeader.extension_adjustment_type,
        extension_adjustment_value: Number(formHeader.extension_adjustment_value) || 0,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax_amount: totals.vat,
        total: totals.total,
        currency: formHeader.currency,
        includes_iva: formHeader.includes_iva,
        status: formHeader.status,
        notes: formHeader.notes,
        converted_to_service: false,
        exchange_rate: formHeader.currency === 'USD' ? 940 : formHeader.currency === 'EUR' ? 1010 : 1,
        value_converted: totals.total * (formHeader.currency === 'USD' ? 940 : formHeader.currency === 'EUR' ? 1010 : 1),
        rate_date: new Date().toISOString().split('T')[0]
      };

      // 1. Insert quotation
      const { data: quotData, error: quotErr } = await supabase
        .from('quotations')
        .insert([quotPayload])
        .select()
        .single();

      if (quotErr) throw quotErr;

      // 2. Insert items
      const itemsPayload = formItems.map(item => ({
        organization_id: orgId,
        quotation_id: quotData.id,
        catalog_id: item.catalog_id,
        pack_id: item.pack_id,
        concept: item.concept,
        description: item.description,
        unit_price: item.unit_price,
        quantity: item.quantity,
        total: item.unit_price * item.quantity,
        source_type: item.source_type
      }));

      const { error: itemsErr } = await supabase
        .from('quotation_items')
        .insert(itemsPayload);

      if (itemsErr) throw itemsErr;

      // 3. If marked as approved (status === 'aprobada'), trigger conversion immediately
      if (formHeader.status === 'aprobada') {
        await convertToServices(quotData.id, orgId, totals.total, formHeader.currency, formHeader.includes_iva);
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error("Error creating quick quotation:", err);
      setFormError(err.message || 'Ocurrió un error inesperado al guardar la cotización.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const convertToServices = async (quotId, orgId, totalAmount, currency, includesIva) => {
    // 1. Fetch items of this quotation to convert
    const { data: items, error: itemsErr } = await supabase
      .from('quotation_items')
      .select('*, service_catalog(category)')
      .eq('quotation_id', quotId);

    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) return;

    // Ask or assign default book title
    const bookTitle = 'Obra sin título (Cotización)';
    const rate = currency === 'USD' ? 940 : currency === 'EUR' ? 1010 : 1;

    // Proportional adjustment factor (pro-rata calculation)
    const factor = (formHeader.extension_adjustment_type === 'percentage') 
      ? (1 + (Number(formHeader.extension_adjustment_value) || 0) / 100)
      : 1; // For fixed amount, keep base or calculate share

    for (const item of items) {
      let serviceType = 'otro';
      if (item.source_type === 'catalog' && item.service_catalog) {
        serviceType = item.service_catalog.category || 'otro';
      } else if (item.source_type === 'pack') {
        serviceType = 'maquetación'; // Default for packs
      }

      // Proportional or base value adjusted
      const finalVal = (Number(item.unit_price) * Number(item.quantity)) * factor;

      // Create service
      const { error: serviceErr } = await supabase
        .from('services')
        .insert([{
          organization_id: orgId,
          client_id: clientId, // Must be Client to convert. If Prospect, conversion handle convertToClient first
          type: serviceType,
          book_title: bookTitle,
          status: 'recibido',
          value: finalVal,
          currency: currency,
          exchange_rate: rate,
          value_converted: finalVal * rate,
          rate_date: new Date().toISOString().split('T')[0],
          total_agreed_amount: totalAmount,
          payment_status: 'pendiente',
          notes: `Creado desde Cotización Rápida Aprobada. Concepto: ${item.concept}`
        }]);

      if (serviceErr) throw serviceErr;
    }

    // Create a pending Income (Invoice) record
    const { error: incomeErr } = await supabase
      .from('incomes')
      .insert([{
        organization_id: orgId,
        client_id: clientId,
        amount: totalAmount,
        currency: currency,
        exchange_rate: rate,
        value_converted: totalAmount * rate,
        date: new Date().toISOString().split('T')[0],
        rate_date: new Date().toISOString().split('T')[0],
        payment_method: 'transferencia',
        includes_vat: includesIva,
        status: 'pendiente',
        notes: `Facturación de cotización aprobada rápida.`
      }]);

    if (incomeErr) throw incomeErr;

    // Update converted status in quotations
    await supabase
      .from('quotations')
      .update({ converted_to_service: true })
      .eq('id', quotId);
  };

  if (!isOpen) return null;

  const totals = getTotals();

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Crear Cotización Rápida
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Destinatario: <span className="text-slate-600 dark:text-slate-300 font-bold">{entityName || 'Contacto seleccionado'}</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{formError}</span>
            </div>
          )}

          {/* Catalog & Packs Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Services catalog */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Servicios del Catálogo</label>
              <div className="flex gap-2">
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                >
                  <option value="">-- Seleccionar servicio --</option>
                  {catalog.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({formatCurrency(c.base_price, c.currency)})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCatalogItem}
                  className="px-3 py-2 bg-indigo-50 text-indigo-650 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar</span>
                </button>
              </div>
            </div>

            {/* Editorial packs */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Packs Editoriales</label>
              <div className="flex gap-2">
                <select
                  value={selectedPackId}
                  onChange={(e) => setSelectedPackId(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                >
                  <option value="">-- Seleccionar pack --</option>
                  {packs.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.price_special, p.currency)})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddPackItem}
                  className="px-3 py-2 bg-indigo-50 text-indigo-650 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Selected items table */}
          <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/60">
                  <th className="p-3">Concepto</th>
                  <th className="p-3 w-32">Precio Unitario</th>
                  <th className="p-3 w-20 text-center">Cant.</th>
                  <th className="p-3 w-28 text-right">Total</th>
                  <th className="p-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {formItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-slate-400 font-medium italic">
                      No se han agregado ítems a la cotización rápida.
                    </td>
                  </tr>
                ) : (
                  formItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-950/15">
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.concept}
                          onChange={(e) => handleUpdateItemField(item.id, 'concept', e.target.value)}
                          className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                        />
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mt-0.5">
                          {item.source_type === 'catalog' ? 'Catálogo' : 'Pack Editorial'}
                        </span>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => handleUpdateItemField(item.id, 'unit_price', Number(e.target.value))}
                          className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded text-xs focus:outline-none"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItemField(item.id, 'quantity', Number(e.target.value))}
                          className="w-12 px-1.5 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded text-xs text-center focus:outline-none"
                        />
                      </td>
                      <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-350">
                        {formatCurrency(item.unit_price * item.quantity, formHeader.currency)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-1 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Manuscript Pages and Extension Adjustments */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/30">
            {/* Pages input */}
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Páginas del Manuscrito</label>
              <input
                type="number"
                min="0"
                placeholder="Ej. 120"
                value={formHeader.manuscript_pages || ''}
                onChange={(e) => handlePagesChange(Number(e.target.value))}
                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-755 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Adjustment Type selector */}
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Tipo Ajuste Extensión</label>
              <select
                value={formHeader.extension_adjustment_type}
                onChange={(e) => setFormHeader({...formHeader, extension_adjustment_type: e.target.value})}
                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-755 text-xs focus:outline-none"
              >
                <option value="percentage">Ajuste Porcentaje (%)</option>
                <option value="fixed">Ajuste Monto Fijo ($)</option>
              </select>
            </div>

            {/* Adjustment value */}
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Valor de Ajuste</label>
              <div className="relative">
                <input
                  type="number"
                  value={formHeader.extension_adjustment_value}
                  onChange={(e) => setFormHeader({...formHeader, extension_adjustment_value: Number(e.target.value)})}
                  className="block w-full px-3 py-2 pr-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-755 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">
                  {formHeader.extension_adjustment_type === 'percentage' ? '%' : formHeader.currency}
                </span>
              </div>
            </div>

            {formHeader.manuscript_pages > 0 && (
              <div className="md:col-span-3 text-[11px] font-semibold text-indigo-650 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20 p-2 rounded-lg border border-indigo-100/40 dark:border-indigo-900/30">
                {getExtensionSuggestion(formHeader.manuscript_pages).text}
              </div>
            )}
          </div>

          {/* Pricing settings: currency, IVA, discount, status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Moneda</label>
              <select
                value={formHeader.currency}
                onChange={(e) => setFormHeader({...formHeader, currency: e.target.value})}
                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
              >
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Aplica IVA (19%)</label>
              <select
                value={formHeader.includes_iva ? 'si' : 'no'}
                onChange={(e) => setFormHeader({...formHeader, includes_iva: e.target.value === 'si'})}
                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
              >
                <option value="si">IVA Incluido</option>
                <option value="no">Exento</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Descuento</label>
              <input
                type="number"
                min="0"
                value={formHeader.discount}
                onChange={(e) => setFormHeader({...formHeader, discount: Number(e.target.value)})}
                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Estado</label>
              <select
                value={formHeader.status}
                onChange={(e) => setFormHeader({...formHeader, status: e.target.value})}
                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none capitalize font-bold text-indigo-600 dark:text-indigo-400"
              >
                <option value="borrador">Borrador</option>
                <option value="enviada">Enviada</option>
                <option value="aprobada">Aprobada</option>
                <option value="rechazada">Rechazada</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Notas Adicionales / Acuerdo Comercial</label>
            <textarea
              rows="2"
              value={formHeader.notes}
              onChange={(e) => setFormHeader({...formHeader, notes: e.target.value})}
              placeholder="Escriba condiciones comerciales, validez, plazos..."
              className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
            ></textarea>
          </div>

          {/* Totals Breakdown */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-end">
            <div className="w-72 space-y-2 text-right text-xs">
              <div className="flex justify-between text-slate-400 font-semibold uppercase">
                <span>Subtotal Conceptos:</span>
                <span className="font-mono">{formatCurrency(totals.subtotal, formHeader.currency)}</span>
              </div>
              {totals.adjustmentAmount > 0 && (
                <div className="flex justify-between text-indigo-650 dark:text-indigo-400 font-semibold uppercase">
                  <span>
                    Ajuste Extensión ({formHeader.extension_adjustment_type === 'percentage' ? `+${formHeader.extension_adjustment_value}%` : 'Fijo'}):
                  </span>
                  <span className="font-mono">+{formatCurrency(totals.adjustmentAmount, formHeader.currency)}</span>
                </div>
              )}
              {formHeader.manuscript_pages > 0 && (
                <div className="flex justify-between text-slate-400 font-bold uppercase border-t border-slate-50 dark:border-slate-850 pt-1">
                  <span>Total Sugerido:</span>
                  <span className="font-mono">{formatCurrency(totals.subtotalAdjusted, formHeader.currency)}</span>
                </div>
              )}
              {totals.discount > 0 && (
                <div className="flex justify-between text-rose-500 font-semibold uppercase">
                  <span>Descuento Especial:</span>
                  <span className="font-mono">-{formatCurrency(totals.discount, formHeader.currency)}</span>
                </div>
              )}
              {formHeader.includes_iva && (
                <>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Neto (Base):</span>
                    <span className="font-mono">{formatCurrency(totals.net, formHeader.currency)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>IVA (19%):</span>
                    <span className="font-mono">{formatCurrency(totals.vat, formHeader.currency)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-base font-extrabold text-slate-800 dark:text-slate-100 border-t border-dashed border-slate-200 dark:border-slate-800 pt-2">
                <span>Total Final:</span>
                <span className="font-mono text-indigo-650 dark:text-indigo-400">{formatCurrency(totals.total, formHeader.currency)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-150 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-600/10 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : formHeader.status === 'aprobada' ? 'Aprobar y Crear Servicios' : 'Guardar Cotización'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
