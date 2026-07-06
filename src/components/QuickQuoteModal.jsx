import { useEffect, useState } from 'react';
import { supabase, getValidOrgId, isMock } from '../supabaseClient';
import { formatCurrency, calculateVatSplit } from '../utils';
import { jsPDF } from 'jspdf';
import { 
  X, Plus, Trash2, Check, FileText, AlertTriangle, Download, Calendar, Sparkles, Building2
} from 'lucide-react';

const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};

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
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

  // Selection states in editor
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedPackId, setSelectedPackId] = useState('');

  // Company Settings state
  const [companySettings, setCompanySettings] = useState({
    company_name: 'EDITORIAL NOVELI',
    commercial_name: 'Somos Noveli Editorial',
    representative_name: 'Javier Román González',
    representative_role: 'Representante Noveli Editorial',
    official_email: 'somosnovelieditorial@gmail.com',
    phone: '',
    website_url: 'https://www.somosnovelieditorial.com',
    instagram_url: 'https://www.instagram.com/editorialnoveli/',
    address: 'Santa Magdalena 75 Of 304, Providencia',
    city: 'Santiago',
    country: 'Chile',
    tax_id: '',
    logo_url: '',
    favicon_url: '',
    signature_name: 'Javier Román González',
    default_legal_text: '',
    default_footer_text: 'Los derechos de la obra pertenecen siempre al autor.'
  });

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
          legal_notes: companySettings.default_legal_text || `• La cotización de impresión física se realizará por separado antes de la entrega del libro finalizado.
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
      const [catalogRes, packsRes, companyRes] = await Promise.all([
        supabase.from('service_catalog').select('*').eq('organization_id', orgId).eq('active', true),
        supabase.from('service_packs').select('*').eq('organization_id', orgId).eq('active', true),
        supabase.from('company_settings').select('*').eq('organization_id', orgId)
      ]);
      if (catalogRes.error) throw catalogRes.error;
      if (packsRes.error) throw packsRes.error;
      setCatalog(catalogRes.data || []);
      setPacks(packsRes.data || []);
      if (companyRes.data && companyRes.data.length > 0) {
        setCompanySettings(companyRes.data[0]);
      }
    } catch (err) {
      console.error('Error fetching catalog/packs/company:', err);
    } finally {
      setLoading(false);
    }
  };

  const [uploadingCompanyLogo, setUploadingCompanyLogo] = useState(false);

  const uploadCompanyLogoFile = async (file) => {
    const orgId = await getValidOrgId();
    const fileExt = file.name.split('.').pop().toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
    if (!allowedExts.includes(fileExt)) {
      throw new Error('Formato no permitido. Solo se aceptan: JPG, PNG, WEBP, SVG.');
    }

    const storagePath = `${orgId}/company_logo_${Date.now()}.${fileExt}`;

    if (isMock) {
      return `mock://brand-assets/${storagePath}`;
    } else {
      const { error: uploadErr } = await supabase.storage
        .from('brand-assets')
        .upload(storagePath, file, { upsert: true });

      if (uploadErr) {
        console.error("Supabase storage upload error complete:", uploadErr);
        throw uploadErr;
      }

      const { data: publicUrlData } = supabase.storage
        .from('brand-assets')
        .getPublicUrl(storagePath);
      
      return publicUrlData?.publicUrl || '';
    }
  };

  const handleCompanyLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingCompanyLogo(true);
    try {
      const url = await uploadCompanyLogoFile(file);
      setCompanySettings(prev => ({ ...prev, logo_url: url }));
      alert('Logo subido temporalmente. Haz clic en Guardar para conservar los cambios.');
    } catch (err) {
      console.error("Error uploading company logo:", err);
      alert(err.message || 'Error al subir el logo');
    } finally {
      setUploadingCompanyLogo(false);
    }
  };

  const handleCompanySaveInline = async (e) => {
    e.preventDefault();
    try {
      const orgId = await getValidOrgId();
      const payload = {
        company_name: companySettings.company_name,
        commercial_name: companySettings.commercial_name,
        representative_name: companySettings.representative_name,
        representative_role: companySettings.representative_role,
        official_email: companySettings.official_email,
        phone: companySettings.phone || '',
        website_url: companySettings.website_url,
        instagram_url: companySettings.instagram_url,
        address: companySettings.address,
        city: companySettings.city,
        country: companySettings.country,
        tax_id: companySettings.tax_id || '',
        logo_url: companySettings.logo_url || '',
        favicon_url: companySettings.favicon_url || '',
        signature_name: companySettings.signature_name,
        default_legal_text: companySettings.default_legal_text || '',
        default_footer_text: companySettings.default_footer_text || '',
        organization_id: orgId
      };

      if (companySettings.id) {
        payload.id = companySettings.id;
      }

      const { data, error } = await supabase
        .from('company_settings')
        .upsert(payload, { onConflict: 'organization_id' })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setCompanySettings(data);
      }
      setIsCompanyModalOpen(false);
      alert('Datos de la empresa guardados con éxito.');
    } catch (err) {
      console.error(err);
      alert('Error al guardar datos de la empresa: ' + err.message);
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

  const handleDownloadPDF = async (quote) => {
    try {
      const items = formItems;

      let logoImg = null;
      if (companySettings.logo_url) {
        try {
          logoImg = await loadImage(companySettings.logo_url);
        } catch (err) {
          console.error("Error loading logo image for PDF:", err);
        }
      }

      const doc = new jsPDF();
      const primaryColor = [79, 70, 229]; // Indigo-600
      const secondaryColor = [30, 41, 59]; // Slate-800
      const lightBg = [248, 250, 252]; // Slate-50

      // PAGE 1: OBJETO & SERVICIOS INCLUIDOS
      // Encabezado
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Noveli Editorial / Propuesta comercial preliminar', 20, 12);
      doc.setDrawColor(226, 232, 240);
      doc.line(20, 14, 190, 14);

      let nextY = 32;
      let imgH = 0;

      // Brand Title or Logo
      if (logoImg) {
        const maxW_mm = 47.6;
        const maxH_mm = 18.5;
        let imgW = logoImg.width;
        imgH = logoImg.height;
        const ratio = imgW / imgH;

        if (ratio > maxW_mm / maxH_mm) {
          imgW = maxW_mm;
          imgH = maxW_mm / ratio;
        } else {
          imgH = maxH_mm;
          imgW = maxH_mm * ratio;
        }
        
        let format = 'PNG';
        const urlLower = String(companySettings.logo_url).toLowerCase();
        if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) format = 'JPEG';
        else if (urlLower.includes('.webp')) format = 'WEBP';
        else if (urlLower.includes('.svg')) format = 'SVG';

        doc.addImage(logoImg, format, 20, 18, imgW, imgH);
        nextY = 18 + imgH + 5;
      } else {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...primaryColor);
        doc.text(String(companySettings.company_name || 'EDITORIAL NOVELI').toUpperCase(), 20, 25);
        nextY = 32;
      }

      // Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...secondaryColor);
      doc.text('PROPUESTA COMERCIAL PRELIMINAR', 115, 23);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Número: ${quote.quote_number || 'S/N'}`, 115, 28);
      doc.text(`Emisión: ${quote.issue_date || ''}`, 115, 33);
      doc.text(`Validez: ${quote.validity_days || 15} días`, 115, 38);

      // Tabla inicial box (Dirigido a, Fecha, Obra, Tipo)
      let tableY = Math.max(nextY, 43);
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.rect(20, tableY, 170, 20, 'FD');
      // vertical separator line
      doc.line(105, tableY, 105, tableY + 20);
      // horizontal separator line
      doc.line(20, tableY + 10, 190, tableY + 10);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Dirigido a:', 23, tableY + 6);
      doc.text('Obra / Proyecto:', 23, tableY + 16);
      doc.text('Fecha Emisión:', 108, tableY + 6);
      doc.text('Tipo de solicitud:', 108, tableY + 16);

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(quote.author_name || 'Nuevo Autor', 42, tableY + 6);
      doc.text(quote.object || 'Proyecto Editorial', 48, tableY + 16, { maxWidth: 55 });
      doc.text(quote.issue_date || '', 131, tableY + 6);
      doc.text('Propuesta Comercial', 133, tableY + 16);

      // Sección 1: OBJETO
      let s1Y = tableY + 26;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('1. OBJETO', 20, s1Y);
      doc.setDrawColor(...primaryColor);
      doc.line(20, s1Y + 1.5, 35, s1Y + 1.5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const objetoText = `La presente propuesta tiene como objeto detallar la prestación de servicios editoriales y de producción para la obra "${quote.object || 'Proyecto del Autor'}". El objetivo es lograr un producto editorial de la más alta calidad bajo la marca Noveli Editorial.`;
      const splitObjeto = doc.splitTextToSize(objetoText, 170);
      doc.text(splitObjeto, 20, s1Y + 6);

      // Sección 2: SERVICIOS INCLUIDOS
      let s2Y = s1Y + 22;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('2. SERVICIOS INCLUIDOS', 20, s2Y);
      doc.line(20, s2Y + 1.5, 55, s2Y + 1.5);

      let itemsY = s2Y + 7;
      (items || []).forEach((item, idx) => {
        if (itemsY > 265) {
          doc.addPage();
          itemsY = 20; // reset on new page if it overflows
        }
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`${idx + 1}. ${item.concept}`, 20, itemsY);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        const splitDesc = doc.splitTextToSize(item.description || 'Sin descripción adicional.', 160);
        doc.text(splitDesc, 24, itemsY + 4.5);
        itemsY += 6 + (splitDesc.length * 3.5);
      });

      // PAGE 2: VALORES, PAGOS, PLAZOS Y EXCLUSIONES
      doc.addPage();

      // Top header page 2
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Noveli Editorial / Propuesta comercial preliminar', 20, 12);
      doc.setDrawColor(226, 232, 240);
      doc.line(20, 14, 190, 14);

      // Sección 3: ALTERNATIVAS Y VALOR DEL SERVICIO
      let s3Y = 22;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('3. ALTERNATIVAS Y VALOR DEL SERVICIO', 20, s3Y);
      doc.setDrawColor(...primaryColor);
      doc.line(20, s3Y + 1.5, 80, s3Y + 1.5);

      // Draw table for items
      let tableValY = s3Y + 6;
      doc.setFillColor(248, 250, 252);
      doc.rect(20, tableValY, 170, 7, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Servicio / Concepto', 23, tableValY + 4.5);
      doc.text('Cant.', 105, tableValY + 4.5);
      doc.text('Valor Neto', 120, tableValY + 4.5);
      doc.text('IVA 19%', 145, tableValY + 4.5);
      doc.text('Total', 170, tableValY + 4.5);

      let rowY = tableValY + 7;
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.setDrawColor(241, 245, 249);

      (items || []).forEach(item => {
        const total = Number(item.unit_price) * Number(item.quantity);
        const net = quote.includes_iva ? Math.round(total / 1.19) : total;
        const vat = quote.includes_iva ? (total - net) : 0;

        doc.line(20, rowY + 6, 190, rowY + 6);
        doc.text(String(item.concept).substring(0, 45), 23, rowY + 4);
        doc.text(String(item.quantity || 1), 107, rowY + 4);
        doc.text(formatCurrency(net, quote.currency), 120, rowY + 4);
        doc.text(formatCurrency(vat, quote.currency), 145, rowY + 4);
        doc.text(formatCurrency(total, quote.currency), 170, rowY + 4);
        rowY += 6;
      });

      // Totals display
      doc.setFont('Helvetica', 'bold');
      doc.text('TOTAL GENERAL CON IVA:', 110, rowY + 5);
      doc.text(formatCurrency(quote.total, quote.currency), 170, rowY + 5);
      rowY += 10;

      // Sección 4: FORMA DE PAGO
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('4. FORMA DE PAGO', 20, rowY);
      doc.line(20, rowY + 1.5, 50, rowY + 1.5);

      let payTableY = rowY + 6;
      doc.setFillColor(248, 250, 252);
      doc.rect(20, payTableY, 170, 7, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Alternativa', 23, payTableY + 4.5);
      doc.text('Total con IVA', 60, payTableY + 4.5);
      doc.text('% Anticipo', 95, payTableY + 4.5);
      doc.text('Condición de pago', 120, payTableY + 4.5);

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.line(20, payTableY + 7 + 10, 190, payTableY + 7 + 10);
      doc.text('Propuesta Sugerida', 23, payTableY + 13);
      doc.text(formatCurrency(quote.total, quote.currency), 60, payTableY + 13);
      
      // Look for the percentage block in payment terms to display
      let pct = 50;
      const matchPct = String(quote.payment_terms || '').match(/(\d+)%/);
      if (matchPct) {
        pct = parseInt(matchPct[1], 10);
      }
      doc.text(`${pct}%`, 97, payTableY + 13);
      const splitPayTerms = doc.splitTextToSize(quote.payment_terms || '', 68);
      doc.text(splitPayTerms, 120, payTableY + 11);

      rowY = payTableY + 7 + 16;

      // Sección 5: PLAZO DE TRABAJO
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('5. PLAZO DE TRABAJO', 20, rowY);
      doc.line(20, rowY + 1.5, 55, rowY + 1.5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(quote.work_timeline || 'A convenir.', 20, rowY + 6);

      rowY += 13;

      // Sección 6: SERVICIOS NO INCLUIDOS Y CONDICIONES
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('6. SERVICIOS NO INCLUIDOS Y CONDICIONES', 20, rowY);
      doc.line(20, rowY + 1.5, 90, rowY + 1.5);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Qué no incluye:', 20, rowY + 6);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const splitExcludes = doc.splitTextToSize(quote.excludes_notes || '• Exclusiones estándar.', 75);
      doc.text(splitExcludes, 20, rowY + 10);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Requisitos para iniciar:', 105, rowY + 6);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const splitReqs = doc.splitTextToSize(quote.start_conditions || '• Aceptación formal de la propuesta.', 80);
      doc.text(splitReqs, 105, rowY + 10);

      rowY += 26 + Math.max(splitExcludes.length, splitReqs.length) * 3.5;

      // Sección 7: VIGENCIA
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('7. VIGENCIA', 20, rowY);
      doc.line(20, rowY + 1.5, 38, rowY + 1.5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`Esta propuesta tiene una validez de ${quote.validity_days || 15} días corridos a contar de su emisión.`, 20, rowY + 6);

      rowY += 15;

      // Nota Legal (small)
      doc.setFillColor(248, 250, 252);
      doc.rect(20, rowY, 170, 18, 'F');
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      const splitLegal = doc.splitTextToSize(quote.legal_notes || '', 162);
      doc.text(splitLegal, 23, rowY + 4);

      rowY += 25;

      // Firmas
      doc.setDrawColor(203, 213, 225);
      doc.line(20, rowY, 80, rowY);
      doc.line(130, rowY, 190, rowY);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Firma Autor/a', 147, rowY + 4);
      doc.text(companySettings.representative_name || 'Javier Román González', 23, rowY + 4);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(companySettings.representative_role || 'Representante Noveli Editorial', 23, rowY + 8);
      doc.text('Aceptación de Propuesta', 142, rowY + 8);

      // Footer
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(companySettings.default_footer_text || 'Los derechos de la obra pertenecen siempre al autor.', 45, 287);

      doc.save(`Propuesta_${quote.quote_number || 'S_N'}_${quote.author_name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error generando PDF.');
    }
  };

  if (!isOpen) return null;

  const getPaymentAdvancePct = () => {
    let pct = 50;
    const matchPct = String(formHeader.payment_terms || '').match(/(\d+)%/);
    if (matchPct) pct = parseInt(matchPct[1], 10);
    return `${pct}%`;
  };

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
            <div className={`bg-slate-50/60 dark:bg-slate-955/20 p-6 overflow-y-auto ${editorTab === 'form' ? 'hidden' : editorTab === 'split' ? 'w-full md:w-1/2' : 'w-full'} space-y-3`}>
            <div className="flex justify-between items-center max-w-[800px] mx-auto text-slate-400 font-bold uppercase text-[9px] tracking-wider">
              <span>Vista Previa Interactiva</span>
              <button
                type="button"
                onClick={() => setIsCompanyModalOpen(true)}
                className="text-[10px] font-extrabold text-indigo-650 hover:text-indigo-500 transition-all cursor-pointer border border-indigo-150 rounded-lg px-2 py-0.5 bg-indigo-50/20"
              >
                Editar datos de empresa
              </button>
            </div>
            
            <div className="space-y-6 max-w-[800px] mx-auto text-slate-800 dark:text-slate-250">
              {/* PAGE 1 */}
              <div className="bg-white dark:bg-slate-900 p-8 shadow-md rounded-xl border border-slate-100 dark:border-slate-850 text-xs space-y-6 min-h-[842px] flex flex-col justify-between">
                <div className="space-y-6">
                  {/* Encabezado */}
                  <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-wider border-b pb-1">
                    <span>Noveli Editorial / Propuesta comercial preliminar</span>
                    <span>Página 1</span>
                  </div>

                  {/* Brand Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      {companySettings.logo_url ? (
                        <img src={companySettings.logo_url} alt="Logo" className="max-h-12 max-w-full object-contain mb-2" />
                      ) : (
                        <h2 className="font-extrabold text-xl text-indigo-600 dark:text-indigo-400 tracking-wider">{companySettings.company_name || 'EDITORIAL NOVELI'}</h2>
                      )}
                      <p className="text-[10px] text-slate-455 mt-1 font-bold">{companySettings.commercial_name || 'Somos Noveli Editorial'}</p>
                      <p className="text-[10px] text-slate-400">{companySettings.official_email || 'contacto@somosnoveli.cl'} | {companySettings.website_url || 'www.somosnoveli.cl'}</p>
                    </div>
                    <div className="text-right text-[10px] text-slate-500 font-medium">
                      <span className="font-bold text-slate-705 dark:text-slate-300 text-xs block">PROPUESTA COMERCIAL PRELIMINAR</span>
                      <span className="font-bold text-indigo-650 block mt-0.5">{formHeader.quote_number}</span>
                      <span className="block mt-1">Fecha Emisión: {formHeader.issue_date}</span>
                      <span>Válida hasta: {formHeader.valid_until}</span>
                    </div>
                  </div>

                  {/* Table Inicial Box */}
                  <div className="grid grid-cols-2 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-[11px]">
                    <div className="p-3 border-r border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                      <span className="font-bold text-slate-400 block text-[9px] uppercase">Dirigido a:</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-205">{formHeader.author_name || 'Nuevo Autor'}</span>
                    </div>
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                      <span className="font-bold text-slate-400 block text-[9px] uppercase">Fecha Emisión:</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-205">{formHeader.issue_date}</span>
                    </div>
                    <div className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                      <span className="font-bold text-slate-400 block text-[9px] uppercase">Obra / Proyecto:</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-205">{formHeader.object || 'Proyecto Editorial'}</span>
                    </div>
                    <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20">
                      <span className="font-bold text-slate-400 block text-[9px] uppercase">Tipo de solicitud:</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-205">Propuesta Comercial</span>
                    </div>
                  </div>

                  {/* Objeto */}
                  <div className="space-y-1">
                    <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b pb-1">1. Objeto de la propuesta</h5>
                    <p className="text-slate-600 dark:text-slate-350 leading-relaxed text-[11px]">
                      La presente propuesta tiene como objeto detallar la prestación de servicios editoriales y de producción para la obra "{formHeader.object || 'Proyecto del Autor'}". El objetivo es lograr un producto editorial de la más alta calidad bajo la marca Noveli Editorial.
                    </p>
                  </div>

                  {/* Servicios Incluidos */}
                  <div className="space-y-3">
                    <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b pb-1">2. Servicios Incluidos</h5>
                    <div className="space-y-3">
                      {formItems.length === 0 ? (
                        <p className="text-slate-400 italic">No se han añadido conceptos.</p>
                      ) : (
                        formItems.map((item, index) => (
                          <div key={item.id} className="text-[11px] py-1 border-b border-slate-50 dark:border-slate-850 pb-2">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              {index + 1}. {item.concept}
                            </span>
                            {item.description && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Page 1 Footer */}
                <div className="text-center text-[9px] text-slate-400 border-t pt-3 font-semibold">
                  {companySettings.default_footer_text || 'Los derechos de la obra pertenecen siempre al autor.'}
                </div>
              </div>

              {/* PAGE 2 */}
              <div className="bg-white dark:bg-slate-900 p-8 shadow-md rounded-xl border border-slate-100 dark:border-slate-850 text-xs space-y-6 min-h-[842px] flex flex-col justify-between">
                <div className="space-y-6">
                  {/* Encabezado */}
                  <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-wider border-b pb-1">
                    <span>Noveli Editorial / Propuesta comercial preliminar</span>
                    <span>Página 2</span>
                  </div>

                  {/* Valores del servicio Table */}
                  <div className="space-y-2">
                    <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b pb-1">3. Alternativas y Valor del Servicio</h5>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-55 dark:bg-slate-950 font-bold uppercase text-[9px] text-slate-455 border-b border-slate-100 dark:border-slate-800">
                            <th className="p-2">Alternativa / Servicio</th>
                            <th className="p-2 w-12 text-center">Cant.</th>
                            <th className="p-2 w-20 text-right">Neto</th>
                            <th className="p-2 w-16 text-right">IVA 19%</th>
                            <th className="p-2 w-24 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formItems.map(item => {
                            const total = item.unit_price * item.quantity;
                            const net = formHeader.includes_iva ? Math.round(total / 1.19) : total;
                            const vat = formHeader.includes_iva ? total - net : 0;
                            return (
                              <tr key={item.id} className="border-b border-slate-50 dark:border-slate-850">
                                <td className="p-2 font-bold">{item.concept}</td>
                                <td className="p-2 text-center">{item.quantity}</td>
                                <td className="p-2 text-right font-mono">{formatCurrency(net, formHeader.currency)}</td>
                                <td className="p-2 text-right font-mono">{formatCurrency(vat, formHeader.currency)}</td>
                                <td className="p-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{formatCurrency(total, formHeader.currency)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Totals Block */}
                    <div className="flex justify-end pt-2">
                      <div className="w-64 space-y-1 text-right text-[11px]">
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
                        <div className="flex justify-between font-extrabold text-xs text-indigo-650 dark:text-indigo-400 border-t pt-1 border-slate-200 dark:border-slate-800">
                          <span>VALOR TOTAL PROPUESTA:</span>
                          <span className="font-mono text-xs">{formatCurrency(totals.total, formHeader.currency)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Forma de Pago Table */}
                  <div className="space-y-2">
                    <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b pb-1">4. Forma de Pago</h5>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-55 dark:bg-slate-950 font-bold uppercase text-[9px] text-slate-455 border-b border-slate-100 dark:border-slate-800">
                            <th className="p-2">Alternativa</th>
                            <th className="p-2 w-28 text-right">Total con IVA</th>
                            <th className="p-2 w-20 text-center">% Inicio</th>
                            <th className="p-2 w-48">Tipo / condición</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-50 dark:border-slate-850">
                            <td className="p-2 font-bold">Propuesta Sugerida</td>
                            <td className="p-2 text-right font-mono font-bold text-indigo-650 dark:text-indigo-400">{formatCurrency(totals.total, formHeader.currency)}</td>
                            <td className="p-2 text-center font-bold">{getPaymentAdvancePct()}</td>
                            <td className="p-2 text-slate-500 leading-tight">{formHeader.payment_terms}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Plazo de Trabajo */}
                  <div className="space-y-1">
                    <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b pb-1">5. Plazo de Trabajo</h5>
                    <p className="text-slate-600 dark:text-slate-350 text-[11px] leading-relaxed">
                      {formHeader.work_timeline}
                    </p>
                  </div>

                  {/* Exclusiones y Condiciones */}
                  <div className="space-y-2">
                    <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b pb-1">6. Servicios No Incluidos y Condiciones</h5>
                    <div className="grid grid-cols-2 gap-4 text-[10px]">
                      <div className="space-y-1 bg-slate-50/50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                        <span className="font-bold text-slate-500 dark:text-slate-400">Qué NO incluye:</span>
                        <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">{formHeader.excludes_notes}</p>
                      </div>
                      <div className="space-y-1 bg-slate-50/50 dark:bg-slate-955/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                        <span className="font-bold text-slate-500 dark:text-slate-400">Requisitos para iniciar:</span>
                        <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">{formHeader.start_conditions}</p>
                      </div>
                    </div>
                  </div>

                  {/* Vigencia */}
                  <div className="space-y-1">
                    <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b pb-1">7. Vigencia</h5>
                    <p className="text-slate-600 dark:text-slate-350 text-[11px] leading-relaxed">
                      Esta propuesta tiene una validez de {formHeader.validity_days || 15} días corridos a contar de su fecha de emisión.
                    </p>
                  </div>

                  {/* Legal Notes */}
                  <div className="bg-slate-50/50 dark:bg-slate-955/20 p-3 rounded-lg border text-[8px] text-slate-400 space-y-1 italic leading-relaxed">
                    {formHeader.legal_notes.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>

                  {/* Signatures block */}
                  <div className="pt-6 flex justify-between text-[9px] text-slate-455 text-center">
                    <div className="w-40 border-t pt-2">
                      <span className="font-bold text-slate-755 dark:text-slate-300 block">{companySettings.representative_name || 'Javier Román González'}</span>
                      <span>Representante Noveli Editorial</span>
                    </div>
                    <div className="w-40 border-t pt-2">
                      <span className="font-bold text-slate-755 dark:text-slate-300 block">Aceptación de Propuesta</span>
                      <span>{formHeader.author_name || 'Firma Autor / Cliente'}</span>
                    </div>
                  </div>
                </div>

                {/* Page 2 Footer */}
                <div className="text-center text-[9px] text-slate-400 border-t pt-3 font-semibold">
                  {companySettings.default_footer_text || 'Los derechos de la obra pertenecen siempre al autor.'}
                </div>
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

      {isCompanyModalOpen && (
        <div className="fixed inset-0 bg-slate-955/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <h4 className="font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                Editar Datos de Empresa
              </h4>
              <button onClick={() => setIsCompanyModalOpen(false)} className="text-slate-400 hover:text-slate-655 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCompanySaveInline} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Nombre Editorial</label>
                  <input
                    type="text"
                    required
                    value={companySettings.company_name}
                    onChange={(e) => setCompanySettings({...companySettings, company_name: e.target.value})}
                    className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Nombre Comercial</label>
                  <input
                    type="text"
                    required
                    value={companySettings.commercial_name}
                    onChange={(e) => setCompanySettings({...companySettings, commercial_name: e.target.value})}
                    className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Representante</label>
                  <input
                    type="text"
                    required
                    value={companySettings.representative_name}
                    onChange={(e) => setCompanySettings({...companySettings, representative_name: e.target.value})}
                    className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Cargo</label>
                  <input
                    type="text"
                    required
                    value={companySettings.representative_role}
                    onChange={(e) => setCompanySettings({...companySettings, representative_role: e.target.value})}
                    className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Oficial</label>
                  <input
                    type="email"
                    required
                    value={companySettings.official_email}
                    onChange={(e) => setCompanySettings({...companySettings, official_email: e.target.value})}
                    className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Teléfono</label>
                  <input
                    type="text"
                    value={companySettings.phone || ''}
                    onChange={(e) => setCompanySettings({...companySettings, phone: e.target.value})}
                    className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Sitio Web</label>
                  <input
                    type="url"
                    required
                    value={companySettings.website_url}
                    onChange={(e) => setCompanySettings({...companySettings, website_url: e.target.value})}
                    className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Instagram</label>
                  <input
                    type="url"
                    required
                    value={companySettings.instagram_url}
                    onChange={(e) => setCompanySettings({...companySettings, instagram_url: e.target.value})}
                    className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Dirección</label>
                  <input
                    type="text"
                    required
                    value={companySettings.address}
                    onChange={(e) => setCompanySettings({...companySettings, address: e.target.value})}
                    className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Ciudad</label>
                  <input
                    type="text"
                    required
                    value={companySettings.city}
                    onChange={(e) => setCompanySettings({...companySettings, city: e.target.value})}
                    className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">País</label>
                  <input
                    type="text"
                    required
                    value={companySettings.country}
                    onChange={(e) => setCompanySettings({...companySettings, country: e.target.value})}
                    className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707"
                  />
                </div>
                <div className="space-y-1 col-span-2 border border-slate-100 dark:border-slate-800 p-3 rounded-xl space-y-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Logo de Empresa (SVG, PNG, JPG, WEBP)</label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.svg"
                      onChange={handleCompanyLogoChange}
                      className="block w-full text-[10px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-slate-850 dark:file:text-slate-350"
                    />
                    {uploadingCompanyLogo && <p className="text-[9px] text-brand-500 font-bold mt-0.5 animate-pulse">Subiendo logo...</p>}
                    
                    {companySettings.logo_url && (
                      <div className="mt-1.5 p-1 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-850 inline-block">
                        <img src={companySettings.logo_url} alt="Logo de la Empresa" className="max-h-12 max-w-full object-contain rounded" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Logo URL Directa</label>
                    <input
                      type="text"
                      value={companySettings.logo_url || ''}
                      onChange={(e) => setCompanySettings({...companySettings, logo_url: e.target.value})}
                      className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707"
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Texto Legal Predeterminado</label>
                  <textarea
                    rows="3"
                    value={companySettings.default_legal_text}
                    onChange={(e) => setCompanySettings({...companySettings, default_legal_text: e.target.value})}
                    className="block w-full p-2 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707 resize-none"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Pie de Página Predeterminado</label>
                  <input
                    type="text"
                    required
                    value={companySettings.default_footer_text}
                    onChange={(e) => setCompanySettings({...companySettings, default_footer_text: e.target.value})}
                    className="block w-full px-3 py-1.5 border rounded-xl bg-slate-50 dark:bg-slate-950/50 text-slate-707"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="px-3.5 py-1.5 border rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold cursor-pointer shadow-sm shadow-indigo-600/10"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
