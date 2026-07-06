import { useEffect, useState } from 'react';
import { supabase, getValidOrgId, isMock } from '../supabaseClient';
import { formatCurrency, calculateVatSplit, formatDate } from '../utils';
import { jsPDF } from 'jspdf';
import { 
  Plus, Search, Edit2, Trash2, X, FileText, Check, AlertTriangle,
  User, Sparkles, Download, DollarSign, Eye, RefreshCw, Calendar, Trash, FolderOpen, Building2
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

export default function Quotations({ isReadOnly = false, userRole = 'administrador', realtimeTrigger }) {
  const [quotations, setQuotations] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  
  // Editor view split state: 'split' or 'form' or 'preview'
  const [editorTab, setEditorTab] = useState('split'); 

  // Selection states for catalog / packs in editor
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
    author_name: '',
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
    currency: 'CLP',
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
    fetchQuotations();
    fetchCatalogAndPacks();
    fetchCompanySettings();
  }, [realtimeTrigger]);

  const fetchCompanySettings = async () => {
    try {
      const orgId = await getValidOrgId();
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('organization_id', orgId);
      
      if (error) throw error;
      if (data && data.length > 0) {
        setCompanySettings(data[0]);
      }
    } catch (err) {
      console.error('Error fetching company settings:', err);
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

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const orgId = await getValidOrgId();
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotations(data || []);
    } catch (err) {
      console.error('Error fetching quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogAndPacks = async () => {
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
      console.error('Error loading catalog/packs:', err);
    }
  };

  const handleOpenAddModal = () => {
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setSelectedQuotation(null);
    setFormHeader({
      author_name: '',
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
      currency: 'CLP',
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
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (quote) => {
    setSelectedQuotation(quote);
    setFormHeader({
      author_name: quote.author_name || '',
      author_email: quote.author_email || '',
      author_phone: quote.author_phone || '',
      author_instagram: quote.author_instagram || '',
      country: quote.country || '',
      city: quote.city || '',
      origin: quote.origin || 'Instagram',
      quote_number: quote.quote_number || '',
      issue_date: quote.issue_date || new Date().toISOString().split('T')[0],
      validity_days: quote.validity_days || 15,
      valid_until: quote.valid_until || '',
      object: quote.object || '',
      status: quote.status || 'borrador',
      manuscript_pages: quote.manuscript_pages || 0,
      extension_adjustment_type: quote.extension_adjustment_type || 'percentage',
      extension_adjustment_value: quote.extension_adjustment_value || 0,
      discount: quote.discount || 0,
      currency: quote.currency || 'CLP',
      includes_iva: quote.includes_iva !== undefined ? quote.includes_iva : true,
      payment_terms: quote.payment_terms || '',
      work_timeline: quote.work_timeline || '',
      includes_notes: quote.includes_notes || '',
      excludes_notes: quote.excludes_notes || '',
      start_conditions: quote.start_conditions || '',
      legal_notes: quote.legal_notes || '',
      other_notes: quote.other_notes || '',
      notes: quote.notes || ''
    });
    setFormError('');
    setIsModalOpen(true);

    // Fetch items
    try {
      const { data, error } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quote.id)
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

  const handleDeleteQuotation = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta propuesta comercial?')) return;
    try {
      const { error } = await supabase.from('quotations').delete().eq('id', id);
      if (error) throw error;
      setQuotations(quotations.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting quotation:', err);
      alert('Error al eliminar propuesta.');
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
        accepted_at: formHeader.status === 'aceptada' ? new Date().toISOString() : selectedQuotation?.accepted_at || null,
        rejected_at: formHeader.status === 'rechazada' ? new Date().toISOString() : selectedQuotation?.rejected_at || null
      };

      let quoteId = '';
      if (selectedQuotation) {
        quoteId = selectedQuotation.id;
        const { error } = await supabase.from('quotations').update(payload).eq('id', quoteId);
        if (error) throw error;

        // Delete and replace items
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

      setIsModalOpen(false);
      fetchQuotations();
      alert('¡Propuesta comercial guardada con éxito!');
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Error al guardar la propuesta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const convertToProspect = async (quote) => {
    if (!window.confirm(`¿Convertir propuesta ${quote.quote_number} a Prospecto?`)) return;
    try {
      const orgId = await getValidOrgId();

      // Retrieve items to serialize services
      const { data: items, error: itemsErr } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quote.id);

      if (itemsErr) throw itemsErr;

      const prospectPayload = {
        organization_id: orgId,
        name: quote.author_name,
        email: quote.author_email,
        phone: quote.author_phone,
        instagram: quote.author_instagram,
        country: quote.country,
        city: quote.city,
        origin: quote.origin || 'Instagram',
        interest_service: items?.[0]?.concept || 'Editorial',
        amount: quote.total,
        currency: quote.currency,
        notes: `Convertido desde Propuesta Comercial N° ${quote.quote_number}. Notas propuesta: ${quote.notes || ''}`,
        status: 'acuerdo enviado',
        selected_services: items ? items.map(it => ({
          name: it.concept,
          price: it.unit_price * it.quantity,
          category: it.source_type === 'catalog' ? 'editorial' : 'otro'
        })) : []
      };

      const { data: newProspect, error: prErr } = await supabase
        .from('prospects')
        .insert([prospectPayload])
        .select()
        .single();

      if (prErr) throw prErr;

      // Update proposal state
      const { error: quoteUpdateErr } = await supabase
        .from('quotations')
        .update({
          converted_to_prospect: true,
          converted_prospect_id: newProspect.id,
          converted_at: new Date().toISOString(),
          status: 'convertida a prospecto'
        })
        .eq('id', quote.id);

      if (quoteUpdateErr) throw quoteUpdateErr;

      alert(`¡Convertido a Prospecto exitosamente! Nombre: ${newProspect.name}`);
      fetchQuotations();
    } catch (err) {
      console.error('Error converting to prospect:', err);
      alert('Error en la conversión: ' + err.message);
    }
  };

  const handleDownloadPDF = async (quote) => {
    try {
      const { data: items, error: itemsErr } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quote.id)
        .order('display_order', { ascending: true });

      if (itemsErr) throw itemsErr;

      // PDF styling settings
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
      doc.text(String(companySettings.company_name || 'EDITORIAL NOVELI').toUpperCase(), 20, 25);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Correo: ${companySettings.official_email || 'contacto@somosnoveli.cl'}`, 20, 31);
      doc.text(`Web: ${companySettings.website_url || 'www.somosnoveli.cl'}`, 20, 36);
      if (companySettings.address) {
        doc.text(`Dirección: ${companySettings.address}, ${companySettings.city || ''}`, 20, 41);
      }

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
      (items || []).forEach((item, index) => {
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
      doc.text(companySettings.representative_name || 'Javier Román González', 32, y + 4);
      doc.text(companySettings.representative_role || 'Representante Noveli Editorial', 27, y + 8);
      
      doc.text('Aceptación de Propuesta', 142, y + 4);
      doc.text(quote.author_name || 'Firma Autor / Cliente', 142, y + 8);

      // Footer
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text(companySettings.default_footer_text || 'Los derechos de la obra pertenecen siempre al autor.', 45, 287);

      doc.save(`Propuesta_${quote.quote_number || 'S_N'}_${quote.author_name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error generando PDF.');
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'borrador': return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800';
      case 'enviada': return 'bg-blue-50 text-blue-750 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40';
      case 'aceptada': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-455 dark:border-emerald-900/40';
      case 'rechazada': return 'bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/40';
      case 'vencida': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40';
      case 'convertida a prospecto': return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/40';
      default: return 'bg-slate-50 text-slate-655 border-slate-200';
    }
  };

  const filteredQuotes = quotations.filter(q => {
    const name = String(q.author_name || '').toLowerCase();
    const email = String(q.author_email || '').toLowerCase();
    const number = String(q.quote_number || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.includes(query) || email.includes(query) || number.includes(query);
    const matchesStatus = statusFilter === 'todos' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totals = getTotals();

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 dark:text-slate-100">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-805 dark:text-slate-100 font-sans tracking-tight">
            Propuestas Comerciales
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Redacción, control de tarifas, previsualización interactiva y descarga de cotizaciones editoriales.
          </p>
        </div>
        {!isReadOnly && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-brand-600/20 cursor-pointer w-fit"
          >
            <Plus className="w-4 h-4" />
            Nueva Propuesta
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por autor, N° o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-707 dark:text-slate-200 text-sm focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold uppercase whitespace-nowrap">Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-707 dark:text-slate-200 text-xs font-semibold focus:outline-none"
          >
            <option value="todos">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="enviada">Enviada</option>
            <option value="aceptada">Aceptada</option>
            <option value="rechazada">Rechazada</option>
            <option value="vencida">Vencida</option>
            <option value="convertida a prospecto">Convertida a Prospecto</option>
          </select>
        </div>
      </div>

      {/* List Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-650"></div>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400 italic">
          No se encontraron propuestas comerciales registradas.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-55 dark:bg-slate-950/70 border-b border-slate-100 dark:border-slate-800 text-slate-405 font-bold uppercase tracking-wider">
                  <th className="p-4">Propuesta N°</th>
                  <th className="p-4">Autor / Contacto</th>
                  <th className="p-4">Objeto</th>
                  <th className="p-4">Emisión / Vigencia</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-855 font-medium">
                {filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{quote.quote_number}</td>
                    <td className="p-4">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{quote.author_name}</span>
                      <span className="text-[10px] text-slate-450">{quote.author_email || quote.author_phone || 'Sin contacto'}</span>
                    </td>
                    <td className="p-4 text-slate-500 truncate max-w-xs">{quote.object}</td>
                    <td className="p-4 text-slate-450">
                      <span>{formatDate(quote.issue_date)}</span>
                      <span className="block text-[10px] text-slate-400 font-bold">Vence: {formatDate(quote.valid_until)}</span>
                    </td>
                    <td className="p-4 text-right font-extrabold text-slate-705 dark:text-slate-205">{formatCurrency(quote.total, quote.currency)}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded border uppercase text-[9px] font-bold tracking-wide ${getStatusBadgeColor(quote.status)}`}>
                        {quote.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleDownloadPDF(quote)}
                        className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-450 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer align-middle"
                        title="Descargar PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      
                      {/* Convert to Prospect Action */}
                      {!isReadOnly && quote.status === 'aceptada' && !quote.converted_to_prospect && (
                        <button
                          onClick={() => convertToProspect(quote)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 dark:bg-indigo-950/20 dark:text-indigo-400 rounded-lg text-[10px] font-extrabold cursor-pointer border border-indigo-100 dark:border-indigo-900"
                          title="Convertir a Prospecto"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Convertir a Prospecto</span>
                        </button>
                      )}

                      {!isReadOnly && (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(quote)}
                            className="inline-flex p-1.5 rounded-lg border border-slate-105 dark:border-slate-800 text-slate-450 hover:text-indigo-655 hover:bg-indigo-55 dark:hover:bg-indigo-950/20 cursor-pointer align-middle"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuotation(quote.id)}
                            className="inline-flex p-1.5 rounded-lg border border-slate-105 dark:border-slate-800 text-slate-455 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer align-middle"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Proposal Editor Split modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-955/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl ${editorTab === 'split' ? 'max-w-7xl' : 'max-w-3xl'} w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col transition-all`}>
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  {selectedQuotation ? 'Editar Propuesta Editorial' : 'Crear Propuesta Comercial / Cotización'}
                </h3>
              </div>

              {/* View options */}
              <div className="flex items-center gap-2 mr-6">
                <button
                  type="button"
                  onClick={() => setEditorTab('form')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${editorTab === 'form' ? 'bg-indigo-50 text-indigo-655 dark:bg-indigo-950/30 dark:text-indigo-400' : 'text-slate-455 hover:text-slate-655'}`}
                >
                  Formulario
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab('split')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${editorTab === 'split' ? 'bg-indigo-50 text-indigo-655 dark:bg-indigo-950/30 dark:text-indigo-400' : 'text-slate-455 hover:text-slate-655'}`}
                >
                  Pantalla Dividida (Vista Previa)
                </button>
              </div>

              <button 
                onClick={() => setIsModalOpen(false)}
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
                  <h4 className="font-bold text-xs text-indigo-655 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">A. Datos del Autor / Interesado</h4>
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
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Email</label>
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
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
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
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Ciudad</label>
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
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
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
                  <h4 className="font-bold text-xs text-indigo-655 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">B. Datos de la Propuesta</h4>
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
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Section C: Servicios propuestos */}
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-indigo-655 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">C. Servicios Propuestos</h4>
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
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-655 rounded-xl text-xs font-bold cursor-pointer"
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
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-655 rounded-xl text-xs font-bold cursor-pointer"
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
                        <tr className="bg-slate-55 dark:bg-slate-950 font-bold uppercase text-[10px] text-slate-400 border-b border-slate-100 dark:border-slate-800">
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
                            <td className="p-2 text-right font-bold text-slate-600 dark:text-slate-350">
                              {formatCurrency(item.unit_price * item.quantity, formHeader.currency)}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="text-rose-500 hover:bg-rose-50 p-1 rounded"
                              >
                                <Trash className="w-3.5 h-3.5" />
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
                  <h4 className="font-bold text-xs text-indigo-655 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">D. Ajuste por Extensión</h4>
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
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
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
                        className="block w-full px-3 py-2 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Section E: Totales */}
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-indigo-655 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">E. Totales y Moneda</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Moneda</label>
                      <select
                        value={formHeader.currency}
                        onChange={(e) => setFormHeader({...formHeader, currency: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs font-bold"
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
                        className="block w-full px-3 py-2 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
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
                        className="block w-full px-3 py-2 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Estado Propuesta</label>
                      <select
                        value={formHeader.status}
                        onChange={(e) => setFormHeader({...formHeader, status: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-indigo-650 font-bold text-xs"
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
                  <h4 className="font-bold text-xs text-indigo-655 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">F. Plazo, Inclusiones y Condiciones</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Plazo de Trabajo</label>
                      <input
                        type="text"
                        value={formHeader.work_timeline}
                        onChange={(e) => setFormHeader({...formHeader, work_timeline: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Forma de Pago Sugerida</label>
                      <input
                        type="text"
                        value={formHeader.payment_terms}
                        onChange={(e) => setFormHeader({...formHeader, payment_terms: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Qué Incluye</label>
                      <textarea
                        rows="3"
                        value={formHeader.includes_notes}
                        onChange={(e) => setFormHeader({...formHeader, includes_notes: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Qué NO Incluye</label>
                      <textarea
                        rows="3"
                        value={formHeader.excludes_notes}
                        onChange={(e) => setFormHeader({...formHeader, excludes_notes: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Requisitos para Iniciar</label>
                      <input
                        type="text"
                        value={formHeader.start_conditions}
                        onChange={(e) => setFormHeader({...formHeader, start_conditions: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
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
              <div className={`bg-slate-50/60 dark:bg-slate-950/20 p-6 overflow-y-auto ${editorTab === 'form' ? 'hidden' : editorTab === 'split' ? 'w-full md:w-1/2' : 'w-full'} space-y-3`}>
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
                <div className="bg-white dark:bg-slate-900 p-8 shadow-md rounded-xl border border-slate-100 dark:border-slate-850 max-w-[800px] mx-auto text-slate-800 dark:text-slate-250 text-xs space-y-6">
                  
                  {/* Logo Brand Header */}
                  <div className="border-b pb-6 flex justify-between items-start">
                    <div>
                      {companySettings.logo_url ? (
                        <img src={companySettings.logo_url} alt="Logo" className="max-h-12 max-w-full object-contain mb-2" />
                      ) : (
                        <h2 className="font-extrabold text-xl text-indigo-600 dark:text-indigo-400 tracking-wider">{companySettings.company_name || 'EDITORIAL NOVELI'}</h2>
                      )}
                      <p className="text-[10px] text-slate-450 mt-1 font-bold">{companySettings.commercial_name || 'Somos Noveli Editorial'}</p>
                      <p className="text-[10px] text-slate-400">{companySettings.official_email || 'contacto@somosnoveli.cl'} | {companySettings.website_url || 'www.somosnoveli.cl'}</p>
                      {companySettings.address && <p className="text-[9px] text-slate-400 mt-0.5">{companySettings.address}, {companySettings.city || ''}</p>}
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
                        <div className="flex justify-between text-indigo-655 dark:text-indigo-400">
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
                  <div className="pt-8 flex justify-between text-[9px] text-slate-450 text-center">
                    <div className="w-40 border-t pt-2">
                      <span className="font-bold text-slate-755 dark:text-slate-300 block">{companySettings.representative_name || 'Javier Román González'}</span>
                      <span>{companySettings.representative_role || 'Representante Noveli Editorial'}</span>
                    </div>
                    <div className="w-40 border-t pt-2">
                      <span className="font-bold text-slate-755 dark:text-slate-300 block">Aceptación de Propuesta</span>
                      <span>{formHeader.author_name || 'Firma Autor / Cliente'}</span>
                    </div>
                  </div>

                  <div className="text-center text-[9px] text-slate-400 font-bold border-t pt-3">
                    {companySettings.default_footer_text || 'Los derechos de la obra pertenecen siempre al autor.'}
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
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-150 dark:border-slate-800 text-slate-505 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  onClick={handleFormSubmit}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-650/10 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Guardando...' : 'Guardar Propuesta'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {isCompanyModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
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
