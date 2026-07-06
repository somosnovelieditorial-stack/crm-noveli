import { useEffect, useState } from 'react';
import { supabase, getValidOrgId } from '../supabaseClient';
import { formatCurrency, calculateVatSplit } from '../utils';
import { jsPDF } from 'jspdf';
import { 
  X, Plus, Trash2, Percent, DollarSign, Check, FileText, AlertTriangle, Download, Calendar
} from 'lucide-react';

export default function QuickQuoteModal({ 
  isOpen, 
  onClose, 
  clientId = null, 
  prospectId = null, 
  entityName = '', 
  preferredCurrency = 'CLP',
  quotationToEdit = null, // pass quotation object if editing
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
    quote_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    validity_days: 15,
    valid_until: '',
    manuscript_pages: 0,
    extension_adjustment_type: 'percentage',
    extension_adjustment_value: 0,
    discount: 0,
    currency: preferredCurrency || 'CLP',
    includes_iva: true,
    status: 'borrador',
    payment_terms: 'Transferencia bancaria al inicio de la contratación.',
    scope_notes: 'Servicios editoriales profesionales para el desarrollo del manuscrito.',
    includes_notes: 'Revisión técnica, correcciones indicadas en el plan y maquetación final.',
    excludes_notes: 'Impresiones adicionales fuera del tiraje acordado, traducciones.',
    start_conditions: 'Firma de acuerdo de servicios y pago inicial.',
    legal_notes: 'Esta cotización no constituye factura ni boleta. Los valores indicados son referenciales hasta la aceptación formal del cliente y confirmación de pago.',
    notes: ''
  });

  // Selected Items State
  const [formItems, setFormItems] = useState([]);
  
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync valid_until date when issue_date or validity_days changes
  useEffect(() => {
    if (formHeader.issue_date && formHeader.validity_days) {
      const issue = new Date(formHeader.issue_date + 'T12:00:00');
      issue.setDate(issue.getDate() + Number(formHeader.validity_days));
      const validStr = issue.toISOString().split('T')[0];
      setFormHeader(prev => ({ ...prev, valid_until: validStr }));
    }
  }, [formHeader.issue_date, formHeader.validity_days]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      if (quotationToEdit) {
        // Edit mode: populate fields
        setFormHeader({
          quote_number: quotationToEdit.quote_number || '',
          issue_date: quotationToEdit.issue_date || new Date().toISOString().split('T')[0],
          validity_days: quotationToEdit.validity_days || 15,
          valid_until: quotationToEdit.valid_until || '',
          manuscript_pages: quotationToEdit.manuscript_pages || 0,
          extension_adjustment_type: quotationToEdit.extension_adjustment_type || 'percentage',
          extension_adjustment_value: quotationToEdit.extension_adjustment_value || 0,
          discount: quotationToEdit.discount || 0,
          currency: quotationToEdit.currency || 'CLP',
          includes_iva: quotationToEdit.includes_iva !== undefined ? quotationToEdit.includes_iva : true,
          status: quotationToEdit.status || 'borrador',
          payment_terms: quotationToEdit.payment_terms || 'Transferencia bancaria al inicio de la contratación.',
          scope_notes: quotationToEdit.scope_notes || 'Servicios editoriales profesionales para el desarrollo del manuscrito.',
          includes_notes: quotationToEdit.includes_notes || 'Revisión técnica, correcciones indicadas en el plan y maquetación final.',
          excludes_notes: quotationToEdit.excludes_notes || 'Impresiones adicionales fuera del tiraje acordado, traducciones.',
          start_conditions: quotationToEdit.start_conditions || 'Firma de acuerdo de servicios y pago inicial.',
          legal_notes: quotationToEdit.legal_notes || 'Esta cotización no constituye factura ni boleta. Los valores indicados son referenciales hasta la aceptación formal del cliente y confirmación de pago.',
          notes: quotationToEdit.notes || ''
        });
        fetchQuotationItems(quotationToEdit.id);
      } else {
        // Create mode
        const randNum = Math.floor(1000 + Math.random() * 9000);
        setFormHeader({
          quote_number: `COT-${randNum}`,
          issue_date: new Date().toISOString().split('T')[0],
          validity_days: 15,
          valid_until: '',
          manuscript_pages: 0,
          extension_adjustment_type: 'percentage',
          extension_adjustment_value: 0,
          discount: 0,
          currency: preferredCurrency || 'CLP',
          includes_iva: true,
          status: 'borrador',
          payment_terms: 'Transferencia bancaria al inicio de la contratación.',
          scope_notes: 'Servicios editoriales profesionales para el desarrollo del manuscrito.',
          includes_notes: 'Revisión técnica, correcciones indicadas en el plan y maquetación final.',
          excludes_notes: 'Impresiones adicionales fuera del tiraje acordado, traducciones.',
          start_conditions: 'Firma de acuerdo de servicios y pago inicial.',
          legal_notes: 'Esta cotización no constituye factura ni boleta. Los valores indicados son referenciales hasta la aceptación formal del cliente y confirmación de pago.',
          notes: ''
        });
        setFormItems([]);
      }
      setFormError('');
    }
  }, [isOpen, quotationToEdit]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const orgId = await getValidOrgId();
      const [catalogRes, packsRes] = await Promise.all([
        supabase.from('service_catalog').select('*').eq('organization_id', orgId).eq('active', true).order('name', { ascending: true }),
        supabase.from('service_packs').select('*').eq('organization_id', orgId).eq('active', true).order('name', { ascending: true })
      ]);

      if (catalogRes.error) throw catalogRes.error;
      if (packsRes.error) throw packsRes.error;

      setCatalog(catalogRes.data || []);
      setPacks(packsRes.data || []);
    } catch (err) {
      console.error("Error loading QuickQuoteModal catalog:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotationItems = async (quotId) => {
    try {
      const { data, error } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quotId)
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
      console.error("Error loading quotation items:", err);
      setFormError('No se pudieron cargar los detalles de los servicios cotizados.');
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

    if (formItems.some(item => item.catalog_id === service.id)) {
      setFormError('Este servicio ya está agregado.');
      return;
    }

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
    setFormError('');
  };

  const handleAddPackItem = () => {
    if (!selectedPackId) return;
    const pack = packs.find(p => p.id === selectedPackId);
    if (!pack) return;

    if (formItems.some(item => item.pack_id === pack.id)) {
      setFormError('Este pack ya está agregado.');
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
        return { ...item, [field]: value };
      }
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

  const generatePDF = () => {
    const totals = getTotals();
    const doc = new jsPDF();

    // Palette colors
    const primaryColor = [79, 70, 229]; // Indigo-600
    const secondaryColor = [30, 41, 59]; // Slate-800
    const lightBg = [248, 250, 252]; // Slate-50

    // Header Stripe
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 8, 'F');

    // Title / Company Brand
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...primaryColor);
    doc.text('SOMOS NOVELI EDITORIAL', 20, 25);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Correo: contacto@somosnoveli.cl', 20, 31);
    doc.text('Web: www.somosnoveli.cl', 20, 36);

    // Document Metadata Block (right-aligned)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...secondaryColor);
    doc.text('COTIZACIÓN COMERCIAL', 130, 25);
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Número: ${formHeader.quote_number}`, 130, 32);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Emisión: ${formHeader.issue_date}`, 130, 38);
    doc.text(`Validez: ${formHeader.valid_until} (${formHeader.validity_days} días)`, 130, 43);

    // Client/Prospect Block
    doc.setFillColor(...lightBg);
    doc.rect(20, 52, 170, 26, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(20, 52, 170, 26, 'D');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...secondaryColor);
    doc.text('DATOS DEL DESTINATARIO', 25, 58);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Nombre / Razón Social: ${entityName}`, 25, 64);
    doc.text(`Moneda de cotización: ${formHeader.currency}`, 25, 70);

    if (formHeader.manuscript_pages > 0) {
      doc.text(`Extensión manuscrito: ${formHeader.manuscript_pages} páginas`, 110, 70);
    }

    // Table Header
    let y = 88;
    doc.setFillColor(...secondaryColor);
    doc.rect(20, y, 170, 8, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('CONCEPTO / SERVICIO', 23, y + 5.5);
    doc.text('CANT.', 125, y + 5.5);
    doc.text('VALOR UNIT.', 143, y + 5.5);
    doc.text('TOTAL', 173, y + 5.5);

    // Table Body
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.setDrawColor(241, 245, 249);
    
    y += 8;
    formItems.forEach((item) => {
      // Row bg logic
      doc.line(20, y + 9, 190, y + 9);
      
      doc.setFont('Helvetica', 'bold');
      doc.text(item.concept, 23, y + 6);
      doc.setFont('Helvetica', 'normal');
      
      doc.text(String(item.quantity), 128, y + 6);
      doc.text(formatCurrency(item.unit_price, formHeader.currency), 143, y + 6);
      doc.text(formatCurrency(item.unit_price * item.quantity, formHeader.currency), 173, y + 6);
      
      y += 9;
    });

    // Totals calculations block
    y += 4;
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    
    doc.text('Subtotal Base:', 125, y + 4);
    doc.text(formatCurrency(totals.subtotal, formHeader.currency), 173, y + 4);

    y += 5;
    if (totals.adjustmentAmount > 0) {
      doc.text('Ajuste Extensión:', 125, y + 4);
      doc.text(`+${formatCurrency(totals.adjustmentAmount, formHeader.currency)}`, 173, y + 4);
      y += 5;
    }

    if (totals.discount > 0) {
      doc.text('Descuento Especial:', 125, y + 4);
      doc.text(`-${formatCurrency(totals.discount, formHeader.currency)}`, 173, y + 4);
      y += 5;
    }

    if (formHeader.includes_iva) {
      doc.text('Neto (Ajustado):', 125, y + 4);
      doc.text(formatCurrency(totals.net, formHeader.currency), 173, y + 4);
      y += 5;
      doc.text('IVA (19%):', 125, y + 4);
      doc.text(formatCurrency(totals.vat, formHeader.currency), 173, y + 4);
      y += 5;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.setFontSize(10.5);
    doc.text('TOTAL FINAL:', 125, y + 5);
    doc.text(formatCurrency(totals.total, formHeader.currency), 173, y + 5);

    // Terms / Conditions block
    y += 18;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...secondaryColor);
    doc.text('CONDICIONES COMERCIALES Y ALCANCE', 20, y);
    
    doc.setDrawColor(...primaryColor);
    doc.line(20, y + 2, 70, y + 2);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    y += 7;
    doc.setFont('Helvetica', 'bold');
    doc.text('1. Alcance y Plazos:', 20, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(formHeader.scope_notes || 'Servicios contratados conforme a requerimientos.', 53, y);

    y += 5.5;
    doc.setFont('Helvetica', 'bold');
    doc.text('2. Qué Incluye:', 20, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(formHeader.includes_notes || 'Revisión y entregables detallados.', 45, y);

    y += 5.5;
    doc.setFont('Helvetica', 'bold');
    doc.text('3. Exclusiones:', 20, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(formHeader.excludes_notes || 'Servicios no listados en la presente cotización.', 45, y);

    y += 5.5;
    doc.setFont('Helvetica', 'bold');
    doc.text('4. Forma de Pago:', 20, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(formHeader.payment_terms || 'Transferencia directa.', 48, y);

    y += 5.5;
    doc.setFont('Helvetica', 'bold');
    doc.text('5. Inicio de Trabajo:', 20, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(formHeader.start_conditions || 'Aprobación de cotización y pago inicial.', 52, y);

    // Legal disclaimer
    y += 10;
    doc.setFillColor(...lightBg);
    doc.rect(20, y, 170, 16, 'F');
    doc.setFont('Helvetica', 'oblique');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    
    const splitLegal = doc.splitTextToSize(formHeader.legal_notes || '', 160);
    doc.text(splitLegal, 25, y + 5);

    // Signature Area
    y += 24;
    doc.setDrawColor(203, 213, 225);
    doc.line(20, y, 80, y);
    doc.line(130, y, 190, y);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Firma Autorizada Noveli', 35, y + 4);
    doc.text('Aceptación de Conformidad Cliente', 135, y + 4);

    // Footer
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Somos Noveli Editorial - Los derechos de la obra pertenecen siempre al autor.', 45, 287);

    // Save
    doc.save(`${formHeader.quote_number}_Cotizacion_${entityName.replace(/\s+/g, '_')}.pdf`);
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
        scope_notes: formHeader.scope_notes,
        includes_notes: formHeader.includes_notes,
        excludes_notes: formHeader.excludes_notes,
        start_conditions: formHeader.start_conditions,
        legal_notes: formHeader.legal_notes,
        status: formHeader.status,
        notes: formHeader.notes,
        converted_to_service: quotationToEdit ? quotationToEdit.converted_to_service : false,
        exchange_rate: formHeader.currency === 'USD' ? 940 : formHeader.currency === 'EUR' ? 1010 : 1,
        value_converted: totals.total * (formHeader.currency === 'USD' ? 940 : formHeader.currency === 'EUR' ? 1010 : 1),
        rate_date: new Date().toISOString().split('T')[0]
      };

      let quotationId = '';

      if (quotationToEdit) {
        // Update existing quotation
        quotationId = quotationToEdit.id;
        const { error: updateErr } = await supabase
          .from('quotations')
          .update(quotPayload)
          .eq('id', quotationId);

        if (updateErr) throw updateErr;

        // Delete previous items to replace
        const { error: delErr } = await supabase
          .from('quotation_items')
          .delete()
          .eq('quotation_id', quotationId);

        if (delErr) throw delErr;
      } else {
        // Insert new quotation
        const { data: quotData, error: quotErr } = await supabase
          .from('quotations')
          .insert([quotPayload])
          .select()
          .single();

        if (quotErr) throw quotErr;
        quotationId = quotData.id;
      }

      // Insert items with display order
      const itemsPayload = formItems.map((item, index) => ({
        organization_id: orgId,
        quotation_id: quotationId,
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

      const { error: itemsErr } = await supabase
        .from('quotation_items')
        .insert(itemsPayload);

      if (itemsErr) throw itemsErr;

      // Trigger automatic conversion to service contracts if approved and not already converted
      if (formHeader.status === 'aprobada' && (!quotationToEdit || !quotationToEdit.converted_to_service)) {
        await convertToServices(quotationId, orgId, totals.total, formHeader.currency, formHeader.includes_iva);
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error("Error saving quotation:", err);
      setFormError(err.message || 'Ocurrió un error inesperado al guardar la cotización.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const convertToServices = async (quotId, orgId, totalAmount, currency, includesIva) => {
    const { data: items, error: itemsErr } = await supabase
      .from('quotation_items')
      .select('*, service_catalog(category)')
      .eq('quotation_id', quotId);

    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) return;

    const bookTitle = 'Obra sin título (Cotización)';
    const rate = currency === 'USD' ? 940 : currency === 'EUR' ? 1010 : 1;

    const factor = (formHeader.extension_adjustment_type === 'percentage') 
      ? (1 + (Number(formHeader.extension_adjustment_value) || 0) / 100)
      : 1;

    for (const item of items) {
      let serviceType = 'otro';
      if (item.source_type === 'catalog' && item.service_catalog) {
        serviceType = item.service_catalog.category || 'otro';
      } else if (item.source_type === 'pack') {
        serviceType = 'maquetación';
      }

      const finalVal = (Number(item.unit_price) * Number(item.quantity)) * factor;

      const { error: serviceErr } = await supabase
        .from('services')
        .insert([{
          organization_id: orgId,
          client_id: clientId,
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
          notes: `Creado desde Cotización Aprobada. Concepto: ${item.concept}`
        }]);

      if (serviceErr) throw serviceErr;
    }

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
        notes: `Facturación de cotización aprobada ${formHeader.quote_number}`
      }]);

    if (incomeErr) throw incomeErr;

    await supabase
      .from('quotations')
      .update({ converted_to_service: true, status: 'aprobada' })
      .eq('id', quotId);
  };

  if (!isOpen) return null;

  const totals = getTotals();

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 sticky top-0">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              {quotationToEdit ? 'Editar Cotización Comercial' : 'Crear Cotización Rápida'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Destinatario: <span className="text-slate-600 dark:text-slate-300 font-bold">{entityName || 'Contacto'}</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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

          {/* Quotation Metadata Settings */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/20">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Cotización N°</label>
              <input
                type="text"
                value={formHeader.quote_number}
                onChange={(e) => setFormHeader({...formHeader, quote_number: e.target.value})}
                className="block w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Fecha Emisión</label>
              <input
                type="date"
                value={formHeader.issue_date}
                onChange={(e) => setFormHeader({...formHeader, issue_date: e.target.value})}
                className="block w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Días de Validez</label>
              <input
                type="number"
                min="1"
                value={formHeader.validity_days}
                onChange={(e) => setFormHeader({...formHeader, validity_days: Number(e.target.value)})}
                className="block w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Válido Hasta</label>
              <input
                type="date"
                value={formHeader.valid_until}
                readOnly
                className="block w-full px-3 py-1.5 border border-slate-100 dark:border-slate-850 bg-slate-100/50 dark:bg-slate-950/50 rounded-xl text-slate-500 text-xs cursor-not-allowed"
              />
            </div>
          </div>

          {/* Catalog & Packs Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Servicios del Catálogo</label>
              <div className="flex gap-2">
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                >
                  <option value="">-- Seleccionar servicio --</option>
                  {catalog.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.title} ({formatCurrency(c.price_from || c.base_price, c.currency)})</option>
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

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Packs Editoriales</label>
              <div className="flex gap-2">
                <select
                  value={selectedPackId}
                  onChange={(e) => setSelectedPackId(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
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
                      No se han agregado ítems.
                    </td>
                  </tr>
                ) : (
                  formItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-55 dark:hover:bg-slate-950/15">
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.concept}
                          onChange={(e) => handleUpdateItemField(item.id, 'concept', e.target.value)}
                          className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                        />
                        <input
                          type="text"
                          value={item.description}
                          placeholder="Descripción breve..."
                          onChange={(e) => handleUpdateItemField(item.id, 'description', e.target.value)}
                          className="w-full bg-transparent border-b border-transparent focus:border-indigo-550 focus:outline-none text-[10px] text-slate-400 block mt-1"
                        />
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
            <div>
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

            <div>
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

            <div>
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
                <option value="si">IVA Incluido (19%)</option>
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
                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none capitalize font-bold text-indigo-650 dark:text-indigo-400"
              >
                <option value="borrador">Borrador</option>
                <option value="enviada">Enviada</option>
                <option value="aprobada">Aprobada</option>
                <option value="rechazada">Rechazada</option>
                <option value="vencida">Vencida</option>
                <option value="convertida">Convertida</option>
              </select>
            </div>
          </div>

          {/* Scope and Terms details panels */}
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/10 space-y-4">
            <h4 className="font-bold text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider">Términos, Alcance y Condiciones (para el PDF)</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Alcance del Servicio</label>
                <textarea
                  rows="2"
                  value={formHeader.scope_notes}
                  onChange={(e) => setFormHeader({...formHeader, scope_notes: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Qué Incluye</label>
                <textarea
                  rows="2"
                  value={formHeader.includes_notes}
                  onChange={(e) => setFormHeader({...formHeader, includes_notes: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Qué No Incluye (Exclusiones)</label>
                <textarea
                  rows="2"
                  value={formHeader.excludes_notes}
                  onChange={(e) => setFormHeader({...formHeader, excludes_notes: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Forma y Condiciones de Pago</label>
                <textarea
                  rows="2"
                  value={formHeader.payment_terms}
                  onChange={(e) => setFormHeader({...formHeader, payment_terms: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Condiciones para Iniciar Trabajo</label>
                <textarea
                  rows="2"
                  value={formHeader.start_conditions}
                  onChange={(e) => setFormHeader({...formHeader, start_conditions: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Nota Legal / Observaciones</label>
                <textarea
                  rows="2"
                  value={formHeader.legal_notes}
                  onChange={(e) => setFormHeader({...formHeader, legal_notes: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg focus:outline-none text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Observaciones Generales</label>
              <textarea
                rows="1"
                value={formHeader.notes}
                onChange={(e) => setFormHeader({...formHeader, notes: e.target.value})}
                placeholder="Notas adicionales..."
                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg focus:outline-none text-xs"
              />
            </div>
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
          <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              {formItems.length > 0 && (
                <button
                  type="button"
                  onClick={generatePDF}
                  className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-450 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar PDF Oficial</span>
                </button>
              )}
            </div>
            
            <div className="flex gap-3">
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
          </div>
        </form>
      </div>
    </div>
  );
}
