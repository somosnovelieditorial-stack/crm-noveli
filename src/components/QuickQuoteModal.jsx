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

const normalizeDate = (value) => {
  if (!value || value === '' || value === 'dd-mm-aaaa') return null;
  return value;
};

const normalizeTimestamp = (value) => {
  if (!value || value === '' || value === 'dd-mm-aaaa') return null;
  return value;
};

const isPdfImageCompatible = (url) => {
  if (!url) return false;
  const clean = url.toLowerCase().split('?')[0];
  return clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.jpeg');
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
    notes: '',
    pdf_compact: true
  });

  const [formItems, setFormItems] = useState([]);
  const [includedItems, setIncludedItems] = useState([]);
  const [excludedItems, setExcludedItems] = useState([]);
  const [manualIncludeText, setManualIncludeText] = useState('');
  const [manualExcludeText, setManualExcludeText] = useState('');

  // Payment Terms details
  const [paymentType, setPaymentType] = useState('50_inicio_50_termino');
  const [paymentAdvancePct, setPaymentAdvancePct] = useState(50);
  const [paymentInstallments, setPaymentInstallments] = useState(3);
  const [isPaymentTermsEditedManually, setIsPaymentTermsEditedManually] = useState(false);

  // Requisitos de inicio
  const [startRequirements, setStartRequirements] = useState({
    aceptacion: true,
    firma: true,
    pago: true,
    manuscrito: false,
    materiales: false,
    datos: false
  });

  // Inclusions/Exclusions defaults & suggested
  const suggestedInclusionsList = [
    'Revisión filológica y ortotipográfica',
    'Corrección de estilo editorial',
    'Diseño de portada personalizado (3 propuestas)',
    'Maquetación interior profesional (novela/ensayo/poesía)',
    'Maquetación ebook (ePub y Mobi)',
    'Publicación y distribución bajo demanda en Amazon',
    'Asignación de ISBN oficial y código de barras',
    'Ficha en catálogo oficial de Noveli Editorial',
    'Sesión fotográfica del autor para solapas',
    'Material promocional (marcapáginas y banners digitales)',
    'Lanzamiento virtual en redes sociales y canal YouTube',
    'Asesoría comercial para distribución física',
    '10 copias físicas de autor de regalo',
    'Informe de lectura profesional preliminar'
  ];

  const suggestedExclusionsList = [
    'Impresión física de libros (se cotiza por separado según cantidad)',
    'Distribución física obligatoria en librerías retail',
    'Trámites de registro de propiedad intelectual fuera de Chile',
    'Traducción de la obra a otros idiomas',
    'Campañas de publicidad pagada (Facebook/Instagram Ads)',
    'Organización de eventos de lanzamiento presenciales',
    'Ilustraciones personalizadas a medida para el interior',
    'Derechos de adaptaciones audiovisuales o guion'
  ];

  const parseBulletsToList = (text) => {
    if (!text) return [];
    return text.split('\n')
      .map(line => line.replace(/^•\s*/, '').trim())
      .filter(line => line.length > 0);
  };

  const getSuggestedInclusions = () => {
    const fromItems = formItems.flatMap(item => {
      if (item.source_type === 'pack') {
        const p = packs.find(pk => pk.id === item.pack_id);
        return p ? parseBulletsToList(p.includes_text || '') : [];
      } else if (item.source_type === 'catalog') {
        const c = catalog.find(ct => ct.id === item.catalog_id);
        return c ? parseBulletsToList(c.includes_text || '') : [];
      }
      return [];
    });

    const combined = Array.from(new Set([...suggestedInclusionsList, ...fromItems]));
    return combined.filter(item => !includedItems.includes(item) && !excludedItems.includes(item));
  };

  const getSuggestedExclusions = () => {
    const fromItems = formItems.flatMap(item => {
      if (item.source_type === 'pack') {
        const p = packs.find(pk => pk.id === item.pack_id);
        return p ? parseBulletsToList(p.excludes_text || '') : [];
      } else if (item.source_type === 'catalog') {
        const c = catalog.find(ct => ct.id === item.catalog_id);
        return c ? parseBulletsToList(c.excludes_text || '') : [];
      }
      return [];
    });

    const combined = Array.from(new Set([...suggestedExclusionsList, ...fromItems]));
    return combined.filter(item => !includedItems.includes(item) && !excludedItems.includes(item));
  };

  const handleAddInclude = (val) => {
    const clean = val.trim();
    if (!clean) return;
    if (excludedItems.includes(clean)) {
      alert('Este ítem ya está en la lista de no incluidos. Deseléccionalo de ahí primero.');
      return;
    }
    if (!includedItems.includes(clean)) {
      setIncludedItems([...includedItems, clean]);
    }
  };

  const handleRemoveInclude = (idx) => {
    setIncludedItems(includedItems.filter((_, i) => i !== idx));
  };

  const handleAddExclude = (val) => {
    const clean = val.trim();
    if (!clean) return;
    if (includedItems.includes(clean)) {
      alert('Este ítem ya está en la lista de incluidos. Deseléccionalo de ahí primero.');
      return;
    }
    if (!excludedItems.includes(clean)) {
      setExcludedItems([...excludedItems, clean]);
    }
  };

  const handleRemoveExclude = (idx) => {
    setExcludedItems(excludedItems.filter((_, i) => i !== idx));
  };


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
        const loadedFormat = quotationToEdit.proposal_format || 'Formal completo';
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
          includes_iva: quotationToEdit.iva_mode === 'IVA incluido',
          payment_terms: quotationToEdit.payment_terms || '',
          work_timeline: quotationToEdit.work_timeline || '',
          includes_notes: quotationToEdit.includes_notes || '',
          excludes_notes: quotationToEdit.excludes_notes || '',
          start_conditions: quotationToEdit.start_conditions || '',
          legal_notes: quotationToEdit.legal_notes || '',
          other_notes: quotationToEdit.other_notes || '',
          notes: quotationToEdit.notes || '',
          
          // NEW COLUMNS
          iva_mode: quotationToEdit.iva_mode || (quotationToEdit.includes_iva ? 'IVA incluido' : 'Exento / sin IVA'),
          tax_rate: quotationToEdit.tax_rate || 19,
          proposal_format: loadedFormat,
          show_signatures: quotationToEdit.show_signatures !== false,
          has_alternatives: quotationToEdit.has_alternatives || loadedFormat === 'Con alternativas'
        });

        // Parse lists
        setIncludedItems(quotationToEdit.included_items || parseBulletsToList(quotationToEdit.includes_notes || ''));
        setExcludedItems(quotationToEdit.excluded_items || parseBulletsToList(quotationToEdit.excludes_notes || ''));

        // Payments
        setPaymentType(quotationToEdit.payment_plan_type || '50_inicio_50_termino');
        setPaymentAdvancePct(quotationToEdit.upfront_percentage !== undefined ? quotationToEdit.upfront_percentage : 50);
        setPaymentInstallments(quotationToEdit.installments || 3);
        setIsPaymentTermsEditedManually(true);

        const reqs = quotationToEdit.start_condition_items && Array.isArray(quotationToEdit.start_condition_items)
          ? quotationToEdit.start_condition_items
          : parseBulletsToList(quotationToEdit.start_conditions || '');
        setStartRequirements({
          aceptacion: reqs.some(r => r.toLowerCase().includes('aceptación') || r.toLowerCase().includes('aceptacion') || r.toLowerCase().includes('propuesta')),
          firma: reqs.some(r => r.toLowerCase().includes('firma') || r.toLowerCase().includes('contrato')),
          pago: reqs.some(r => r.toLowerCase().includes('pago') || r.toLowerCase().includes('anticipo') || r.toLowerCase().includes('inicial')),
          manuscrito: reqs.some(r => r.toLowerCase().includes('manuscrito') || r.toLowerCase().includes('recepción manuscrito')),
          materiales: reqs.some(r => r.toLowerCase().includes('materiales') || r.toLowerCase().includes('portada') || r.toLowerCase().includes('archivos') || r.toLowerCase().includes('definitivo')),
          datos: reqs.some(r => r.toLowerCase().includes('datos') || r.toLowerCase().includes('confirmación') || r.toLowerCase().includes('confirmacion') || r.toLowerCase().includes('autor'))
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
          notes: '',
          
          iva_mode: 'IVA incluido',
          tax_rate: 19,
          proposal_format: 'Formal completo',
          show_signatures: true,
          has_alternatives: false
        });

        setIncludedItems([
          'Revisión filológica y ortotipográfica',
          'Diseño de portada personalizado (3 propuestas)',
          'Maquetación interior profesional (novela/ensayo/poesía)',
          'Entrega de archivos finales en formato digital'
        ]);
        setExcludedItems([
          'Impresión física de libros (se cotiza por separado según cantidad)',
          'Distribución física obligatoria en librerías retail',
          'Trámites de registro de propiedad intelectual fuera de Chile'
        ]);
        setStartRequirements({
          aceptacion: true,
          firma: true,
          pago: true,
          manuscrito: false,
          materiales: false,
          datos: false
        });
        setPaymentType('50_inicio_50_termino');
        setPaymentAdvancePct(50);
        setPaymentInstallments(3);
        setIsPaymentTermsEditedManually(false);
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
    const totalRaw = Math.max(0, subtotalAdjusted - discount);

    let net = 0;
    let vat = 0;
    let total = 0;
    const rate = (Number(formHeader.tax_rate) || 19) / 100;

    if (formHeader.iva_mode === 'IVA incluido') {
      total = totalRaw;
      net = Math.round(total / (1 + rate));
      vat = total - net;
    } else if (formHeader.iva_mode === '+ IVA') {
      net = totalRaw;
      vat = Math.round(net * rate);
      total = net + vat;
    } else { // 'Exento / sin IVA'
      net = totalRaw;
      vat = 0;
      total = totalRaw;
    }

    return {
      subtotal,
      adjustmentAmount,
      subtotalAdjusted,
      discount,
      net,
      vat,
      total
    };
  };

  // Keep includes_notes and excludes_notes updated
  useEffect(() => {
    setFormHeader(prev => ({
      ...prev,
      includes_notes: includedItems.map(item => `• ${item}`).join('\n'),
      excludes_notes: excludedItems.map(item => `• ${item}`).join('\n')
    }));
  }, [includedItems, excludedItems]);

  // Keep payment terms updated
  useEffect(() => {
    if (isPaymentTermsEditedManually) return;
    let text = '';
    const totals = getTotals();
    const formattedTotal = formatCurrency(totals.total, formHeader.currency);
    const advanceAmount = Math.round(totals.total * (paymentAdvancePct / 100));
    const formattedAdvance = formatCurrency(advanceAmount, formHeader.currency);

    if (paymentType === '100_inicio') {
      text = `Pago del 100% de la propuesta sugerida al inicio del proyecto (${formattedTotal}).`;
    } else if (paymentType === '55_inicio_55_termino' || paymentType === '50_inicio_50_termino') {
      const restPct = 100 - paymentAdvancePct;
      const restAmount = totals.total - advanceAmount;
      const formattedRest = formatCurrency(restAmount, formHeader.currency);
      text = `${paymentAdvancePct}% al inicio del proyecto (${formattedAdvance}) y ${restPct}% al término de los servicios contra entrega (${formattedRest}).`;
    } else if (paymentType === '50_inicio_50_entrega') {
      const restPct = 100 - paymentAdvancePct;
      const restAmount = totals.total - advanceAmount;
      const formattedRest = formatCurrency(restAmount, formHeader.currency);
      text = `${paymentAdvancePct}% al inicio del proyecto (${formattedAdvance}) y ${restPct}% contra entrega del manuscrito diagramado listo para imprenta (${formattedRest}).`;
    } else if (paymentType === 'cuotas') {
      const remainingPct = 100 - paymentAdvancePct;
      const installmentsCount = paymentInstallments || 3;
      const remainingAmount = totals.total - advanceAmount;
      const installmentAmount = Math.round(remainingAmount / installmentsCount);
      const formattedInstallment = formatCurrency(installmentAmount, formHeader.currency);
      text = `${paymentAdvancePct}% de anticipo (${formattedAdvance}) y saldo del ${remainingPct}% cancelado en ${installmentsCount} cuotas consecutivas mensuales de ${formattedInstallment} cada una.`;
    } else {
      text = formHeader.payment_terms;
    }

    setFormHeader(prev => ({ ...prev, payment_terms: text }));
  }, [paymentType, paymentAdvancePct, paymentInstallments, formItems, formHeader.currency, formHeader.extension_adjustment_type, formHeader.extension_adjustment_value, formHeader.discount]);

  useEffect(() => {
    const active = Object.keys(startRequirements)
      .filter(k => startRequirements[k])
      .map(k => {
        const labelsMap = {
          aceptacion: 'Aceptación propuesta',
          firma: 'Firma de contrato',
          pago: 'Pago inicial',
          manuscrito: 'Recepción manuscrito',
          materiales: 'Recepción portada/archivos',
          datos: 'Datos del autor'
        };
        return labelsMap[k];
      });
    setFormHeader(prev => ({
      ...prev,
      start_conditions: active.length > 0 ? active.map(item => `• ${item}`).join('\n') : 'A convenir.'
    }));
  }, [startRequirements]);

  const handleProposalFormatChange = (fmt) => {
    setFormHeader(prev => ({
      ...prev,
      proposal_format: fmt,
      has_alternatives: fmt === 'Con alternativas'
    }));
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

      const startConditionItems = Object.keys(startRequirements)
        .filter(k => startRequirements[k])
        .map(k => {
          const optionsMap = {
            aceptacion: 'Aceptación propuesta',
            firma: 'Firma de contrato',
            pago: 'Pago inicial',
            manuscrito: 'Recepción manuscrito',
            materiales: 'Recepción portada/archivos',
            datos: 'Datos del autor'
          };
          return optionsMap[k];
        });

      const valDays = Number(formHeader.validity_days) || 15;
      let issueDateStr = normalizeDate(formHeader.issue_date) || new Date().toISOString().slice(0, 10);
      let validUntilStr = normalizeDate(formHeader.valid_until);
      if (!validUntilStr) {
        const issueDateObj = new Date(issueDateStr + 'T12:00:00');
        issueDateObj.setDate(issueDateObj.getDate() + valDays);
        validUntilStr = issueDateObj.toISOString().slice(0, 10);
      }

      const payload = {
        organization_id: orgId,
        client_id: clientId || null,
        prospect_id: prospectId || null,
        author_name: formHeader.author_name,
        author_email: formHeader.author_email || null,
        author_phone: formHeader.author_phone || null,
        author_instagram: formHeader.author_instagram || null,
        origin: formHeader.origin,
        country: formHeader.country || null,
        city: formHeader.city || null,
        object: formHeader.object,
        quote_number: formHeader.quote_number,
        issue_date: issueDateStr,
        valid_until: validUntilStr,
        validity_days: valDays,
        manuscript_pages: Number(formHeader.manuscript_pages) || 0,
        extension_adjustment_type: formHeader.extension_adjustment_type,
        extension_adjustment_value: Number(formHeader.extension_adjustment_value) || 0,
        subtotal: totals.subtotal || 0,
        discount: totals.discount || 0,
        tax_amount: totals.vat || 0,
        total: totals.total || 0,
        currency: formHeader.currency,
        includes_iva: formHeader.iva_mode === 'IVA incluido',
        payment_terms: formHeader.payment_terms || null,
        work_timeline: formHeader.work_timeline || null,
        includes_notes: formHeader.includes_notes || null,
        excludes_notes: formHeader.excludes_notes || null,
        start_conditions: formHeader.start_conditions || null,
        legal_notes: formHeader.legal_notes || null,
        other_notes: formHeader.other_notes || null,
        notes: formHeader.notes || null,
        status: formHeader.status,
        accepted_at: formHeader.status === 'aceptada' ? new Date().toISOString() : normalizeTimestamp(quotationToEdit?.accepted_at),
        rejected_at: formHeader.status === 'rechazada' ? new Date().toISOString() : normalizeTimestamp(quotationToEdit?.rejected_at),
        sent_at: normalizeTimestamp(quotationToEdit?.sent_at),
        converted_at: normalizeTimestamp(quotationToEdit?.converted_at),

        // NEW COLUMNS
        iva_mode: formHeader.iva_mode,
        tax_rate: Number(formHeader.tax_rate) || 19,
        net_amount: totals.net || 0,
        payment_plan_type: paymentType,
        upfront_percentage: Number(paymentAdvancePct) || 0,
        installments: Number(paymentInstallments) || 0,
        included_items: includedItems || [],
        excluded_items: excludedItems || [],
        start_condition_items: startConditionItems || [],
        proposal_format: formHeader.proposal_format,
        show_signatures: formHeader.show_signatures,
        has_alternatives: formHeader.has_alternatives
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

  const handleDownloadPDF = async (quote, forceNoLogo = false) => {
    try {
      const safeQuote = quote || {};
      const safeCompanySettings = companySettings || {};
      const safeProposalData = safeQuote;
      console.log("Datos enviados al PDF", safeProposalData);
      console.log("Logo usado en PDF", companySettings?.logo_url);

      const items = formItems || [];

      let logoImg = null;
      if (safeCompanySettings.logo_url && isPdfImageCompatible(safeCompanySettings.logo_url) && !forceNoLogo) {
        try {
          logoImg = await loadImage(safeCompanySettings.logo_url);
        } catch (err) {
          console.error("Error loading logo image for PDF:", err);
        }
      }

      const doc = new jsPDF();
      const primaryColor = [79, 70, 229]; // Indigo-600
      const secondaryColor = [30, 41, 59]; // Slate-800
      
      const format = safeQuote.proposal_format || 'Formal completo';
      const showSigs = safeQuote.show_signatures !== false;
      const isExec = format === 'Resumen ejecutivo';
      const hasAlts = safeQuote.has_alternatives || format === 'Con alternativas';
      const isCompact = safeQuote.pdf_compact !== false;

      // Layout measurements
      const lm = isCompact ? 15 : 20;
      const rm = isCompact ? 195 : 190;
      const cw = rm - lm;
      const bodyFontSize = isCompact ? 7.5 : 8.5;
      const titleFontSize = isCompact ? 11 : 12;
      const headingFontSize = isCompact ? 9.5 : 10;
      const rowSpacing = isCompact ? 5 : 6.5;

      let currentPage = 1;
      let currentY = 32;

      const writeHeader = (pageNumber) => {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Noveli Editorial / Propuesta comercial preliminar', lm, 12);
        doc.setDrawColor(226, 232, 240);
        doc.line(lm, 14, rm, 14);
        
        doc.setFont('Helvetica', 'normal');
        doc.text(`Página ${pageNumber}`, rm - 12, 12);
      };

      const writeFooter = () => {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(safeCompanySettings.default_footer_text || 'Los derechos de la obra pertenecen siempre al autor.', lm + 25, 287);
      };

      const checkPageBreak = (neededH) => {
        if (currentY + neededH > 272) {
          doc.addPage();
          currentPage++;
          writeHeader(currentPage);
          currentY = isCompact ? 18 : 22;
        }
      };

      // PAGE 1 Start
      writeHeader(1);

      let nextY = 32;
      let imgH = 0;

      // Brand Title or Logo
      if (logoImg && !forceNoLogo) {
        try {
          const maxW_mm = isCompact ? 40 : 47.6;
          const maxH_mm = isCompact ? 14 : 18.5;
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
          
          let formatExt = 'PNG';
          const urlLower = String(safeCompanySettings.logo_url).toLowerCase();
          if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) formatExt = 'JPEG';
          else if (urlLower.includes('.webp')) formatExt = 'WEBP';
          else if (urlLower.includes('.svg')) formatExt = 'SVG';

          doc.addImage(logoImg, formatExt, lm, 18, imgW, imgH);
          nextY = 18 + imgH + (isCompact ? 3 : 5);
        } catch (logoErr) {
          console.error("Error drawing logo to PDF (falling back to text):", logoErr);
          logoImg = null; // Fallback
        }
      }

      if (!logoImg || forceNoLogo) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(isCompact ? 15 : 18);
        doc.setTextColor(...primaryColor);
        doc.text(String(safeCompanySettings.company_name || 'EDITORIAL NOVELI').toUpperCase(), lm, 25);
        nextY = isCompact ? 28 : 32;
      }

      // Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(titleFontSize);
      doc.setTextColor(...secondaryColor);
      doc.text('PROPUESTA COMERCIAL PRELIMINAR', lm + (isCompact ? 80 : 95), 23);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(bodyFontSize);
      doc.setTextColor(100, 116, 139);
      doc.text(`Número: ${safeQuote.quote_number || 'S/N'}`, lm + (isCompact ? 80 : 95), 28);
      doc.text(`Emisión: ${safeQuote.issue_date || ''}`, lm + (isCompact ? 80 : 95), 33);
      doc.text(`Validez: ${safeQuote.validity_days || 15} días`, lm + (isCompact ? 80 : 95), 38);

      // Tabla inicial box (Dirigido a, Fecha, Obra, Tipo)
      let tableY = Math.max(nextY, isCompact ? 38 : 43);
      const tableHeight = isCompact ? 16 : 20;
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.rect(lm, tableY, cw, tableHeight, 'FD');
      doc.line(lm + (cw / 2), tableY, lm + (cw / 2), tableY + tableHeight);
      doc.line(lm, tableY + (tableHeight / 2), rm, tableY + (tableHeight / 2));

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(isCompact ? 7.5 : 8);
      doc.setTextColor(71, 85, 105);
      doc.text('Dirigido a:', lm + 3, tableY + (isCompact ? 5 : 6));
      doc.text('Obra / Proyecto:', lm + 3, tableY + (isCompact ? 13 : 16));
      doc.text('Fecha Emisión:', lm + (cw / 2) + 3, tableY + (isCompact ? 5 : 6));
      doc.text('Tipo de solicitud:', lm + (cw / 2) + 3, tableY + (isCompact ? 13 : 16));

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(safeQuote.author_name || 'Nuevo Autor', lm + 22, tableY + (isCompact ? 5 : 6));
      doc.text(safeQuote.object || 'Proyecto Editorial', lm + 28, tableY + (isCompact ? 13 : 16), { maxWidth: (cw / 2) - 32 });
      doc.text(safeQuote.issue_date || '', lm + (cw / 2) + 26, tableY + (isCompact ? 5 : 6));
      doc.text('Propuesta Comercial', lm + (cw / 2) + 28, tableY + (isCompact ? 13 : 16));

      currentY = tableY + tableHeight + (isCompact ? 5 : 7);

      if (!isExec) {
        // Sección 1: OBJETO
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(headingFontSize);
        doc.setTextColor(...primaryColor);
        doc.text('1. OBJETO', lm, currentY);
        doc.setDrawColor(...primaryColor);
        doc.line(lm, currentY + 1.5, lm + 15, currentY + 1.5);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(bodyFontSize);
        doc.setTextColor(51, 65, 85);
        const objetoText = `La presente propuesta tiene como objeto detallar la prestación de servicios editoriales y de producción para la obra "${safeQuote.object || 'Proyecto del Autor'}". El objetivo es lograr un producto editorial de la más alta calidad bajo la marca Noveli Editorial.`;
        const splitObjeto = doc.splitTextToSize(objetoText, cw);
        doc.text(splitObjeto, lm, currentY + 5.5);

        currentY += isCompact ? 12 : 18;

        // Sección 2: SERVICIOS INCLUIDOS
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(headingFontSize);
        doc.setTextColor(...primaryColor);
        doc.text('2. SERVICIOS INCLUIDOS', lm, currentY);
        doc.line(lm, currentY + 1.5, lm + 35, currentY + 1.5);

        let itemsY = currentY + 6;
        const pdfIncludes = (safeQuote.included_items && Array.isArray(safeQuote.included_items) && safeQuote.included_items.length > 0)
          ? safeQuote.included_items
          : parseBulletsToList(safeQuote.includes_notes || '');

        pdfIncludes.forEach((itemText, idx) => {
          if (itemsY > (isCompact ? 275 : 265)) {
            doc.addPage();
            currentPage++;
            writeHeader(currentPage);
            itemsY = isCompact ? 20 : 25;
          }
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(bodyFontSize);
          doc.setTextColor(30, 41, 59);
          doc.text(`${idx + 1}. ${itemText}`, lm, itemsY);
          itemsY += isCompact ? 5 : 6;
        });

        currentY = itemsY + (isCompact ? 2 : 4);
      }

      // Sección 3: VALORES DEL SERVICIO
      checkPageBreak(25 + ((items || []).length * rowSpacing));
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(headingFontSize);
      doc.setTextColor(...primaryColor);
      doc.text(isExec ? '1. VALORES Y SERVICIOS' : '3. ALTERNATIVAS Y VALOR DEL SERVICIO', lm, currentY);
      doc.setDrawColor(...primaryColor);
      doc.line(lm, currentY + 1.5, lm + (isExec ? 35 : 60), currentY + 1.5);

      let tableValY = currentY + 6;
      doc.setFillColor(248, 250, 252);
      doc.rect(lm, tableValY, cw, isCompact ? 6 : 7, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(isCompact ? 7.5 : 8);
      doc.setTextColor(71, 85, 105);
      doc.text(hasAlts ? 'Alternativa / Servicio' : 'Servicio / Concepto', lm + 3, tableValY + (isCompact ? 4.2 : 4.5));
      doc.text('Cant.', lm + (cw - 85), tableValY + (isCompact ? 4.2 : 4.5));
      doc.text('Valor Neto', lm + (cw - 70), tableValY + (isCompact ? 4.2 : 4.5));
      doc.text(safeQuote.iva_mode === 'Exento / sin IVA' ? 'IVA (Exento)' : 'IVA 19%', lm + (cw - 45), tableValY + (isCompact ? 4.2 : 4.5));
      doc.text('Total', lm + (cw - 20), tableValY + (isCompact ? 4.2 : 4.5));

      let rowY = tableValY + (isCompact ? 6 : 7);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.setDrawColor(241, 245, 249);

      const ivaMode = safeQuote.iva_mode || (safeQuote.includes_iva ? 'IVA incluido' : 'Exento / sin IVA');
      const taxRate = Number(safeQuote.tax_rate) || 19;

      (items || []).forEach(item => {
        const total = Number(item.unit_price) * Number(item.quantity);
        let net = 0;
        let vat = 0;
        if (ivaMode === 'IVA incluido') {
          net = Math.round(total / (1 + taxRate / 100));
          vat = total - net;
        } else if (ivaMode === '+ IVA') {
          net = total;
          vat = Math.round(net * (taxRate / 100));
        } else { // Exento
          net = total;
          vat = 0;
        }

        doc.line(lm, rowY + rowSpacing, rm, rowY + rowSpacing);
        doc.setFontSize(bodyFontSize);
        doc.text(String(item.concept).substring(0, isCompact ? 52 : 45), lm + 3, rowY + (isCompact ? 3.5 : 4));
        doc.text(String(item.quantity || 1), lm + (cw - 82), rowY + (isCompact ? 3.5 : 4));
        doc.text(formatCurrency(net, safeQuote.currency), lm + (cw - 70), rowY + (isCompact ? 3.5 : 4));
        doc.text(ivaMode === 'Exento / sin IVA' ? 'Exento' : formatCurrency(vat, safeQuote.currency), lm + (cw - 45), rowY + (isCompact ? 3.5 : 4));
        doc.text(formatCurrency(ivaMode === '+ IVA' ? (net + vat) : total, safeQuote.currency), lm + (cw - 20), rowY + (isCompact ? 3.5 : 4));
        rowY += rowSpacing;
      });

      // Totals display
      if (!hasAlts) {
        doc.setFont('Helvetica', 'bold');
        doc.text('TOTAL GENERAL:', lm + (cw - 80), rowY + (isCompact ? 4.5 : 5));
        doc.text(formatCurrency(safeQuote.total || 0, safeQuote.currency), lm + (cw - 20), rowY + (isCompact ? 4.5 : 5));
        rowY += isCompact ? 8 : 10;
      } else {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.text('* Valores unitarios por alternativa independiente.', lm + 3, rowY + (isCompact ? 4.5 : 5));
        rowY += isCompact ? 8 : 10;
      }

      currentY = rowY;

      // Sección 4: FORMA DE PAGO
      checkPageBreak(hasAlts ? 25 + ((items || []).length * rowSpacing) : 30);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(headingFontSize);
      doc.setTextColor(...primaryColor);
      doc.text(isExec ? '2. CONDICIONES DE PAGO' : '4. FORMA DE PAGO', lm, currentY);
      doc.setDrawColor(...primaryColor);
      doc.line(lm, currentY + 1.5, lm + (isExec ? 40 : 30), currentY + 1.5);

      let payTableY = currentY + 6;
      doc.setFillColor(248, 250, 252);
      doc.rect(lm, payTableY, cw, isCompact ? 6 : 7, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(isCompact ? 7.5 : 8);
      doc.setTextColor(71, 85, 105);
      doc.text('Alternativa', lm + 3, payTableY + (isCompact ? 4.2 : 4.5));
      doc.text('Total', lm + 40, payTableY + (isCompact ? 4.2 : 4.5));
      doc.text('% Anticipo', lm + 75, payTableY + (isCompact ? 4.2 : 4.5));
      doc.text('Condición de pago', lm + 100, payTableY + (isCompact ? 4.2 : 4.5));

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      const upfrontPct = safeQuote.upfront_percentage !== undefined ? safeQuote.upfront_percentage : 50;

      if (hasAlts) {
        let pRowY = payTableY + (isCompact ? 6 : 7);
        (items || []).forEach(item => {
          const itemTotal = Number(item.unit_price) * Number(item.quantity);
          const finalItemTotal = ivaMode === '+ IVA' ? Math.round(itemTotal * (1 + taxRate/100)) : itemTotal;
          doc.line(lm, pRowY + rowSpacing, rm, pRowY + rowSpacing);
          doc.setFontSize(bodyFontSize);
          doc.text(String(item.concept).substring(0, 22), lm + 3, pRowY + (isCompact ? 3.5 : 4));
          doc.text(formatCurrency(finalItemTotal, safeQuote.currency), lm + 40, pRowY + (isCompact ? 3.5 : 4));
          doc.text(`${upfrontPct}%`, lm + 77, pRowY + (isCompact ? 3.5 : 4));
          const displayTerms = safeQuote.payment_plan_type === '100_inicio' ? '100% al inicio' :
                               safeQuote.payment_plan_type === '50_inicio_50_termino' ? '50% inicio / 50% término' :
                               safeQuote.payment_plan_type === '50_inicio_50_entrega' ? '50% inicio / 50% contra entrega' :
                               safeQuote.payment_plan_type === 'cuotas' ? `${upfrontPct}% anticipo, saldo en ${safeQuote.installments} cuotas` :
                               String(safeQuote.payment_terms).substring(0, 35);
          doc.text(displayTerms, lm + 100, pRowY + (isCompact ? 3.5 : 4));
          pRowY += rowSpacing;
        });
        currentY = pRowY + (isCompact ? 2 : 4);
      } else {
        doc.line(lm, payTableY + (isCompact ? 6 : 7) + (isCompact ? 8 : 10), rm, payTableY + (isCompact ? 6 : 7) + (isCompact ? 8 : 10));
        doc.setFontSize(bodyFontSize);
        doc.text('Propuesta Sugerida', lm + 3, payTableY + (isCompact ? 11 : 13));
        doc.text(formatCurrency(safeQuote.total || 0, safeQuote.currency), lm + 40, payTableY + (isCompact ? 11 : 13));
        doc.text(`${upfrontPct}%`, lm + 77, payTableY + (isCompact ? 11 : 13));
        const splitPayTerms = doc.splitTextToSize(safeQuote.payment_terms || '', cw - 103);
        doc.text(splitPayTerms, lm + 100, payTableY + (isCompact ? 9.5 : 11));
        currentY = payTableY + (isCompact ? 6 : 7) + (isCompact ? 14 : 16);
      }

      // Sección 5: PLAZO DE TRABAJO
      checkPageBreak(15);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(headingFontSize);
      doc.setTextColor(...primaryColor);
      doc.text(isExec ? '3. PLAZO DE TRABAJO' : '5. PLAZO DE TRABAJO', lm, currentY);
      doc.setDrawColor(...primaryColor);
      doc.line(lm, currentY + 1.5, lm + 35, currentY + 1.5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(bodyFontSize);
      doc.setTextColor(51, 65, 85);
      doc.text(safeQuote.work_timeline || 'A convenir.', lm, currentY + 5.5);

      currentY += isCompact ? 10 : 13;

      if (!isExec) {
        // Sección 6: SERVICIOS NO INCLUIDOS Y CONDICIONES
        const pdfExcludes = (safeQuote.excluded_items && Array.isArray(safeQuote.excluded_items) && safeQuote.excluded_items.length > 0)
          ? safeQuote.excluded_items
          : parseBulletsToList(safeQuote.excludes_notes || '');
        const excludesText = pdfExcludes.map(e => `• ${e}`).join('\n');
        const splitExcludes = doc.splitTextToSize(excludesText || '• Exclusiones estándar.', (cw / 2) - 5);
        const splitReqs = doc.splitTextToSize(safeQuote.start_conditions || '• Aceptación de la propuesta.', (cw / 2) - 5);
        
        const neededExcludesH = 15 + Math.max(splitExcludes.length, splitReqs.length) * 3.5;
        checkPageBreak(neededExcludesH);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(headingFontSize);
        doc.setTextColor(...primaryColor);
        doc.text('6. SERVICIOS NO INCLUIDOS Y CONDICIONES', lm, currentY);
        doc.line(lm, currentY + 1.5, lm + 65, currentY + 1.5);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(isCompact ? 7.5 : 8);
        doc.setTextColor(71, 85, 105);
        doc.text('Qué no incluye:', lm, currentY + 5.5);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(bodyFontSize);
        doc.setTextColor(100, 116, 139);
        doc.text(splitExcludes, lm, currentY + 9.5);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(isCompact ? 7.5 : 8);
        doc.setTextColor(71, 85, 105);
        doc.text('Requisitos para iniciar:', lm + (cw / 2) + 3, currentY + 5.5);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(bodyFontSize);
        doc.setTextColor(100, 116, 139);
        doc.text(splitReqs, lm + (cw / 2) + 3, currentY + 9.5);

        currentY += 12 + Math.max(splitExcludes.length, splitReqs.length) * (isCompact ? 3.2 : 3.6);

        // Sección 7: VIGENCIA
        checkPageBreak(12);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(headingFontSize);
        doc.setTextColor(...primaryColor);
        doc.text('7. VIGENCIA', lm, currentY);
        doc.line(lm, currentY + 1.5, lm + 20, currentY + 1.5);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(bodyFontSize);
        doc.setTextColor(51, 65, 85);
        doc.text(`Esta propuesta tiene una validez de ${safeQuote.validity_days || 15} días corridos a contar del ${safeQuote.issue_date || 'su emisión'}.`, lm, currentY + 5.5);

        currentY += isCompact ? 10 : 12;

        // Legal note
        const splitLegal = doc.splitTextToSize(safeQuote.legal_notes || '', cw - 6);
        const legalBoxH = 6 + splitLegal.length * (isCompact ? 2.8 : 3.2);
        checkPageBreak(legalBoxH + 5);

        doc.setFillColor(248, 250, 252);
        doc.rect(lm, currentY, cw, legalBoxH, 'F');
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(isCompact ? 6 : 6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(splitLegal, lm + 3, currentY + 4);

        currentY += legalBoxH + (isCompact ? 5 : 8);
      } else {
        // Compact requirements & validity for Executive Summary
        checkPageBreak(12);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(isCompact ? 7.5 : 8);
        doc.setTextColor(71, 85, 105);
        doc.text('Requisitos para iniciar:', lm, currentY + 3);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(bodyFontSize);
        doc.setTextColor(51, 65, 85);
        doc.text(safeQuote.start_conditions || 'Aceptación propuesta.', lm + (isCompact ? 32 : 36), currentY + 3);

        doc.setFont('Helvetica', 'bold');
        doc.text('Vigencia:', lm + (cw - 65), currentY + 3);
        doc.setFont('Helvetica', 'normal');
        doc.text(`${safeQuote.validity_days || 15} días corridos.`, lm + (cw - 50), currentY + 3);

        currentY += isCompact ? 8 : 12;
      }

      // Firmas
      if (showSigs) {
        checkPageBreak(isCompact ? 18 : 25);
        
        const sigLineY = currentY + (isCompact ? 10 : 15);
        doc.setDrawColor(203, 213, 225);
        doc.line(lm, sigLineY, lm + (isCompact ? 50 : 60), sigLineY);
        doc.line(rm - (isCompact ? 50 : 60), sigLineY, rm, sigLineY);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(isCompact ? 7.5 : 8);
        doc.setTextColor(71, 85, 105);
        doc.text(safeCompanySettings.representative_name || 'Javier Román González', lm + 3, sigLineY + 4);
        doc.text('Firma Autor/a', rm - (isCompact ? 47 : 57), sigLineY + 4);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(isCompact ? 7 : 7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(safeCompanySettings.representative_role || 'Representante Noveli Editorial', lm + 3, sigLineY + 7.5);
        doc.text('Aceptación de Propuesta', rm - (isCompact ? 47 : 57), sigLineY + 7.5);
      }

      writeFooter();
      doc.save(`Propuesta_${safeQuote.quote_number || 'S_N'}_${(safeQuote.author_name || 'Autor').replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Error real generando PDF:", error);
      alert(`Error generando PDF: ${error?.message || error}`);
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
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Fecha de Emisión</label>
                  <input
                    type="date"
                    value={formHeader.issue_date || ''}
                    onChange={(e) => setFormHeader({...formHeader, issue_date: e.target.value || null})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl text-slate-707 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Fecha de Vencimiento</label>
                  <input
                    type="date"
                    value={formHeader.valid_until || ''}
                    onChange={(e) => setFormHeader({...formHeader, valid_until: e.target.value || null})}
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
              <h4 className="font-bold text-xs text-indigo-650 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">E. Configuración y Totales</h4>
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
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Régimen IVA</label>
                  <select
                    value={formHeader.iva_mode}
                    onChange={(e) => setFormHeader({...formHeader, iva_mode: e.target.value, includes_iva: e.target.value === 'IVA incluido'})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  >
                    <option value="IVA incluido">IVA incluido</option>
                    <option value="+ IVA">+ IVA</option>
                    <option value="Exento / sin IVA">Exento / sin IVA</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Tasa Impuesto (%)</label>
                  <input
                    type="number"
                    value={formHeader.tax_rate !== undefined ? formHeader.tax_rate : 19}
                    onChange={(e) => setFormHeader({...formHeader, tax_rate: Number(e.target.value)})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-855 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  />
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
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Formato Documento</label>
                  <select
                    value={formHeader.proposal_format}
                    onChange={(e) => handleProposalFormatChange(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  >
                    <option value="Formal completo">Formal completo</option>
                    <option value="Resumen ejecutivo">Resumen ejecutivo</option>
                    <option value="Con alternativas">Con alternativas</option>
                    <option value="Una sola propuesta">Una sola propuesta</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Mostrar Firmas</label>
                  <select
                    value={formHeader.show_signatures ? 'si' : 'no'}
                    onChange={(e) => setFormHeader({...formHeader, show_signatures: e.target.value === 'si'})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  >
                    <option value="si">Mostrar Firmas</option>
                    <option value="no">Ocultar Firmas</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">PDF Compacto</label>
                  <select
                    value={formHeader.pdf_compact === false ? 'no' : 'si'}
                    onChange={(e) => setFormHeader({...formHeader, pdf_compact: e.target.value === 'si'})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs font-bold"
                  >
                    <option value="si">Compacto (por defecto)</option>
                    <option value="no">Normal</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Valores Unitarios</label>
                  <select
                    value={formHeader.has_alternatives ? 'si' : 'no'}
                    onChange={(e) => setFormHeader({...formHeader, has_alternatives: e.target.value === 'si'})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-855 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  >
                    <option value="no">Sumar Total General</option>
                    <option value="si">Alternativas Independientes</option>
                  </select>
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

            {/* Section F: Plazo, Inclusiones y Condiciones */}
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
                
                <div className="space-y-2 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Esquema Forma de Pago</label>
                  <select
                    value={paymentType}
                    onChange={(e) => {
                      setPaymentType(e.target.value);
                      setIsPaymentTermsEditedManually(false);
                    }}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                  >
                    <option value="100_inicio">100% al inicio</option>
                    <option value="50_inicio_50_termino">50% al inicio y 50% al término</option>
                    <option value="50_inicio_50_entrega">50% al inicio y 50% contra entrega</option>
                    <option value="cuotas">Pago en cuotas</option>
                    <option value="personalizado">Pago personalizado / Editar texto</option>
                  </select>

                  {paymentType !== '100_inicio' && paymentType !== 'personalizado' && (
                    <div className="space-y-1 mt-2">
                      <label className="block text-[9px] uppercase text-slate-400 font-bold">% Inicio / Anticipo</label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={paymentAdvancePct}
                        onChange={(e) => {
                          setPaymentAdvancePct(Number(e.target.value));
                          setIsPaymentTermsEditedManually(false);
                        }}
                        className="block w-full px-2 py-1 border rounded-lg text-xs"
                      />
                    </div>
                  )}

                  {paymentType === 'cuotas' && (
                    <div className="space-y-1 mt-2">
                      <label className="block text-[9px] uppercase text-slate-400 font-bold">Número de Cuotas de Saldo</label>
                      <input
                        type="number"
                        min="2"
                        max="12"
                        value={paymentInstallments}
                        onChange={(e) => {
                          setPaymentInstallments(Number(e.target.value));
                          setIsPaymentTermsEditedManually(false);
                        }}
                        className="block w-full px-2 py-1 border rounded-lg text-xs"
                      />
                    </div>
                  )}
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Texto Forma de Pago (Editable)</label>
                  <textarea
                    rows="2"
                    value={formHeader.payment_terms}
                    onChange={(e) => {
                      setFormHeader({...formHeader, payment_terms: e.target.value});
                      setIsPaymentTermsEditedManually(true);
                    }}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs font-semibold"
                  />
                  <div className="text-[9px] text-slate-450 leading-none select-none">
                    * Si editas este texto manualmente, se desactivará el cálculo automático hasta que vuelvas a seleccionar un esquema.
                  </div>
                </div>

                {/* Qué Incluye */}
                <div className="space-y-2 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Qué Incluye</label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto mb-2 pr-1">
                    {includedItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg border text-xs">
                        <span className="leading-tight text-slate-700 dark:text-slate-200">{item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveInclude(idx)}
                          className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-0.5 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-1">
                      <span className="block text-[9px] font-bold uppercase text-slate-400">Sugerencias del Catálogo/Packs</span>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddInclude(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="block w-full px-2 py-1 border rounded-lg text-xs"
                      >
                        <option value="">-- Seleccionar sugerencia --</option>
                        {getSuggestedInclusions().map((s, i) => (
                          <option key={i} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="block text-[9px] font-bold uppercase text-slate-400">Agregar ítem manual</span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={manualIncludeText}
                          onChange={(e) => setManualIncludeText(e.target.value)}
                          placeholder="Escribe un ítem..."
                          className="block w-full px-2 py-1 border rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            handleAddInclude(manualIncludeText);
                            setManualIncludeText('');
                          }}
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Qué NO Incluye */}
                <div className="space-y-2 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Qué NO Incluye</label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto mb-2 pr-1">
                    {excludedItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg border text-xs">
                        <span className="leading-tight text-slate-700 dark:text-slate-200">{item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExclude(idx)}
                          className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-0.5 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-1">
                      <span className="block text-[9px] font-bold uppercase text-slate-400">Sugerencias del Catálogo/Packs</span>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddExclude(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="block w-full px-2 py-1 border rounded-lg text-xs"
                      >
                        <option value="">-- Seleccionar sugerencia --</option>
                        {getSuggestedExclusions().map((s, i) => (
                          <option key={i} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="block text-[9px] font-bold uppercase text-slate-400">Agregar ítem manual</span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={manualExcludeText}
                          onChange={(e) => setManualExcludeText(e.target.value)}
                          placeholder="Escribe un ítem..."
                          className="block w-full px-2 py-1 border rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            handleAddExclude(manualExcludeText);
                            setManualExcludeText('');
                          }}
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Requisitos para Iniciar */}
                <div className="col-span-2 space-y-2 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Requisitos para iniciar</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.keys(startRequirements).map((key) => {
                      const labelsMap = {
                        aceptacion: 'Aceptación propuesta',
                        firma: 'Firma de contrato',
                        pago: 'Pago inicial',
                        manuscrito: 'Recepción manuscrito',
                        materiales: 'Recepción portada/archivos',
                        datos: 'Datos del autor'
                      };
                      return (
                        <label key={key} className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 p-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950 transition-all select-none">
                          <input
                            type="checkbox"
                            checked={startRequirements[key]}
                            onChange={(e) => setStartRequirements({...startRequirements, [key]: e.target.checked})}
                            className="rounded text-indigo-650 focus:ring-indigo-500 w-3.5 h-3.5"
                          />
                          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">{labelsMap[key]}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="text-[9px] text-slate-450 mt-1 select-none leading-none">
                    Vista previa: <span className="font-bold text-slate-600 dark:text-slate-300">{formHeader.start_conditions}</span>
                  </div>
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
              {/* CONDITIONAL FORMAT: Resumen Ejecutivo vs Complete Format */}
              {formHeader.proposal_format === 'Resumen ejecutivo' ? (
                /* PAGE 1: RESUMEN EJECUTIVO (Single Page) */
                <div className={`bg-white dark:bg-slate-900 shadow-md rounded-xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between ${formHeader.pdf_compact === false ? 'p-8 space-y-6 min-h-[842px] text-xs' : 'p-5 space-y-3.5 min-h-[680px] text-[11px]'}`}>
                  <div className={formHeader.pdf_compact === false ? 'space-y-6' : 'space-y-3.5'}>
                    {/* Encabezado */}
                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-wider border-b pb-1">
                      <span>Noveli Editorial / Resumen ejecutivo de propuesta</span>
                      <span>Página 1 de 1</span>
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
                      <div className="p-3 border-r border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-955/10">
                        <span className="font-bold text-slate-400 block text-[9px] uppercase">Dirigido a:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-205">{formHeader.author_name || 'Nuevo Autor'}</span>
                      </div>
                      <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-955/10">
                        <span className="font-bold text-slate-400 block text-[9px] uppercase">Fecha Emisión:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-205">{formHeader.issue_date}</span>
                      </div>
                      <div className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-955/10">
                        <span className="font-bold text-slate-400 block text-[9px] uppercase">Obra / Proyecto:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-205">{formHeader.object || 'Proyecto Editorial'}</span>
                      </div>
                      <div className="p-3 bg-slate-50/50 dark:bg-slate-955/10">
                        <span className="font-bold text-slate-400 block text-[9px] uppercase">Tipo de solicitud:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-205">Resumen Ejecutivo</span>
                      </div>
                    </div>

                    {/* Valores del servicio Table */}
                    <div className="space-y-2">
                      <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b pb-1">1. Valores y Servicios</h5>
                      <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-slate-55 dark:bg-slate-950 font-bold uppercase text-[9px] text-slate-455 border-b border-slate-100 dark:border-slate-800">
                              <th className="p-2">Servicio / Alternativa</th>
                              <th className="p-2 w-12 text-center">Cant.</th>
                              <th className="p-2 w-20 text-right">Neto</th>
                              <th className="p-2 w-20 text-right">{formHeader.iva_mode === 'Exento / sin IVA' ? 'IVA (Exento)' : 'IVA 19%'}</th>
                              <th className="p-2 w-24 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formItems.map(item => {
                              const total = item.unit_price * item.quantity;
                              let net = 0;
                              let vat = 0;
                              if (formHeader.iva_mode === 'IVA incluido') {
                                net = Math.round(total / 1.19);
                                vat = total - net;
                              } else if (formHeader.iva_mode === '+ IVA') {
                                net = total;
                                vat = Math.round(net * 0.19);
                              } else {
                                net = total;
                                vat = 0;
                              }
                              return (
                                <tr key={item.id} className="border-b border-slate-50 dark:border-slate-850">
                                  <td className="p-2 font-bold">{item.concept}</td>
                                  <td className="p-2 text-center">{item.quantity}</td>
                                  <td className="p-2 text-right font-mono">{formatCurrency(net, formHeader.currency)}</td>
                                  <td className="p-2 text-right font-mono">{formHeader.iva_mode === 'Exento / sin IVA' ? 'Exento' : formatCurrency(vat, formHeader.currency)}</td>
                                  <td className="p-2 text-right font-mono font-bold text-slate-700 dark:text-slate-355">{formatCurrency(formHeader.iva_mode === '+ IVA' ? (net + vat) : total, formHeader.currency)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      {!formHeader.has_alternatives && (
                        <div className="flex justify-end pt-1">
                          <div className="w-64 space-y-1 text-right text-[11px] font-bold">
                            <div className="flex justify-between font-extrabold text-indigo-650 dark:text-indigo-400">
                              <span>VALOR TOTAL PROPUESTA:</span>
                              <span className="font-mono text-xs">{formatCurrency(totals.total, formHeader.currency)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {formHeader.has_alternatives && (
                        <div className="text-[10px] text-slate-500 italic mt-1 text-right">
                          * Valores unitarios por alternativa independiente.
                        </div>
                      )}
                    </div>

                    {/* Pago, Plazo, Requisitos */}
                    <div className="grid grid-cols-2 gap-4 text-[10px]">
                      <div className="space-y-1 bg-slate-50/50 dark:bg-slate-950/20 p-2.5 rounded-lg border">
                        <span className="font-bold text-slate-550 block">2. Condiciones de Pago:</span>
                        <p className="text-slate-600 dark:text-slate-400 leading-tight font-medium">{formHeader.payment_terms}</p>
                      </div>
                      <div className="space-y-1 bg-slate-50/50 dark:bg-slate-955/20 p-2.5 rounded-lg border">
                        <span className="font-bold text-slate-550 block">3. Plazo de Trabajo y Requisitos:</span>
                        <p className="text-slate-600 dark:text-slate-400 leading-tight">Plazo: {formHeader.work_timeline}</p>
                        <p className="text-slate-500 dark:text-slate-500 mt-1 leading-tight text-[9px] whitespace-pre-line">{formHeader.start_conditions}</p>
                      </div>
                    </div>

                    {/* Firmas en Resumen Ejecutivo */}
                    {formHeader.show_signatures && (
                      <div className="pt-4 flex justify-between text-[9px] text-slate-455 text-center">
                        <div className="w-40 border-t pt-2">
                          <span className="font-bold text-slate-755 dark:text-slate-300 block">{companySettings.representative_name || 'Javier Román González'}</span>
                          <span>Representante Noveli Editorial</span>
                        </div>
                        <div className="w-40 border-t pt-2">
                          <span className="font-bold text-slate-755 dark:text-slate-300 block">Aceptación de Propuesta</span>
                          <span>{formHeader.author_name || 'Firma Autor / Cliente'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="text-center text-[9px] text-slate-400 border-t pt-3 font-semibold">
                    {companySettings.default_footer_text || 'Los derechos de la obra pertenecen siempre al autor.'}
                  </div>
                </div>
              ) : (
                /* DETAILED FORMAT: PAGE 1 + PAGE 2 */
                <>
                  {/* PAGE 1: DETAILED OBJETO & INCLUSIONES */}
                  <div className={`bg-white dark:bg-slate-900 shadow-md rounded-xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between ${formHeader.pdf_compact === false ? 'p-8 space-y-6 min-h-[842px] text-xs' : 'p-5 space-y-3.5 min-h-[680px] text-[11px]'}`}>
                    <div className={formHeader.pdf_compact === false ? 'space-y-6' : 'space-y-3.5'}>
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
                        <div className="p-3 bg-slate-50/50 dark:bg-slate-955/10">
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
                        <div className="space-y-1 bg-slate-50/20 p-3 rounded-xl border border-slate-100/50 dark:border-slate-800/40">
                          {includedItems.length === 0 ? (
                            <p className="text-slate-400 italic">No se han seleccionado conceptos de inclusión.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-600 dark:text-slate-350">
                              {includedItems.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-1">
                                  <span className="text-indigo-500 font-bold">•</span>
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Page 1 Footer */}
                    <div className="text-center text-[9px] text-slate-400 border-t pt-3 font-semibold">
                      {companySettings.default_footer_text || 'Los derechos de la obra pertenecen siempre al autor.'}
                    </div>
                  </div>

                  {/* PAGE 2: VALORES, FORMAS DE PAGO & EXCLUSIONES */}
                  <div className={`bg-white dark:bg-slate-900 shadow-md rounded-xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between ${formHeader.pdf_compact === false ? 'p-8 space-y-6 min-h-[842px] text-xs' : 'p-5 space-y-3.5 min-h-[680px] text-[11px]'}`}>
                    <div className={formHeader.pdf_compact === false ? 'space-y-6' : 'space-y-3.5'}>
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
                                <th className="p-2 w-20 text-right">{formHeader.iva_mode === 'Exento / sin IVA' ? 'IVA (Exento)' : 'IVA 19%'}</th>
                                <th className="p-2 w-24 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {formItems.map(item => {
                                const total = item.unit_price * item.quantity;
                                let net = 0;
                                let vat = 0;
                                if (formHeader.iva_mode === 'IVA incluido') {
                                  net = Math.round(total / 1.19);
                                  vat = total - net;
                                } else if (formHeader.iva_mode === '+ IVA') {
                                  net = total;
                                  vat = Math.round(net * 0.19);
                                } else {
                                  net = total;
                                  vat = 0;
                                }
                                return (
                                  <tr key={item.id} className="border-b border-slate-50 dark:border-slate-850">
                                    <td className="p-2 font-bold">{item.concept}</td>
                                    <td className="p-2 text-center">{item.quantity}</td>
                                    <td className="p-2 text-right font-mono">{formatCurrency(net, formHeader.currency)}</td>
                                    <td className="p-2 text-right font-mono">{formHeader.iva_mode === 'Exento / sin IVA' ? 'Exento' : formatCurrency(vat, formHeader.currency)}</td>
                                    <td className="p-2 text-right font-mono font-bold text-slate-700 dark:text-slate-355">{formatCurrency(formHeader.iva_mode === '+ IVA' ? (net + vat) : total, formHeader.currency)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Totals Block */}
                        {!formHeader.has_alternatives && (
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
                        )}
                        {formHeader.has_alternatives && (
                          <div className="text-[10px] text-slate-500 italic mt-1 text-right">
                            * Valores unitarios por alternativa independiente.
                          </div>
                        )}
                      </div>

                      {/* Forma de Pago Table */}
                      <div className="space-y-2">
                        <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b pb-1">4. Forma de Pago</h5>
                        <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="bg-slate-55 dark:bg-slate-950 font-bold uppercase text-[9px] text-slate-455 border-b border-slate-100 dark:border-slate-800">
                                <th className="p-2">Alternativa</th>
                                <th className="p-2 w-28 text-right">Total</th>
                                <th className="p-2 w-20 text-center">% Anticipo</th>
                                <th className="p-2 w-48">Tipo / condición de pago</th>
                              </tr>
                            </thead>
                            <tbody>
                              {formHeader.has_alternatives ? (
                                formItems.map(item => {
                                  const itemTotal = item.unit_price * item.quantity;
                                  const finalItemTotal = formHeader.iva_mode === '+ IVA' ? Math.round(itemTotal * 1.19) : itemTotal;
                                  return (
                                    <tr key={item.id} className="border-b border-slate-50 dark:border-slate-850">
                                      <td className="p-2 font-bold">{item.concept}</td>
                                      <td className="p-2 text-right font-mono">{formatCurrency(finalItemTotal, formHeader.currency)}</td>
                                      <td className="p-2 text-center">{paymentAdvancePct}%</td>
                                      <td className="p-2 text-slate-500 leading-tight">
                                        {paymentType === '100_inicio' ? '100% al inicio' :
                                         paymentType === '50_inicio_50_termino' ? '50% inicio / 50% término' :
                                         paymentType === '50_inicio_50_entrega' ? '50% inicio / 50% contra entrega' :
                                         paymentType === 'cuotas' ? `${paymentAdvancePct}% anticipo, saldo en ${paymentInstallments} cuotas` :
                                         formHeader.payment_terms}
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr className="border-b border-slate-50 dark:border-slate-850">
                                  <td className="p-2 font-bold">Propuesta Sugerida</td>
                                  <td className="p-2 text-right font-mono font-bold text-indigo-650 dark:text-indigo-400">{formatCurrency(totals.total, formHeader.currency)}</td>
                                  <td className="p-2 text-center font-bold">{paymentAdvancePct}%</td>
                                  <td className="p-2 text-slate-500 leading-tight">{formHeader.payment_terms}</td>
                                </tr>
                              )}
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
                          <div className="space-y-1 bg-slate-50/50 dark:bg-slate-955/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                            <span className="font-bold text-slate-550 block">Qué NO incluye:</span>
                            <div className="space-y-1 text-slate-600 dark:text-slate-400 leading-relaxed max-h-32 overflow-y-auto">
                              {excludedItems.map((e, idx) => (
                                <div key={idx} className="flex items-start gap-1">
                                  <span>•</span>
                                  <span>{e}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1 bg-slate-50/50 dark:bg-slate-955/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                            <span className="font-bold text-slate-550 block">Requisitos para iniciar:</span>
                            <div className="text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                              {formHeader.start_conditions}
                            </div>
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
                      {formHeader.show_signatures && (
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
                      )}
                    </div>

                    {/* Page 2 Footer */}
                    <div className="text-center text-[9px] text-slate-400 border-t pt-3 font-semibold">
                      {companySettings.default_footer_text || 'Los derechos de la obra pertenecen siempre al autor.'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky bottom-0 z-10">
          <div>
            {formItems.length > 0 && (
              <div className="flex gap-2">
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
                <button
                  type="button"
                  onClick={() => handleDownloadPDF({
                    ...formHeader,
                    subtotal: totals.subtotal,
                    total: totals.total
                  }, true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-medium flex items-center gap-1 cursor-pointer"
                  title="Descarga la propuesta omitiendo el logo en caso de errores de formato"
                >
                  <span>Descargar sin logo</span>
                </button>
              </div>
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
