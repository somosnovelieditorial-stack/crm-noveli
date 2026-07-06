import { useEffect, useState } from 'react';
import { supabase, getValidOrgId } from '../supabaseClient';
import { formatCurrency, calculateVatSplit } from '../utils';
import { jsPDF } from 'jspdf';
import { 
  X, Plus, Trash2, Check, FileText, AlertTriangle, Download, Calendar, Sparkles
} from 'lucide-react';

export default function QuickQuoteModal({ 
  isOpen, 
  onClose, 
  clientId = null, 
  prospectId = null, 
  entityName = '', 
  preferredCurrency = 'CLP',
  quotationToEdit = null,
  onSuccess 
}) {
  const [catalog, setCatalog] = useState([]);
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // View mode: 'split' or 'form'
  const [editorTab, setEditorTab] = useState('split'); 

  // Selection states in editor
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedPackId, setSelectedPackId] = useState('');

  // Form State
  const [formHeader, setFormHeader] = useState({
    author_name: entityName || '',
    author_email: '',
    author_phone: '',
    author_instagram: '',
    country: '',
    city: '',
    origin: 'Instagram',
    quote_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    validity_days: 15,
    valid_until: '',
    object: 'Propuesta de publicación y servicios editoriales personalizados.',
    status: 'borrador',
    manuscript_pages: 0,
    extension_adjustment_type: 'percentage',
    extension_adjustment_value: 0,
    discount: 0,
    currency: preferredCurrency || 'CLP',
    includes_iva: true,
    payment_terms: '50% al inicio y 50% al término del servicio contra entrega.',
    work_timeline: '8 a 10 semanas desde la entrega completa de materiales.',
    includes_notes: '• Reuniones de seguimiento editorial y asesoría continua.\n• Entrega de archivos finales en formato digital listos para imprenta/distribución.',
    excludes_notes: '• Costos de impresión física de ejemplares (se cotizan por separado).\n• Trámites legales de depósito legal fuera del territorio nacional.',
    start_conditions: 'Pago del anticipo inicial, firma de contrato y envío del manuscrito definitivo.',
    legal_notes: `• La cotización de impresión física se realizará por separado antes de la entrega del libro finalizado.
• Editorial Noveli no comercializa directamente el libro ni administra sus ventas, salvo acuerdo distinto por escrito.
• Los derechos de la obra pertenecen siempre al autor.
• Esta cotización no constituye factura ni boleta.
• Los valores indicados son referenciales hasta la aceptación formal del cliente y confirmación de pago.`,
    other_notes: '',
    notes: ''
  });

  const [formItems, setFormItems] = useState([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync valid_until date when issue_date or validity_days changes
  useEffect(() => {
    if (formHeader.issue_date && formHeader.validity_days) {
      const issue = new Date(formHeader.issue_date + 'T12:00:00');
      issue.setDate(issue.getDate() + Number(formHeader.validity_days));
      setFormHeader(prev => ({ ...prev, valid_until: issue.toISOString().split('T')[0] }));
    }
  }, [formHeader.issue_date, formHeader.validity_days]);

  useEffect(() => {
    if (isOpen) {
      fetchCatalogAndPacks();
      if (quotationToEdit) {
        setFormHeader({
          author_name: quotationToEdit.author_name || '',
          author_email: quotationToEdit.author_email || '',
          author_phone: quotationToEdit.author_phone || '',
          author_instagram: quotationToEdit.author_instagram || '',
          country: quotationToEdit.country || '',
          city: quotationToEdit.city || '',
          origin: quotationToEdit.origin || 'Instagram',
          quote_number: quotationToEdit.quote_number || '',
          issue_date: quotationToEdit.issue_date || new Date().toISOString().split('T')[0],
          validity_days: quotationToEdit.validity_days || 15,
          valid_until: quotationToEdit.valid_until || '',
          object: quotationToEdit.object || '',
          status: quotationToEdit.status || 'borrador',
          manuscript_pages: quotationToEdit.manuscript_pages || 0,
          extension_adjustment_type: quotationToEdit.extension_adjustment_type || 'percentage',
          extension_adjustment_value: quotationToEdit.extension_adjustment_value || 0,
          discount: quotationToEdit.discount || 0,
          currency: quotationToEdit.currency || 'CLP',
          includes_iva: quotationToEdit.includes_iva !== undefined ? quotationToEdit.includes_iva : true,
          payment_terms: quotationToEdit.payment_terms || '',
          work_timeline: quotationToEdit.work_timeline || '',
          includes_notes: quotationToEdit.includes_notes || '',
          excludes_notes: quotationToEdit.excludes_notes || '',
          start_conditions: quotationToEdit.start_conditions || '',
          legal_notes: quotationToEdit.legal_notes || '',
          other_notes: quotationToEdit.other_notes || '',
          notes: quotationToEdit.notes || ''
        });
        fetchQuotationItems(quotationToEdit.id);
      } else {
        const randNum = Math.floor(1000 + Math.random() * 9000);
        setFormHeader({
          author_name: entityName || '',
          author_email: '',
          author_phone: '',
          author_instagram: '',
          country: '',
          city: '',
          origin: 'Instagram',
          quote_number: `COT-${randNum}`,
          issue_date: new Date().toISOString().split('T')[0],
          validity_days: 15,
          valid_until: '',
          object: 'Propuesta de publicación y servicios editoriales personalizados.',
          status: 'borrador',
          manuscript_pages: 0,
          extension_adjustment_type: 'percentage',
          extension_adjustment_value: 0,
          discount: 0,
          currency: preferredCurrency || 'CLP',
          includes_iva: true,
          payment_terms: '50% al inicio y 50% al término del servicio contra entrega.',
          work_timeline: '8 a 10 semanas desde la entrega completa de materiales.',
          includes_notes: '• Reuniones de seguimiento editorial y asesoría continua.\n• Entrega de archivos finales en formato digital listos para imprenta/distribución.',
          excludes_notes: '• Costos de impresión física de ejemplares (se cotizan por separado).\n• Trámites legales de depósito legal fuera del territorio nacional.',
          start_conditions: 'Pago del anticipo inicial, firma de contrato y envío del manuscrito definitivo.',
          legal_notes: `• La cotización de impresión física se realizará por separado antes de la entrega del libro finalizado.
• Editorial Noveli no comercializa directamente el libro ni administra sus ventas, salvo acuerdo distinto por escrito.
• Los derechos de la obra pertenecen siempre al autor.
• Esta cotización no constituye factura ni boleta.
• Los valores indicados son referenciales hasta la aceptación formal del cliente y confirmación de pago.`,
          other_notes: '',
          notes: ''
        });
        setFormItems([]);
      }
      setFormError('');
    }
  }, [isOpen, quotationToEdit]);

  const fetchCatalogAndPacks = async () => {
    setLoading(true);
    try {
      const orgId = await getValidOrgId();
      const [catalogRes, packsRes] = await Promise.all([
        supabase.from('service_catalog').select('*').eq('organization_id', orgId).eq('active', true),
        supabase.from('service_packs').select('*').eq('organization_id', orgId).eq('active', true)
      ]);
      if (catalogRes.error) throw catalogRes.error;
      if (packsRes.error) throw packsRes.error;
      setCatalog(catalogRes.data || []);
      setPacks(packsRes.data || []);
    } catch (err) {
      console.error('Error fetching catalog/packs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotationItems = async (quoteId) => {
    try {
      const { data, error } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quoteId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      setFormItems(data.map((item, idx) => ({
        id: item.id || `item-${idx}`,
        catalog_id: item.catalog_id,
        pack_id: item.pack_id,
        concept: item.concept,
        description: item.description || '',
        unit_price: Number(item.unit_price) || 0,
        quantity: item.quantity || 1,
        source_type: item.source_type
      })));
    } catch (err) {
      console.error('Error fetching quotation items:', err);
    }
  };

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
      extension_adjustment_value: (prev.extension_adjustment_type === 'percentage' && !suggestion.warning) 
        ? suggestion.pct 
        : prev.extension_adjustment_value
    }));
  };

  const handleAddCatalogItem = () => {
    if (!selectedServiceId) return;
    const service = catalog.find(c => c.id === selectedServiceId);
    if (!service) return;

    setFormItems([...formItems, {
      id: `service-${Date.now()}`,
      catalog_id: service.id,
      pack_id: null,
      concept: service.name || service.title,
      description: service.description || '',
      unit_price: Number(service.price_from || service.base_price) || 0,
      quantity: 1,
      source_type: 'catalog'
    }]);
    setSelectedServiceId('');
  };

  const handleAddPackItem = () => {
    if (!selectedPackId) return;
    const pack = packs.find(p => p.id === selectedPackId);
    if (!pack) return;

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
  };

  const handleAddManualItem = () => {
    setFormItems([...formItems, {
      id: `manual-${Date.now()}`,
      catalog_id: null,
      pack_id: null,
      concept: 'Concepto Personalizado',
      description: '',
      unit_price: 0,
      quantity: 1,
      source_type: 'manual'
    }]);
  };

  const handleUpdateItemField = (itemId, field, value) => {
    setFormItems(formItems.map(item => {
      if (item.id === itemId) return { ...item, [field]: value };
      return item;
    }));
  };

  const handleRemoveItem = (itemId) => {
    setFormItems(formItems.filter(item => item.id !== itemId));
  };

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
      setFormError('Debe agregar al menos un servicio o ítem.');
      return;
    }
    if (!formHeader.author_name.trim()) {
      setFormError('El nombre del autor o destinatario es requerido.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const orgId = await getValidOrgId();
      const totals = getTotals();

      const payload = {
        organization_id: orgId,
        client_id: clientId || null,
        prospect_id: prospectId || null,
        author_name: formHeader.author_name,
        author_email: formHeader.author_email,
        author_phone: formHeader.author_phone,
        author_instagram: formHeader.author_instagram,
        origin: formHeader.origin,
        country: formHeader.country,
        city: formHeader.city,
        object: formHeader.object,
        quote_number: formHeader.quote_number,
        issue_date: formHeader.issue_date,
        valid_until: formHeader.valid_until,
        validity_days: Number(formHeader.validity_days) || 15,
        manuscript_pages: Number(formHeader.manuscript_pages) || 0,
        extension_adjustment_type: formHeader.extension_adjustment_type,
        extension_adjustment_value: Number(formHeader.extension_adjustment_value) || 0,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax_amount: totals.vat,
        total: totals.total,
        currency: formHeader.currency,
        includes_iva: formHeader.includes_iva,
        payment_terms: formHeader.payment_terms,
        work_timeline: formHeader.work_timeline,
        includes_notes: formHeader.includes_notes,
        excludes_notes: formHeader.excludes_notes,
        start_conditions: formHeader.start_conditions,
        legal_notes: formHeader.legal_notes,
        other_notes: formHeader.other_notes,
        notes: formHeader.notes,
        status: formHeader.status,
        accepted_at: formHeader.status === 'aceptada' ? new Date().toISOString() : quotationToEdit?.accepted_at || null,
        rejected_at: formHeader.status === 'rechazada' ? new Date().toISOString() : quotationToEdit?.rejected_at || null
      };

      let quoteId = '';
      if (quotationToEdit) {
        quoteId = quotationToEdit.id;
        const { error } = await supabase.from('quotations').update(payload).eq('id', quoteId);
        if (error) throw error;
        await supabase.from('quotation_items').delete().eq('quotation_id', quoteId);
      } else {
        const { data, error } = await supabase.from('quotations').insert([payload]).select().single();
        if (error) throw error;
        quoteId = data.id;
      }

      const itemsPayload = formItems.map((item, index) => ({
        organization_id: orgId,
        quotation_id: quoteId,
        catalog_id: item.catalog_id,
        pack_id: item.pack_id,
        concept: item.concept,
        description: item.description,
        unit_price: item.unit_price,
        quantity: item.quantity,
        total: item.unit_price * item.quantity,
        source_type: item.source_type,
        display_order: index
      }));

      const { error: itemsErr } = await supabase.from('quotation_items').insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Error al guardar la propuesta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = (quote) => {
    try {
      const primaryColor = [79, 70, 229]; // Indigo-600
      const secondaryColor = [30, 41, 59]; // Slate-800
      const lightBg = [248, 250, 252]; // Slate-50

      const doc = new jsPDF();
      
      // Top Stripe
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 8, 'F');

      // Brand Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(...primaryColor);
      doc.text('SOMOS NOVELI EDITORIAL', 20, 25);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Correo: contacto@somosnoveli.cl', 20, 31);
      doc.text('Web: www.somosnoveli.cl', 20, 36);

      // Proposal details
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...secondaryColor);
      doc.text('PROPUESTA EDITORIAL Y COMERCIAL', 115, 25);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Número: ${quote.quote_number || 'S/N'}`, 115, 32);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Emisión: ${quote.issue_date || ''}`, 115, 38);
      doc.text(`Validez: ${quote.valid_until || ''} (${quote.validity_days || 15} días)`, 115, 43);

      // Recipient Box
      doc.setFillColor(...lightBg);
      doc.rect(20, 52, 170, 32, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(20, 52, 170, 32, 'D');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...secondaryColor);
      doc.text('INFORMACIÓN DE LA PROPUESTA', 25, 58);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Dirigido a: ${quote.author_name || 'Nuevo Autor'}`, 25, 64);
      doc.text(`Email: ${quote.author_email || 'Sin registrar'}`, 25, 70);
      doc.text(`Ubicación: ${quote.city || ''}${quote.city && quote.country ? ', ' : ''}${quote.country || ''}`, 25, 76);

      doc.text(`Objeto: ${quote.object || 'Propuesta de servicios editoriales.'}`, 110, 64, { maxWidth: 75 });
      if (quote.manuscript_pages > 0) {
        doc.text(`Manuscrito: ${quote.manuscript_pages} páginas`, 110, 76);
      }

      // Table Header
      let y = 92;
      doc.setFillColor(...secondaryColor);
      doc.rect(20, y, 170, 8, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('SERVICIOS INCLUIDOS', 23, y + 5.5);
      doc.text('CANT.', 125, y + 5.5);
      doc.text('PRECIO UNIT.', 143, y + 5.5);
      doc.text('TOTAL', 173, y + 5.5);

      // Table Items
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.setDrawColor(241, 245, 249);
      
      y += 8;
      formItems.forEach((item, index) => {
        doc.line(20, y + 13, 190, y + 13);
        
        doc.setFont('Helvetica', 'bold');
        doc.text(`${index + 1}. ${item.concept}`, 23, y + 5.5);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(item.description || 'Sin descripción adicional.', 23, y + 10, { maxWidth: 90 });
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);

        doc.text(String(item.quantity || 1), 128, y + 7);
        doc.text(formatCurrency(item.unit_price || 0, quote.currency), 143, y + 7);
        doc.text(formatCurrency((item.unit_price || 0) * (item.quantity || 1), quote.currency), 173, y + 7);
        
        y += 13;
      });

      // Totals
      y += 4;
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      
      doc.text('Subtotal Base:', 125, y + 4);
      doc.text(formatCurrency(quote.subtotal || 0, quote.currency), 173, y + 4);

      y += 5;
      const adjustmentAmount = quote.extension_adjustment_type === 'percentage'
        ? Math.round(Number(quote.subtotal || 0) * (Number(quote.extension_adjustment_value || 0) / 100))
        : Number(quote.extension_adjustment_value || 0);

      if (adjustmentAmount > 0) {
        doc.text('Ajuste Extensión:', 125, y + 4);
        doc.text(`+${formatCurrency(adjustmentAmount, quote.currency)}`, 173, y + 4);
        y += 5;
      }

      if (Number(quote.discount) > 0) {
        doc.text('Descuento Especial:', 125, y + 4);
        doc.text(`-${formatCurrency(quote.discount, quote.currency)}`, 173, y + 4);
        y += 5;
      }

      if (quote.includes_iva) {
        const net = Math.round(Number(quote.total) / 1.19);
        const vat = Number(quote.total) - net;
        
        doc.text('Neto:', 125, y + 4);
        doc.text(formatCurrency(net, quote.currency), 173, y + 4);
        y += 5;
        doc.text('IVA (19%):', 125, y + 4);
        doc.text(formatCurrency(vat, quote.currency), 173, y + 4);
        y += 5;
      }

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.setFontSize(10.5);
      doc.text('TOTAL DE LA PROPUESTA:', 110, y + 5);
      doc.text(formatCurrency(quote.total || 0, quote.currency), 173, y + 5);

      // Terms
      y += 18;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...secondaryColor);
      doc.text('TÉRMINOS Y CONDICIONES', 20, y);
      
      doc.setDrawColor(...primaryColor);
      doc.line(20, y + 2, 70, y + 2);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      y += 7;
      doc.setFont('Helvetica', 'bold');
      doc.text('Plazo Estimado:', 20, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(quote.work_timeline || 'A convenir.', 48, y);

      y += 5.5;
      doc.setFont('Helvetica', 'bold');
      doc.text('Forma de Pago:', 20, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(quote.payment_terms || 'Estándar.', 53, y);

      y += 5.5;
      doc.setFont('Helvetica', 'bold');
      doc.text('Requisitos de Inicio:', 20, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(quote.start_conditions || 'Aceptación formal.', 53, y);

      // Notes
      y += 10;
      doc.setFillColor(...lightBg);
      doc.rect(20, y, 170, 32, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(20, y, 170, 32, 'D');

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);

      const splitLegal = doc.splitTextToSize(quote.legal_notes || '', 162);
      doc.text(splitLegal, 24, y + 5);

      // Signatures
      y += 42;
      doc.setDrawColor(203, 213, 225);
      doc.line(20, y, 80, y);
      doc.line(130, y, 190, y);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Javier Román González', 32, y + 4);
      doc.text('Representante Noveli Editorial', 27, y + 8);
      
      doc.text('Aceptación de Propuesta', 142, y + 4);
      doc.text(quote.author_name || 'Firma Autor / Cliente', 142, y + 8);

      // Footer
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Somos Noveli Editorial - Los derechos de la obra pertenecen siempre al autor.', 45, 287);

      doc.save(`Propuesta_${quote.quote_number || 'S_N'}_${quote.author_name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error generando PDF.');
    }
  };

  if (!isOpen) return null;

  const totals = getTotals();

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl ${editorTab === 'split' ? 'max-w-7xl' : 'max-w-3xl'} w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col transition-all`}>
        
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              {quotationToEdit ? 'Editar Propuesta Editorial' : 'Crear Propuesta Comercial / Cotización'}
            </h3>
          </div>

          {/* View options */}
          <div className="flex items-center gap-2 mr-6">
            <button
              type="button"
              onClick={() => setEditorTab('form')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${editorTab === 'form' ? 'bg-indigo-50 text-indigo-650 dark:bg-indigo-950/30 dark:text-indigo-400' : 'text-slate-455 hover:text-slate-655'}`}
            >
              Formulario
            </button>
            <button
              type="button"
              onClick={() => setEditorTab('split')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${editorTab === 'split' ? 'bg-indigo-50 text-indigo-650 dark:bg-indigo-950/30 dark:text-indigo-400' : 'text-slate-455 hover:text-slate-655'}`}
            >
              Pantalla Dividida (Vista Previa)
            </button>
          </div>

          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Split panel Content */}
        <div className="flex flex-col md:flex-row overflow-y-auto flex-1 min-h-0 divide-x divide-slate-100 dark:divide-slate-800">
          
          {/* Form columns (left) */}
          <div className={`p-6 space-y-6 overflow-y-auto ${editorTab === 'preview' ? 'hidden' : editorTab === 'split' ? 'w-full md:w-1/2' : 'w-full'}`}>
            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-955/20 border border-rose-100 dark:border-rose-900/40 rounded-xl text-rose-600 dark:text-rose-455 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{formError}</span>
              </div>
            )}

            {/* Section A: Datos del autor */}
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-indigo-650 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">A. Datos del Autor / Interesado</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Nombre Autor</label>
                  <input
                    type="text"
                    value={formHeader.author_name}
                    onChange={(e) => setFormHeader({...formHeader, author_name: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs font-bold"
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Email</label>
                  <input
                    type="email"
                    value={formHeader.author_email}
                    onChange={(e) => setFormHeader({...formHeader, author_email: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Teléfono</label>
                  <input
                    type="text"
                    value={formHeader.author_phone}
                    onChange={(e) => setFormHeader({...formHeader, author_phone: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
                    placeholder="+56 9..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Instagram</label>
                  <input
                    type="text"
                    value={formHeader.author_instagram}
                    onChange={(e) => setFormHeader({...formHeader, author_instagram: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-805 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
                    placeholder="@cuenta"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">País</label>
                    <input
                      type="text"
                      value={formHeader.country}
                      onChange={(e) => setFormHeader({...formHeader, country: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Ciudad</label>
                    <input
                      type="text"
                      value={formHeader.city}
                      onChange={(e) => setFormHeader({...formHeader, city: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Origen de Contacto</label>
                  <select
                    value={formHeader.origin}
                    onChange={(e) => setFormHeader({...formHeader, origin: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="web">Sitio Web</option>
                    <option value="referido">Referido</option>
                    <option value="correo">Correo</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Notas Internas</label>
                  <textarea
                    rows="2"
                    value={formHeader.notes}
                    onChange={(e) => setFormHeader({...formHeader, notes: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
                    placeholder="Observaciones de contacto inicial..."
                  />
                </div>
              </div>
            </div>

            {/* Section B: Datos de la propuesta */}
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-indigo-650 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">B. Datos de la Propuesta</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Número Propuesta</label>
                  <input
                    type="text"
                    value={formHeader.quote_number}
                    onChange={(e) => setFormHeader({...formHeader, quote_number: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Vigencia (Días)</label>
                  <input
                    type="number"
                    value={formHeader.validity_days}
                    onChange={(e) => setFormHeader({...formHeader, validity_days: Number(e.target.value)})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Objeto de la Propuesta</label>
                  <input
                    type="text"
                    value={formHeader.object}
                    onChange={(e) => setFormHeader({...formHeader, object: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section C: Servicios propuestos */}
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-indigo-650 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">C. Servicios Propuestos</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Catálogo de Servicios</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedServiceId}
                      onChange={(e) => setSelectedServiceId(e.target.value)}
                      className="block w-full px-3 py-1.5 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs"
                    >
                      <option value="">-- Seleccionar servicio --</option>
                      {catalog.map(c => (
                        <option key={c.id} value={c.id}>{c.name || c.title} ({formatCurrency(c.price_from || c.base_price, c.currency)})</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddCatalogItem}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Otras Acciones</label>
                  <button
                    type="button"
                    onClick={handleAddManualItem}
                    className="w-full py-1.5 border border-dashed border-slate-300 dark:border-slate-700 text-slate-550 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Añadir Ítem Manual
                  </button>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Packs Editoriales</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedPackId}
                      onChange={(e) => setSelectedPackId(e.target.value)}
                      className="block w-full px-3 py-1.5 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs"
                    >
                      <option value="">-- Seleccionar pack --</option>
                      {packs.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.price_special, p.currency)})</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddPackItem}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              </div>

              {/* List of items */}
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 font-bold uppercase text-[10px] text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="p-2">Concepto</th>
                      <th className="p-2 w-24">Precio</th>
                      <th className="p-2 w-16 text-center">Cant.</th>
                      <th className="p-2 w-20 text-right">Total</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formItems.map(item => (
                      <tr key={item.id} className="border-b border-slate-50 dark:border-slate-850">
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.concept}
                            onChange={(e) => handleUpdateItemField(item.id, 'concept', e.target.value)}
                            className="w-full font-bold bg-transparent text-slate-700 dark:text-slate-200 border-none focus:outline-none"
                          />
                          <textarea
                            rows="1"
                            value={item.description}
                            placeholder="Descripción..."
                            onChange={(e) => handleUpdateItemField(item.id, 'description', e.target.value)}
                            className="w-full bg-transparent text-[10px] text-slate-400 border-none focus:outline-none resize-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => handleUpdateItemField(item.id, 'unit_price', Number(e.target.value))}
                            className="w-full px-1.5 py-0.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-955 rounded"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItemField(item.id, 'quantity', Number(e.target.value))}
                            className="w-12 text-center px-1 py-0.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-955 rounded"
                          />
                        </td>
                        <td className="p-2 text-right font-bold text-slate-600 dark:text-slate-355">
                          {formatCurrency(item.unit_price * item.quantity, formHeader.currency)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-rose-500 hover:bg-rose-55 p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section D: Ajuste por extensión */}
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-indigo-650 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">D. Ajuste por Extensión</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Páginas Manuscrito</label>
                  <input
                    type="number"
                    min="0"
                    value={formHeader.manuscript_pages || ''}
                    onChange={(e) => handlePagesChange(Number(e.target.value))}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Tipo de Ajuste</label>
                  <select
                    value={formHeader.extension_adjustment_type}
                    onChange={(e) => setFormHeader({...formHeader, extension_adjustment_type: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  >
                    <option value="percentage">Ajuste Porcentaje (%)</option>
                    <option value="fixed">Ajuste Monto Fijo ($)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Valor de Ajuste</label>
                  <input
                    type="number"
                    value={formHeader.extension_adjustment_value}
                    onChange={(e) => setFormHeader({...formHeader, extension_adjustment_value: Number(e.target.value)})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section E: Totales */}
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-indigo-650 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">E. Totales y Moneda</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Moneda</label>
                  <select
                    value={formHeader.currency}
                    onChange={(e) => setFormHeader({...formHeader, currency: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs font-bold"
                  >
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">IVA (19%)</label>
                  <select
                    value={formHeader.includes_iva ? 'si' : 'no'}
                    onChange={(e) => setFormHeader({...formHeader, includes_iva: e.target.value === 'si'})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  >
                    <option value="si">IVA Incluido</option>
                    <option value="no">Exento de IVA</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Descuento</label>
                  <input
                    type="number"
                    value={formHeader.discount}
                    onChange={(e) => setFormHeader({...formHeader, discount: Number(e.target.value)})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Estado Propuesta</label>
                  <select
                    value={formHeader.status}
                    onChange={(e) => setFormHeader({...formHeader, status: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-xl text-indigo-650 font-bold text-xs"
                  >
                    <option value="borrador">Borrador</option>
                    <option value="enviada">Enviada</option>
                    <option value="aceptada">Aceptada</option>
                    <option value="rechazada">Rechazada</option>
                    <option value="vencida">Vencida</option>
                    <option value="convertida a prospecto">Convertida a Prospecto</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section F: Condiciones y legal */}
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-indigo-650 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">F. Plazo, Inclusiones y Condiciones</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Plazo de Trabajo</label>
                  <input
                    type="text"
                    value={formHeader.work_timeline}
                    onChange={(e) => setFormHeader({...formHeader, work_timeline: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Forma de Pago Sugerida</label>
                  <input
                    type="text"
                    value={formHeader.payment_terms}
                    onChange={(e) => setFormHeader({...formHeader, payment_terms: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Qué Incluye</label>
                  <textarea
                    rows="3"
                    value={formHeader.includes_notes}
                    onChange={(e) => setFormHeader({...formHeader, includes_notes: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Qué NO Incluye</label>
                  <textarea
                    rows="3"
                    value={formHeader.excludes_notes}
                    onChange={(e) => setFormHeader({...formHeader, excludes_notes: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-855 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Requisitos para Iniciar</label>
                  <input
                    type="text"
                    value={formHeader.start_conditions}
                    onChange={(e) => setFormHeader({...formHeader, start_conditions: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-855 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Nota Legal e Incompatibilidad</label>
                  <textarea
                    rows="4"
                    value={formHeader.legal_notes}
                    onChange={(e) => setFormHeader({...formHeader, legal_notes: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview (right panel) */}
          <div className={`bg-slate-50/60 dark:bg-slate-950/20 p-6 overflow-y-auto ${editorTab === 'form' ? 'hidden' : editorTab === 'split' ? 'w-full md:w-1/2' : 'w-full'}`}>
            <div className="bg-white dark:bg-slate-900 p-8 shadow-md rounded-xl border border-slate-100 dark:border-slate-850 max-w-[800px] mx-auto text-slate-800 dark:text-slate-250 text-xs space-y-6">
              
              {/* Logo Brand Header */}
              <div className="border-b pb-6 flex justify-between items-start">
                <div>
                  <h2 className="font-extrabold text-xl text-indigo-600 dark:text-indigo-400 tracking-wider">NOVELI EDITORIAL</h2>
                  <p className="text-[10px] text-slate-450 mt-1 font-bold">SOMOS NOVELI EDITORIAL</p>
                  <p className="text-[10px] text-slate-400">contacto@somosnoveli.cl | www.somosnoveli.cl</p>
                </div>
                <div className="text-right text-[10px] text-slate-500 font-medium">
                  <span className="font-bold text-slate-705 dark:text-slate-300 text-xs block">PROPUESTA COMERCIAL PRELIMINAR</span>
                  <span className="font-bold text-indigo-650 block mt-0.5">{formHeader.quote_number}</span>
                  <span className="block mt-1">Fecha Emisión: {formHeader.issue_date}</span>
                  <span>Válida hasta: {formHeader.valid_until}</span>
                </div>
              </div>

              {/* Recipient box */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50/40 dark:bg-slate-950/20 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-[9px] uppercase tracking-widest font-bold text-slate-400 block mb-0.5">Dirigido a:</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-205 text-[11px]">{formHeader.author_name || 'Nuevo Autor'}</span>
                  {formHeader.author_email && <span className="block text-[10px] text-slate-500 mt-0.5">{formHeader.author_email}</span>}
                  {formHeader.author_phone && <span className="block text-[10px] text-slate-505">{formHeader.author_phone}</span>}
                  {(formHeader.city || formHeader.country) && (
                    <span className="block text-[10px] text-slate-450 mt-0.5">
                      {formHeader.city || ''}{formHeader.city && formHeader.country ? ', ' : ''}{formHeader.country || ''}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-widest font-bold text-slate-400 block mb-0.5">Objeto de la propuesta:</span>
                  <p className="text-[10px] text-slate-655 dark:text-slate-350 leading-relaxed font-semibold">{formHeader.object}</p>
                  {formHeader.manuscript_pages > 0 && (
                    <span className="block text-[10px] text-slate-450 mt-1 font-bold">Extensión: {formHeader.manuscript_pages} páginas</span>
                  )}
                </div>
              </div>

              {/* Items list */}
              <div className="space-y-3">
                <h5 className="font-bold text-slate-700 dark:text-slate-300 border-b pb-1">SERVICIOS INCLUIDOS</h5>
                <div className="space-y-3">
                  {formItems.length === 0 ? (
                    <p className="text-slate-400 italic">No se han añadido conceptos.</p>
                  ) : (
                    formItems.map((item, index) => (
                      <div key={item.id} className="flex justify-between items-start text-[11px] py-0.5">
                        <div className="space-y-0.5 pr-4">
                          <span className="font-bold text-slate-805 dark:text-slate-200">
                            {index + 1}. {item.concept}
                          </span>
                          {item.description && (
                            <p className="text-[10px] text-slate-400 max-w-[450px]">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <span className="font-bold text-slate-705 dark:text-slate-300">
                            {formatCurrency(item.unit_price * item.quantity, formHeader.currency)}
                          </span>
                          {item.quantity > 1 && (
                            <span className="block text-[9px] text-slate-400">
                              {item.quantity} x {formatCurrency(item.unit_price, formHeader.currency)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Values Block */}
              <div className="flex justify-end pt-2 border-t">
                <div className="w-64 space-y-1.5 text-right text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal Base:</span>
                    <span className="font-mono">{formatCurrency(totals.subtotal, formHeader.currency)}</span>
                  </div>
                  {totals.adjustmentAmount > 0 && (
                    <div className="flex justify-between text-indigo-650 dark:text-indigo-400">
                      <span>Ajuste por Extensión:</span>
                      <span className="font-mono">+{formatCurrency(totals.adjustmentAmount, formHeader.currency)}</span>
                    </div>
                  )}
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>Descuento Comercial:</span>
                      <span className="font-mono">-{formatCurrency(totals.discount, formHeader.currency)}</span>
                    </div>
                  )}
                  {formHeader.includes_iva && (
                    <>
                      <div className="flex justify-between text-slate-400 text-[10px]">
                        <span>Neto:</span>
                        <span className="font-mono">{formatCurrency(totals.net, formHeader.currency)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[10px]">
                        <span>IVA (19%):</span>
                        <span className="font-mono">{formatCurrency(totals.vat, formHeader.currency)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-extrabold text-xs text-indigo-650 dark:text-indigo-400 border-t pt-1.5">
                    <span>VALOR DEL SERVICIO:</span>
                    <span className="font-mono text-sm">{formatCurrency(totals.total, formHeader.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Conditions & Scope */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-105 text-[9.5px]">
                <div className="space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-350">Qué Incluye:</span>
                  <p className="text-slate-500 whitespace-pre-line leading-relaxed">{formHeader.includes_notes}</p>
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-350">Qué NO Incluye:</span>
                  <p className="text-slate-500 whitespace-pre-line leading-relaxed">{formHeader.excludes_notes}</p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t text-[10px]">
                <div className="flex gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-350 min-w-[110px]">Plazo de Trabajo:</span>
                  <span className="text-slate-655 dark:text-slate-300">{formHeader.work_timeline}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-350 min-w-[110px]">Forma de Pago:</span>
                  <span className="text-slate-655 dark:text-slate-300">{formHeader.payment_terms}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-350 min-w-[110px]">Requisitos de Inicio:</span>
                  <span className="text-slate-655 dark:text-slate-300">{formHeader.start_conditions}</span>
                </div>
              </div>

              {/* Legal block */}
              <div className="bg-slate-50/50 dark:bg-slate-950/20 p-3 rounded-lg border text-[8px] text-slate-400 space-y-1 italic leading-relaxed">
                {formHeader.legal_notes.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>

              {/* Signatures block */}
              <div className="pt-8 flex justify-between text-[9px] text-slate-455 text-center">
                <div className="w-40 border-t pt-2">
                  <span className="font-bold text-slate-755 dark:text-slate-300 block">Javier Román González</span>
                  <span>Representante Noveli Editorial</span>
                </div>
                <div className="w-40 border-t pt-2">
                  <span className="font-bold text-slate-755 dark:text-slate-300 block">Aceptación de Propuesta</span>
                  <span>{formHeader.author_name || 'Firma Autor / Cliente'}</span>
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-400 font-bold border-t pt-3">
                Somos Noveli Editorial - Los derechos de la obra pertenecen siempre al autor.
              </div>

            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky bottom-0 z-10">
          <div>
            {formItems.length > 0 && (
              <button
                type="button"
                onClick={() => handleDownloadPDF({
                  ...formHeader,
                  subtotal: totals.subtotal,
                  total: totals.total
                })}
                className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Propuesta PDF</span>
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-150 dark:border-slate-808 text-slate-505 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={handleFormSubmit}
              className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-650/10 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Propuesta'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
