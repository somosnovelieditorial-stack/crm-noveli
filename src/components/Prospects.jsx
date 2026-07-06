import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatDate, exportToCSV } from '../utils';
import { 
  Plus, Search, Edit2, Trash2, X, Sparkles, Check,
  User, Send, Target, Calendar, HelpCircle, FileText, Download, Globe, MapPin, Clock, DollarSign,
  AlertCircle, AlertTriangle, CheckCircle2, XCircle, Mail, Phone, FolderOpen
} from 'lucide-react';

export default function Prospects({ isReadOnly = false, userRole = 'administrador' }) {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [probabilityFilter, setProbabilityFilter] = useState('todos');
  const [originFilter, setOriginFilter] = useState('todos');
  const [countryFilter, setCountryFilter] = useState('todos');
  const [clientTypeFilter, setClientTypeFilter] = useState('todos');
  const [conversionStatus, setConversionStatus] = useState('todos'); // todos, pendientes, convertidos
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState(null);
  
  // Main form state
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    origin: 'Instagram',
    interest_service: 'corrección',
    probability: 'media',
    next_action: '',
    followup_date: '',
    country: '',
    city: '',
    client_type: 'nacional',
    preferred_currency: 'CLP',
    notes: '',
    
    // Commercial tracking fields
    total_agreed_amount: '',
    currency: 'CLP',
    includes_vat: false,
    payment_status: 'sin pago',
    amount_paid: '0',
    balance_due: 0,
    payment_method: 'transferencia',
    paid_at: '',
    payment_link_sent: false,
    payment_link_sent_at: '',
    contract_sent: false,
    contract_sent_at: '',
    contract_signed_received: false,
    contract_signed_received_at: '',
    files_received: false,
    files_received_at: '',
    ready_to_start: false,
    agreement_notes: '',

    // Dynamic requirements & selected services columns
    selected_services: [],
    service_category: 'editorial',
    agreement_period_type: 'contrato editorial',
    materials_received: false,
    materials_received_at: '',
    partial_payment_authorized: false,
    ready_to_start_reason: '',
    services_summary: ''
  });

  // Convert form state
  const [convertData, setConvertData] = useState({
    name: '',
    email: '',
    instagram: '',
    phone: '',
    country: '',
    city: '',
    client_type: 'nacional',
    preferred_currency: 'CLP',
    status: 'interesado',
    notes: '',

    // Commercial tracking fields
    interest_service: 'corrección',
    total_agreed_amount: '',
    currency: 'CLP',
    includes_vat: false,
    payment_status: 'sin pago',
    amount_paid: '0',
    balance_due: 0,
    payment_method: 'transferencia',
    paid_at: '',
    payment_link_sent: false,
    payment_link_sent_at: '',
    contract_sent: false,
    contract_sent_at: '',
    contract_signed_received: false,
    contract_signed_received_at: '',
    files_received: false,
    files_received_at: '',
    ready_to_start: false,
    agreement_notes: '',

    // Dynamic requirements & selected services columns
    selected_services: [],
    service_category: 'editorial',
    agreement_period_type: 'contrato editorial',
    materials_received: false,
    materials_received_at: '',
    partial_payment_authorized: false,
    ready_to_start_reason: '',
    services_summary: '',

    // Service fields
    register_service: false,
    service_type: 'corrección',
    service_book_title: '',
    service_start_date: new Date().toISOString().split('T')[0],
    service_duration_value: '6',
    service_duration_unit: 'meses',
    service_estimated_delivery: '',
    service_current_stage: 'recepción de material',
    service_notes: ''
  });

  
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editorialStages, setEditorialStages] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [packs, setPacks] = useState([]);

  const fetchCatalogAndPacks = async () => {
    try {
      const { data: catData } = await supabase.from('service_catalog').select('*').eq('active', true).order('name', { ascending: true });
      const { data: packData } = await supabase.from('service_packs').select('*').eq('active', true).order('name', { ascending: true });
      setCatalog(catData || []);
      setPacks(packData || []);
    } catch (err) {
      console.error('Error loading catalog and packs:', err);
    }
  };

  const calculateEstimatedDelivery = (startDateStr, durationValue, durationUnit) => {
    if (!startDateStr) return '';
    const date = new Date(startDateStr);
    if (isNaN(date.getTime())) return '';
    
    const val = durationValue !== '' && durationValue !== undefined ? parseInt(durationValue, 10) : 6;
    const unit = durationUnit || 'meses';
    
    if (unit === 'meses') {
      date.setMonth(date.getMonth() + val);
    } else if (unit === 'semanas') {
      date.setDate(date.getDate() + (val * 7));
    } else if (unit === 'días') {
      date.setDate(date.getDate() + val);
    }
    
    return date.toISOString().split('T')[0];
  };

  const fetchEditorialStages = async () => {
    try {
      const { data, error } = await supabase
        .from('editorial_stages')
        .select('*')
        .order('id', { ascending: true });
        
      if (!error && data) {
        setEditorialStages(data);
      }
    } catch (err) {
      console.error('Error fetching editorial stages:', err);
    }
  };

  useEffect(() => {
    fetchProspects();
    fetchEditorialStages();
    fetchCatalogAndPacks();
  }, []);

  // Update estimated delivery dynamically based on duration input for convertData
  useEffect(() => {
    if (convertData.service_start_date) {
      const calculated = calculateEstimatedDelivery(
        convertData.service_start_date,
        convertData.service_duration_value,
        convertData.service_duration_unit
      );
      setConvertData(prev => {
        if (prev.service_estimated_delivery !== calculated) {
          return { ...prev, service_estimated_delivery: calculated };
        }
        return prev;
      });
    }
  }, [convertData.service_start_date, convertData.service_duration_value, convertData.service_duration_unit]);


  const calculateIsReadyToStart = (data) => {
    const services = data.selected_services || [];
    
    let reqManuscript = true;
    let reqMaterials = false;
    let reqSignedContract = true;
    let reqAgreementSent = false;
    let reqDuration = false;

    if (services.length > 0) {
      reqManuscript = services.some(s => s.requires_manuscript);
      reqMaterials = services.some(s => s.requires_materials);
      reqSignedContract = services.some(s => s.requires_signed_contract);
      reqAgreementSent = services.some(s => s.requires_agreement_sent);
      reqDuration = services.some(s => s.requires_duration);
    } else {
      const cat = data.service_category || 'editorial';
      if (cat === 'publicidad' || cat === 'difusión') {
        reqManuscript = false;
        reqMaterials = false;
        reqSignedContract = false;
        reqAgreementSent = true;
        reqDuration = true;
      } else if (cat === 'diseño' || cat === 'portada') {
        reqManuscript = false;
        reqMaterials = true;
        reqSignedContract = false;
        reqAgreementSent = true;
        reqDuration = false;
      } else if (cat === 'asesoría') {
        reqManuscript = false;
        reqMaterials = false;
        reqSignedContract = false;
        reqAgreementSent = true;
        reqDuration = true;
      } else {
        reqManuscript = true;
        reqMaterials = false;
        reqSignedContract = true;
        reqAgreementSent = false;
        reqDuration = false;
      }
    }

    const payStatus = data.payment_status;
    const isPaymentOk = payStatus === 'pagado' || payStatus === 'pago parcial' || !!data.partial_payment_authorized;
    
    const isAgreementSentOk = !reqAgreementSent || !!data.contract_sent;
    const isSignedContractOk = !reqSignedContract || !!data.contract_signed_received;
    const isManuscriptOk = !reqManuscript || !!data.files_received;
    const isMaterialsOk = !reqMaterials || !!data.materials_received;
    const isPeriodOk = !reqDuration || (data.service_start_date && data.service_duration_value);

    const isReady = isPaymentOk && isAgreementSentOk && isSignedContractOk && isManuscriptOk && isMaterialsOk && isPeriodOk;
    
    const reasons = [];
    if (!isPaymentOk) reasons.push("Falta pago o autorización parcial");
    if (!isAgreementSentOk) reasons.push("Falta enviar acuerdo");
    if (!isSignedContractOk) reasons.push("Falta contrato firmado");
    if (!isManuscriptOk) reasons.push("Falta manuscrito");
    if (!isMaterialsOk) reasons.push("Falta briefing/materiales");
    if (!isPeriodOk) reasons.push("Falta definir periodo");
    
    const reasonText = isReady ? "Todos los requisitos cumplidos" : reasons.join(", ");

    return { isReady, reasonText };
  };

  // Reactive form automatons for formData (prospects)
  useEffect(() => {
    setFormData(prev => {
      let updated = false;
      const next = { ...prev };

      const total = parseFloat(next.total_agreed_amount) || 0;
      const paid = parseFloat(next.amount_paid) || 0;
      const bal = Math.max(0, total - paid);
      if (next.balance_due !== bal) {
        next.balance_due = bal;
        updated = true;
      }

      let expectedPayStatus = next.payment_status;
      if (total > 0) {
        if (paid >= total) {
          expectedPayStatus = 'pagado';
        } else if (paid > 0) {
          expectedPayStatus = 'pago parcial';
        } else {
          expectedPayStatus = 'sin pago';
        }
      } else {
        if (paid > 0) {
          expectedPayStatus = 'pagado';
        }
      }
      if (next.payment_status !== expectedPayStatus) {
        next.payment_status = expectedPayStatus;
        updated = true;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      if (next.payment_link_sent && !next.payment_link_sent_at) {
        next.payment_link_sent_at = todayStr;
        updated = true;
      } else if (!next.payment_link_sent && next.payment_link_sent_at) {
        next.payment_link_sent_at = '';
        updated = true;
      }

      if (next.contract_sent && !next.contract_sent_at) {
        next.contract_sent_at = todayStr;
        updated = true;
      } else if (!next.contract_sent && next.contract_sent_at) {
        next.contract_sent_at = '';
        updated = true;
      }

      if (next.contract_signed_received && !next.contract_signed_received_at) {
        next.contract_signed_received_at = todayStr;
        updated = true;
      } else if (!next.contract_signed_received && next.contract_signed_received_at) {
        next.contract_signed_received_at = '';
        updated = true;
      }

      if (next.files_received && !next.files_received_at) {
        next.files_received_at = todayStr;
        updated = true;
      } else if (!next.files_received && next.files_received_at) {
        next.files_received_at = '';
        updated = true;
      }

      if (next.materials_received && !next.materials_received_at) {
        next.materials_received_at = todayStr;
        updated = true;
      } else if (!next.materials_received && next.materials_received_at) {
        next.materials_received_at = '';
        updated = true;
      }

      if ((next.payment_status === 'pagado' || next.payment_status === 'pago parcial') && !next.paid_at) {
        next.paid_at = todayStr;
        updated = true;
      } else if (next.payment_status === 'sin pago' && next.paid_at) {
        next.paid_at = '';
        updated = true;
      }

      // Dynamic Category auto-fill
      const firstService = next.selected_services?.[0];
      const firstCat = firstService?.category || 'editorial';
      if (next.service_category !== firstCat) {
        next.service_category = firstCat;
        updated = true;

        let pType = 'contrato editorial';
        if (firstCat === 'publicidad') pType = 'campaña de difusión';
        else if (firstCat === 'asesoría') pType = 'asesoría';
        else if (firstCat === 'diseño') pType = 'diseño';
        
        next.agreement_period_type = pType;
      }

      const { isReady, reasonText } = calculateIsReadyToStart(next);
      if (next.ready_to_start !== isReady) {
        next.ready_to_start = isReady;
        updated = true;
      }
      if (next.ready_to_start_reason !== reasonText) {
        next.ready_to_start_reason = reasonText;
        updated = true;
      }

      return updated ? next : prev;
    });
  }, [
    formData.total_agreed_amount,
    formData.amount_paid,
    formData.payment_link_sent,
    formData.contract_sent,
    formData.contract_signed_received,
    formData.files_received,
    formData.materials_received,
    formData.payment_status,
    formData.selected_services,
    formData.service_category,
    formData.partial_payment_authorized
  ]);

  // Reactive form automatons for convertData (converting to client)
  useEffect(() => {
    setConvertData(prev => {
      let updated = false;
      const next = { ...prev };

      const total = parseFloat(next.total_agreed_amount) || 0;
      const paid = parseFloat(next.amount_paid) || 0;
      const bal = Math.max(0, total - paid);
      if (next.balance_due !== bal) {
        next.balance_due = bal;
        updated = true;
      }

      let expectedPayStatus = next.payment_status;
      if (total > 0) {
        if (paid >= total) {
          expectedPayStatus = 'pagado';
        } else if (paid > 0) {
          expectedPayStatus = 'pago parcial';
        } else {
          expectedPayStatus = 'sin pago';
        }
      } else {
        if (paid > 0) {
          expectedPayStatus = 'pagado';
        }
      }
      if (next.payment_status !== expectedPayStatus) {
        next.payment_status = expectedPayStatus;
        updated = true;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      if (next.payment_link_sent && !next.payment_link_sent_at) {
        next.payment_link_sent_at = todayStr;
        updated = true;
      } else if (!next.payment_link_sent && next.payment_link_sent_at) {
        next.payment_link_sent_at = '';
        updated = true;
      }

      if (next.contract_sent && !next.contract_sent_at) {
        next.contract_sent_at = todayStr;
        updated = true;
      } else if (!next.contract_sent && next.contract_sent_at) {
        next.contract_sent_at = '';
        updated = true;
      }

      if (next.contract_signed_received && !next.contract_signed_received_at) {
        next.contract_signed_received_at = todayStr;
        updated = true;
      } else if (!next.contract_signed_received && next.contract_signed_received_at) {
        next.contract_signed_received_at = '';
        updated = true;
      }

      if (next.files_received && !next.files_received_at) {
        next.files_received_at = todayStr;
        updated = true;
      } else if (!next.files_received && next.files_received_at) {
        next.files_received_at = '';
        updated = true;
      }

      if (next.materials_received && !next.materials_received_at) {
        next.materials_received_at = todayStr;
        updated = true;
      } else if (!next.materials_received && next.materials_received_at) {
        next.materials_received_at = '';
        updated = true;
      }

      if ((next.payment_status === 'pagado' || next.payment_status === 'pago parcial') && !next.paid_at) {
        next.paid_at = todayStr;
        updated = true;
      } else if (next.payment_status === 'sin pago' && next.paid_at) {
        next.paid_at = '';
        updated = true;
      }

      // Dynamic Category auto-fill
      const firstService = next.selected_services?.[0];
      const firstCat = firstService?.category || 'editorial';
      if (next.service_category !== firstCat) {
        next.service_category = firstCat;
        updated = true;

        let pType = 'contrato editorial';
        if (firstCat === 'publicidad') pType = 'campaña de difusión';
        else if (firstCat === 'asesoría') pType = 'asesoría';
        else if (firstCat === 'diseño') pType = 'diseño';
        
        next.agreement_period_type = pType;
      }

      if (next.payment_link_sent && ['prospecto', 'interesado', 'contrato enviado', 'acuerdo enviado'].includes(String(next.status || '').toLowerCase())) {
        next.status = 'link de pago enviado';
        updated = true;
      }
      if (next.contract_sent && !next.payment_link_sent && ['prospecto', 'interesado'].includes(String(next.status || '').toLowerCase())) {
        next.status = next.service_category === 'editorial' ? 'contrato enviado' : 'acuerdo enviado';
        updated = true;
      }

      const { isReady, reasonText } = calculateIsReadyToStart(next);
      if (next.ready_to_start !== isReady) {
        next.ready_to_start = isReady;
        updated = true;
      }
      if (next.ready_to_start_reason !== reasonText) {
        next.ready_to_start_reason = reasonText;
        updated = true;
      }

      if (isReady && ['prospecto', 'interesado', 'acuerdo enviado', 'contrato enviado', 'link de pago enviado', 'esperando pago', 'pago recibido', 'esperando contrato firmado', 'esperando archivos/materiales'].includes(String(next.status || '').toLowerCase())) {
        next.status = 'listo para iniciar';
        updated = true;
      }

      return updated ? next : prev;
    });
  }, [
    convertData.total_agreed_amount,
    convertData.amount_paid,
    convertData.payment_link_sent,
    convertData.contract_sent,
    convertData.contract_signed_received,
    convertData.files_received,
    convertData.materials_received,
    convertData.payment_status,
    convertData.selected_services,
    convertData.service_category,
    convertData.status,
    convertData.partial_payment_authorized
  ]);

  const logActivity = async (action, description, entityId, moduleName = 'Clientes') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('activity_log').insert({
        user_id: user?.id,
        user_email: user?.email,
        date: new Date().toISOString(),
        module: moduleName,
        action: action,
        description: description,
        entity_id: entityId
      });
    } catch (err) {
      console.error('Error logging activity:', err);
    }
  };

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setProspects(data || []);
    } catch (err) {
      console.error('Error fetching prospects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedProspect(null);
    setFormData({
      name: '',
      contact: '',
      origin: 'Instagram',
      interest_service: 'corrección',
      probability: 'media',
      next_action: '',
      followup_date: '',
      country: '',
      city: '',
      client_type: 'nacional',
      preferred_currency: 'CLP',
      notes: '',
      total_agreed_amount: '',
      currency: 'CLP',
      includes_vat: false,
      payment_status: 'sin pago',
      amount_paid: '0',
      balance_due: 0,
      payment_method: 'transferencia',
      paid_at: '',
      payment_link_sent: false,
      payment_link_sent_at: '',
      contract_sent: false,
      contract_sent_at: '',
      contract_signed_received: false,
      contract_signed_received_at: '',
      files_received: false,
      files_received_at: '',
      ready_to_start: false,
      agreement_notes: '',

      selected_services: [],
      service_category: 'editorial',
      agreement_period_type: 'contrato editorial',
      materials_received: false,
      materials_received_at: '',
      partial_payment_authorized: false,
      ready_to_start_reason: '',
      services_summary: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prospect) => {
    setSelectedProspect(prospect);
    setFormData({
      name: prospect.name || '',
      contact: prospect.contact || '',
      origin: prospect.origin || 'Instagram',
      interest_service: prospect.interest_service || 'corrección',
      probability: prospect.probability || 'media',
      next_action: prospect.next_action || '',
      followup_date: prospect.followup_date || '',
      country: prospect.country || '',
      city: prospect.city || '',
      client_type: prospect.client_type || 'nacional',
      preferred_currency: prospect.preferred_currency || 'CLP',
      notes: prospect.notes || '',
      total_agreed_amount: prospect.total_agreed_amount !== undefined && prospect.total_agreed_amount !== null ? prospect.total_agreed_amount : '',
      currency: prospect.currency || 'CLP',
      includes_vat: !!prospect.includes_vat,
      payment_status: prospect.payment_status || 'sin pago',
      amount_paid: prospect.amount_paid !== undefined && prospect.amount_paid !== null ? prospect.amount_paid : '0',
      balance_due: prospect.balance_due || 0,
      payment_method: prospect.payment_method || 'transferencia',
      paid_at: prospect.paid_at || '',
      payment_link_sent: !!prospect.payment_link_sent,
      payment_link_sent_at: prospect.payment_link_sent_at || '',
      contract_sent: !!prospect.contract_sent,
      contract_sent_at: prospect.contract_sent_at || '',
      contract_signed_received: !!prospect.contract_signed_received,
      contract_signed_received_at: prospect.contract_signed_received_at || '',
      files_received: !!prospect.files_received,
      files_received_at: prospect.files_received_at || '',
      ready_to_start: !!prospect.ready_to_start,
      agreement_notes: prospect.agreement_notes || '',

      selected_services: prospect.selected_services || [],
      service_category: prospect.service_category || 'editorial',
      agreement_period_type: prospect.agreement_period_type || 'contrato editorial',
      materials_received: !!prospect.materials_received,
      materials_received_at: prospect.materials_received_at || '',
      partial_payment_authorized: !!prospect.partial_payment_authorized,
      ready_to_start_reason: prospect.ready_to_start_reason || '',
      services_summary: prospect.services_summary || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenConvertModal = (prospect) => {
    setSelectedProspect(prospect);
    
    // Guess contact type
    let email = '';
    let instagram = '';
    let phone = '';
    
    const contact = prospect.contact || '';
    if (contact.includes('@') && !contact.startsWith('@')) {
      email = contact;
    } else if (contact.startsWith('@')) {
      instagram = contact;
    } else if (contact.match(/^[+\d\s-]+$/)) {
      phone = contact;
    } else {
      instagram = contact.startsWith('@') ? contact : '';
    }

    setConvertData({
      name: prospect.name,
      email: email,
      instagram: instagram || (prospect.origin === 'Instagram' ? contact : ''),
      phone: phone,
      country: prospect.country || '',
      city: prospect.city || '',
      client_type: prospect.client_type || 'nacional',
      preferred_currency: prospect.preferred_currency || 'CLP',
      status: 'interesado',
      notes: `Convertido desde prospecto. Servicio de interés: ${prospect.interest_service || 'Ninguno'}. Origen: ${prospect.origin}.\n\nNotas originales: ${prospect.notes || ''}`,

      // Copy commercial/checklist fields from prospect
      interest_service: prospect.interest_service || 'corrección',
      total_agreed_amount: prospect.total_agreed_amount !== undefined && prospect.total_agreed_amount !== null ? prospect.total_agreed_amount : '',
      currency: prospect.currency || 'CLP',
      includes_vat: !!prospect.includes_vat,
      payment_status: prospect.payment_status || 'sin pago',
      amount_paid: prospect.amount_paid !== undefined && prospect.amount_paid !== null ? prospect.amount_paid : '0',
      balance_due: prospect.balance_due || 0,
      payment_method: prospect.payment_method || 'transferencia',
      paid_at: prospect.paid_at || '',
      payment_link_sent: !!prospect.payment_link_sent,
      payment_link_sent_at: prospect.payment_link_sent_at || '',
      contract_sent: !!prospect.contract_sent,
      contract_sent_at: prospect.contract_sent_at || '',
      contract_signed_received: !!prospect.contract_signed_received,
      contract_signed_received_at: prospect.contract_signed_received_at || '',
      files_received: !!prospect.files_received,
      files_received_at: prospect.files_received_at || '',
      ready_to_start: !!prospect.ready_to_start,
      agreement_notes: prospect.agreement_notes || '',

      selected_services: prospect.selected_services || [],
      service_category: prospect.service_category || 'editorial',
      agreement_period_type: prospect.agreement_period_type || 'contrato editorial',
      materials_received: !!prospect.materials_received,
      materials_received_at: prospect.materials_received_at || '',
      partial_payment_authorized: !!prospect.partial_payment_authorized,
      ready_to_start_reason: prospect.ready_to_start_reason || '',
      services_summary: prospect.services_summary || '',

      // Service fields
      register_service: false,
      service_type: prospect.interest_service || 'corrección',
      service_book_title: '',
      service_start_date: new Date().toISOString().split('T')[0],
      service_duration_value: '6',
      service_duration_unit: 'meses',
      service_estimated_delivery: '',
      service_current_stage: editorialStages[0]?.name || 'recepción de material',
      service_notes: ''
    });
    
    setFormError('');
    setIsConvertModalOpen(true);
  };


  const handleDeleteProspect = async (id) => {
    if (isReadOnly) {
      alert('Acceso denegado: Tu rol actual no tiene permisos para esta acción.');
      return;
    }
    if (window.confirm('¿Estás seguro de que deseas eliminar este prospecto?')) {
      try {
        const { error } = await supabase
          .from('prospects')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        setProspects(prospects.filter(p => p.id !== id));
      } catch (err) {
        console.error('Error deleting prospect:', err);
        alert('Error al eliminar el prospecto');
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) {
      alert('Acceso denegado: Tu rol actual no tiene permisos para esta acción.');
      return;
    }
    if (!formData.name.trim()) {
      setFormError('El nombre es requerido.');
      return;
    }
    
    setIsSubmitting(true);
    setFormError('');

    try {
      const prospectPayload = {
        name: formData.name,
        contact: formData.contact,
        origin: formData.origin,
        interest_service: formData.selected_services?.[0]?.name || formData.interest_service || 'otro',
        probability: formData.probability,
        next_action: formData.next_action,
        followup_date: formData.followup_date || null,
        country: formData.country,
        city: formData.city,
        client_type: formData.client_type,
        preferred_currency: formData.preferred_currency,
        notes: formData.notes,
        
        total_agreed_amount: parseFloat(formData.total_agreed_amount) || 0,
        includes_vat: !!formData.includes_vat,
        payment_status: formData.payment_status,
        amount_paid: parseFloat(formData.amount_paid) || 0,
        balance_due: parseFloat(formData.balance_due) || 0,
        payment_method: formData.payment_method,
        paid_at: formData.paid_at || null,
        payment_link_sent: !!formData.payment_link_sent,
        payment_link_sent_at: formData.payment_link_sent_at || null,
        contract_sent: !!formData.contract_sent,
        contract_sent_at: formData.contract_sent_at || null,
        contract_signed_received: !!formData.contract_signed_received,
        contract_signed_received_at: formData.contract_signed_received_at || null,
        files_received: !!formData.files_received,
        files_received_at: formData.files_received_at || null,
        ready_to_start: !!formData.ready_to_start,
        agreement_notes: formData.agreement_notes,
        currency: formData.currency,

        selected_services: formData.selected_services,
        service_category: formData.service_category,
        agreement_period_type: formData.agreement_period_type,
        materials_received: !!formData.materials_received,
        materials_received_at: formData.materials_received_at || null,
        partial_payment_authorized: !!formData.partial_payment_authorized,
        ready_to_start_reason: formData.ready_to_start_reason,
        services_summary: formData.selected_services ? formData.selected_services.map(s => s.name).join(', ') : ''
      };

      if (selectedProspect) {
        // Edit Mode
        const { error } = await supabase
          .from('prospects')
          .update(prospectPayload)
          .eq('id', selectedProspect.id);

        if (error) throw error;
      } else {
        // Add Mode
        const { error } = await supabase
          .from('prospects')
          .insert([prospectPayload]);

        if (error) throw error;
      }

      await fetchProspects();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving prospect:', err);
      setFormError(err.message || 'Error al guardar los datos del prospecto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) {
      alert('Acceso denegado: Tu rol actual no tiene permisos para esta acción.');
      return;
    }
    if (!convertData.name.trim()) {
      setFormError('El nombre es requerido.');
      return;
    }

    // Commercial validation during convert
    const isConfirmedClient = !['prospecto', 'interesado', 'perdido / rechazado'].includes(String(convertData.status || '').toLowerCase());
    const agreedAmount = parseFloat(convertData.total_agreed_amount) || 0;
    if (isConfirmedClient && (convertData.total_agreed_amount === '' || agreedAmount <= 0)) {
      setFormError('El valor acordado es requerido para clientes confirmados.');
      return;
    }

    // Checklist validation during convert
    if (convertData.status === 'listo para iniciar' || convertData.ready_to_start) {
      const { isReady, reasonText } = calculateIsReadyToStart(convertData);
      if (!isReady) {
        setFormError(`El cliente no cumple con todos los requisitos para iniciar: ${reasonText}`);
        return;
      }
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        name: convertData.name,
        email: convertData.email,
        instagram: convertData.instagram,
        phone: convertData.phone,
        country: convertData.country,
        city: convertData.city,
        client_type: convertData.client_type,
        preferred_currency: convertData.preferred_currency,
        status: convertData.status,
        notes: convertData.notes,
        
        interest_service: convertData.selected_services?.[0]?.name || convertData.interest_service || 'otro',
        total_agreed_amount: agreedAmount,
        includes_vat: !!convertData.includes_vat,
        payment_status: convertData.payment_status,
        amount_paid: parseFloat(convertData.amount_paid) || 0,
        balance_due: parseFloat(convertData.balance_due) || 0,
        payment_method: convertData.payment_method,
        paid_at: convertData.paid_at || null,
        payment_link_sent: !!convertData.payment_link_sent,
        payment_link_sent_at: convertData.payment_link_sent_at || null,
        contract_sent: !!convertData.contract_sent,
        contract_sent_at: convertData.contract_sent_at || null,
        contract_signed_received: !!convertData.contract_signed_received,
        contract_signed_received_at: convertData.contract_signed_received_at || null,
        files_received: !!convertData.files_received,
        files_received_at: convertData.files_received_at || null,
        ready_to_start: !!convertData.ready_to_start,
        agreement_notes: convertData.agreement_notes,
        currency: convertData.currency,

        selected_services: convertData.selected_services,
        service_category: convertData.service_category,
        agreement_period_type: convertData.agreement_period_type,
        materials_received: !!convertData.materials_received,
        materials_received_at: convertData.materials_received_at || null,
        partial_payment_authorized: !!convertData.partial_payment_authorized,
        ready_to_start_reason: convertData.ready_to_start_reason,
        services_summary: convertData.selected_services ? convertData.selected_services.map(s => s.name).join(', ') : ''
      };

      // 1. Check if client already exists with same email, instagram, or phone
      let existingClient = null;
      if (convertData.email && convertData.email.trim()) {
        const { data: byEmail, error: errE } = await supabase
          .from('clients')
          .select('id, name')
          .eq('email', convertData.email.trim())
          .limit(1);
        if (!errE && byEmail && byEmail.length > 0) existingClient = byEmail[0];
      }
      if (!existingClient && convertData.instagram && convertData.instagram.trim()) {
        const { data: byInsta, error: errI } = await supabase
          .from('clients')
          .select('id, name')
          .eq('instagram', convertData.instagram.trim())
          .limit(1);
        if (!errI && byInsta && byInsta.length > 0) existingClient = byInsta[0];
      }
      if (!existingClient && convertData.phone && convertData.phone.trim()) {
        const { data: byPhone, error: errP } = await supabase
          .from('clients')
          .select('id, name')
          .eq('phone', convertData.phone.trim())
          .limit(1);
        if (!errP && byPhone && byPhone.length > 0) existingClient = byPhone[0];
      }

      let clientTargetId = '';
      let clientTargetName = '';

      if (existingClient) {
        clientTargetId = existingClient.id;
        clientTargetName = existingClient.name;
        // Update existing client with latest conversion payload
        const { error: updateClientErr } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', clientTargetId);
        if (updateClientErr) throw updateClientErr;
      } else {
        // Insert new client
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert([payload])
          .select()
          .single();

        if (clientError) throw clientError;
        if (!newClient?.id) {
          throw new Error('Cliente creado, pero Supabase no devolvió ID');
        }
        clientTargetId = newClient.id;
        clientTargetName = newClient.name;
      }

      // 2. Insert into activity_log if any requirements are already completed
      if (payload.payment_link_sent) {
        await logActivity('link de pago enviado', `Link de pago enviado a ${payload.name}`, clientTargetId);
      }
      if (payload.contract_sent) {
        await logActivity('contrato enviado', `Contrato enviado a ${payload.name}`, clientTargetId);
      }
      if (payload.contract_signed_received) {
        await logActivity('contrato firmado recibido', `Contrato firmado recibido de ${payload.name}`, clientTargetId);
      }
      if (payload.files_received) {
        await logActivity('manuscrito/archivos recibidos', `Manuscrito o archivos recibidos de ${payload.name}`, clientTargetId);
      }
      if (payload.ready_to_start) {
        await logActivity('cliente listo para iniciar', `Cliente ${payload.name} listo para iniciar trabajo editorial`, clientTargetId);
      }
      if (parseFloat(payload.amount_paid) > 0) {
        await logActivity('pago recibido', `Pago de ${payload.currency} ${parseFloat(payload.amount_paid).toLocaleString()} recibido de ${payload.name}`, clientTargetId);
      }

      // 3. Link prospect with client and update status
      const { error: prospectError } = await supabase
        .from('prospects')
        .update({ 
          converted_to_client_id: clientTargetId,
          converted_client_id: clientTargetId,
          converted_to_client: true,
          status: 'convertido',
          converted_at: new Date().toISOString()
        })
        .eq('id', selectedProspect.id);

      if (prospectError) throw prospectError;

      // 4. Create initial services and income if registered
      if (convertData.register_service) {
        const durationVal = parseInt(convertData.service_duration_value, 10) || 6;
        const durationUnit = convertData.service_duration_unit || 'meses';
        const currency = convertData.currency || 'CLP';

        const servicesToRegister = convertData.selected_services && convertData.selected_services.length > 0
          ? convertData.selected_services
          : [{
              name: convertData.service_type || 'otro',
              price: agreedAmount,
              category: convertData.service_category || 'editorial'
            }];

        for (const [sidx, sItem] of servicesToRegister.entries()) {
          const sValue = parseFloat(sItem.price) || 0;
          const servicePayload = {
            client_id: clientTargetId,
            type: sItem.name,
            book_title: convertData.service_book_title,
            value: sValue,
            currency: currency,
            amount_paid: sidx === 0 ? (parseFloat(convertData.amount_paid) || 0) : 0,
            balance_due: sidx === 0 ? Math.max(0, sValue - (parseFloat(convertData.amount_paid) || 0)) : sValue,
            payment_status: sidx === 0 ? convertData.payment_status : 'pendiente',
            payment_method: convertData.payment_method,
            paid_at: convertData.paid_at || null,
            start_date: convertData.service_start_date,
            contract_duration_value: durationVal,
            contract_duration_unit: durationUnit,
            estimated_delivery: convertData.service_estimated_delivery || null,
            current_stage: convertData.service_current_stage,
            contract_notes: convertData.service_notes || convertData.agreement_notes,
            
            payment_link_sent: !!convertData.payment_link_sent,
            payment_link_sent_at: convertData.payment_link_sent_at || null,
            contract_sent: !!convertData.contract_sent,
            contract_sent_at: convertData.contract_sent_at || null,
            contract_signed_received: !!convertData.contract_signed_received,
            contract_signed_received_at: convertData.contract_signed_received_at || null,
            files_received: !!convertData.files_received,
            files_received_at: convertData.files_received_at || null,
            ready_to_start: !!convertData.ready_to_start,
            contract_start_date: convertData.service_start_date,
            contract_end_date: convertData.service_estimated_delivery || null,

            service_category: sItem.category || 'editorial',
            agreement_period_type: convertData.agreement_period_type,
            materials_received: !!convertData.materials_received,
            materials_received_at: convertData.materials_received_at || null,
            partial_payment_authorized: !!convertData.partial_payment_authorized,
            ready_to_start_reason: convertData.ready_to_start_reason
          };

          const { data: newService, error: serviceError } = await supabase
            .from('services')
            .insert([servicePayload])
            .select()
            .single();

          if (serviceError) throw serviceError;

          if (!newService?.id) {
            throw new Error('Servicio creado, pero Supabase no devolvió ID');
          }

          if (sidx === 0) {
            const amtPaidVal = parseFloat(convertData.amount_paid) || 0;
            if (amtPaidVal > 0) {
              const { error: incomeError } = await supabase
                .from('incomes')
                .insert({
                  client_id: clientTargetId,
                  service_id: newService.id,
                  amount: amtPaidVal,
                  currency: currency,
                  date: convertData.paid_at || convertData.service_start_date || new Date().toISOString().split('T')[0],
                  payment_method: convertData.payment_method || 'transferencia',
                  includes_vat: convertData.includes_vat || false,
                  status: 'pagado',
                  notes: `Pago inicial registrado desde formulario de conversión de prospecto a cliente para la obra: ${convertData.service_book_title}`
                });
              if (incomeError) throw incomeError;
            }
          }

          // Log defined contract in activity_log
          await logActivity('contrato creado', `Se registró contrato con período definido: ${durationVal} ${durationUnit} para la obra ${convertData.service_book_title} (Servicio: ${sItem.name})`, newService.id, 'Servicios');
        }
      }

      await fetchProspects();
      setIsConvertModalOpen(false);
      alert(`¡Prospecto convertido en cliente con éxito! Cliente: ${clientTargetName}`);

    } catch (err) {
      console.error('Error converting prospect to client:', err);
      setFormError(err.message || 'Error al realizar la conversión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get unique countries from prospects list
  const uniqueCountries = Array.from(new Set(prospects.map(p => p.country).filter(Boolean)));

  const filteredProspects = prospects.filter(p => {
    if (!p) return false;
    const name = String(p.name || '').toLowerCase();
    const contact = String(p.contact || '').toLowerCase();
    const interest = String(p.interest_service || '').toLowerCase();
    const query = String(searchQuery || '').toLowerCase();
    
    const matchesSearch = 
      name.includes(query) ||
      contact.includes(query) ||
      interest.includes(query);
      
    const matchesProb = probabilityFilter === 'todos' || p.probability === probabilityFilter;
    const matchesOrig = originFilter === 'todos' || p.origin === originFilter;
    const matchesCountry = countryFilter === 'todos' || p.country === countryFilter;
    const matchesType = clientTypeFilter === 'todos' || p.client_type === clientTypeFilter;
    
    const isConvertedOrExcluded = 
      p.converted_to_client_id || 
      p.converted_client_id || 
      p.converted_to_client === true || 
      ['convertido', 'cliente', 'finalizado', 'perdido', 'perdido / rechazado'].includes(String(p.status || '').toLowerCase().trim());

    let matchesConv = true;
    if (conversionStatus === 'todos' || conversionStatus === 'pendientes') {
      matchesConv = !isConvertedOrExcluded;
    } else if (conversionStatus === 'convertidos') {
      matchesConv = (p.converted_to_client_id || p.converted_client_id || p.converted_to_client === true || p.status === 'convertido');
    }

    return matchesSearch && matchesProb && matchesOrig && matchesCountry && matchesType && matchesConv;
  });

  const handleExportCSV = () => {
    const csvData = filteredProspects.map(p => ({
      Nombre: p.name,
      Contacto: p.contact || '',
      Origen: p.origin || 'Instagram',
      'Servicio Interés': p.interest_service || '',
      Probability: p.probability || 'media',
      'Próxima Acción': p.next_action || '',
      'Fecha Seguimiento': p.followup_date || '',
      País: p.country || '',
      Ciudad: p.city || '',
      'Tipo Cliente': p.client_type || 'nacional',
      'Moneda Preferida': p.preferred_currency || 'CLP',
      'Convertido a Cliente': p.converted_to_client_id ? 'Sí' : 'No',
      Notas: p.notes || '',
      'Fecha Creación': p.created_at ? p.created_at.split('T')[0] : ''
    }));

    exportToCSV(
      csvData,
      'prospectos',
      ['Nombre', 'Contacto', 'Origen', 'Servicio Interés', 'Probability', 'Próxima Acción', 'Fecha Seguimiento', 'País', 'Ciudad', 'Tipo Cliente', 'Moneda Preferida', 'Convertido a Cliente', 'Notas', 'Fecha Creación']
    );
  };

  const getProbColor = (prob) => {
    switch (prob) {
      case 'baja':
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      case 'media':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900';
      case 'alta':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-450 dark:border-emerald-900';
      default:
        return 'bg-slate-50 text-slate-655';
    }
  };

  // Requirements for formData (Prospect modal)
  const formServices = formData.selected_services || [];
  let formReqManuscript = true;
  let formReqMaterials = false;
  let formReqSignedContract = true;
  let formReqAgreementSent = false;
  let formReqDuration = false;

  if (formServices.length > 0) {
    formReqManuscript = formServices.some(s => s.requires_manuscript);
    formReqMaterials = formServices.some(s => s.requires_materials);
    formReqSignedContract = formServices.some(s => s.requires_signed_contract);
    formReqAgreementSent = formServices.some(s => s.requires_agreement_sent);
    formReqDuration = formServices.some(s => s.requires_duration);
  } else {
    const cat = formData.service_category || 'editorial';
    if (cat === 'publicidad' || cat === 'difusión') {
      formReqManuscript = false;
      formReqMaterials = false;
      formReqSignedContract = false;
      formReqAgreementSent = true;
      formReqDuration = true;
    } else if (cat === 'diseño' || cat === 'portada') {
      formReqManuscript = false;
      formReqMaterials = true;
      formReqSignedContract = false;
      formReqAgreementSent = true;
      formReqDuration = false;
    } else if (cat === 'asesoría') {
      formReqManuscript = false;
      formReqMaterials = false;
      formReqSignedContract = false;
      formReqAgreementSent = true;
      formReqDuration = true;
    } else {
      formReqManuscript = true;
      formReqMaterials = false;
      formReqSignedContract = true;
      formReqAgreementSent = false;
      formReqDuration = false;
    }
  }

  // Requirements for convertData (Conversion modal)
  const convertServices = convertData.selected_services || [];
  let convertReqManuscript = true;
  let convertReqMaterials = false;
  let convertReqSignedContract = true;
  let convertReqAgreementSent = false;
  let convertReqDuration = false;

  if (convertServices.length > 0) {
    convertReqManuscript = convertServices.some(s => s.requires_manuscript);
    convertReqMaterials = convertServices.some(s => s.requires_materials);
    convertReqSignedContract = convertServices.some(s => s.requires_signed_contract);
    convertReqAgreementSent = convertServices.some(s => s.requires_agreement_sent);
    convertReqDuration = convertServices.some(s => s.requires_duration);
  } else {
    const cat = convertData.service_category || 'editorial';
    if (cat === 'publicidad' || cat === 'difusión') {
      convertReqManuscript = false;
      convertReqMaterials = false;
      convertReqSignedContract = false;
      convertReqAgreementSent = true;
      convertReqDuration = true;
    } else if (cat === 'diseño' || cat === 'portada') {
      convertReqManuscript = false;
      convertReqMaterials = true;
      convertReqSignedContract = false;
      convertReqAgreementSent = true;
      convertReqDuration = false;
    } else if (cat === 'asesoría') {
      convertReqManuscript = false;
      convertReqMaterials = false;
      convertReqSignedContract = false;
      convertReqAgreementSent = true;
      convertReqDuration = true;
    } else {
      convertReqManuscript = true;
      convertReqMaterials = false;
      convertReqSignedContract = true;
      convertReqAgreementSent = false;
      convertReqDuration = false;
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Prospectos (Leads)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Canal de ventas. Seguimiento de cotizaciones e interesados en servicios editoriales.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={filteredProspects.length === 0}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          {!isReadOnly && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-brand-600/20 cursor-pointer w-fit"
            >
              <Plus className="w-4 h-4" />
              Añadir Prospecto
            </button>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative md:col-span-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, contacto, interés..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Prob Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Pr.:</span>
            <select
              value={probabilityFilter}
              onChange={(e) => setProbabilityFilter(e.target.value)}
              className="block w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all capitalize"
            >
              <option value="todos">Todos</option>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </div>

          {/* Country Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">País:</span>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="block w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none"
            >
              <option value="todos">Todos</option>
              {uniqueCountries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Tipo:</span>
            <select
              value={clientTypeFilter}
              onChange={(e) => setClientTypeFilter(e.target.value)}
              className="block w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none"
            >
              <option value="todos">Todos</option>
              <option value="nacional">Nacional</option>
              <option value="internacional">Internacional</option>
            </select>
          </div>
        </div>

        {/* Tab row for Conversion Status */}
        <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-3 flex-wrap gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setConversionStatus('todos')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${conversionStatus === 'todos' ? 'bg-brand-500 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setConversionStatus('pendientes')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${conversionStatus === 'pendientes' ? 'bg-brand-500 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              Activos (Pendientes)
            </button>
            <button
              onClick={() => setConversionStatus('convertidos')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${conversionStatus === 'convertidos' ? 'bg-brand-500 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              Convertidos
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Origen:</span>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="block px-2.5 py-1 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none"
            >
              <option value="todos">Todos</option>
              <option value="Instagram">Instagram</option>
              <option value="web">Web</option>
              <option value="referido">Referido</option>
              <option value="correo">Correo</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>
      </div>

      {/* Prospects list/table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : filteredProspects.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400">
          No se encontraron prospectos con los filtros aplicados.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 font-semibold">
                  <th className="px-6 py-4">Interesado</th>
                  <th className="px-6 py-4">Contacto / Origen</th>
                  <th className="px-6 py-4">País / Tipo</th>
                  <th className="px-6 py-4">Servicio</th>
                  <th className="px-6 py-4">Probabilidad</th>
                  <th className="px-6 py-4">Próxima Acción / Fecha</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredProspects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</div>
                      {p.converted_to_client_id ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full mt-1 border border-emerald-100 dark:border-emerald-950">
                          <Check className="w-3 h-3" />
                          Cliente Convertido
                        </span>
                      ) : p.city ? (
                        <span className="text-[10px] text-slate-400 font-medium">{p.city}</span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <div className="font-medium text-slate-655 dark:text-slate-300">{p.contact || '-'}</div>
                      <span className="inline-block text-[11px] font-semibold text-slate-405 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded capitalize">
                        {p.origin}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-xs text-slate-705 dark:text-slate-205">{p.country || '-'}</div>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 uppercase tracking-wider ${
                        p.client_type === 'internacional' 
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200' 
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350'
                      }`}>
                        {p.client_type || 'nacional'}
                      </span>
                    </td>
                    <td className="px-6 py-4 capitalize font-medium text-slate-700 dark:text-slate-200">
                      {p.interest_service || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wider ${getProbColor(p.probability)}`}>
                        {p.probability}
                      </span>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">{p.next_action || '-'}</div>
                      {p.followup_date && (
                        <div className="text-[11px] text-brand-600 dark:text-brand-400 font-bold flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {p.followup_date}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                      {!isReadOnly && (
                        <>
                          {!(p.converted_to_client_id || p.converted_to_client || p.status === 'convertido') && (
                            <button
                              onClick={() => handleOpenConvertModal(p)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-sm shadow-emerald-600/10 cursor-pointer"
                              title="Convertir en Cliente"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Convertir</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProspect(p.id)}
                            className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {selectedProspect ? 'Editar Prospecto' : 'Añadir Prospecto'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-5">
                {/* SECCIÓN A: DATOS DEL AUTOR / PROSPECTO */}
                <div className="bg-slate-50/30 dark:bg-slate-950/20 p-4.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 border-b border-slate-100 dark:border-slate-850 pb-2">A. Datos del Prospecto / Autor</h4>
                  
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nombre Prospecto *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><User className="w-4 h-4" /></span>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="e.g. Gabriel García Márquez"
                      />
                    </div>
                  </div>

                  {/* Contact & Origin */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Contacto (Email, Tel o Red)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Send className="w-4 h-4" /></span>
                        <input
                          type="text"
                          value={formData.contact}
                          onChange={(e) => setFormData({...formData, contact: e.target.value})}
                          className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="e.g. @instagram o email@test.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Origen del Lead</label>
                      <select
                        value={formData.origin}
                        onChange={(e) => setFormData({...formData, origin: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 capitalize"
                      >
                        <option value="Instagram">Instagram</option>
                        <option value="web">Página Web</option>
                        <option value="referido">Referido</option>
                        <option value="correo">Correo Electrónico</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  </div>

                  {/* Geography parameters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">País</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Globe className="w-4 h-4" /></span>
                        <input
                          type="text"
                          value={formData.country}
                          onChange={(e) => setFormData({...formData, country: e.target.value})}
                          className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="e.g. Colombia"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Ciudad</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><MapPin className="w-4 h-4" /></span>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({...formData, city: e.target.value})}
                          className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="e.g. Bogotá"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Classifications and preferences */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipo Cliente</label>
                      <select
                        value={formData.client_type}
                        onChange={(e) => setFormData({...formData, client_type: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="nacional">Nacional</option>
                        <option value="internacional">Internacional</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Moneda Preferida</label>
                      <select
                        value={formData.preferred_currency}
                        onChange={(e) => setFormData({...formData, preferred_currency: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="CLP">CLP ($)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                    </div>
                  </div>

                  {/* Probability */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Probabilidad de Cierre</label>
                    <select
                      value={formData.probability}
                      onChange={(e) => setFormData({...formData, probability: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 capitalize"
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>

                  {/* Next Action & Followup date */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Próxima Acción</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><HelpCircle className="w-4 h-4" /></span>
                        <input
                          type="text"
                          value={formData.next_action}
                          onChange={(e) => setFormData({...formData, next_action: e.target.value})}
                          className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="Enviar cotización, llamar..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha de Seguimiento</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Calendar className="w-4 h-4" /></span>
                        <input
                          type="date"
                          value={formData.followup_date}
                          onChange={(e) => setFormData({...formData, followup_date: e.target.value})}
                          className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notas Internas</label>
                    <textarea
                      rows="2.5"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="Detalles sobre lo conversado, requerimientos específicos del libro..."
                    ></textarea>
                  </div>
                </div>

                {/* SECCIÓN B: ACUERDO COMERCIAL Y SERVICIOS */}
                <div className="bg-slate-50/50 dark:bg-slate-950/40 p-4.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 border-b border-slate-100 dark:border-slate-850 pb-2">B. Acuerdo Comercial y Servicios</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Servicios o Packs de Interés</label>
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          
                          let newServ = null;
                          if (val.startsWith('pack:')) {
                            const packId = val.split(':')[1];
                            const p = packs.find(item => String(item.id) === String(packId));
                            if (p) {
                              newServ = {
                                id: `pack-${p.id}`,
                                type: 'pack',
                                name: p.name,
                                price: p.price_special || 0,
                                category: p.category || 'editorial',
                                requires_manuscript: !!p.requires_manuscript,
                                requires_materials: !!p.requires_materials,
                                requires_signed_contract: !!p.requires_signed_contract,
                                requires_agreement_sent: !!p.requires_agreement_sent,
                                requires_duration: !!p.requires_duration
                              };
                            }
                          } else {
                            const catId = val.split(':')[1];
                            const c = catalog.find(item => String(item.id) === String(catId));
                            if (c) {
                              newServ = {
                                id: `service-${c.id}`,
                                type: 'individual',
                                name: c.name,
                                price: c.base_price || 0,
                                category: c.category || 'editorial',
                                requires_manuscript: !!c.requires_manuscript,
                                requires_materials: !!c.requires_materials,
                                requires_signed_contract: !!c.requires_signed_contract,
                                requires_agreement_sent: !!c.requires_agreement_sent,
                                requires_duration: !!c.requires_duration
                              };
                            }
                          }

                          if (newServ) {
                            setFormData(prev => {
                              const alreadyExists = (prev.selected_services || []).some(s => s.id === newServ.id);
                              if (alreadyExists) return prev;
                              const list = [...(prev.selected_services || []), newServ];
                              const sum = list.reduce((total, s) => total + Number(s.price), 0);
                              return {
                                ...prev,
                                selected_services: list,
                                total_agreed_amount: sum
                              };
                            });
                          }
                        }}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">-- Selecciona un servicio o pack --</option>
                        {packs.length > 0 && (
                          <optgroup label="Packs Editoriales">
                            {packs.map(p => (
                              <option key={p.id} value={`pack:${p.id}`}>{p.name} ({p.currency} {Number(p.price_special || 0).toLocaleString()})</option>
                            ))}
                          </optgroup>
                        )}
                        {catalog.length > 0 && (
                          <optgroup label="Servicios Individuales">
                            {catalog.map(c => (
                              <option key={c.id} value={`service:${c.id}`}>{c.name} ({c.currency} {Number(c.base_price || 0).toLocaleString()})</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Valor Cobrado / Acordado Total</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-mono text-xs">{formData.currency}</span>
                        <input
                          type="number"
                          value={formData.total_agreed_amount}
                          onChange={(e) => setFormData({...formData, total_agreed_amount: e.target.value})}
                          className="block w-full pl-12 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="e.g. 1500000"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resumen de servicios seleccionados */}
                  {formData.selected_services && formData.selected_services.length > 0 && (
                    <div className="space-y-2 border border-slate-100 dark:border-slate-800/60 p-3.5 rounded-xl bg-slate-50/40 dark:bg-slate-950/20">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Resumen de Servicios Seleccionados</span>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {formData.selected_services.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl text-xs shadow-sm">
                            <div className="space-y-0.5">
                              <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase border ${item.type === 'pack' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-900 dark:text-indigo-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400'}`}>
                                {item.type === 'pack' ? 'Pack' : 'Servicio'}
                              </span>
                              <div className="font-bold text-slate-750 dark:text-slate-200 capitalize">{item.name}</div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 font-bold">{formData.currency}</span>
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setFormData(prev => {
                                    const list = prev.selected_services.map((s, sidx) => sidx === idx ? { ...s, price: val } : s);
                                    const sum = list.reduce((total, s) => total + Number(s.price), 0);
                                    return {
                                      ...prev,
                                      selected_services: list,
                                      total_agreed_amount: sum
                                    };
                                  });
                                }}
                                className="w-24 px-1.5 py-1 border border-slate-200 dark:border-slate-855 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg text-center text-xs font-semibold focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData(prev => {
                                    const list = prev.selected_services.filter((_, sidx) => sidx !== idx);
                                    const sum = list.reduce((total, s) => total + Number(s.price), 0);
                                    return {
                                      ...prev,
                                      selected_services: list,
                                      total_agreed_amount: sum
                                    };
                                  });
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Moneda del Acuerdo</label>
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData({...formData, currency: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="CLP">CLP</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Monto Pagado</label>
                      <input
                        type="number"
                        value={formData.amount_paid}
                        onChange={(e) => setFormData({...formData, amount_paid: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="e.g. 750050"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Método de Pago</label>
                      <select
                        value={formData.payment_method}
                        onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="transferencia">Transferencia bancaria</option>
                        <option value="paypal">PayPal</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Estado de Pago (Auto-calculado)</label>
                      <div className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200 text-sm font-semibold capitalize">
                        {formData.payment_status}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha de Pago</label>
                      <input
                        type="date"
                        value={formData.paid_at}
                        onChange={(e) => setFormData({...formData, paid_at: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-150 dark:border-slate-800 text-xs">
                    <div>
                      <span className="font-bold text-slate-455 uppercase mr-2">Saldo Pendiente:</span>
                      <span className="font-mono font-extrabold text-rose-600 dark:text-rose-455 text-sm">
                        {formData.currency} {Number(formData.balance_due || 0).toLocaleString()}
                      </span>
                    </div>
                    
                    <label className="flex items-center gap-2 cursor-pointer text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <input
                        type="checkbox"
                        checked={formData.includes_vat}
                        onChange={(e) => setFormData({...formData, includes_vat: e.target.checked})}
                        className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Incluye IVA</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Observaciones del Acuerdo</label>
                    <textarea
                      rows="2"
                      value={formData.agreement_notes}
                      onChange={(e) => setFormData({...formData, agreement_notes: e.target.value})}
                      className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="Notas del acuerdo de pago, cuotas pactadas..."
                    ></textarea>
                  </div>
                </div>

                {/* SECCIÓN C: DOCUMENTOS Y REQUISITOS DE INICIO */}
                <div className="bg-slate-50/50 dark:bg-slate-950/40 p-4.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 border-b border-slate-100 dark:border-slate-850 pb-2">C. Requisitos y Documentos</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Link de pago */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.payment_link_sent}
                          onChange={(e) => setFormData({...formData, payment_link_sent: e.target.checked})}
                          className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4"
                        />
                        <span>Link de pago enviado</span>
                      </label>
                      {formData.payment_link_sent && (
                        <input
                          type="date"
                          value={formData.payment_link_sent_at}
                          onChange={(e) => setFormData({...formData, payment_link_sent_at: e.target.value})}
                          className="block w-full px-2.5 py-1 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs"
                        />
                      )}
                    </div>

                    {/* Contrato / Acuerdo enviado */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.contract_sent}
                          onChange={(e) => setFormData({...formData, contract_sent: e.target.checked})}
                          className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4"
                        />
                        <span>{formData.service_category === 'editorial' ? 'Contrato enviado' : 'Contrato/acuerdo enviado'}</span>
                      </label>
                      {formData.contract_sent && (
                        <input
                          type="date"
                          value={formData.contract_sent_at}
                          onChange={(e) => setFormData({...formData, contract_sent_at: e.target.value})}
                          className="block w-full px-2.5 py-1 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs"
                        />
                      )}
                    </div>

                    {/* Contrato firmado (condicional) */}
                    {formReqSignedContract && (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={formData.contract_signed_received}
                            onChange={(e) => setFormData({...formData, contract_signed_received: e.target.checked})}
                            className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4"
                          />
                          <span>Contrato firmado recibido</span>
                        </label>
                        {formData.contract_signed_received && (
                          <input
                            type="date"
                            value={formData.contract_signed_received_at}
                            onChange={(e) => setFormData({...formData, contract_signed_received_at: e.target.value})}
                            className="block w-full px-2.5 py-1 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs"
                          />
                        )}
                      </div>
                    )}

                    {/* Manuscrito / Archivos (condicional) */}
                    {formReqManuscript && (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={formData.files_received}
                            onChange={(e) => setFormData({...formData, files_received: e.target.checked})}
                            className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4"
                          />
                          <span>Manuscrito/archivos recibidos</span>
                        </label>
                        {formData.files_received && (
                          <input
                            type="date"
                            value={formData.files_received_at}
                            onChange={(e) => setFormData({...formData, files_received_at: e.target.value})}
                            className="block w-full px-2.5 py-1 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs"
                          />
                        )}
                      </div>
                    )}

                    {/* Materiales / Briefing (condicional) */}
                    {formReqMaterials && (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={formData.materials_received}
                            onChange={(e) => setFormData({...formData, materials_received: e.target.checked})}
                            className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                          />
                          <span>Materiales/briefing recibidos</span>
                        </label>
                        {formData.materials_received && (
                          <input
                            type="date"
                            value={formData.materials_received_at}
                            onChange={(e) => setFormData({...formData, materials_received_at: e.target.value})}
                            className="block w-full px-2.5 py-1 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs"
                          />
                        )}
                      </div>
                    )}

                    {/* Autorización de pago parcial */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.partial_payment_authorized}
                          onChange={(e) => setFormData({...formData, partial_payment_authorized: e.target.checked})}
                          className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                        />
                        <span>Autorizar inicio con pago parcial</span>
                      </label>
                      <p className="text-[10px] text-slate-400 leading-tight font-medium">Habilita "Listo para iniciar" aunque no esté pagado al 100%.</p>
                    </div>
                  </div>

                  {/* VISUAL CHECKLIST: Condiciones para iniciar trabajo */}
                  <div className="bg-brand-50/20 dark:bg-brand-950/10 p-4 rounded-xl border border-brand-100/50 dark:border-brand-900/30 space-y-3">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-brand-800 dark:text-brand-455">
                      Condiciones para iniciar trabajo
                    </h5>
                    
                    <div className="space-y-2">
                      {/* 1. Payment check */}
                      <div className="flex items-center gap-2.5 text-xs">
                        {formData.payment_status === 'pagado' || formData.payment_status === 'pago parcial' || formData.partial_payment_authorized ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                            <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">✓</span> 
                            Pago recibido o parcial autorizado
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-455 font-semibold flex items-center gap-1.5">
                            <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px]">✗</span> 
                            Pago pendiente
                          </span>
                        )}
                      </div>

                      {/* 2. Contract signed check */}
                      {formReqSignedContract && (
                        <div className="flex items-center gap-2.5 text-xs">
                          {formData.contract_signed_received ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">✓</span> 
                              Contrato firmado recibido
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-455 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px]">✗</span> 
                              Falta recibir contrato firmado
                            </span>
                          )}
                        </div>
                      )}

                      {/* 3. Agreement sent check */}
                      {formReqAgreementSent && (
                        <div className="flex items-center gap-2.5 text-xs">
                          {formData.contract_sent ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">✓</span> 
                              Contrato/acuerdo enviado o aceptado
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-455 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px]">✗</span> 
                              Falta enviar contrato/acuerdo
                            </span>
                          )}
                        </div>
                      )}

                      {/* 4. Files check */}
                      {formReqManuscript && (
                        <div className="flex items-center gap-2.5 text-xs">
                          {formData.files_received ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">✓</span> 
                              Manuscrito o archivos recibidos
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-455 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px]">✗</span> 
                              Falta recibir manuscrito o archivos
                            </span>
                          )}
                        </div>
                      )}

                      {/* 5. Materials check */}
                      {formReqMaterials && (
                        <div className="flex items-center gap-2.5 text-xs">
                          {formData.materials_received ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">✓</span> 
                              Materiales o briefing recibidos
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-455 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px]">✗</span> 
                              Falta recibir materiales o briefing
                            </span>
                          )}
                        </div>
                      )}

                      {/* 6. Period check */}
                      {formReqDuration && (
                        <div className="flex items-center gap-2.5 text-xs">
                          {formData.service_start_date && formData.service_duration_value ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">✓</span> 
                              Periodo del servicio definido
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-455 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px]">✗</span> 
                              Falta definir periodo del servicio
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Texto de difusión sugerido */}
                    {(formData.service_category === 'publicidad' || formData.service_category === 'difusión') && (
                      <p className="text-[10px] text-brand-700 dark:text-brand-300 italic bg-brand-50/50 dark:bg-brand-950/20 p-2 rounded-lg border border-brand-100/35">
                        “Este servicio de difusión puede iniciar cuando exista pago confirmado y periodo definido.”
                      </p>
                    )}

                    {formData.ready_to_start ? (
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 text-center uppercase tracking-wider">
                        ★ Listo para iniciar trabajo ({formData.service_category}) ★
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10.5px] text-slate-400 text-center">
                        Para habilitar "Listo para iniciar", complete los requisitos marcados con <span className="text-rose-600 font-bold">✗</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECCIÓN D: PERIODO DEL CONTRATO O ACUERDO */}
                <div className="bg-slate-50/50 dark:bg-slate-950/40 p-4.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/50 pb-2">D. Periodo del contrato o acuerdo</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipo de periodo *</label>
                      <select
                        value={formData.agreement_period_type || 'contrato editorial'}
                        onChange={(e) => setFormData({ ...formData, agreement_period_type: e.target.value })}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="contrato editorial">Contrato editorial</option>
                        <option value="campaña de difusión">Campaña de difusión</option>
                        <option value="asesoría">Asesoría</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha de inicio *</label>
                      <input
                        type="date"
                        value={formData.service_start_date}
                        onChange={(e) => setFormData({ ...formData, service_start_date: e.target.value })}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Duración</label>
                      <input
                        type="number"
                        value={formData.service_duration_value}
                        onChange={(e) => setFormData({ ...formData, service_duration_value: e.target.value })}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="e.g. 6"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Unidad de Duración</label>
                      <select
                        value={formData.service_duration_unit}
                        onChange={(e) => setFormData({ ...formData, service_duration_unit: e.target.value })}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="días">Días</option>
                        <option value="semanas">Semanas</option>
                        <option value="meses">Meses</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Término Estimado (Calculado)</label>
                      <input
                        type="date"
                        readOnly
                        disabled
                        value={formData.service_estimated_delivery}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed font-medium font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-350 rounded-xl text-sm font-semibold hover:bg-slate-55 cursor-pointer shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-brand-600/10"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isConvertModalOpen && selectedProspect && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                Convertir Prospecto a Cliente
              </h3>
              <button 
                onClick={() => setIsConvertModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleConvertSubmit} className="p-6 space-y-5">
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 p-4 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed font-medium">
                Vas a registrar formalmente a <strong>{selectedProspect.name}</strong> en la base de datos de Clientes. Se conservarán los datos de contacto y se actualizará su estado comercial a Cliente.
              </div>

              {formError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-5">
                {/* SECCIÓN A: DATOS DEL AUTOR / CLIENTE */}
                <div className="bg-slate-50/30 dark:bg-slate-950/20 p-4.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 border-b border-slate-100 dark:border-slate-850 pb-2">A. Datos del Autor / Cliente</h4>
                  
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nombre Completo *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><User className="w-4 h-4" /></span>
                      <input
                        type="text"
                        required
                        value={convertData.name}
                        onChange={(e) => setConvertData({...convertData, name: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  {/* Email & Instagram */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={convertData.email}
                        onChange={(e) => setConvertData({...convertData, email: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Instagram</label>
                      <input
                        type="text"
                        value={convertData.instagram}
                        onChange={(e) => setConvertData({...convertData, instagram: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="@instagram"
                      />
                    </div>
                  </div>

                  {/* Phone & Country */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Teléfono</label>
                      <input
                        type="text"
                        value={convertData.phone}
                        onChange={(e) => setConvertData({...convertData, phone: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="+56 9..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">País</label>
                      <input
                        type="text"
                        value={convertData.country}
                        onChange={(e) => setConvertData({...convertData, country: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="e.g. Chile"
                      />
                    </div>
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Ciudad</label>
                    <input
                      type="text"
                      value={convertData.city}
                      onChange={(e) => setConvertData({...convertData, city: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="e.g. Santiago"
                    />
                  </div>

                  {/* Client Type & Preferred Currency */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipo Cliente</label>
                      <select
                        value={convertData.client_type}
                        onChange={(e) => setConvertData({...convertData, client_type: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="nacional">Nacional</option>
                        <option value="internacional">Internacional</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Moneda Preferida</label>
                      <select
                        value={convertData.preferred_currency}
                        onChange={(e) => setConvertData({...convertData, preferred_currency: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="CLP">CLP</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Estado del Pipeline *</label>
                    <select
                      value={convertData.status}
                      onChange={(e) => setConvertData({...convertData, status: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 capitalize"
                    >
                      <option value="prospecto">Prospecto</option>
                      <option value="interesado">Interesado</option>
                      <option value="contrato enviado">Contrato Enviado</option>
                      <option value="link de pago enviado">Link de Pago Enviado</option>
                      <option value="esperando pago">Esperando Pago</option>
                      <option value="pago recibido">Pago Recibido</option>
                      <option value="contrato firmado recibido">Contrato Firmado Recibido</option>
                      <option value="esperando manuscrito/archivos">Esperando Manuscrito/Archivos</option>
                      <option value="listo para iniciar">Listo para Iniciar</option>
                      <option value="en proceso editorial">En Proceso Editorial</option>
                      <option value="finalizado">Finalizado</option>
                      <option value="perdido / rechazado">Perdido / Rechazado</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notas Internas de Cliente</label>
                    <textarea
                      rows="3"
                      value={convertData.notes}
                      onChange={(e) => setConvertData({...convertData, notes: e.target.value})}
                      className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    ></textarea>
                  </div>
                </div>

                {/* SECCIÓN B: ACUERDO COMERCIAL Y SERVICIOS */}
                <div className="bg-slate-50/50 dark:bg-slate-950/40 p-4.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 border-b border-slate-100 dark:border-slate-850 pb-2">B. Acuerdo Comercial y Servicios</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Servicios o Packs de Interés</label>
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          
                          let newServ = null;
                          if (val.startsWith('pack:')) {
                            const packId = val.split(':')[1];
                            const p = packs.find(item => String(item.id) === String(packId));
                            if (p) {
                              newServ = {
                                id: `pack-${p.id}`,
                                type: 'pack',
                                name: p.name,
                                price: p.price_special || 0,
                                category: p.category || 'editorial',
                                requires_manuscript: !!p.requires_manuscript,
                                requires_materials: !!p.requires_materials,
                                requires_signed_contract: !!p.requires_signed_contract,
                                requires_agreement_sent: !!p.requires_agreement_sent,
                                requires_duration: !!p.requires_duration
                              };
                            }
                          } else {
                            const catId = val.split(':')[1];
                            const c = catalog.find(item => String(item.id) === String(catId));
                            if (c) {
                              newServ = {
                                id: `service-${c.id}`,
                                type: 'individual',
                                name: c.name,
                                price: c.base_price || 0,
                                category: c.category || 'editorial',
                                requires_manuscript: !!c.requires_manuscript,
                                requires_materials: !!c.requires_materials,
                                requires_signed_contract: !!c.requires_signed_contract,
                                requires_agreement_sent: !!c.requires_agreement_sent,
                                requires_duration: !!c.requires_duration
                              };
                            }
                          }

                          if (newServ) {
                            setConvertData(prev => {
                              const alreadyExists = (prev.selected_services || []).some(s => s.id === newServ.id);
                              if (alreadyExists) return prev;
                              const list = [...(prev.selected_services || []), newServ];
                              const sum = list.reduce((total, s) => total + Number(s.price), 0);
                              return {
                                ...prev,
                                selected_services: list,
                                total_agreed_amount: sum
                              };
                            });
                          }
                        }}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">-- Selecciona un servicio o pack --</option>
                        {packs.length > 0 && (
                          <optgroup label="Packs Editoriales">
                            {packs.map(p => (
                              <option key={p.id} value={`pack:${p.id}`}>{p.name} ({p.currency} {Number(p.price_special || 0).toLocaleString()})</option>
                            ))}
                          </optgroup>
                        )}
                        {catalog.length > 0 && (
                          <optgroup label="Servicios Individuales">
                            {catalog.map(c => (
                              <option key={c.id} value={`service:${c.id}`}>{c.name} ({c.currency} {Number(c.base_price || 0).toLocaleString()})</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Valor Cobrado / Acordado Total</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-mono text-xs">{convertData.currency}</span>
                        <input
                          type="number"
                          value={convertData.total_agreed_amount}
                          onChange={(e) => setConvertData({...convertData, total_agreed_amount: e.target.value})}
                          className="block w-full pl-12 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="e.g. 1500000"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resumen de servicios seleccionados */}
                  {convertData.selected_services && convertData.selected_services.length > 0 && (
                    <div className="space-y-2 border border-slate-100 dark:border-slate-800/60 p-3.5 rounded-xl bg-slate-50/40 dark:bg-slate-950/20">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Resumen de Servicios Seleccionados</span>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {convertData.selected_services.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl text-xs shadow-sm">
                            <div className="space-y-0.5">
                              <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase border ${item.type === 'pack' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-900 dark:text-indigo-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400'}`}>
                                {item.type === 'pack' ? 'Pack' : 'Servicio'}
                              </span>
                              <div className="font-bold text-slate-750 dark:text-slate-200 capitalize">{item.name}</div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 font-bold">{convertData.currency}</span>
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setConvertData(prev => {
                                    const list = prev.selected_services.map((s, sidx) => sidx === idx ? { ...s, price: val } : s);
                                    const sum = list.reduce((total, s) => total + Number(s.price), 0);
                                    return {
                                      ...prev,
                                      selected_services: list,
                                      total_agreed_amount: sum
                                    };
                                  });
                                }}
                                className="w-24 px-1.5 py-1 border border-slate-200 dark:border-slate-855 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg text-center text-xs font-semibold focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setConvertData(prev => {
                                    const list = prev.selected_services.filter((_, sidx) => sidx !== idx);
                                    const sum = list.reduce((total, s) => total + Number(s.price), 0);
                                    return {
                                      ...prev,
                                      selected_services: list,
                                      total_agreed_amount: sum
                                    };
                                  });
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Moneda del Acuerdo</label>
                      <select
                        value={convertData.currency}
                        onChange={(e) => setConvertData({...convertData, currency: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="CLP">CLP</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Monto Pagado</label>
                      <input
                        type="number"
                        value={convertData.amount_paid}
                        onChange={(e) => setConvertData({...convertData, amount_paid: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="e.g. 750050"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Método de Pago</label>
                      <select
                        value={convertData.payment_method}
                        onChange={(e) => setConvertData({...convertData, payment_method: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="transferencia">Transferencia bancaria</option>
                        <option value="paypal">PayPal</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Estado de Pago (Auto-calculado)</label>
                      <div className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200 text-sm font-semibold capitalize">
                        {convertData.payment_status}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha de Pago</label>
                      <input
                        type="date"
                        value={convertData.paid_at}
                        onChange={(e) => setConvertData({...convertData, paid_at: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-150 dark:border-slate-800 text-xs">
                    <div>
                      <span className="font-bold text-slate-455 uppercase mr-2">Saldo Pendiente:</span>
                      <span className="font-mono font-extrabold text-rose-600 dark:text-rose-455 text-sm">
                        {convertData.currency} {Number(convertData.balance_due || 0).toLocaleString()}
                      </span>
                    </div>
                    
                    <label className="flex items-center gap-2 cursor-pointer text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <input
                        type="checkbox"
                        checked={convertData.includes_vat}
                        onChange={(e) => setConvertData({...convertData, includes_vat: e.target.checked})}
                        className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Incluye IVA</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Observaciones del Acuerdo</label>
                    <textarea
                      rows="2"
                      value={convertData.agreement_notes}
                      onChange={(e) => setConvertData({...convertData, agreement_notes: e.target.value})}
                      className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="Notas del acuerdo de pago, cuotas pactadas..."
                    ></textarea>
                  </div>
                </div>

                {/* SECCIÓN C: DOCUMENTOS Y REQUISITOS DE INICIO */}
                <div className="bg-slate-50/50 dark:bg-slate-950/40 p-4.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 border-b border-slate-100 dark:border-slate-855 pb-2">C. Requisitos y Documentos</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Link de pago */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={convertData.payment_link_sent}
                          onChange={(e) => setConvertData({...convertData, payment_link_sent: e.target.checked})}
                          className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4"
                        />
                        <span>Link de pago enviado</span>
                      </label>
                      {convertData.payment_link_sent && (
                        <input
                          type="date"
                          value={convertData.payment_link_sent_at}
                          onChange={(e) => setConvertData({...convertData, payment_link_sent_at: e.target.value})}
                          className="block w-full px-2.5 py-1 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs"
                        />
                      )}
                    </div>

                    {/* Contrato / Acuerdo enviado */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={convertData.contract_sent}
                          onChange={(e) => setConvertData({...convertData, contract_sent: e.target.checked})}
                          className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4"
                        />
                        <span>{convertData.service_category === 'editorial' ? 'Contrato enviado' : 'Contrato/acuerdo enviado'}</span>
                      </label>
                      {convertData.contract_sent && (
                        <input
                          type="date"
                          value={convertData.contract_sent_at}
                          onChange={(e) => setConvertData({...convertData, contract_sent_at: e.target.value})}
                          className="block w-full px-2.5 py-1 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs"
                        />
                      )}
                    </div>

                    {/* Contrato firmado (condicional) */}
                    {convertReqSignedContract && (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={convertData.contract_signed_received}
                            onChange={(e) => setConvertData({...convertData, contract_signed_received: e.target.checked})}
                            className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4"
                          />
                          <span>Contrato firmado recibido</span>
                        </label>
                        {convertData.contract_signed_received && (
                          <input
                            type="date"
                            value={convertData.contract_signed_received_at}
                            onChange={(e) => setConvertData({...convertData, contract_signed_received_at: e.target.value})}
                            className="block w-full px-2.5 py-1 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs"
                          />
                        )}
                      </div>
                    )}

                    {/* Manuscrito / Archivos (condicional) */}
                    {convertReqManuscript && (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={convertData.files_received}
                            onChange={(e) => setConvertData({...convertData, files_received: e.target.checked})}
                            className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4"
                          />
                          <span>Manuscrito/archivos recibidos</span>
                        </label>
                        {convertData.files_received && (
                          <input
                            type="date"
                            value={convertData.files_received_at}
                            onChange={(e) => setConvertData({...convertData, files_received_at: e.target.value})}
                            className="block w-full px-2.5 py-1 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs"
                          />
                        )}
                      </div>
                    )}

                    {/* Materiales / Briefing (condicional) */}
                    {convertReqMaterials && (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={convertData.materials_received}
                            onChange={(e) => setConvertData({...convertData, materials_received: e.target.checked})}
                            className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                          />
                          <span>Materiales/briefing recibidos</span>
                        </label>
                        {convertData.materials_received && (
                          <input
                            type="date"
                            value={convertData.materials_received_at}
                            onChange={(e) => setConvertData({...convertData, materials_received_at: e.target.value})}
                            className="block w-full px-2.5 py-1 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs"
                          />
                        )}
                      </div>
                    )}

                    {/* Autorización de pago parcial */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={convertData.partial_payment_authorized}
                          onChange={(e) => setConvertData({...convertData, partial_payment_authorized: e.target.checked})}
                          className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                        />
                        <span>Autorizar inicio con pago parcial</span>
                      </label>
                      <p className="text-[10px] text-slate-400 leading-tight font-medium">Habilita "Listo para iniciar" aunque no esté pagado al 100%.</p>
                    </div>
                  </div>

                  {/* VISUAL CHECKLIST: Condiciones para iniciar trabajo */}
                  <div className="bg-brand-50/20 dark:bg-brand-950/10 p-4 rounded-xl border border-brand-100/50 dark:border-brand-900/30 space-y-3">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-brand-800 dark:text-brand-455">
                      Condiciones para iniciar trabajo
                    </h5>
                    
                    <div className="space-y-2">
                      {/* 1. Payment check */}
                      <div className="flex items-center gap-2.5 text-xs">
                        {convertData.payment_status === 'pagado' || convertData.payment_status === 'pago parcial' || convertData.partial_payment_authorized ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                            <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">✓</span> 
                            Pago recibido o parcial autorizado
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-455 font-semibold flex items-center gap-1.5">
                            <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px]">✗</span> 
                            Pago pendiente
                          </span>
                        )}
                      </div>

                      {/* 2. Contract signed check */}
                      {convertReqSignedContract && (
                        <div className="flex items-center gap-2.5 text-xs">
                          {convertData.contract_signed_received ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">✓</span> 
                              Contrato firmado recibido
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-455 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px]">✗</span> 
                              Falta recibir contrato firmado
                            </span>
                          )}
                        </div>
                      )}

                      {/* 3. Agreement sent check */}
                      {convertReqAgreementSent && (
                        <div className="flex items-center gap-2.5 text-xs">
                          {convertData.contract_sent ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">✓</span> 
                              Contrato/acuerdo enviado o aceptado
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-455 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px]">✗</span> 
                              Falta enviar contrato/acuerdo
                            </span>
                          )}
                        </div>
                      )}

                      {/* 4. Files check */}
                      {convertReqManuscript && (
                        <div className="flex items-center gap-2.5 text-xs">
                          {convertData.files_received ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">✓</span> 
                              Manuscrito o archivos recibidos
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-455 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px]">✗</span> 
                              Falta recibir manuscrito o archivos
                            </span>
                          )}
                        </div>
                      )}

                      {/* 5. Materials check */}
                      {convertReqMaterials && (
                        <div className="flex items-center gap-2.5 text-xs">
                          {convertData.materials_received ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">✓</span> 
                              Materiales o briefing recibidos
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-455 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px]">✗</span> 
                              Falta recibir materiales o briefing
                            </span>
                          )}
                        </div>
                      )}

                      {/* 6. Period check */}
                      {convertReqDuration && (
                        <div className="flex items-center gap-2.5 text-xs">
                          {convertData.service_start_date && convertData.service_duration_value ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">✓</span> 
                              Periodo del servicio definido
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-455 font-semibold flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px]">✗</span> 
                              Falta definir periodo del servicio
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Texto de difusión sugerido */}
                    {(convertData.service_category === 'publicidad' || convertData.service_category === 'difusión') && (
                      <p className="text-[10px] text-brand-700 dark:text-brand-300 italic bg-brand-50/50 dark:bg-brand-950/20 p-2 rounded-lg border border-brand-100/35">
                        “Este servicio de difusión puede iniciar cuando exista pago confirmado y periodo definido.”
                      </p>
                    )}

                    {convertData.ready_to_start ? (
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 text-center uppercase tracking-wider">
                        ★ Listo para iniciar trabajo ({convertData.service_category}) ★
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10.5px] text-slate-400 text-center">
                        Para habilitar "Listo para iniciar", complete los requisitos marcados con <span className="text-rose-600 font-bold">✗</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECCIÓN D: PERIODO DEL CONTRATO O ACUERDO */}
                <div className="bg-slate-50/50 dark:bg-slate-950/40 p-4.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/50 pb-2">D. Periodo del contrato o acuerdo</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipo de periodo *</label>
                      <select
                        value={convertData.agreement_period_type || 'contrato editorial'}
                        onChange={(e) => setConvertData({ ...convertData, agreement_period_type: e.target.value })}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="contrato editorial">Contrato editorial</option>
                        <option value="campaña de difusión">Campaña de difusión</option>
                        <option value="asesoría">Asesoría</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha de inicio *</label>
                      <input
                        type="date"
                        value={convertData.service_start_date}
                        onChange={(e) => setConvertData({ ...convertData, service_start_date: e.target.value })}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Duración</label>
                      <input
                        type="number"
                        value={convertData.service_duration_value}
                        onChange={(e) => setConvertData({ ...convertData, service_duration_value: e.target.value })}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="e.g. 6"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Unidad de Duración</label>
                      <select
                        value={convertData.service_duration_unit}
                        onChange={(e) => setConvertData({ ...convertData, service_duration_unit: e.target.value })}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="días">Días</option>
                        <option value="semanas">Semanas</option>
                        <option value="meses">Meses</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Término Estimado (Calculado)</label>
                      <input
                        type="date"
                        readOnly
                        disabled
                        value={convertData.service_estimated_delivery}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed font-medium font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* SECCIÓN E: REGISTRAR SERVICIO INICIAL */}
                <div className="bg-slate-50/50 dark:bg-slate-950/40 p-4.5 rounded-xl border border-slate-100 dark:border-slate-800/80 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={convertData.register_service}
                        onChange={(e) => setConvertData({ ...convertData, register_service: e.target.checked })}
                        className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Registrar servicio inicial para este cliente</span>
                    </label>
                  </div>

                  {convertData.register_service && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800 space-y-4 animate-fade-in">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/50 pb-2">E. Servicio Inicial / Obra</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(!convertData.selected_services || convertData.selected_services.length === 0) && (
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipo de Servicio o Pack contratado *</label>
                            <select
                              value={convertData.service_type}
                              onChange={(e) => setConvertData({ ...convertData, service_type: e.target.value })}
                              className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                              <option value="corrección">Corrección</option>
                              <option value="maquetación">Maquetación</option>
                              <option value="portada">Portada</option>
                              <option value="ebook">Ebook</option>
                              <option value="libro físico">Libro físico</option>
                              <option value="difusión">Difusión</option>
                              <option value="derechos de autor">Derechos de autor</option>
                              <option value="asesoría de publicación">Asesoría de publicación</option>
                              <option value="otro">Otro</option>
                            </select>
                          </div>
                        )}

                        <div className={convertData.selected_services && convertData.selected_services.length > 0 ? "col-span-2" : ""}>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Título del Libro / Proyecto</label>
                          <input
                            type="text"
                            value={convertData.service_book_title}
                            onChange={(e) => setConvertData({ ...convertData, service_book_title: e.target.value })}
                            className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            placeholder="e.g. La Casa de los Espíritus"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Etapa Inicial del Servicio</label>
                          <select
                            value={convertData.service_current_stage}
                            onChange={(e) => setConvertData({ ...convertData, service_current_stage: e.target.value })}
                            className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          >
                            {editorialStages.length > 0 ? (
                              editorialStages.map(stage => (
                                <option key={stage.id} value={stage.name}>{stage.name}</option>
                              ))
                            ) : (
                              <>
                                <option value="recepción de material">recepción de material</option>
                                <option value="diseño">diseño</option>
                                <option value="maquetación">maquetación</option>
                                <option value="entregado">entregado</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-455 mb-1.5">Notas Especiales</label>
                          <input
                            type="text"
                            value={convertData.service_notes}
                            onChange={(e) => setConvertData({ ...convertData, service_notes: e.target.value })}
                            className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            placeholder="Especificar acuerdos especiales..."
                          />
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-350 rounded-xl text-sm font-semibold hover:bg-slate-55 cursor-pointer shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-600/10"
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar y Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
