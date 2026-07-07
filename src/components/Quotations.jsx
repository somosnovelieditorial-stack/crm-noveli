import { useEffect, useState } from 'react';
import { supabase, getValidOrgId, isMock } from '../supabaseClient';
import { formatCurrency, calculateVatSplit, formatDate } from '../utils';
import { jsPDF } from 'jspdf';
import { normalizeUuid, normalizeNumber, normalizeDate, normalizeArray } from '../utils/normalize';
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

const parseBulletsToList = (text) => {
  if (!text) return [];
  return text
    .split('\n')
    .map(line => line.replace(/^[•\-\*\d\.\s]+/g, '').trim())
    .filter(line => line.length > 0);
};

const parsePaymentTerms = (terms) => {
  const t = String(terms || '').trim();
  const lower = t.toLowerCase();
  if (lower === 'pago del 100% al inicio del servicio.' || lower === '100% al inicio') {
    return { type: '100_inicio', pct: 100, installments: 1, customText: '' };
  }
  if (lower === '50% al inicio y 50% al término del servicio.' || lower === '50% de anticipo al inicio y 50% al término del servicio.') {
    return { type: '50_inicio_50_termino', pct: 50, installments: 2, customText: '' };
  }
  if (lower === '50% al inicio y 50% contra entrega de archivos finales.' || lower === '50% de anticipo al inicio y 50% contra entrega de archivos finales.') {
    return { type: '50_inicio_50_entrega', pct: 50, installments: 2, customText: '' };
  }
  if (lower.includes('cuotas')) {
    const matchCuotas = lower.match(/(\d+)\s+cuotas/);
    const matchPct = lower.match(/(\d+)%\s+de\s+anticipo/);
    return {
      type: 'cuotas',
      pct: matchPct ? parseInt(matchPct[1], 10) : 50,
      installments: matchCuotas ? parseInt(matchCuotas[1], 10) : 3,
      customText: ''
    };
  }
  return { type: 'personalizado', pct: 50, installments: 3, customText: terms };
};

const parseStartConditions = (text) => {
  const t = String(text || '').toLowerCase();
  return {
    aceptacion: t.includes('aceptación') || t.includes('aceptacion'),
    firma: t.includes('firma') || t.includes('contrato') || t.includes('orden'),
    pago: t.includes('pago') || t.includes('anticipo'),
    manuscrito: t.includes('manuscrito') || t.includes('definitivo'),
    materiales: t.includes('portada') || t.includes('materiales') || t.includes('archivos'),
    datos: t.includes('datos') || t.includes('confirmación') || t.includes('confirmacion')
  };
};

const formatStartConditions = (checkedOptions) => {
  const optionsMap = {
    aceptacion: 'Aceptación formal de la propuesta',
    firma: 'Firma de contrato u orden de trabajo',
    pago: 'Pago inicial correspondiente',
    manuscrito: 'Recepción completa del manuscrito',
    materiales: 'Recepción de portada o archivos necesarios',
    datos: 'Confirmación de datos del autor'
  };
  const selected = Object.keys(checkedOptions)
    .filter(k => checkedOptions[k])
    .map(k => optionsMap[k]);
  
  if (selected.length === 0) return 'Aceptación formal.';
  return selected.join(', ') + '.';
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

  const [paymentType, setPaymentType] = useState('50_inicio_50_entrega');
  const [paymentAdvancePct, setPaymentAdvancePct] = useState(50);
  const [paymentInstallments, setPaymentInstallments] = useState(3);
  const [paymentCustomText, setPaymentCustomText] = useState('');
  const [isPaymentTermsEditedManually, setIsPaymentTermsEditedManually] = useState(false);

  const [includedItems, setIncludedItems] = useState([]);
  const [excludedItems, setExcludedItems] = useState([]);
  const [packItems, setPackItems] = useState([]);
  const [manualIncludeText, setManualIncludeText] = useState('');
  const [manualExcludeText, setManualExcludeText] = useState('');
  
  const [startRequirements, setStartRequirements] = useState({
    aceptacion: true,
    firma: true,
    pago: true,
    manuscrito: true,
    materiales: false,
    datos: false
  });

  const updateIncludesExcludesNotes = (newInc, newExc) => {
    setFormHeader(prev => ({
      ...prev,
      includes_notes: newInc.map(i => `• ${i}`).join('\n'),
      excludes_notes: newExc.map(e => `• ${e}`).join('\n')
    }));
  };

  const handleAddInclude = (item) => {
    if (!item) return;
    const trimmed = item.trim();
    if (!trimmed || includedItems.includes(trimmed) || excludedItems.includes(trimmed)) return;
    const newInc = [...includedItems, trimmed];
    setIncludedItems(newInc);
    updateIncludesExcludesNotes(newInc, excludedItems);
  };

  const handleRemoveInclude = (index) => {
    const newInc = includedItems.filter((_, idx) => idx !== index);
    setIncludedItems(newInc);
    updateIncludesExcludesNotes(newInc, excludedItems);
  };

  const handleAddExclude = (item) => {
    if (!item) return;
    const trimmed = item.trim();
    if (!trimmed || excludedItems.includes(trimmed) || includedItems.includes(trimmed)) return;
    const newExc = [...excludedItems, trimmed];
    setExcludedItems(newExc);
    updateIncludesExcludesNotes(includedItems, newExc);
  };

  const handleRemoveExclude = (index) => {
    const newExc = excludedItems.filter((_, idx) => idx !== index);
    setExcludedItems(newExc);
    updateIncludesExcludesNotes(includedItems, newExc);
  };

  const getSuggestedInclusions = () => {
    const list = new Set([
      'Revisión general del manuscrito',
      'Corrección ortográfica y de estilo',
      'Maquetación interior para libro físico',
      'Maquetación Ebook',
      'Conversión y preparación Ebook',
      'Adaptación técnica de portada',
      'Diseño de portada desde cero',
      'Gestión de registro de derechos de autor',
      'ISBN y código de barras',
      'Asesoría de autopublicación',
      'Acompañamiento editorial',
      'Entrega de archivos finales digitales',
      'Revisión técnica de archivos'
    ]);
    catalog.forEach(s => {
      if (s.includes_text) {
        parseBulletsToList(s.includes_text).forEach(item => list.add(item));
      }
    });
    packs.forEach(p => {
      if (p.includes_text) {
        parseBulletsToList(p.includes_text).forEach(item => list.add(item));
      }
    });
    return Array.from(list).filter(item => !includedItems.includes(item) && !excludedItems.includes(item));
  };

  const getSuggestedExclusions = () => {
    const list = new Set([
      'Impresión física de ejemplares',
      'Costos de despacho',
      'Publicidad editorial pagada',
      'Campañas en redes sociales',
      'Distribución comercial en librerías',
      'Comercialización directa del libro',
      'Administración de ventas del autor',
      'Cambios extraordinarios fuera del alcance inicial',
      'Nuevas versiones no contempladas',
      'Correcciones posteriores a la aprobación final',
      'Trámites legales no indicados expresamente'
    ]);
    catalog.forEach(s => {
      if (s.excludes_text) {
        parseBulletsToList(s.excludes_text).forEach(item => list.add(item));
      }
    });
    packs.forEach(p => {
      if (p.excludes_text) {
        parseBulletsToList(p.excludes_text).forEach(item => list.add(item));
      }
    });
    return Array.from(list).filter(item => !includedItems.includes(item) && !excludedItems.includes(item));
  };

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
    notes: '',
    pdf_compact: true
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
      const [catalogRes, packsRes, packItemsRes] = await Promise.all([
        supabase.from('service_catalog').select('*').eq('organization_id', orgId).eq('active', true),
        supabase.from('service_packs').select('*').eq('organization_id', orgId).eq('active', true),
        supabase.from('service_pack_items').select('*, service_catalog(*)').eq('organization_id', orgId)
      ]);
      if (catalogRes.error) throw catalogRes.error;
      if (packsRes.error) throw packsRes.error;
      if (packItemsRes.error) throw packItemsRes.error;
      setCatalog(catalogRes.data || []);
      setPacks(packsRes.data || []);
      setPackItems(packItemsRes.data || []);
    } catch (err) {
      console.error('Error loading catalog/packs/pack-items:', err);
    }
  };

  const handleOpenAddModal = () => {
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setSelectedQuotation(null);
    setPaymentType('50_inicio_50_entrega');
    setPaymentAdvancePct(50);
    setPaymentInstallments(3);
    setPaymentCustomText('');
    setIsPaymentTermsEditedManually(false);
    
    setIncludedItems([
      'Reuniones de seguimiento editorial y asesoría continua',
      'Entrega de archivos finales en formato digital listos para imprenta/distribución'
    ]);
    setExcludedItems([
      'Costos de impresión física de ejemplares',
      'Trámites legales de depósito legal fuera del territorio nacional'
    ]);

    setStartRequirements({
      aceptacion: true,
      firma: true,
      pago: true,
      manuscrito: true,
      materiales: false,
      datos: false
    });
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
      iva_mode: 'IVA incluido',
      tax_rate: 19,
      net_amount: 0,
      payment_plan_type: '50_inicio_50_entrega',
      upfront_percentage: 50,
      installments: 3,
      proposal_format: 'Formal completo',
      show_signatures: true,
      has_alternatives: false,
      payment_terms: '50% al inicio y 50% contra entrega de archivos finales.',
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
    const parsedPayment = parsePaymentTerms(quote.payment_terms || '');
    setPaymentType(quote.payment_plan_type || parsedPayment.type);
    setPaymentAdvancePct(quote.upfront_percentage !== undefined ? quote.upfront_percentage : parsedPayment.pct);
    setPaymentInstallments(quote.installments || parsedPayment.installments);
    setPaymentCustomText(quote.payment_plan_type === 'personalizado' ? quote.payment_terms : parsedPayment.customText);
    setIsPaymentTermsEditedManually(true); // lock auto-regeneration of payment terms unless they change options

    const inc = quote.included_items && Array.isArray(quote.included_items)
      ? quote.included_items
      : parseBulletsToList(quote.includes_notes || '');
    const exc = quote.excluded_items && Array.isArray(quote.excluded_items)
      ? quote.excluded_items
      : parseBulletsToList(quote.excludes_notes || '');
    setIncludedItems(inc);
    setExcludedItems(exc);

    const reqs = quote.start_condition_items && Array.isArray(quote.start_condition_items)
      ? quote.start_condition_items
      : parseBulletsToList(quote.start_conditions || '');
    const parsedRequirements = {
      aceptacion: reqs.some(r => r.toLowerCase().includes('aceptación') || r.toLowerCase().includes('aceptacion') || r.toLowerCase().includes('propuesta')),
      firma: reqs.some(r => r.toLowerCase().includes('firma') || r.toLowerCase().includes('contrato')),
      pago: reqs.some(r => r.toLowerCase().includes('pago') || r.toLowerCase().includes('anticipo') || r.toLowerCase().includes('inicial')),
      manuscrito: reqs.some(r => r.toLowerCase().includes('manuscrito') || r.toLowerCase().includes('recepción manuscrito')),
      materiales: reqs.some(r => r.toLowerCase().includes('materiales') || r.toLowerCase().includes('portada') || r.toLowerCase().includes('archivos') || r.toLowerCase().includes('definitivo')),
      datos: reqs.some(r => r.toLowerCase().includes('datos') || r.toLowerCase().includes('confirmación') || r.toLowerCase().includes('confirmacion') || r.toLowerCase().includes('autor'))
    };
    setStartRequirements(parsedRequirements);

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
      iva_mode: quote.iva_mode || (quote.includes_iva ? 'IVA incluido' : 'Exento / sin IVA'),
      tax_rate: quote.tax_rate !== undefined ? quote.tax_rate : 19,
      net_amount: quote.net_amount !== undefined ? quote.net_amount : (quote.includes_iva ? Math.round((quote.total || 0) / 1.19) : (quote.total || 0)),
      payment_plan_type: quote.payment_plan_type || parsedPayment.type,
      upfront_percentage: quote.upfront_percentage !== undefined ? quote.upfront_percentage : parsedPayment.pct,
      installments: quote.installments || parsedPayment.installments,
      proposal_format: quote.proposal_format || 'Formal completo',
      show_signatures: quote.show_signatures !== undefined ? quote.show_signatures : true,
      has_alternatives: quote.has_alternatives !== undefined ? quote.has_alternatives : (quote.proposal_format === 'Con alternativas'),
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
      const normalizedQuoteId = normalizeUuid(quote.id);
      if (!normalizedQuoteId) {
        setFormItems([]);
        return;
      }
      const { data, error } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', normalizedQuoteId)
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
      const normalizedId = normalizeUuid(id);
      if (!normalizedId) throw new Error("ID de propuesta no válido.");
      const { error } = await supabase.from('quotations').delete().eq('id', normalizedId);
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

  const handleFormItemsChange = (newItems) => {
    setFormItems(newItems);
    if (newItems.length === 0) return;

    const inclusions = new Set(includedItems);
    const exclusions = new Set(excludedItems);
    let maxPlazoWeeks = 0;
    
    const reqs = { ...startRequirements };
    let suggestedPayment = paymentType;
    let customTimeline = null;
    let customPayment = null;

    newItems.forEach(item => {
      if (item.pack_id) {
        const p = packs.find(pk => pk.id === item.pack_id);
        if (p) {
          if (p.includes_text) {
            parseBulletsToList(p.includes_text).forEach(i => inclusions.add(i));
          } else {
            inclusions.add('Corrección de estilo y ortotipográfica del manuscrito.');
            inclusions.add('Diseño y maquetación interior para formato digital y papel.');
            inclusions.add('Diseño de portada, contraportada y lomo personalizado.');
            inclusions.add('Asesoría en distribución en Amazon e IngramSpark.');
          }

          if (p.excludes_text) {
            parseBulletsToList(p.excludes_text).forEach(e => exclusions.add(e));
          } else {
            exclusions.add('Costos de impresión física de ejemplares.');
            exclusions.add('Campañas publicitarias pagadas.');
          }

          if (p.default_work_timeline) {
            customTimeline = p.default_work_timeline;
          } else {
            maxPlazoWeeks = Math.max(maxPlazoWeeks, 10);
          }

          if (p.default_payment_terms) {
            customPayment = p.default_payment_terms;
          } else {
            suggestedPayment = '50_inicio_50_entrega';
          }

          if (p.default_start_conditions) {
            const parsed = parseStartConditions(p.default_start_conditions);
            Object.keys(parsed).forEach(k => { if (parsed[k]) reqs[k] = true; });
          } else {
            reqs.pago = true;
            reqs.manuscrito = true;
            reqs.firma = true;
          }
        }
      } else if (item.catalog_id) {
        const s = catalog.find(c => c.id === item.catalog_id);
        if (s) {
          if (s.includes_text) {
            parseBulletsToList(s.includes_text).forEach(i => inclusions.add(i));
          }
          if (s.excludes_text) {
            parseBulletsToList(s.excludes_text).forEach(e => exclusions.add(e));
          }
          if (s.default_work_timeline) {
            customTimeline = s.default_work_timeline;
          }
          if (s.default_payment_terms) {
            customPayment = s.default_payment_terms;
          }
          if (s.default_start_conditions) {
            const parsed = parseStartConditions(s.default_start_conditions);
            Object.keys(parsed).forEach(k => { if (parsed[k]) reqs[k] = true; });
          }

          if (!s.includes_text || !s.excludes_text) {
            const category = String(s.category || '').toLowerCase();
            const name = String(s.name || '').toLowerCase();

            if (category.includes('corrección') || name.includes('corrección') || name.includes('estilo')) {
              if (!s.includes_text) inclusions.add('Corrección de estilo y ortotipográfica del manuscrito.');
              if (!s.excludes_text) {
                exclusions.add('Maquetación de páginas interiores.');
                exclusions.add('Diseño de portada.');
              }
              if (!s.default_work_timeline) maxPlazoWeeks = Math.max(maxPlazoWeeks, 4);
              reqs.manuscrito = true;
              reqs.pago = true;
            } else if (category.includes('maquetación') || name.includes('maquetación') || name.includes('interior')) {
              if (!s.includes_text) inclusions.add('Diseño y maquetación interior para formato digital y papel.');
              if (!s.excludes_text) {
                exclusions.add('Corrección de textos.');
                exclusions.add('Diseño de portada.');
              }
              if (!s.default_work_timeline) maxPlazoWeeks = Math.max(maxPlazoWeeks, 3);
              reqs.manuscrito = true;
              reqs.pago = true;
            } else if (category.includes('diseño') || name.includes('portada') || name.includes('diseño')) {
              if (!s.includes_text) inclusions.add('Diseño de portada, contraportada y lomo personalizado.');
              if (!s.excludes_text) {
                exclusions.add('Corrección de textos.');
                exclusions.add('Maquetación de páginas interiores.');
              }
              if (!s.default_work_timeline) maxPlazoWeeks = Math.max(maxPlazoWeeks, 2);
              reqs.materiales = true;
              reqs.pago = true;
            } else if (category.includes('legal') || name.includes('derecho') || name.includes('isbn')) {
              if (!s.includes_text) inclusions.add('Tramitación de código ISBN y registro de propiedad intelectual.');
              if (!s.excludes_text) exclusions.add('Pago de tasas especiales fuera de lo contemplado.');
              if (!s.default_work_timeline) maxPlazoWeeks = Math.max(maxPlazoWeeks, 2);
              reqs.datos = true;
            } else if (category.includes('publicidad') || name.includes('difusión') || name.includes('marketing')) {
              if (!s.includes_text) inclusions.add('Promoción en canales de la editorial y diseño de kit de prensa.');
              if (!s.excludes_text) exclusions.add('Contratación de publicidad pagada o anuncios digitales.');
              if (!s.default_work_timeline) maxPlazoWeeks = Math.max(maxPlazoWeeks, 3);
              reqs.materiales = true;
            } else {
              if (!s.includes_text) inclusions.add(`Servicio de ${s.name} según requerimientos del autor.`);
              if (!s.excludes_text) exclusions.add('Servicios adicionales no especificados en esta propuesta.');
              if (!s.default_work_timeline) maxPlazoWeeks = Math.max(maxPlazoWeeks, 2);
            }
          }
        }
      }
    });

    const newInc = Array.from(inclusions);
    const newExc = Array.from(exclusions);
    setIncludedItems(newInc);
    setExcludedItems(newExc);

    const incText = newInc.map(i => `• ${i}`).join('\n');
    const excText = newExc.map(e => `• ${e}`).join('\n');
    const weeksText = customTimeline || (maxPlazoWeeks > 0 ? `${maxPlazoWeeks - 1} a ${maxPlazoWeeks + 1} semanas desde la entrega completa de materiales.` : 'A convenir.');

    setFormHeader(prev => ({
      ...prev,
      includes_notes: incText,
      excludes_notes: excText,
      work_timeline: weeksText,
      payment_terms: customPayment || prev.payment_terms
    }));

    setStartRequirements(prev => ({
      ...prev,
      ...reqs
    }));
    
    if (customPayment) {
      const parsed = parsePaymentTerms(customPayment);
      setPaymentType(parsed.type);
      setPaymentAdvancePct(parsed.pct);
      setPaymentInstallments(parsed.installments);
      setPaymentCustomText(parsed.customText);
    } else {
      setPaymentType(suggestedPayment);
    }
  };

  const handleAddCatalogItem = () => {
    if (!selectedServiceId) return;
    const service = catalog.find(c => c.id === selectedServiceId);
    if (!service) return;

    const newItems = [...formItems, {
      id: `service-${Date.now()}`,
      catalog_id: service.id,
      pack_id: null,
      concept: service.name || service.title,
      description: service.description || '',
      unit_price: Number(service.price_from || service.base_price) || 0,
      quantity: 1,
      source_type: 'catalog'
    }];
    handleFormItemsChange(newItems);
    setSelectedServiceId('');
  };

  const handleAddPackItem = () => {
    if (!selectedPackId) return;
    const pack = packs.find(p => p.id === selectedPackId);
    if (!pack) return;

    const newItems = [...formItems, {
      id: `pack-${Date.now()}`,
      catalog_id: null,
      pack_id: pack.id,
      concept: pack.name,
      description: pack.description || '',
      unit_price: Number(pack.price_special) || 0,
      quantity: 1,
      source_type: 'pack'
    }];
    handleFormItemsChange(newItems);
    setSelectedPackId('');
  };

  const handleAddManualItem = () => {
    const newItems = [...formItems, {
      id: `manual-${Date.now()}`,
      catalog_id: null,
      pack_id: null,
      concept: 'Concepto Personalizado',
      description: '',
      unit_price: 0,
      quantity: 1,
      source_type: 'manual'
    }];
    handleFormItemsChange(newItems);
  };

  const handleUpdateItemField = (itemId, field, value) => {
    const newItems = formItems.map(item => {
      if (item.id === itemId) return { ...item, [field]: value };
      return item;
    });
    setFormItems(newItems);
  };

  const handleRemoveItem = (itemId) => {
    const newItems = formItems.filter(item => item.id !== itemId);
    handleFormItemsChange(newItems);
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

  useEffect(() => {
    if (isPaymentTermsEditedManually) return;
    let text = '';
    const total = getTotals().total;
    if (paymentType === '100_inicio') {
      text = 'Pago del 100% al inicio del servicio.';
    } else if (paymentType === '50_inicio_50_termino') {
      text = '50% al inicio y 50% al término del servicio.';
    } else if (paymentType === '50_inicio_50_entrega') {
      text = '50% al inicio y 50% contra entrega de archivos finales.';
    } else if (paymentType === 'cuotas') {
      const advanceAmt = Math.round(total * (paymentAdvancePct / 100));
      const remainingAmt = total - advanceAmt;
      const installmentAmt = paymentInstallments > 0 ? Math.round(remainingAmt / paymentInstallments) : 0;
      text = `${paymentAdvancePct}% de anticipo al inicio (${formatCurrency(advanceAmt, formHeader.currency)}) y el saldo en ${paymentInstallments} cuotas de ${formatCurrency(installmentAmt, formHeader.currency)}.`;
    } else if (paymentType === 'personalizado') {
      text = paymentCustomText;
    }
    setFormHeader(prev => {
      if (prev.payment_terms !== text) {
        return { ...prev, payment_terms: text };
      }
      return prev;
    });
  }, [paymentType, paymentAdvancePct, paymentInstallments, paymentCustomText, formItems, formHeader.discount, formHeader.extension_adjustment_value, formHeader.extension_adjustment_type, formHeader.iva_mode, formHeader.tax_rate, formHeader.currency, isPaymentTermsEditedManually]);

  useEffect(() => {
    const text = formatStartConditions(startRequirements);
    setFormHeader(prev => {
      if (prev.start_conditions !== text) {
        return { ...prev, start_conditions: text };
      }
      return prev;
    });
  }, [startRequirements]);

  const performSaveQuotation = async () => {
    if (formItems.length === 0) {
      throw new Error('Debe agregar al menos un servicio o ítem.');
    }
    if (!formHeader.author_name.trim()) {
      throw new Error('El nombre del autor o destinatario es requerido.');
    }

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
      accepted_at: formHeader.status === 'aceptada' ? new Date().toISOString() : normalizeTimestamp(selectedQuotation?.accepted_at),
      rejected_at: formHeader.status === 'rechazada' ? new Date().toISOString() : normalizeTimestamp(selectedQuotation?.rejected_at),
      sent_at: normalizeTimestamp(selectedQuotation?.sent_at),
      converted_at: normalizeTimestamp(selectedQuotation?.converted_at),
      
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

    const cleanPayload = {
      ...payload,
      organization_id: normalizeUuid(payload.organization_id) || orgId,
      client_id: normalizeUuid(formHeader.client_id),
      prospect_id: normalizeUuid(formHeader.prospect_id),
      service_id: normalizeUuid(formHeader.service_id),
      converted_prospect_id: normalizeUuid(formHeader.converted_prospect_id),
      converted_client_id: normalizeUuid(formHeader.converted_client_id)
    };

    console.log("payload limpio PDF", cleanPayload);

    let quoteId = '';
    let savedData = null;
    if (selectedQuotation) {
      quoteId = normalizeUuid(selectedQuotation.id);
      if (!quoteId) {
        throw new Error("ID de propuesta inválido para actualización.");
      }
      const { error } = await supabase.from('quotations').update(cleanPayload).eq('id', quoteId);
      if (error) throw error;

      // Delete and replace items
      await supabase.from('quotation_items').delete().eq('quotation_id', quoteId);
      savedData = { ...cleanPayload, id: quoteId };
    } else {
      const { data, error } = await supabase.from('quotations').insert([cleanPayload]).select().single();
      if (error) throw error;
      quoteId = normalizeUuid(data.id);
      savedData = data;
    }

    const itemsPayload = formItems.map((item, index) => ({
      organization_id: orgId,
      quotation_id: quoteId,
      catalog_id: normalizeUuid(item.catalog_id),
      pack_id: normalizeUuid(item.pack_id),
      concept: item.concept,
      description: item.description,
      unit_price: Number(item.unit_price) || 0,
      quantity: Number(item.quantity) || 0,
      total: (Number(item.unit_price) || 0) * (Number(item.quantity) || 0),
      source_type: item.source_type,
      display_order: index
    }));

    const cleanItems = itemsPayload;
    console.log("items limpios PDF", cleanItems);

    const { error: itemsErr } = await supabase.from('quotation_items').insert(itemsPayload);
    if (itemsErr) throw itemsErr;

    setSelectedQuotation(savedData);
    setFormHeader(prev => ({ ...prev, id: quoteId }));

    return savedData;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setFormError('');

    try {
      await performSaveQuotation();
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

  const handleDownloadPDFClick = async (forceNoLogo = false) => {
    setFormError('');
    setIsSubmitting(true);
    try {
      const savedQuote = await performSaveQuotation();
      fetchQuotations();
      await handleDownloadPDF(savedQuote, forceNoLogo);
    } catch (err) {
      console.error("Error al guardar borrador previo a PDF:", err);
      setFormError(err.message || 'Error al guardar borrador previo a la descarga.');
      alert('No se pudo guardar la propuesta antes de descargar el PDF: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const convertToProspect = async (quote) => {
    if (!window.confirm(`¿Convertir propuesta ${quote.quote_number} a Prospecto?`)) return;
    try {
      const orgId = await getValidOrgId();

      // Retrieve items to serialize services
      const normalizedQuoteId = normalizeUuid(quote.id);
      if (!normalizedQuoteId) throw new Error("ID de propuesta no válido.");
      const { data: items, error: itemsErr } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', normalizedQuoteId);

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
        .eq('id', normalizedQuoteId);

      if (quoteUpdateErr) throw quoteUpdateErr;

      alert(`¡Convertido a Prospecto exitosamente! Nombre: ${newProspect.name}`);
      fetchQuotations();
    } catch (err) {
      console.error('Error converting to prospect:', err);
      alert('Error en la conversión: ' + err.message);
    }
  };

  const handleDownloadPDF = async (quote, forceNoLogo = false) => {
    try {
      const safeQuote = quote || {};
      const safeCompanySettings = companySettings || {};
      const proposal = safeQuote;
      const safeProposalData = safeQuote;
      console.log("proposal id para PDF", proposal?.id);
      console.log("Datos enviados al PDF", safeProposalData);
      console.log("Logo usado en PDF", companySettings?.logo_url);

      const normalizedQuoteId = normalizeUuid(proposal?.id);

      let items = [];
      if (normalizedQuoteId) {
        const { data: rawItems, error: itemsErr } = await supabase
          .from('quotation_items')
          .select('*')
          .eq('quotation_id', normalizedQuoteId)
          .order('display_order', { ascending: true });

        if (itemsErr) throw itemsErr;
        items = rawItems || [];
      } else {
        items = formItems || [];
      }

      let logoImg = null;
      if (safeCompanySettings.logo_url && isPdfImageCompatible(safeCompanySettings.logo_url) && !forceNoLogo) {
        try {
          logoImg = await loadImage(safeCompanySettings.logo_url);
        } catch (err) {
          console.error("Error loading logo image for PDF:", err);
        }
      }

      const doc = new jsPDF();
      const primaryColor = [23, 37, 84]; // Deep Navy Blue
      const secondaryColor = [51, 65, 85]; // Slate-700

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

      // Brand Title or Logo (top-left)
      if (logoImg && !forceNoLogo) {
        try {
          const maxW_mm = isCompact ? 35 : 42;
          const maxH_mm = isCompact ? 12 : 16;
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
          nextY = 18 + imgH + (isCompact ? 2 : 4);
        } catch (logoErr) {
          console.error("Error drawing logo to PDF (falling back to text):", logoErr);
          logoImg = null; 
        }
      }

      if (!logoImg || forceNoLogo) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(isCompact ? 14 : 16);
        doc.setTextColor(...primaryColor);
        doc.text(String(safeCompanySettings.company_name || 'EDITORIAL NOVELI').toUpperCase(), lm, 25);
        nextY = isCompact ? 28 : 32;
      }

      let headerY = 23;
      if (logoImg && !forceNoLogo) {
        headerY = Math.max(23, 18 + imgH + (isCompact ? 3 : 5));
      } else {
        headerY = 25;
      }

      // Title Centred
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(titleFontSize);
      doc.setTextColor(...primaryColor);
      doc.text('PROPUESTA COMERCIAL PRELIMINAR', 105, headerY, { align: 'center' });

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(bodyFontSize);
      doc.setTextColor(100, 116, 139);
      doc.text(`Número: ${safeQuote.quote_number || 'S/N'}  |  Emisión: ${safeQuote.issue_date || ''}`, 105, headerY + 4.5, { align: 'center' });
      doc.text(`Validez: ${safeQuote.validity_days || 15} días corridos`, 105, headerY + 8.5, { align: 'center' });

      nextY = headerY + 13;

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
      doc.text(safeQuote.author_name || 'Nuevo Autor', lm + 24, tableY + (isCompact ? 5 : 6));
      doc.text(safeQuote.object || 'Proyecto Editorial', lm + 28, tableY + (isCompact ? 13 : 16), { maxWidth: (cw / 2) - 32 });
      doc.text(safeQuote.issue_date || '', lm + (cw / 2) + 28, tableY + (isCompact ? 5 : 6));
      doc.text('Propuesta Comercial', lm + (cw / 2) + 30, tableY + (isCompact ? 13 : 16));

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

        currentY += isCompact ? 15 : 22;

        // Sección 2: SERVICIOS INCLUIDOS (desglosado)
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
          let title = itemText;
          let desc = '';
          const colonIdx = itemText.indexOf(':');
          if (colonIdx > -1) {
            title = itemText.substring(0, colonIdx).trim();
            desc = itemText.substring(colonIdx + 1).trim();
          }

          const splitTitle = doc.splitTextToSize(`${idx + 1}. ${title}`, cw);
          const splitDesc = desc ? doc.splitTextToSize(desc, cw - 5) : [];
          const neededH = (splitTitle.length * (isCompact ? 3.5 : 4)) + (splitDesc.length * (isCompact ? 3 : 3.5)) + (isCompact ? 2 : 3);

          if (itemsY + neededH > (isCompact ? 275 : 265)) {
            doc.addPage();
            currentPage++;
            writeHeader(currentPage);
            itemsY = isCompact ? 20 : 25;
          }

          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(bodyFontSize);
          doc.setTextColor(30, 41, 59);
          doc.text(splitTitle, lm, itemsY);
          itemsY += splitTitle.length * (isCompact ? 3.5 : 4);

          if (desc) {
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(bodyFontSize - 0.5);
            doc.setTextColor(71, 85, 105);
            doc.text(splitDesc, lm + 5, itemsY);
            itemsY += splitDesc.length * (isCompact ? 3 : 3.5);
          }
          itemsY += isCompact ? 1.5 : 2.5;
        });

        currentY = itemsY + (isCompact ? 2 : 4);
      }

      // Sección 3: VALORES DEL SERVICIO
      const rowItems = [];
      let totalNetFromItems = 0;
      const ivaMode = safeQuote.iva_mode || (safeQuote.includes_iva ? 'IVA incluido' : 'Exento / sin IVA');
      const taxRate = Number(safeQuote.tax_rate) || 19;

      (items || []).forEach(item => {
        const itemNetTotal = Number(item.unit_price) * Number(item.quantity);
        let net = 0;
        let vat = 0;
        let rowTotal = 0;

        if (ivaMode === 'IVA incluido') {
          net = Math.round(itemNetTotal / (1 + taxRate / 100));
          vat = itemNetTotal - net;
          rowTotal = itemNetTotal;
        } else if (ivaMode === '+ IVA') {
          net = itemNetTotal;
          vat = Math.round(net * (taxRate / 100));
          rowTotal = net + vat;
        } else { 
          net = itemNetTotal;
          vat = 0;
          rowTotal = itemNetTotal;
        }

        totalNetFromItems += net;
        rowItems.push({
          concept: item.concept,
          quantity: item.quantity,
          net: net,
          vat: vat,
          total: rowTotal
        });
      });

      const adjustmentValue = Number(safeQuote.extension_adjustment_value) || 0;
      let netAdjustment = 0;
      let vatAdjustment = 0;
      let totalAdjustment = 0;

      if (adjustmentValue !== 0) {
        if (ivaMode === 'IVA incluido') {
          netAdjustment = Math.round(adjustmentValue / (1 + taxRate / 100));
          vatAdjustment = adjustmentValue - netAdjustment;
          totalAdjustment = adjustmentValue;
        } else if (ivaMode === '+ IVA') {
          netAdjustment = adjustmentValue;
          vatAdjustment = Math.round(netAdjustment * (taxRate / 100));
          totalAdjustment = netAdjustment + vatAdjustment;
        } else {
          netAdjustment = adjustmentValue;
          vatAdjustment = 0;
          totalAdjustment = adjustmentValue;
        }
      }

      const discountValue = Number(safeQuote.discount) || 0;
      let netDiscount = 0;
      let vatDiscount = 0;
      let totalDiscount = 0;

      if (discountValue !== 0) {
        if (ivaMode === 'IVA incluido') {
          netDiscount = Math.round(discountValue / (1 + taxRate / 100));
          vatDiscount = discountValue - netDiscount;
          totalDiscount = discountValue;
        } else if (ivaMode === '+ IVA') {
          netDiscount = discountValue;
          vatDiscount = Math.round(netDiscount * (taxRate / 100));
          totalDiscount = netDiscount + vatDiscount;
        } else {
          netDiscount = discountValue;
          vatDiscount = 0;
          totalDiscount = discountValue;
        }
      }

      const finalRows = [...rowItems];
      if (adjustmentValue !== 0) {
        finalRows.push({
          concept: `Ajuste por extensión (${safeQuote.manuscript_pages || 0} pág.)`,
          quantity: 1,
          net: netAdjustment,
          vat: vatAdjustment,
          total: totalAdjustment
        });
      }
      if (discountValue !== 0) {
        finalRows.push({
          concept: `Descuento aplicado`,
          quantity: 1,
          net: -netDiscount,
          vat: -vatDiscount,
          total: -totalDiscount
        });
      }

      const finalNetSum = totalNetFromItems + netAdjustment - netDiscount;
      const finalVatSum = rowItems.reduce((acc, r) => acc + r.vat, 0) + vatAdjustment - vatDiscount;
      const finalTotalSum = rowItems.reduce((acc, r) => acc + r.total, 0) + totalAdjustment - totalDiscount;

      checkPageBreak(25 + (finalRows.length * rowSpacing));
      
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
      doc.text(ivaMode === 'Exento / sin IVA' ? 'IVA (Exento)' : 'IVA 19%', lm + (cw - 45), tableValY + (isCompact ? 4.2 : 4.5));
      doc.text('Total', lm + (cw - 20), tableValY + (isCompact ? 4.2 : 4.5));

      let rowY = tableValY + (isCompact ? 6 : 7);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.setDrawColor(241, 245, 249);

      finalRows.forEach(row => {
        doc.line(lm, rowY + rowSpacing, rm, rowY + rowSpacing);
        doc.setFontSize(bodyFontSize);
        doc.text(String(row.concept).substring(0, isCompact ? 52 : 45), lm + 3, rowY + (isCompact ? 3.5 : 4));
        doc.text(String(row.quantity), lm + (cw - 82), rowY + (isCompact ? 3.5 : 4));
        doc.text(formatCurrency(row.net, safeQuote.currency), lm + (cw - 70), rowY + (isCompact ? 3.5 : 4));
        doc.text(ivaMode === 'Exento / sin IVA' && row.vat === 0 ? 'Exento' : formatCurrency(row.vat, safeQuote.currency), lm + (cw - 45), rowY + (isCompact ? 3.5 : 4));
        doc.text(formatCurrency(row.total, safeQuote.currency), lm + (cw - 20), rowY + (isCompact ? 3.5 : 4));
        rowY += rowSpacing;
      });

      if (!hasAlts) {
        doc.setFont('Helvetica', 'bold');
        doc.text('TOTAL GENERAL:', lm + (cw - 80), rowY + (isCompact ? 4.5 : 5));
        doc.text(formatCurrency(finalTotalSum, safeQuote.currency), lm + (cw - 20), rowY + (isCompact ? 4.5 : 5));
        rowY += isCompact ? 8 : 10;
      } else {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.text('* Valores unitarios por alternativa independiente.', lm + 3, rowY + (isCompact ? 4.5 : 5));
        rowY += isCompact ? 8 : 10;
      }

      currentY = rowY;

      // Sección 4: FORMA DE PAGO
      checkPageBreak(hasAlts ? 25 + (finalRows.length * rowSpacing) : 30);
      
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

      let upfrontPct = safeQuote.upfront_percentage !== undefined ? safeQuote.upfront_percentage : 50;
      if (safeQuote.payment_plan_type === '100_inicio') {
        upfrontPct = 100;
      }

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
          const displayTerms = safeQuote.payment_plan_type === '100_inicio' ? 'Pago del 100% al inicio del servicio.' :
                               safeQuote.payment_plan_type === '50_inicio_50_termino' ? '50% inicio / 50% término' :
                               safeQuote.payment_plan_type === '50_inicio_50_entrega' ? '50% inicio / 50% contra entrega' :
                               safeQuote.payment_plan_type === 'cuotas' ? `${upfrontPct}% anticipo, saldo en ${safeQuote.installments} cuotas` :
                               String(safeQuote.payment_terms || '').substring(0, 35);
          doc.text(displayTerms, lm + 100, pRowY + (isCompact ? 3.5 : 4));
          pRowY += rowSpacing;
        });
        currentY = pRowY + (isCompact ? 2 : 4);
      } else {
        doc.line(lm, payTableY + (isCompact ? 6 : 7) + (isCompact ? 8 : 10), rm, payTableY + (isCompact ? 6 : 7) + (isCompact ? 8 : 10));
        doc.setFontSize(bodyFontSize);
        doc.text('Propuesta Sugerida', lm + 3, payTableY + (isCompact ? 11 : 13));
        doc.text(formatCurrency(finalTotalSum, safeQuote.currency), lm + 40, payTableY + (isCompact ? 11 : 13));
        doc.text(`${upfrontPct}%`, lm + 77, payTableY + (isCompact ? 11 : 13));
        const displayTerms = safeQuote.payment_plan_type === '100_inicio' ? 'Pago del 100% al inicio del servicio.' :
                             safeQuote.payment_plan_type === '50_inicio_50_termino' ? '50% inicio / 50% término' :
                             safeQuote.payment_plan_type === '50_inicio_50_entrega' ? '50% inicio / 50% contra entrega' :
                             safeQuote.payment_plan_type === 'cuotas' ? `${upfrontPct}% anticipo, saldo en ${safeQuote.installments} cuotas` :
                             safeQuote.payment_terms || '';
        const splitPayTerms = doc.splitTextToSize(displayTerms, cw - 103);
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
        checkPageBreak(isCompact ? 22 : 30);
        
        const sigLineY = currentY + (isCompact ? 12 : 18);
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
            Creación y seguimiento de propuestas comerciales preliminares.
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
          No hay propuestas comerciales registradas.
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
                  <h4 className="font-bold text-xs text-indigo-655 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-850 pb-1.5">E. Totales y Formato</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Régimen IVA</label>
                      <select
                        value={formHeader.iva_mode || 'IVA incluido'}
                        onChange={(e) => setFormHeader({...formHeader, iva_mode: e.target.value, includes_iva: e.target.value === 'IVA incluido'})}
                        className="block w-full px-3 py-2 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                      >
                        <option value="IVA incluido">IVA incluido</option>
                        <option value="+ IVA">+ IVA (19%)</option>
                        <option value="Exento / sin IVA">Exento / sin IVA</option>
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
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Formato del Documento</label>
                      <select
                        value={formHeader.proposal_format || 'Formal completo'}
                        onChange={(e) => handleProposalFormatChange(e.target.value)}
                        className="block w-full px-3 py-2 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                      >
                        <option value="Formal completo">Formal completo</option>
                        <option value="Resumen ejecutivo">Resumen ejecutivo</option>
                        <option value="Con alternativas">Con alternativas de precio</option>
                        <option value="Una sola propuesta">Una sola propuesta</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Firmas</label>
                      <select
                        value={formHeader.show_signatures !== false ? 'Con firmas' : 'Sin firmas'}
                        onChange={(e) => setFormHeader({...formHeader, show_signatures: e.target.value === 'Con firmas'})}
                        className="block w-full px-3 py-2 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs"
                      >
                        <option value="Con firmas">Con firmas</option>
                        <option value="Sin firmas">Sin firmas</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">PDF Compacto</label>
                      <select
                        value={formHeader.pdf_compact === false ? 'Normal' : 'Compacto'}
                        onChange={(e) => setFormHeader({...formHeader, pdf_compact: e.target.value === 'Compacto'})}
                        className="block w-full px-3 py-2 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs font-bold"
                      >
                        <option value="Compacto">Compacto (por defecto)</option>
                        <option value="Normal">Normal</option>
                      </select>
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
                    <div className="space-y-2 border border-slate-100 dark:border-slate-800 p-3 rounded-xl col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Forma de Pago Sugerida</label>
                      <select
                        value={paymentType}
                        onChange={(e) => {
                          setPaymentType(e.target.value);
                          setIsPaymentTermsEditedManually(false);
                          if (e.target.value === '100_inicio') setPaymentAdvancePct(100);
                          else if (e.target.value === '50_inicio_50_termino') setPaymentAdvancePct(50);
                          else if (e.target.value === '50_inicio_50_entrega') setPaymentAdvancePct(50);
                        }}
                        className="block w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                      >
                        <option value="100_inicio">100% al inicio</option>
                        <option value="50_inicio_50_termino">50% al inicio y 50% al término</option>
                        <option value="50_inicio_50_entrega">50% al inicio y 50% contra entrega de archivos</option>
                        <option value="cuotas">Pago en cuotas</option>
                        <option value="personalizado">Pago personalizado</option>
                      </select>
                      
                      {paymentType === 'cuotas' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="block text-[9px] text-slate-400 font-semibold">% Anticipo</label>
                            <input
                              type="number"
                              value={paymentAdvancePct}
                              onChange={(e) => setPaymentAdvancePct(Number(e.target.value))}
                              className="block w-full px-2 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-slate-707 text-xs focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-400 font-semibold">N° Cuotas</label>
                            <input
                              type="number"
                              value={paymentInstallments}
                              onChange={(e) => setPaymentInstallments(Number(e.target.value))}
                              className="block w-full px-2 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-slate-707 text-xs focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {paymentType === 'personalizado' && (
                        <div className="mt-2">
                          <label className="block text-[9px] text-slate-400 font-semibold">% Anticipo / Pago Inicial</label>
                          <input
                            type="number"
                            value={paymentAdvancePct}
                            onChange={(e) => setPaymentAdvancePct(Number(e.target.value))}
                            className="block w-full px-2 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-slate-707 text-xs focus:outline-none"
                          />
                        </div>
                      )}
                      
                      <div className="mt-2">
                        <label className="block text-[9px] text-slate-400 font-semibold">Texto de Condiciones de Pago</label>
                        <textarea
                          rows="2"
                          value={formHeader.payment_terms}
                          onChange={(e) => {
                            setFormHeader({ ...formHeader, payment_terms: e.target.value });
                            setIsPaymentTermsEditedManually(true);
                          }}
                          className="block w-full px-2 py-1.5 border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 rounded-lg text-slate-707 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Inclusiones / Exclusiones listas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-2">
                      {/* Qué incluye */}
                      <div className="space-y-2 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-650 dark:text-indigo-400">Qué Incluye (Listado)</label>
                        
                        {/* Suggested dropdown */}
                        <div className="flex gap-2">
                          <select
                            value=""
                            onChange={(e) => {
                              handleAddInclude(e.target.value);
                              e.target.value = "";
                            }}
                            className="block w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs focus:outline-none"
                          >
                            <option value="">-- Seleccionar sugerido --</option>
                            {getSuggestedInclusions().map((item, idx) => (
                              <option key={idx} value={item}>{item}</option>
                            ))}
                          </select>
                        </div>

                        {/* Manual input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={manualIncludeText}
                            onChange={(e) => setManualIncludeText(e.target.value)}
                            placeholder="Agregar concepto manual..."
                            className="flex-1 px-3 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddInclude(manualIncludeText);
                                setManualIncludeText('');
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleAddInclude(manualIncludeText);
                              setManualIncludeText('');
                            }}
                            className="px-3 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 font-bold rounded-xl text-xs"
                          >
                            Agregar
                          </button>
                        </div>

                        {/* Selected list */}
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                          {includedItems.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">No hay ítems seleccionados.</p>
                          ) : (
                            includedItems.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/40 p-1.5 rounded-lg border border-slate-100 dark:border-slate-850 text-xs">
                                <span className="truncate pr-2">{item}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInclude(idx)}
                                  className="text-rose-500 hover:text-rose-750"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Qué no incluye */}
                      <div className="space-y-2 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-455">Qué NO Incluye (Listado)</label>
                        
                        {/* Suggested dropdown */}
                        <div className="flex gap-2">
                          <select
                            value=""
                            onChange={(e) => {
                              handleAddExclude(e.target.value);
                              e.target.value = "";
                            }}
                            className="block w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-707 text-xs focus:outline-none"
                          >
                            <option value="">-- Seleccionar sugerido --</option>
                            {getSuggestedExclusions().map((item, idx) => (
                              <option key={idx} value={item}>{item}</option>
                            ))}
                          </select>
                        </div>

                        {/* Manual input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={manualExcludeText}
                            onChange={(e) => setManualExcludeText(e.target.value)}
                            placeholder="Agregar concepto manual..."
                            className="flex-1 px-3 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddExclude(manualExcludeText);
                                setManualExcludeText('');
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleAddExclude(manualExcludeText);
                              setManualExcludeText('');
                            }}
                            className="px-3 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 font-bold rounded-xl text-xs"
                          >
                            Agregar
                          </button>
                        </div>

                        {/* Selected list */}
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                          {excludedItems.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">No hay ítems seleccionados.</p>
                          ) : (
                            excludedItems.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-955/40 p-1.5 rounded-lg border border-slate-100 dark:border-slate-850 text-xs">
                                <span className="truncate pr-2">{item}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveExclude(idx)}
                                  className="text-rose-500 hover:text-rose-750"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 border border-slate-100 dark:border-slate-800 p-3 rounded-xl space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455">Requisitos para Iniciar</label>
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
                            <label key={key} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={startRequirements[key]}
                                onChange={(e) => setStartRequirements(prev => ({ ...prev, [key]: e.target.checked }))}
                                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                              />
                              {labelsMap[key]}
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
                
                <div className="space-y-6 max-w-[800px] mx-auto text-slate-800 dark:text-slate-250">
                  {/* CONDITIONAL FORMAT: Resumen Ejecutivo vs Complete Format */}
                  {formHeader.proposal_format === 'Resumen ejecutivo' ? (
                    /* PAGE 1: RESUMEN EJECUTIVO (Single Page) */
                    <div className="bg-white dark:bg-slate-900 p-8 shadow-md rounded-xl border border-slate-100 dark:border-slate-850 text-xs space-y-6 min-h-[842px] flex flex-col justify-between">
                      <div className="space-y-6">
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
                            <p className="text-[10px] text-slate-450 mt-1 font-bold">{companySettings.commercial_name || 'Somos Noveli Editorial'}</p>
                            <p className="text-[10px] text-slate-400">{companySettings.official_email || 'contacto@somosnoveli.cl'} | {companySettings.website_url || 'www.somosnoveli.cl'}</p>
                          </div>
                          <div className="text-right text-[10px] text-slate-500 font-medium">
                            <span className="font-bold text-slate-755 dark:text-slate-300 text-xs block">RESUMEN EJECUTIVO</span>
                            <span className="font-bold text-indigo-655 block mt-0.5">{formHeader.quote_number}</span>
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

                        {/* Valores del servicio Table */}
                        <div className="space-y-2">
                          <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b pb-1">1. Valores y Servicios</h5>
                          <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                            <table className="w-full text-left border-collapse text-[10px]">
                              <thead>
                                <tr className="bg-slate-50 dark:bg-slate-950 font-bold uppercase text-[9px] text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                  <th className="p-2">{formHeader.has_alternatives ? 'Alternativa / Servicio' : 'Concepto / Servicio'}</th>
                                  <th className="p-2 w-12 text-center">Cant.</th>
                                  <th className="p-2 w-20 text-right">Neto</th>
                                  <th className="p-2 w-16 text-right">{formHeader.iva_mode === 'Exento / sin IVA' ? 'IVA (Exento)' : 'IVA 19%'}</th>
                                  <th className="p-2 w-24 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {formItems.map(item => {
                                  const total = item.unit_price * item.quantity;
                                  const rate = (Number(formHeader.tax_rate) || 19) / 100;
                                  let net = 0;
                                  let vat = 0;
                                  if (formHeader.iva_mode === 'IVA incluido') {
                                    net = Math.round(total / (1 + rate));
                                    vat = total - net;
                                  } else if (formHeader.iva_mode === '+ IVA') {
                                    net = total;
                                    vat = Math.round(net * rate);
                                  } else { // Exento
                                    net = total;
                                    vat = 0;
                                  }
                                  return (
                                    <tr key={item.id} className="border-b border-slate-50 dark:border-slate-855">
                                      <td className="p-2 font-bold">{item.concept}</td>
                                      <td className="p-2 text-center">{item.quantity}</td>
                                      <td className="p-2 text-right font-mono">{formatCurrency(net, formHeader.currency)}</td>
                                      <td className="p-2 text-right font-mono">{formHeader.iva_mode === 'Exento / sin IVA' ? 'Exento' : formatCurrency(vat, formHeader.currency)}</td>
                                      <td className="p-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{formatCurrency(formHeader.iva_mode === '+ IVA' ? (net + vat) : total, formHeader.currency)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          
                          {!formHeader.has_alternatives ? (
                            <div className="flex justify-end pt-1">
                              <div className="w-64 space-y-1 text-right text-[10px]">
                                <div className="flex justify-between font-extrabold text-xs text-indigo-655 dark:text-indigo-400">
                                  <span>VALOR TOTAL PROPUESTA:</span>
                                  <span className="font-mono text-xs">{formatCurrency(totals.total, formHeader.currency)}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[9px] text-slate-400 italic font-bold text-right pt-0.5">* Valores unitarios por alternativa independiente.</p>
                          )}
                        </div>

                        {/* Forma de Pago y Plazo compact */}
                        <div className="grid grid-cols-2 gap-4 text-[10px]">
                          <div className="space-y-1 bg-slate-50/50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                            <span className="font-bold text-slate-500 dark:text-slate-400 block border-b pb-0.5 mb-1 text-[9px] uppercase tracking-wider">2. Condiciones de Pago:</span>
                            <p className="text-slate-650 dark:text-slate-350 font-medium leading-relaxed">{formHeader.payment_terms}</p>
                          </div>
                          <div className="space-y-1 bg-slate-50/50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                            <span className="font-bold text-slate-500 dark:text-slate-400 block border-b pb-0.5 mb-1 text-[9px] uppercase tracking-wider">3. Plazo de Trabajo:</span>
                            <p className="text-slate-650 dark:text-slate-350 font-medium leading-relaxed">{formHeader.work_timeline}</p>
                          </div>
                        </div>

                        {/* Requisitos y vigencia */}
                        <div className="grid grid-cols-2 gap-4 text-[10px]">
                          <div className="space-y-1 bg-slate-50/50 dark:bg-slate-950/10 p-2 rounded-lg border border-slate-100 dark:border-slate-850">
                            <span className="font-bold text-slate-500 dark:text-slate-400 block text-[9px] uppercase">Requisitos para iniciar:</span>
                            <p className="text-slate-600 dark:text-slate-400 italic leading-relaxed">{formHeader.start_conditions}</p>
                          </div>
                          <div className="space-y-1 text-right">
                            <span className="font-bold text-slate-500 dark:text-slate-400 text-[9px] uppercase block">Vigencia propuesta:</span>
                            <p className="text-slate-600 dark:text-slate-400 italic mt-0.5">{formHeader.validity_days} días corridos.</p>
                          </div>
                        </div>

                        {/* Signatures block */}
                        {formHeader.show_signatures !== false && (
                          <div className="pt-6 flex justify-between text-[9px] text-slate-455 text-center">
                            <div className="w-40 border-t pt-2">
                              <span className="font-bold text-slate-755 dark:text-slate-300 block">{companySettings.representative_name || 'Javier Román González'}</span>
                              <span>{companySettings.representative_role || 'Representante Noveli Editorial'}</span>
                            </div>
                            <div className="w-40 border-t pt-2">
                              <span className="font-bold text-slate-755 dark:text-slate-300 block">Firma Autor/a</span>
                              <span>{formHeader.author_name || 'Firma Autor / Cliente'}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Page Footer */}
                      <div className="text-center text-[9px] text-slate-400 border-t pt-3 font-semibold">
                        {companySettings.default_footer_text || 'Los derechos de la obra pertenecen siempre al autor.'}
                      </div>
                    </div>
                  ) : (
                    /* TWO-PAGE FORM (Formal completo, Con alternativas, etc.) */
                    <>
                      {/* PAGE 1 */}
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
                            <div className="text-right text-[10px] text-slate-505 font-medium">
                              <span className="font-bold text-slate-705 dark:text-slate-300 text-xs block">PROPUESTA COMERCIAL PRELIMINAR</span>
                              <span className="font-bold text-indigo-655 block mt-0.5">{formHeader.quote_number}</span>
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
                            <p className="text-slate-600 dark:text-slate-355 leading-relaxed text-[11px]">
                              La presente propuesta tiene como objeto detallar la prestación de servicios editoriales y de producción para la obra "{formHeader.object || 'Proyecto del Autor'}". El objetivo es lograr un producto editorial de la más alta calidad bajo la marca Noveli Editorial.
                            </p>
                          </div>

                          {/* Servicios Incluidos */}
                          <div className="space-y-3">
                            <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b pb-1">2. Servicios Incluidos</h5>
                            <div className="space-y-2">
                              {includedItems.length === 0 ? (
                                <p className="text-slate-400 italic">No se han seleccionado conceptos.</p>
                              ) : (
                                includedItems.map((item, index) => {
                                  let title = item;
                                  let desc = '';
                                  const colonIdx = item.indexOf(':');
                                  if (colonIdx > -1) {
                                    title = item.substring(0, colonIdx).trim();
                                    desc = item.substring(colonIdx + 1).trim();
                                  }
                                  return (
                                    <div key={index} className="text-[11px] py-1 border-b border-slate-50 dark:border-slate-850 pb-1 flex flex-col gap-0.5">
                                      <div className="flex gap-2">
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{index + 1}. {title}</span>
                                      </div>
                                      {desc && (
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-4">{desc}</p>
                                      )}
                                    </div>
                                  );
                                })
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
                                  <tr className="bg-slate-50 dark:bg-slate-950 font-bold uppercase text-[9px] text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                    <th className="p-2">{formHeader.has_alternatives ? 'Alternativa / Servicio' : 'Servicio / Concepto'}</th>
                                    <th className="p-2 w-12 text-center">Cant.</th>
                                    <th className="p-2 w-20 text-right">Neto</th>
                                    <th className="p-2 w-16 text-right">{formHeader.iva_mode === 'Exento / sin IVA' ? 'IVA (Exento)' : 'IVA 19%'}</th>
                                    <th className="p-2 w-24 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {formItems.map(item => {
                                    const total = item.unit_price * item.quantity;
                                    const rate = (Number(formHeader.tax_rate) || 19) / 100;
                                    let net = 0;
                                    let vat = 0;
                                    if (formHeader.iva_mode === 'IVA incluido') {
                                      net = Math.round(total / (1 + rate));
                                      vat = total - net;
                                    } else if (formHeader.iva_mode === '+ IVA') {
                                      net = total;
                                      vat = Math.round(net * rate);
                                    } else { // Exento
                                      net = total;
                                      vat = 0;
                                    }
                                    return (
                                      <tr key={item.id} className="border-b border-slate-50 dark:border-slate-850">
                                        <td className="p-2 font-bold">{item.concept}</td>
                                        <td className="p-2 text-center">{item.quantity}</td>
                                        <td className="p-2 text-right font-mono">{formatCurrency(net, formHeader.currency)}</td>
                                        <td className="p-2 text-right font-mono">{formHeader.iva_mode === 'Exento / sin IVA' ? 'Exento' : formatCurrency(vat, formHeader.currency)}</td>
                                        <td className="p-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{formatCurrency(formHeader.iva_mode === '+ IVA' ? (net + vat) : total, formHeader.currency)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            
                            {/* Totals Block */}
                            {!formHeader.has_alternatives ? (
                              <div className="flex justify-end pt-2">
                                <div className="w-64 space-y-1 text-right text-[11px]">
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
                                  <div className="flex justify-between font-extrabold text-xs text-indigo-650 dark:text-indigo-400 border-t pt-1">
                                    <span>VALOR TOTAL PROPUESTA:</span>
                                    <span className="font-mono text-xs">{formatCurrency(totals.total, formHeader.currency)}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[9px] text-slate-400 italic font-bold text-right pt-0.5">* Valores unitarios por alternativa independiente.</p>
                            )}
                          </div>

                          {/* Forma de Pago Table */}
                          <div className="space-y-2">
                            <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b pb-1">4. Forma de Pago</h5>
                            <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                              <table className="w-full text-left border-collapse text-[10px]">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950 font-bold uppercase text-[9px] text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                    <th className="p-2">Alternativa</th>
                                    <th className="p-2 w-28 text-right">Total</th>
                                    <th className="p-2 w-20 text-center">% Inicio</th>
                                    <th className="p-2 w-48">Tipo / condición</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {formHeader.has_alternatives ? (
                                    formItems.map((item, idx) => {
                                      const total = item.unit_price * item.quantity;
                                      const finalTotal = formHeader.iva_mode === '+ IVA' ? Math.round(total * (1 + (Number(formHeader.tax_rate) || 19) / 100)) : total;
                                      return (
                                        <tr key={item.id} className="border-b border-slate-50 dark:border-slate-850">
                                          <td className="p-2 font-bold">{item.concept}</td>
                                          <td className="p-2 text-right font-mono font-bold text-indigo-650 dark:text-indigo-400">{formatCurrency(finalTotal, formHeader.currency)}</td>
                                          <td className="p-2 text-center font-bold">{paymentAdvancePct}%</td>
                                          <td className="p-2 text-slate-500 leading-tight">
                                            {paymentType === '100_inicio' ? '100% al inicio' :
                                             paymentType === '50_inicio_50_termino' ? '50% inicio / 50% término' :
                                             paymentType === '50_inicio_50_entrega' ? '50% inicio / 50% contra entrega' :
                                             paymentType === 'cuotas' ? `${paymentAdvancePct}% anticipo y saldo en ${paymentInstallments} cuotas` :
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
                              <div className="space-y-1 bg-slate-50/50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                                <span className="font-bold text-slate-500 dark:text-slate-400">Qué NO incluye:</span>
                                <div className="text-slate-600 dark:text-slate-400 space-y-1">
                                  {excludedItems.length === 0 ? (
                                    <p className="italic">No hay exclusiones específicas.</p>
                                  ) : (
                                    excludedItems.map((item, idx) => (
                                      <p key={idx}>• {item}</p>
                                    ))
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1 bg-slate-50/50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
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

                          {/* Nota Legal */}
                          <div className="bg-slate-50/50 dark:bg-slate-950/20 p-3 rounded-lg border text-[8px] text-slate-400 space-y-1 italic leading-relaxed">
                            {formHeader.legal_notes.split('\n').map((line, i) => (
                              <p key={i}>{line}</p>
                            ))}
                          </div>

                          {/* Signatures block */}
                          {formHeader.show_signatures !== false && (
                            <div className="pt-6 flex justify-between text-[9px] text-slate-455 text-center">
                              <div className="w-40 border-t pt-2">
                                <span className="font-bold text-slate-755 dark:text-slate-300 block">{companySettings.representative_name || 'Javier Román González'}</span>
                                <span>{companySettings.representative_role || 'Representante Noveli Editorial'}</span>
                              </div>
                              <div className="w-40 border-t pt-2">
                                <span className="font-bold text-slate-755 dark:text-slate-300 block">Firma Autor/a</span>
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
                      onClick={() => handleDownloadPDFClick(false)}
                      className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar Propuesta PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPDFClick(true)}
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
