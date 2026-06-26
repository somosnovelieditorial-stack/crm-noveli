import { useEffect, useState } from 'react';
import { supabase, isMock } from '../supabaseClient';
import { formatDate, exportToCSV } from '../utils';
import { 
  Plus, Search, Edit2, Trash2, Eye, X, 
  User, Mail, Phone, Globe, FileText, Download, DollarSign, MapPin, Clock,
  BookOpen, ChevronDown, ChevronUp, AlertCircle, CheckCircle, AlertTriangle, Calendar, ClipboardList,
  UploadCloud, FileSpreadsheet, Image, File, Briefcase
} from 'lucide-react';

const InstagramIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

export default function Clients({ isReadOnly = false, userRole = 'administrador' }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [countryFilter, setCountryFilter] = useState('todos');
  const [clientTypeFilter, setClientTypeFilter] = useState('todos');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [detailTab, setDetailTab] = useState('info'); // 'info' o 'docs'
  const [clientDocuments, setClientDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [newDocFile, setNewDocFile] = useState(null);
  const [newDocType, setNewDocType] = useState('contrato');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocNotes, setNewDocNotes] = useState('');
  
  // Editorial stages and Client services
  const [editorialStages, setEditorialStages] = useState([]);
  const [clientServices, setClientServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // Form state
  const [catalog, setCatalog] = useState([]);
  const [packs, setPacks] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    instagram: '',
    phone: '',
    country: '',
    city: '',
    client_type: 'nacional',
    preferred_currency: 'CLP',
    status: 'prospecto',
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

    // Initial Service / contract Fields
    register_service: false,
    service_id: '',
    service_type: 'corrección',
    service_book_title: '',
    service_value: '',
    service_currency: 'CLP',
    service_amount_paid: '0',
    service_payment_status: 'pendiente',
    service_payment_method: 'transferencia',
    service_includes_vat: false,
    service_paid_at: '',
    service_start_date: new Date().toISOString().split('T')[0],
    service_duration_value: '6',
    service_duration_unit: 'meses',
    service_estimated_delivery: '',
    service_current_stage: 'recepción de material',
    service_notes: '',
    allow_excess_payment: false
  });
  
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to calculate estimated delivery date
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

  // Helper to compute duration statistics
  const getDurationStats = (startDateStr, estDeliveryStr, durationVal, durationUnit) => {
    const start = new Date(startDateStr);
    const today = new Date();
    
    const val = durationVal !== undefined && durationVal !== null && durationVal !== '' ? parseInt(durationVal, 10) : 6;
    const unit = durationUnit || 'meses';

    const diffTime = today - start;
    const elapsedDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    let elapsedText = '';
    if (unit === 'meses') {
      const elapsedMonths = Math.floor(elapsedDays / 30);
      const elapsedRemainingDays = elapsedDays % 30;
      elapsedText = elapsedMonths > 0 
        ? `${elapsedMonths} meses y ${elapsedRemainingDays} días` 
        : `${elapsedDays} días`;
    } else if (unit === 'semanas') {
      const elapsedWeeks = Math.floor(elapsedDays / 7);
      const elapsedRemainingDays = elapsedDays % 7;
      elapsedText = elapsedWeeks > 0 
        ? `${elapsedWeeks} semanas y ${elapsedRemainingDays} días` 
        : `${elapsedDays} días`;
    } else { // 'días'
      elapsedText = `${elapsedDays} días`;
    }

    const totalText = `${val} ${unit}`;

    let end = estDeliveryStr ? new Date(estDeliveryStr) : null;
    if (!end && startDateStr) {
      const computedEnd = new Date(startDateStr);
      if (unit === 'meses') {
        computedEnd.setMonth(computedEnd.getMonth() + val);
      } else if (unit === 'semanas') {
        computedEnd.setDate(computedEnd.getDate() + (val * 7));
      } else { // 'días'
        computedEnd.setDate(computedEnd.getDate() + val);
      }
      end = computedEnd;
    }

    let remainingDays = null;
    let remainingText = 'Sin definir';
    let alertNear = false;
    let alertLate = false;

    if (end) {
      const remainingDiff = end - today;
      remainingDays = Math.ceil(remainingDiff / (1000 * 60 * 60 * 24));
      
      if (remainingDays < 0) {
        alertLate = true;
        remainingText = `Atrasado por ${Math.abs(remainingDays)} días`;
      } else {
        if (unit === 'meses' && remainingDays <= 15) {
          alertNear = true;
        } else if (unit === 'semanas' && remainingDays <= 7) {
          alertNear = true;
        } else if (unit === 'días' && remainingDays <= 3) {
          alertNear = true;
        }
        
        if (unit === 'meses') {
          const remMonths = Math.floor(remainingDays / 30);
          const remRemainingDays = remainingDays % 30;
          remainingText = remMonths > 0 ? `${remMonths} meses y ${remRemainingDays} días` : `${remainingDays} días`;
        } else if (unit === 'semanas') {
          const remWeeks = Math.floor(remainingDays / 7);
          const remRemainingDays = remainingDays % 7;
          remainingText = remWeeks > 0 ? `${remWeeks} semanas y ${remRemainingDays} días` : `${remainingDays} días`;
        } else {
          remainingText = `${remainingDays} días`;
        }
      }
    }

    const autoText = `Lleva ${elapsedText} de trabajo. Plazo total: ${totalText}.`;

    return {
      elapsedDays,
      remainingDays,
      alertNear,
      alertLate,
      autoText,
      totalText,
      remainingText: end ? end.toISOString().split('T')[0] : 'Sin definir'
    };
  };

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

  const handleUploadClientDocument = async (file, docType, notes, docTitle) => {
    if (!file) {
      alert('Por favor selecciona un archivo.');
      return;
    }
    if (!docTitle.trim()) {
      alert('Por favor ingresa un título para el documento.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || 'org-noveli-1234';
      const fileName = file.name;
      const fileExt = fileName.split('.').pop().toLowerCase();
      
      const allowedExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'png', 'webp'];
      if (!allowedExts.includes(fileExt)) {
        throw new Error('Formato no permitido. Solo se aceptan: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, WEBP.');
      }

      const sanitizedFileName = fileName.replace(/\s+/g, '_');
      const storagePath = `${orgId}/clientes/${selectedClient.id}/${docType}/${sanitizedFileName}`;

      setUploadProgress(50);

      let fileUrl = '';
      if (!isMock) {
        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, file, { upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from('documents')
          .getPublicUrl(storagePath);
        
        fileUrl = publicUrlData?.publicUrl || '';
      } else {
        fileUrl = `mock://documents/${storagePath}`;
      }

      setUploadProgress(80);

      // Get user context
      let userId = 'mock-user-123';
      if (!isMock) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) userId = user.id;
      }

      const dbPayload = {
        title: docTitle.trim(),
        document_type: docType,
        file_name: fileName,
        file_path: storagePath,
        file_url: fileUrl,
        mime_type: file.type || 'application/octet-stream',
        file_size: file.size || 0,
        notes: notes || '',
        organization_id: orgId,
        user_id: userId,
        client_id: selectedClient.id
      };

      const { error: dbErr } = await supabase
        .from('documents')
        .insert([dbPayload]);

      if (dbErr) throw dbErr;

      setUploadProgress(100);
      
      // Refresh documents
      const { data: refreshData, error: refreshErr } = await supabase
        .from('documents')
        .select('*')
        .eq('client_id', selectedClient.id)
        .order('created_at', { ascending: false });
        
      if (!refreshErr) {
        setClientDocuments(refreshData || []);
      }
    } catch (err) {
      console.error('Error uploading client document:', err);
      alert(err.message || 'Error al subir el archivo.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteClientDocument = async (doc) => {
    const docName = doc.title || doc.name || doc.file_name || 'Documento';
    if (window.confirm(`¿Estás seguro de que deseas eliminar el documento "${docName}"?`)) {
      try {
        if (!isMock) {
          const { error: storageErr } = await supabase.storage
            .from('documents')
            .remove([doc.file_path]);
          if (storageErr) {
            console.warn("Storage warning:", storageErr);
          }
        }

        const { error: dbErr } = await supabase
          .from('documents')
          .delete()
          .eq('id', doc.id);

        if (dbErr) throw dbErr;

        setClientDocuments(clientDocuments.filter(d => d.id !== doc.id));
      } catch (err) {
        console.error("Error deleting document:", err);
        alert("Error al eliminar el documento.");
      }
    }
  };

  const handleDownloadClientFile = (doc) => {
    const docName = doc.title || doc.name || doc.file_name || 'Documento';
    if (isMock) {
      alert(`Simulación de descarga en Modo Demo: descargando archivo "${docName}"`);
    } else {
      if (doc.file_url) {
        window.open(doc.file_url, '_blank');
      } else {
        const { data } = supabase.storage
          .from('documents')
          .getPublicUrl(doc.file_path);
        if (data?.publicUrl) {
          window.open(data.publicUrl, '_blank');
        } else {
          alert('No se pudo generar el enlace de descarga');
        }
      }
    }
  };

  const handleViewClientFile = (doc) => {
    const docName = doc.title || doc.name || doc.file_name || 'Documento';
    if (isMock) {
      alert(`Simulación de visualización en Modo Demo: viendo archivo "${docName}"`);
    } else {
      if (doc.file_url) {
        window.open(doc.file_url, '_blank');
      } else {
        const { data } = supabase.storage
          .from('documents')
          .getPublicUrl(doc.file_path);
        if (data?.publicUrl) {
          window.open(data.publicUrl, '_blank');
        } else {
          alert('No se pudo generar el enlace de visualización');
        }
      }
    }
  };

  const getDocTypeColor = (type) => {
    switch (type) {
      case 'contrato': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900';
      case 'factura': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-455 dark:border-rose-900';
      case 'boleta': return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900';
      case 'comprobante de pago': return 'bg-emerald-50 text-emerald-705 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900';
      case 'manuscrito': return 'bg-amber-50 text-amber-755 border-amber-200 dark:bg-amber-955/30 dark:text-amber-400 dark:border-amber-900';
      case 'portada': return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-900';
      case 'archivo final': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900';
      case 'documento legal': return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900';
      case 'imagen': return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900';
      default: return 'bg-slate-100 text-slate-700 border-slate-205 dark:bg-slate-800 dark:text-slate-350 dark:border-slate-700';
    }
  };

  const getFileFormatDetails = (fileName) => {
    const ext = fileName?.split('.').pop().toLowerCase() || '';
    switch (ext) {
      case 'pdf':
        return {
          icon: FileText,
          bgClass: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/25 dark:text-rose-400 dark:border-rose-900/40',
          label: 'PDF'
        };
      case 'doc':
      case 'docx':
        return {
          icon: FileText,
          bgClass: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/25 dark:text-blue-400 dark:border-blue-900/40',
          label: 'Word'
        };
      case 'xls':
      case 'xlsx':
        return {
          icon: FileSpreadsheet,
          bgClass: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/25 dark:text-emerald-400 dark:border-emerald-900/40',
          label: 'Excel'
        };
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
        return {
          icon: Image,
          bgClass: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-955/25 dark:text-amber-400 dark:border-amber-900/40',
          label: 'Imagen'
        };
      default:
        return {
          icon: File,
          bgClass: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-950/25 dark:text-slate-400 dark:border-slate-900/40',
          label: 'Archivo'
        };
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === undefined || bytes === null || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  useEffect(() => {
    fetchClients();
    fetchEditorialStages();
    fetchCatalogAndPacks();
  }, []);

  // Update estimated delivery dynamically based on duration input
  useEffect(() => {
    if (formData.service_start_date) {
      const calculated = calculateEstimatedDelivery(
        formData.service_start_date,
        formData.service_duration_value,
        formData.service_duration_unit
      );
      setFormData(prev => {
        if (prev.service_estimated_delivery !== calculated) {
          return { ...prev, service_estimated_delivery: calculated };
        }
        return prev;
      });
    }
  }, [formData.service_start_date, formData.service_duration_value, formData.service_duration_unit]);

  // Reactive form automatons for commercial, checklist, and statuses
  useEffect(() => {
    setFormData(prev => {
      let updated = false;
      const next = { ...prev };

      // Calculate balance_due
      const total = parseFloat(next.total_agreed_amount) || 0;
      const paid = parseFloat(next.amount_paid) || 0;
      const bal = Math.max(0, total - paid);
      if (next.balance_due !== bal) {
        next.balance_due = bal;
        updated = true;
      }

      // Auto-set payment_status based on amount_paid vs total_agreed_amount
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

      // Auto date for payment_link_sent
      const todayStr = new Date().toISOString().split('T')[0];
      if (next.payment_link_sent && !next.payment_link_sent_at) {
        next.payment_link_sent_at = todayStr;
        updated = true;
      } else if (!next.payment_link_sent && next.payment_link_sent_at) {
        next.payment_link_sent_at = '';
        updated = true;
      }

      // Auto date for contract_sent
      if (next.contract_sent && !next.contract_sent_at) {
        next.contract_sent_at = todayStr;
        updated = true;
      } else if (!next.contract_sent && next.contract_sent_at) {
        next.contract_sent_at = '';
        updated = true;
      }

      // Auto date for contract_signed_received
      if (next.contract_signed_received && !next.contract_signed_received_at) {
        next.contract_signed_received_at = todayStr;
        updated = true;
      } else if (!next.contract_signed_received && next.contract_signed_received_at) {
        next.contract_signed_received_at = '';
        updated = true;
      }

      // Auto date for files_received
      if (next.files_received && !next.files_received_at) {
        next.files_received_at = todayStr;
        updated = true;
      } else if (!next.files_received && next.files_received_at) {
        next.files_received_at = '';
        updated = true;
      }

      // Auto date for materials_received
      if (next.materials_received && !next.materials_received_at) {
        next.materials_received_at = todayStr;
        updated = true;
      } else if (!next.materials_received && next.materials_received_at) {
        next.materials_received_at = '';
        updated = true;
      }

      // Auto date for paid_at
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

        // Auto period type
        let pType = 'contrato editorial';
        if (firstCat === 'publicidad') pType = 'campaña de difusión';
        else if (firstCat === 'asesoría') pType = 'asesoría';
        else if (firstCat === 'diseño') pType = 'diseño';
        
        next.agreement_period_type = pType;
      }

      // Status automatons:
      // When link sent, set status to "link de pago enviado" if in early states
      if (next.payment_link_sent && ['prospecto', 'interesado', 'contrato enviado', 'acuerdo enviado'].includes(next.status)) {
        next.status = 'link de pago enviado';
        updated = true;
      }
      
      // When contract sent, set status to "acuerdo enviado" or "contrato enviado" if in early states
      if (next.contract_sent && !next.payment_link_sent && ['prospecto', 'interesado'].includes(next.status)) {
        next.status = next.service_category === 'editorial' ? 'contrato enviado' : 'acuerdo enviado';
        updated = true;
      }

      // Check checklist condition for ready_to_start
      const { isReady, reasonText } = calculateIsReadyToStart(next);
      if (next.ready_to_start !== isReady) {
        next.ready_to_start = isReady;
        updated = true;
      }
      if (next.ready_to_start_reason !== reasonText) {
        next.ready_to_start_reason = reasonText;
        updated = true;
      }

      // Auto status update when ready to start
      if (isReady && ['prospecto', 'interesado', 'acuerdo enviado', 'contrato enviado', 'link de pago enviado', 'esperando pago', 'pago recibido', 'esperando contrato firmado', 'esperando archivos/materiales'].includes(next.status)) {
        next.status = 'listo para iniciar';
        updated = true;
      }

      // Keep initial service values in sync if register_service is checked
      if (next.register_service) {
        if (next.service_value !== next.total_agreed_amount) {
          next.service_value = next.total_agreed_amount;
          updated = true;
        }
        if (next.service_amount_paid !== next.amount_paid) {
          next.service_amount_paid = next.amount_paid;
          updated = true;
        }
        if (next.service_currency !== next.currency) {
          next.service_currency = next.currency;
          updated = true;
        }
        if (next.service_payment_status !== next.payment_status) {
          next.service_payment_status = next.payment_status;
          updated = true;
        }
        if (next.service_payment_method !== next.payment_method) {
          next.service_payment_method = next.payment_method;
          updated = true;
        }
        if (next.service_paid_at !== next.paid_at) {
          next.service_paid_at = next.paid_at;
          updated = true;
        }
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
    formData.partial_payment_authorized,
    formData.payment_status,
    formData.status,
    formData.register_service,
    formData.selected_services,
    formData.service_start_date,
    formData.service_duration_value,
    formData.service_duration_unit
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

  const fetchEditorialStages = async () => {
    try {
      const { data, error } = await supabase
        .from('editorial_stages')
        .select('*')
        .eq('active', true)
        .order('order', { ascending: true });
      if (!error && data) {
        setEditorialStages(data);
      }
    } catch (err) {
      console.error('Error fetching editorial stages:', err);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedClient(null);
    setFormData({
      name: '',
      email: '',
      instagram: '',
      phone: '',
      country: '',
      city: '',
      client_type: 'nacional',
      preferred_currency: 'CLP',
      status: 'prospecto',
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

      // Dynamic requirements columns
      selected_services: [],
      service_category: 'editorial',
      agreement_period_type: 'contrato editorial',
      materials_received: false,
      materials_received_at: '',
      partial_payment_authorized: false,
      ready_to_start_reason: '',
      services_summary: '',

      // Initial Service / contract Fields
      register_service: false,
      service_id: '',
      service_type: 'corrección',
      service_book_title: '',
      service_value: '',
      service_currency: 'CLP',
      service_amount_paid: '0',
      service_payment_status: 'pendiente',
      service_payment_method: 'transferencia',
      service_includes_vat: false,
      service_paid_at: '',
      service_start_date: new Date().toISOString().split('T')[0],
      service_duration_value: '6',
      service_duration_unit: 'meses',
      service_estimated_delivery: calculateEstimatedDelivery(new Date().toISOString().split('T')[0], '6', 'meses'),
      service_current_stage: editorialStages[0]?.name || 'recepción de material',
      service_notes: '',
      allow_excess_payment: false
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (client) => {
    setSelectedClient(client);
    
    // Fetch client services to check if there is an initial service
    let existingService = null;
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        existingService = data[0];
      }
    } catch (err) {
      console.error('Error fetching client services for edit:', err);
    }

    setFormData({
      name: client.name || '',
      email: client.email || '',
      instagram: client.instagram || '',
      phone: client.phone || '',
      country: client.country || '',
      city: client.city || '',
      client_type: client.client_type || 'nacional',
      preferred_currency: client.preferred_currency || 'CLP',
      status: client.status || 'prospecto',
      notes: client.notes || '',

      // Commercial tracking fields
      interest_service: client.interest_service || 'corrección',
      total_agreed_amount: client.total_agreed_amount !== undefined ? client.total_agreed_amount : '',
      currency: client.currency || client.preferred_currency || 'CLP',
      includes_vat: !!client.includes_vat,
      payment_status: client.payment_status || 'sin pago',
      amount_paid: client.amount_paid !== undefined ? client.amount_paid : '0',
      balance_due: client.balance_due !== undefined ? client.balance_due : 0,
      payment_method: client.payment_method || 'transferencia',
      paid_at: client.paid_at || '',
      payment_link_sent: !!client.payment_link_sent,
      payment_link_sent_at: client.payment_link_sent_at || '',
      contract_sent: !!client.contract_sent,
      contract_sent_at: client.contract_sent_at || '',
      contract_signed_received: !!client.contract_signed_received,
      contract_signed_received_at: client.contract_signed_received_at || '',
      files_received: !!client.files_received,
      files_received_at: client.files_received_at || '',
      ready_to_start: !!client.ready_to_start,
      agreement_notes: client.agreement_notes || '',

      // Dynamic requirements columns
      selected_services: client.selected_services || [],
      service_category: client.service_category || 'editorial',
      agreement_period_type: client.agreement_period_type || 'contrato editorial',
      materials_received: !!client.materials_received,
      materials_received_at: client.materials_received_at || '',
      partial_payment_authorized: !!client.partial_payment_authorized,
      ready_to_start_reason: client.ready_to_start_reason || '',
      services_summary: client.services_summary || '',
      
      // Service fields
      register_service: !!existingService,
      service_id: existingService ? existingService.id : '',
      service_type: existingService ? existingService.type : 'corrección',
      service_book_title: existingService ? existingService.book_title : '',
      service_value: existingService ? existingService.value : '',
      service_currency: existingService ? existingService.currency : (client.preferred_currency || 'CLP'),
      service_amount_paid: existingService ? existingService.amount_paid || '0' : '0',
      service_payment_status: existingService ? existingService.payment_status || 'pendiente' : 'pendiente',
      service_payment_method: existingService ? existingService.payment_method || 'transferencia' : 'transferencia',
      service_includes_vat: false,
      service_paid_at: existingService ? existingService.paid_at || '' : '',
      service_start_date: existingService ? existingService.start_date : new Date().toISOString().split('T')[0],
      service_duration_value: existingService ? existingService.contract_duration_value || '6' : '6',
      service_duration_unit: existingService ? existingService.contract_duration_unit || 'meses' : 'meses',
      service_estimated_delivery: existingService ? existingService.estimated_delivery || '' : '',
      service_current_stage: existingService ? existingService.current_stage || 'recepción de material' : (editorialStages[0]?.name || 'recepción de material'),
      service_notes: existingService ? existingService.contract_notes || '' : '',
      allow_excess_payment: false
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenDetailModal = async (client) => {
    setSelectedClient(client);
    setDetailTab('info');
    setIsDetailOpen(true);
    setLoadingServices(true);
    setLoadingDocuments(true);
    
    // Fetch Services
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setClientServices(data || []);
    } catch (err) {
      console.error('Error fetching client services for details:', err);
      setClientServices([]);
    } finally {
      setLoadingServices(false);
    }

    // Fetch Documents
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setClientDocuments(data || []);
    } catch (err) {
      console.error('Error fetching client documents for details:', err);
      setClientDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleDeleteClient = async (id) => {
    if (isReadOnly) {
      alert('Acceso denegado: Tu rol actual no tiene permisos para esta acción.');
      return;
    }
    if (window.confirm('¿Estás seguro de que deseas eliminar este cliente? Se borrarán también los servicios asociados.')) {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        setClients(clients.filter(c => c.id !== id));
      } catch (err) {
        console.error('Error deleting client:', err);
        alert('Error al eliminar el cliente');
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

    // Commercial validations:
    // If value agreed is empty, allow saving as prospect/interesado, but require it for confirmed client
    const isConfirmedClient = !['prospecto', 'interesado', 'perdido'].includes(formData.status);
    const agreedAmount = parseFloat(formData.total_agreed_amount) || 0;
    if (isConfirmedClient && (formData.total_agreed_amount === '' || agreedAmount <= 0)) {
      setFormError('El valor acordado es requerido para clientes confirmados.');
      return;
    }

    // Ready to start checklist validation:
    if (formData.status === 'listo para iniciar' || formData.ready_to_start) {
      const { isReady, reasonText } = calculateIsReadyToStart(formData);
      if (!isReady) {
        setFormError(`El cliente no cumple con todos los requisitos para iniciar: ${reasonText}`);
        return;
      }
    }

    if (formData.register_service) {
      if (!formData.service_start_date) {
        setFormError('La fecha de inicio del contrato es requerida.');
        return;
      }
      
      const totalVal = parseFloat(formData.total_agreed_amount) || 0;
      const amtPaid = parseFloat(formData.amount_paid) || 0;
      
      if (amtPaid > totalVal && !formData.allow_excess_payment) {
        setFormError('El monto pagado no puede ser mayor al monto total acordado, salvo que se permita como pago excedente.');
        return;
      }
    }
    
    setIsSubmitting(true);
    setFormError('');

    try {
      const clientPayload = {
        name: formData.name,
        email: formData.email,
        instagram: formData.instagram,
        phone: formData.phone,
        country: formData.country,
        city: formData.city,
        client_type: formData.client_type,
        preferred_currency: formData.preferred_currency,
        status: formData.status,
        notes: formData.notes,
        
        interest_service: formData.selected_services?.[0]?.name || formData.interest_service || 'otro',
        total_agreed_amount: agreedAmount,
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

        // New database columns
        selected_services: formData.selected_services,
        service_category: formData.service_category,
        agreement_period_type: formData.agreement_period_type,
        materials_received: !!formData.materials_received,
        materials_received_at: formData.materials_received_at || null,
        partial_payment_authorized: !!formData.partial_payment_authorized,
        ready_to_start_reason: formData.ready_to_start_reason,
        services_summary: formData.selected_services ? formData.selected_services.map(s => s.name).join(', ') : ''
      };

      const contract_duration_value = formData.service_duration_value !== '' ? parseInt(formData.service_duration_value, 10) : 6;
      const contract_duration_unit = formData.service_duration_unit || 'meses';
      const currency = formData.currency || 'CLP';

      if (selectedClient) {
        // Edit Mode
        const { error: clientError } = await supabase
          .from('clients')
          .update(clientPayload)
          .eq('id', selectedClient.id);

        if (clientError) throw clientError;

        // Audit Logs (differences)
        if (JSON.stringify(formData.selected_services) !== JSON.stringify(selectedClient.selected_services)) {
          const names = formData.selected_services.map(s => s.name).join(', ');
          await logActivity('servicios seleccionados', `Servicios seleccionados actualizados: ${names || 'Ninguno'}`, selectedClient.id);
        }
        if (formData.service_duration_value !== selectedClient.service_duration_value) {
          await logActivity('periodo definido', `Periodo de contrato definido: ${formData.service_duration_value} ${formData.service_duration_unit}`, selectedClient.id);
        }
        if (!selectedClient.payment_link_sent && formData.payment_link_sent) {
          await logActivity('link de pago enviado', `Link de pago enviado a ${formData.name}`, selectedClient.id);
        }
        if (!selectedClient.contract_sent && formData.contract_sent) {
          await logActivity('contrato/acuerdo enviado', `Contrato/acuerdo enviado a ${formData.name}`, selectedClient.id);
        }
        if (!selectedClient.contract_signed_received && formData.contract_signed_received) {
          await logActivity('contrato firmado recibido', `Contrato firmado recibido de ${formData.name}`, selectedClient.id);
        }
        if (!selectedClient.files_received && formData.files_received) {
          await logActivity('manuscrito/archivos recibidos', `Manuscrito o archivos recibidos de ${formData.name}`, selectedClient.id);
        }
        if (!selectedClient.materials_received && formData.materials_received) {
          await logActivity('materiales recibidos', `Materiales o briefing recibidos de ${formData.name}`, selectedClient.id);
        }
        if (!selectedClient.ready_to_start && formData.ready_to_start) {
          await logActivity('servicio listo para iniciar', `Cliente ${formData.name} listo para iniciar trabajo`, selectedClient.id);
        }
        if (parseFloat(formData.amount_paid) > parseFloat(selectedClient.amount_paid || 0)) {
          const diff = parseFloat(formData.amount_paid) - parseFloat(selectedClient.amount_paid || 0);
          await logActivity('pago recibido', `Pago de ${formData.currency} ${diff.toLocaleString()} recibido de ${formData.name}`, selectedClient.id);
        }

        if (formData.register_service) {
          const servicesToRegister = formData.selected_services && formData.selected_services.length > 0
            ? formData.selected_services
            : [{
                name: formData.interest_service || 'otro',
                price: agreedAmount,
                category: formData.service_category || 'editorial'
              }];

          for (const [sidx, sItem] of servicesToRegister.entries()) {
            const sValue = parseFloat(sItem.price) || 0;
            const servicePayload = {
              client_id: selectedClient.id,
              type: sItem.name,
              book_title: formData.service_book_title,
              value: sValue,
              currency: currency,
              amount_paid: sidx === 0 ? (parseFloat(formData.amount_paid) || 0) : 0,
              balance_due: sidx === 0 ? Math.max(0, sValue - (parseFloat(formData.amount_paid) || 0)) : sValue,
              payment_status: sidx === 0 ? formData.payment_status : 'pendiente',
              payment_method: formData.payment_method,
              paid_at: formData.paid_at || null,
              start_date: formData.service_start_date,
              contract_duration_value,
              contract_duration_unit,
              estimated_delivery: formData.service_estimated_delivery || null,
              current_stage: formData.service_current_stage,
              contract_notes: formData.service_notes || formData.agreement_notes,
              
              payment_link_sent: !!formData.payment_link_sent,
              payment_link_sent_at: formData.payment_link_sent_at || null,
              contract_sent: !!formData.contract_sent,
              contract_sent_at: formData.contract_sent_at || null,
              contract_signed_received: !!formData.contract_signed_received,
              contract_signed_received_at: formData.contract_signed_received_at || null,
              files_received: !!formData.files_received,
              files_received_at: formData.files_received_at || null,
              ready_to_start: !!formData.ready_to_start,
              contract_start_date: formData.service_start_date,
              contract_end_date: formData.service_estimated_delivery || null,

              service_category: sItem.category || 'editorial',
              agreement_period_type: formData.agreement_period_type,
              materials_received: !!formData.materials_received,
              materials_received_at: formData.materials_received_at || null,
              partial_payment_authorized: !!formData.partial_payment_authorized,
              ready_to_start_reason: formData.ready_to_start_reason
            };

            if (formData.service_id && sidx === 0) {
              const { data: oldService } = await supabase
                .from('services')
                .select('amount_paid')
                .eq('id', formData.service_id)
                .single();

              const oldAmountPaid = oldService ? parseFloat(oldService.amount_paid) || 0 : 0;
              const newAmountPaid = parseFloat(formData.amount_paid) || 0;
              const diffAmount = newAmountPaid - oldAmountPaid;

              const { error: serviceError } = await supabase
                .from('services')
                .update(servicePayload)
                .eq('id', formData.service_id);

              if (serviceError) throw serviceError;

              if (diffAmount > 0) {
                const { error: incomeError } = await supabase
                  .from('incomes')
                  .insert({
                    client_id: selectedClient.id,
                    service_id: formData.service_id,
                    amount: diffAmount,
                    currency: currency,
                    date: formData.paid_at || new Date().toISOString().split('T')[0],
                    payment_method: formData.payment_method || 'transferencia',
                    includes_vat: formData.includes_vat || false,
                    status: 'pagado',
                    notes: `Pago registrado desde edición de cliente para la obra: ${formData.service_book_title}`
                  });
                if (incomeError) throw incomeError;
              }
            } else {
              const { data: newService, error: serviceError } = await supabase
                .from('services')
                .insert([servicePayload])
                .select()
                .single();

              if (serviceError) throw serviceError;

              const amtPaidVal = sidx === 0 ? (parseFloat(formData.amount_paid) || 0) : 0;
              if (amtPaidVal > 0) {
                const { error: incomeError } = await supabase
                  .from('incomes')
                  .insert({
                    client_id: selectedClient.id,
                    service_id: newService.id,
                    amount: amtPaidVal,
                    currency: currency,
                    date: formData.paid_at || formData.service_start_date || new Date().toISOString().split('T')[0],
                    payment_method: formData.payment_method || 'transferencia',
                    includes_vat: formData.includes_vat || false,
                    status: 'pagado',
                    notes: `Pago inicial registrado para la obra: ${formData.service_book_title}`
                  });
                if (incomeError) throw incomeError;
              }

              await logActivity('contrato creado', `Se registró contrato con período definido: ${contract_duration_value} ${contract_duration_unit} para la obra ${formData.service_book_title}`, newService.id, 'Servicios');
            }
          }
        }
      } else {
        // Add Mode
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert([clientPayload])
          .select()
          .single();

        if (clientError) throw clientError;

        // Audit Logs (initial values)
        if (formData.selected_services && formData.selected_services.length > 0) {
          const names = formData.selected_services.map(s => s.name).join(', ');
          await logActivity('servicios seleccionados', `Servicios seleccionados: ${names}`, newClient.id);
        }
        if (formData.service_duration_value) {
          await logActivity('periodo definido', `Periodo de contrato definido: ${formData.service_duration_value} ${formData.service_duration_unit}`, newClient.id);
        }
        if (formData.payment_link_sent) {
          await logActivity('link de pago enviado', `Link de pago enviado a ${formData.name}`, newClient.id);
        }
        if (formData.contract_sent) {
          await logActivity('contrato/acuerdo enviado', `Contrato/acuerdo enviado a ${formData.name}`, newClient.id);
        }
        if (formData.contract_signed_received) {
          await logActivity('contrato firmado recibido', `Contrato firmado recibido de ${formData.name}`, newClient.id);
        }
        if (formData.files_received) {
          await logActivity('manuscrito/archivos recibidos', `Manuscrito o archivos recibidos de ${formData.name}`, newClient.id);
        }
        if (formData.materials_received) {
          await logActivity('materiales recibidos', `Materiales o briefing recibidos de ${formData.name}`, newClient.id);
        }
        if (formData.ready_to_start) {
          await logActivity('servicio listo para iniciar', `Cliente ${formData.name} listo para iniciar trabajo`, newClient.id);
        }
        if (parseFloat(formData.amount_paid) > 0) {
          await logActivity('pago recibido', `Pago de ${formData.currency} ${parseFloat(formData.amount_paid).toLocaleString()} recibido de ${formData.name}`, newClient.id);
        }

        if (formData.register_service) {
          const servicesToRegister = formData.selected_services && formData.selected_services.length > 0
            ? formData.selected_services
            : [{
                name: formData.interest_service || 'otro',
                price: agreedAmount,
                category: formData.service_category || 'editorial'
              }];

          for (const [sidx, sItem] of servicesToRegister.entries()) {
            const sValue = parseFloat(sItem.price) || 0;
            const servicePayload = {
              client_id: newClient.id,
              type: sItem.name,
              book_title: formData.service_book_title,
              value: sValue,
              currency: currency,
              amount_paid: sidx === 0 ? (parseFloat(formData.amount_paid) || 0) : 0,
              balance_due: sidx === 0 ? Math.max(0, sValue - (parseFloat(formData.amount_paid) || 0)) : sValue,
              payment_status: sidx === 0 ? formData.payment_status : 'pendiente',
              payment_method: formData.payment_method,
              paid_at: formData.paid_at || null,
              start_date: formData.service_start_date,
              contract_duration_value,
              contract_duration_unit,
              estimated_delivery: formData.service_estimated_delivery || null,
              current_stage: formData.service_current_stage,
              contract_notes: formData.service_notes || formData.agreement_notes,
              
              payment_link_sent: !!formData.payment_link_sent,
              payment_link_sent_at: formData.payment_link_sent_at || null,
              contract_sent: !!formData.contract_sent,
              contract_sent_at: formData.contract_sent_at || null,
              contract_signed_received: !!formData.contract_signed_received,
              contract_signed_received_at: formData.contract_signed_received_at || null,
              files_received: !!formData.files_received,
              files_received_at: formData.files_received_at || null,
              ready_to_start: !!formData.ready_to_start,
              contract_start_date: formData.service_start_date,
              contract_end_date: formData.service_estimated_delivery || null,

              service_category: sItem.category || 'editorial',
              agreement_period_type: formData.agreement_period_type,
              materials_received: !!formData.materials_received,
              materials_received_at: formData.materials_received_at || null,
              partial_payment_authorized: !!formData.partial_payment_authorized,
              ready_to_start_reason: formData.ready_to_start_reason
            };

            const { data: newService, error: serviceError } = await supabase
              .from('services')
              .insert([servicePayload])
              .select()
              .single();

            if (serviceError) throw serviceError;

            const amtPaidVal = sidx === 0 ? (parseFloat(formData.amount_paid) || 0) : 0;
            if (amtPaidVal > 0) {
              const { error: incomeError } = await supabase
                .from('incomes')
                .insert({
                  client_id: newClient.id,
                  service_id: newService.id,
                  amount: amtPaidVal,
                  currency: currency,
                  date: formData.paid_at || formData.service_start_date || new Date().toISOString().split('T')[0],
                  payment_method: formData.payment_method || 'transferencia',
                  includes_vat: formData.includes_vat || false,
                  status: 'pagado',
                  notes: `Pago inicial registrado para la obra: ${formData.service_book_title}`
                });
              if (incomeError) throw incomeError;
            }

            await logActivity('contrato creado', `Se registró contrato con período definido: ${contract_duration_value} ${contract_duration_unit} para la obra ${formData.service_book_title}`, newService.id, 'Servicios');
          }
        }
      }

      await fetchClients();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving client:', err);
      setFormError(err.message || 'Error al guardar los datos del cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get unique countries for filters
  const uniqueCountries = Array.from(new Set(clients.map(c => c.country).filter(Boolean)));

  // Filtering list
  const filteredClients = clients.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.instagram && c.instagram.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesStatus = statusFilter === 'todos' || c.status === statusFilter;
    const matchesCountry = countryFilter === 'todos' || c.country === countryFilter;
    const matchesType = clientTypeFilter === 'todos' || c.client_type === clientTypeFilter;
    
    return matchesSearch && matchesStatus && matchesCountry && matchesType;
  });

  const handleExportCSV = () => {
    const csvData = filteredClients.map(c => ({
      Nombre: c.name,
      Email: c.email || '',
      Instagram: c.instagram || '',
      Teléfono: c.phone || '',
      País: c.country || '',
      Ciudad: c.city || '',
      'Tipo Cliente': c.client_type || 'nacional',
      'Moneda Preferida': c.preferred_currency || 'CLP',
      Estado: c.status,
      Notas: c.notes || '',
      'Fecha Creación': c.created_at ? c.created_at.split('T')[0] : ''
    }));

    exportToCSV(
      csvData,
      'clientes',
      ['Nombre', 'Email', 'Instagram', 'Teléfono', 'País', 'Ciudad', 'Tipo Cliente', 'Moneda Preferida', 'Estado', 'Notas', 'Fecha Creación']
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'prospecto':
        return 'bg-slate-100 text-slate-700 border-slate-350 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      case 'interesado':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900';
      case 'contrato enviado':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-900';
      case 'link de pago enviado':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900';
      case 'esperando pago':
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900';
      case 'pago recibido':
        return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900';
      case 'contrato firmado recibido':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900';
      case 'esperando manuscrito/archivos':
        return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900';
      case 'listo para iniciar':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900';
      case 'en proceso editorial':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900';
      case 'finalizado':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900';
      case 'perdido / rechazado':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-450 dark:border-rose-900';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const services = formData.selected_services || [];
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
    const cat = formData.service_category || 'editorial';
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

  const calculatedBalance = Math.max(0, (parseFloat(formData.service_value) || 0) - (parseFloat(formData.service_amount_paid) || 0));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Clientes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Gestión completa y base de datos de autores y clientes de la editorial.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={filteredClients.length === 0}
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
              Añadir Cliente
            </button>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, email o instagram..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all capitalize"
            >
              <option value="todos">Todos</option>
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

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">País:</span>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="block w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            >
              <option value="todos">Todos</option>
              {uniqueCountries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Tipo:</span>
            <select
              value={clientTypeFilter}
              onChange={(e) => setClientTypeFilter(e.target.value)}
              className="block w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            >
              <option value="todos">Todos</option>
              <option value="nacional">Nacional</option>
              <option value="internacional">Internacional</option>
            </select>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400">
          No se encontraron clientes con los filtros aplicados.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 font-semibold">
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Contacto</th>
                  <th className="px-6 py-4">País / Tipo</th>
                  <th className="px-6 py-4">Divisa Preferida</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">F. Creación</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{client.name}</div>
                      {client.city && <span className="text-[10px] text-slate-400">{client.city}</span>}
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      {client.email && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <Mail className="w-3.5 h-3.5" />
                          <span>{client.email}</span>
                        </div>
                      )}
                      {client.instagram && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <InstagramIcon className="w-3.5 h-3.5" />
                          <span>{client.instagram}</span>
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-700 dark:text-slate-200">{client.country || '-'}</div>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 uppercase tracking-wider ${
                        client.client_type === 'internacional' 
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200' 
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350'
                      }`}>
                        {client.client_type || 'nacional'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold text-xs">
                      {client.preferred_currency || 'CLP'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wider ${getStatusColor(client.status)}`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {formatDate(client.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenDetailModal(client)}
                        className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!isReadOnly && (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(client)}
                            className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
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
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {selectedClient ? 'Editar Cliente' : 'Añadir Cliente'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
              {formError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400">
                  {formError}
                </div>
              )}

              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
                {/* SECCIÓN A: DATOS DEL AUTOR / CLIENTE */}
                <div className="bg-slate-50/50 dark:bg-slate-950/40 p-4.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 border-b border-slate-100 dark:border-slate-850 pb-2">A. Datos del Autor / Cliente</h4>
                  
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nombre Completo *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><User className="w-4 h-4" /></span>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="e.g. Isabel Allende"
                      />
                    </div>
                  </div>

                  {/* Contacts Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Email</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Mail className="w-4 h-4" /></span>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="ejemplo@correo.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Instagram</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><InstagramIcon className="w-4 h-4" /></span>
                        <input
                          type="text"
                          value={formData.instagram}
                          onChange={(e) => setFormData({...formData, instagram: e.target.value})}
                          className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="@usuario"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Phone & Country */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Teléfono</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Phone className="w-4 h-4" /></span>
                        <input
                          type="text"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="+56 9..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">País</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Globe className="w-4 h-4" /></span>
                        <input
                          type="text"
                          value={formData.country}
                          onChange={(e) => setFormData({...formData, country: e.target.value})}
                          className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="e.g. Chile"
                        />
                      </div>
                    </div>
                  </div>

                  {/* City & Classification */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Ciudad (Opcional)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><MapPin className="w-4 h-4" /></span>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({...formData, city: e.target.value})}
                          className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="e.g. Santiago"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Clasificación de Cliente</label>
                      <select
                        value={formData.client_type}
                        onChange={(e) => setFormData({...formData, client_type: e.target.value})}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="nacional">Nacional</option>
                        <option value="internacional">Internacional</option>
                      </select>
                    </div>
                  </div>

                  {/* Currency, Status & Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Moneda Preferida</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><DollarSign className="w-4 h-4" /></span>
                        <select
                          value={formData.preferred_currency}
                          onChange={(e) => setFormData({...formData, preferred_currency: e.target.value})}
                          className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="CLP">CLP ($)</option>
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Estado del Pipeline *</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
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
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notas Internas del Autor</label>
                    <textarea
                      rows="2.5"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="Historial del autor, afinidades, preferencias de comunicación..."
                    ></textarea>
                  </div>
                </div>

                {/* SECCIÓN B: ACUERDO COMERCIAL */}
                <div className="bg-slate-50/50 dark:bg-slate-950/40 p-4.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 border-b border-slate-100 dark:border-slate-850 pb-2">B. Acuerdo Comercial</h4>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Agregar Servicio o Pack</label>
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const [type, id] = val.split(':');
                            let item = null;
                            if (type === 'service') {
                              item = catalog.find(c => c.id === id);
                            } else if (type === 'pack') {
                              item = packs.find(p => p.id === id);
                            }
                            if (item) {
                              const newItem = {
                                id: item.id,
                                name: item.name,
                                price: item.price_special !== undefined ? item.price_special : item.base_price,
                                currency: item.currency,
                                type: type,
                                category: item.category || 'editorial',
                                requires_manuscript: item.requires_manuscript !== undefined ? item.requires_manuscript : true,
                                requires_materials: item.requires_materials !== undefined ? item.requires_materials : false,
                                requires_signed_contract: item.requires_signed_contract !== undefined ? item.requires_signed_contract : true,
                                requires_agreement_sent: item.requires_agreement_sent !== undefined ? item.requires_agreement_sent : false,
                                requires_duration: item.requires_duration !== undefined ? item.requires_duration : false
                              };
                              setFormData(prev => {
                                const list = [...(prev.selected_services || []), newItem];
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
                                <option key={p.id} value={`pack:${p.id}`}>{p.name} ({p.currency} {p.price_special.toLocaleString()})</option>
                              ))}
                            </optgroup>
                          )}
                          {catalog.length > 0 && (
                            <optgroup label="Servicios Individuales">
                              {catalog.map(c => (
                                <option key={c.id} value={`service:${c.id}`}>{c.name} ({c.currency} {c.base_price.toLocaleString()})</option>
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
                                  className="w-24 px-1.5 py-1 border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg text-center text-xs font-semibold focus:outline-none"
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
                  </div>

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
                        placeholder="e.g. 750000"
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
                      <span className="font-bold text-slate-450 uppercase mr-2">Saldo Pendiente:</span>
                      <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400 text-sm">
                        {formData.currency} {formData.balance_due.toLocaleString()}
                      </span>
                    </div>
                    
                    <label className="flex items-center gap-2 cursor-pointer text-slate-500 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={formData.includes_vat}
                        onChange={(e) => setFormData({...formData, includes_vat: e.target.checked})}
                        className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4"
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
                    {reqSignedContract && (
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
                    {reqManuscript && (
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
                    {reqMaterials && (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={formData.materials_received}
                            onChange={(e) => setFormData({...formData, materials_received: e.target.checked})}
                            className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4"
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

                    {/* Autorización de pago parcial (siempre visible como opción) */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.partial_payment_authorized}
                          onChange={(e) => setFormData({...formData, partial_payment_authorized: e.target.checked})}
                          className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4"
                        />
                        <span>Autorizar inicio con pago parcial</span>
                      </label>
                      <p className="text-[10px] text-slate-400 leading-tight">Habilita "Listo para iniciar" aunque no esté pagado al 100%.</p>
                    </div>
                  </div>

                  {/* VISUAL CHECKLIST: Condiciones para iniciar trabajo */}
                  <div className="bg-brand-50/20 dark:bg-brand-950/10 p-4 rounded-xl border border-brand-100/50 dark:border-brand-900/30 space-y-3">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-brand-800 dark:text-brand-455">
                      Condiciones para iniciar trabajo
                    </h5>
                    
                    <div className="space-y-2">
                      {/* 1. Payment status check */}
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
                      {reqSignedContract && (
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
                      {reqAgreementSent && (
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

                      {/* 4. Files received check */}
                      {reqManuscript && (
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

                      {/* 5. Materials received check */}
                      {reqMaterials && (
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

                      {/* 6. Period defined check */}
                      {reqDuration && (
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
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed font-medium"
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
                        checked={formData.register_service}
                        onChange={(e) => setFormData({ ...formData, register_service: e.target.checked })}
                        className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Registrar servicio inicial para este cliente</span>
                    </label>
                  </div>

                  {formData.register_service && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800 space-y-4 animate-fade-in">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/50 pb-2">E. Servicio Inicial / Obra</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipo de Servicio o Pack contratado *</label>
                          <select
                            value={formData.service_type}
                            onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
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

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Título del Libro / Proyecto</label>
                          <input
                            type="text"
                            value={formData.service_book_title}
                            onChange={(e) => setFormData({ ...formData, service_book_title: e.target.value })}
                            className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            placeholder="e.g. La Casa de los Espíritus"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Etapa Inicial del Servicio</label>
                          <select
                            value={formData.service_current_stage}
                            onChange={(e) => setFormData({ ...formData, service_current_stage: e.target.value })}
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
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-450 mb-1.5">Notas Especiales</label>
                          <input
                            type="text"
                            value={formData.service_notes}
                            onChange={(e) => setFormData({ ...formData, service_notes: e.target.value })}
                            className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            placeholder="e.g. Entrega en 2 partes"
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
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-350 rounded-xl text-sm font-semibold hover:bg-slate-55 cursor-pointer"
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

      {/* Details Modal */}
      {isDetailOpen && selectedClient && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <User className="w-5 h-5 text-brand-500" />
                Ficha del Cliente
              </h3>
              <button 
                onClick={() => setIsDetailOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Tab Selection Headers */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 px-6">
              <button
                type="button"
                onClick={() => setDetailTab('info')}
                className={`py-2.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
                  detailTab === 'info'
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Información
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('docs')}
                className={`py-2.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
                  detailTab === 'docs'
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Documentos ({clientDocuments.length})
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto pr-1">
              {detailTab === 'info' && (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{selectedClient.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">Registrado el {formatDate(selectedClient.created_at)}</p>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(selectedClient.status)}`}>
                      {selectedClient.status}
                    </span>
                  </div>

                  {/* Información General y Contacto */}
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-2">Información del Autor</h5>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedClient.email && (
                        <div className="flex items-center gap-2 text-xs text-slate-655 dark:text-slate-350">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium truncate">{selectedClient.email}</span>
                        </div>
                      )}
                      {selectedClient.instagram && (
                        <div className="flex items-center gap-2 text-xs text-slate-655 dark:text-slate-350">
                          <InstagramIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium">{selectedClient.instagram}</span>
                        </div>
                      )}
                      {selectedClient.phone && (
                        <div className="flex items-center gap-2 text-xs text-slate-655 dark:text-slate-350">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium">{selectedClient.phone}</span>
                        </div>
                      )}
                      {(selectedClient.country || selectedClient.city) && (
                        <div className="flex items-center gap-2 text-xs text-slate-655 dark:text-slate-350">
                          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium">
                            {selectedClient.city ? `${selectedClient.city}, ` : ''}{selectedClient.country || ''}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-655 dark:text-slate-350 col-span-2">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium">
                          Moneda Preferida: <strong className="font-mono">{selectedClient.preferred_currency || 'CLP'}</strong> | Clasificación: <strong className="capitalize">{selectedClient.client_type || 'nacional'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Panel de Acuerdo Comercial */}
                  <div className="space-y-3 p-4 rounded-xl border border-slate-150 dark:border-slate-800">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-brand-500" />
                      Acuerdo Comercial
                    </h5>

                    <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 dark:bg-slate-950/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Acordado</span>
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                          {selectedClient.currency || 'CLP'} {Number(selectedClient.total_agreed_amount || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Pagado</span>
                        <span className="font-mono text-xs font-bold text-emerald-650 dark:text-emerald-400">
                          {selectedClient.currency || 'CLP'} {Number(selectedClient.amount_paid || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Pendiente</span>
                        <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-455">
                          {selectedClient.currency || 'CLP'} {Number(selectedClient.balance_due || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/50 py-1">
                        <span className="text-slate-400">Estado de Pago:</span>
                        <span className="font-bold capitalize text-slate-700 dark:text-slate-300">{selectedClient.payment_status || 'Sin pago'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/50 py-1">
                        <span className="text-slate-400">Método de Pago:</span>
                        <span className="font-bold capitalize text-slate-700 dark:text-slate-300">{selectedClient.payment_method || 'N/A'}</span>
                      </div>
                      {selectedClient.paid_at && (
                        <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/50 py-1 col-span-2">
                          <span className="text-slate-400">Fecha de Pago:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{formatDate(selectedClient.paid_at)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/50 py-1 col-span-2">
                        <span className="text-slate-400">Servicio de Interés:</span>
                        <span className="font-bold capitalize text-slate-700 dark:text-slate-300">{selectedClient.interest_service || 'N/A'}</span>
                      </div>
                    </div>

                    {selectedClient.agreement_notes && (
                      <div className="mt-2 text-xs bg-amber-50/30 dark:bg-amber-955/10 border border-amber-100/50 dark:border-amber-900/25 p-2 rounded-lg text-slate-600 dark:text-slate-350">
                        <strong className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Notas del Acuerdo:</strong>
                        {selectedClient.agreement_notes}
                      </div>
                    )}
                  </div>

                  {/* Requisitos de Inicio y Checklist */}
                  <div className="bg-brand-50/20 dark:bg-brand-950/10 p-4 rounded-xl border border-brand-100/50 dark:border-brand-900/30 space-y-3">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Requisitos de Inicio</span>
                      {selectedClient.ready_to_start ? (
                        <span className="text-[9px] bg-emerald-100 text-emerald-850 px-2 py-0.5 rounded font-bold uppercase dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50">Listo para iniciar</span>
                      ) : (
                        <span className="text-[9px] bg-rose-100 text-rose-850 px-2 py-0.5 rounded font-bold uppercase dark:bg-rose-950/40 dark:text-rose-455 border border-rose-200/50">Requisitos pendientes</span>
                      )}
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Link de pago */}
                      <div className="flex items-start gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className={`text-sm ${selectedClient.payment_link_sent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300'}`}>✓</span>
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">Link de Pago Enviado</span>
                          <span className="text-[10px] text-slate-400">
                            {selectedClient.payment_link_sent ? `Enviado el ${formatDate(selectedClient.payment_link_sent_at)}` : 'No enviado'}
                          </span>
                        </div>
                      </div>

                      {/* Contrato enviado */}
                      <div className="flex items-start gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className={`text-sm ${selectedClient.contract_sent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300'}`}>✓</span>
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">Contrato Enviado</span>
                          <span className="text-[10px] text-slate-400">
                            {selectedClient.contract_sent ? `Enviado el ${formatDate(selectedClient.contract_sent_at)}` : 'No enviado'}
                          </span>
                        </div>
                      </div>

                      {/* Contrato firmado */}
                      <div className="flex items-start gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className={`text-sm ${selectedClient.contract_signed_received ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300'}`}>✓</span>
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">Contrato Firmado</span>
                          <span className="text-[10px] text-slate-400">
                            {selectedClient.contract_signed_received ? `Recibido el ${formatDate(selectedClient.contract_signed_received_at)}` : 'Pendiente'}
                          </span>
                        </div>
                      </div>

                      {/* Manuscrito / Archivos */}
                      <div className="flex items-start gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className={`text-sm ${selectedClient.files_received ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300'}`}>✓</span>
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">Manuscrito / Archivos</span>
                          <span className="text-[10px] text-slate-400">
                            {selectedClient.files_received ? `Recibido el ${formatDate(selectedClient.files_received_at)}` : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!selectedClient.ready_to_start && (
                      <div className="p-2.5 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-900/20 rounded-lg text-[10.5px] text-rose-700 dark:text-rose-455">
                        <strong>Faltas para iniciar:</strong>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          {!(selectedClient.payment_status === 'pagado' || selectedClient.payment_status === 'pago parcial') && <li>Pago pendiente o pago parcial no autorizado.</li>}
                          {!selectedClient.contract_signed_received && <li>Falta recibir contrato firmado.</li>}
                          {!selectedClient.files_received && <li>Falta recibir manuscrito o archivos.</li>}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Notas Internas */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Notas del Autor
                    </h5>
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/50 rounded-xl text-slate-655 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedClient.notes || 'Sin notas registradas.'}
                    </div>
                  </div>

                  {/* Associated Services Section */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-brand-500" />
                      Servicios y Contratos Asociados ({clientServices.length})
                    </h5>

                    {loadingServices ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
                      </div>
                    ) : clientServices.length === 0 ? (
                      <div className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 text-center">
                        Este cliente no posee servicios o contratos registrados todavía.
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-1">
                        {clientServices.map((service) => {
                          const stats = getDurationStats(
                            service.start_date,
                            service.estimated_delivery,
                            service.contract_duration_value,
                            service.contract_duration_unit
                          );

                          return (
                            <div key={service.id} className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-3">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <span className="text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded capitalize dark:bg-brand-950/30 dark:text-brand-400 dark:border-brand-900">
                                    {service.type}
                                  </span>
                                  <h6 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mt-1.5">{service.book_title}</h6>
                                </div>
                                
                                <div className="flex flex-col items-end gap-1.5">
                                  {stats.alertLate ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded uppercase tracking-wider dark:bg-rose-950/30 dark:text-rose-455">
                                      <AlertTriangle className="w-3 h-3" /> Vencido
                                    </span>
                                  ) : stats.alertNear ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded uppercase tracking-wider dark:bg-amber-955/30 dark:text-amber-455">
                                      <Clock className="w-3.5 h-3.5" /> Por vencer
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded uppercase tracking-wider dark:bg-emerald-950/30 dark:text-emerald-455">
                                      En plazo
                                    </span>
                                  )}
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    Avance: {service.advance_percent || 0}%
                                  </span>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-brand-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${service.advance_percent || 0}%` }}
                                ></div>
                              </div>

                              {/* Financials details */}
                              <div className="grid grid-cols-3 gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                                <div>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Acordado</span>
                                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                    {service.currency} {Number(service.value).toLocaleString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Pagado</span>
                                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    {service.currency} {Number(service.amount_paid || 0).toLocaleString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Pendiente</span>
                                  <span className="font-mono font-bold text-rose-600 dark:text-rose-455">
                                    {service.currency} {Number(service.balance_due || 0).toLocaleString()}
                                  </span>
                                </div>
                              </div>

                              {/* Contract tracking stats */}
                              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-350">
                                <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-950/20 p-2 rounded-lg border border-slate-200/50 dark:border-slate-800/50 text-[11px]">
                                  <span className="font-medium">{stats.autoText}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-slate-400">
                                  <span>Período: <strong className="text-slate-600 dark:text-slate-300">{formatDate(service.start_date)}</strong> al <strong className="text-slate-600 dark:text-slate-300">{formatDate(stats.remainingText !== 'Sin definir' ? stats.remainingText : service.estimated_delivery)}</strong></span>
                                  <span>Días transcurridos: <strong className="text-slate-600 dark:text-slate-300">{stats.elapsedDays}</strong></span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {detailTab === 'docs' && (
                <div className="space-y-4 animate-fade-in">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-brand-500" />
                    Documentos del Cliente ({clientDocuments.length})
                  </h5>

                  {loadingDocuments ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
                    </div>
                  ) : clientDocuments.length === 0 ? (
                    <div className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 text-center">
                      Este cliente no posee documentos registrados.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1">
                      {clientDocuments.map((doc) => {
                        const fileFormat = getFileFormatDetails(doc.file_name);
                        const FormatIcon = fileFormat.icon;
                        const docName = doc.title || doc.name || doc.file_name || 'Sin título';
                        const docTypeVal = doc.document_type || doc.file_type || 'otro';
                        return (
                          <div key={doc.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-brand-200 transition-all gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`p-1.5 rounded-lg border shrink-0 ${fileFormat.bgClass}`}>
                                <FormatIcon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <h6 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate" title={docName}>{docName}</h6>
                                <span className="text-[9px] font-mono text-slate-450 truncate block">{doc.file_name}</span>
                                {doc.notes && <span className="text-[10px] text-slate-500 italic block truncate">"{doc.notes}"</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${getDocTypeColor(docTypeVal)}`}>
                                {docTypeVal}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleViewClientFile(doc)}
                                className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-slate-900 cursor-pointer"
                                title="Ver"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadClientFile(doc)}
                                className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-slate-900 cursor-pointer"
                                title="Descargar"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClientDocument(doc)}
                                className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-900 cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Direct upload form */}
                  <div className="border-t border-slate-100 dark:border-slate-800/85 pt-4 space-y-3">
                    <h6 className="text-[11px] font-bold uppercase tracking-wider text-slate-450">Subir Documento Nuevo</h6>
                    <div className="space-y-3 bg-slate-50/50 dark:bg-slate-950/20 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Archivo *</label>
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                setNewDocFile(file);
                                setNewDocTitle(file.name);
                              }
                            }}
                            className="block w-full text-[11px] text-slate-500 border border-slate-200 dark:border-slate-850 rounded-lg p-1.5 focus:outline-none bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Nombre Visual *</label>
                          <input
                            type="text"
                            value={newDocTitle}
                            onChange={(e) => setNewDocTitle(e.target.value)}
                            placeholder="Título del documento"
                            className="block w-full text-[11px] border border-slate-200 dark:border-slate-850 rounded-lg p-1.5 focus:outline-none bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Categoría</label>
                          <select
                            value={newDocType}
                            onChange={(e) => setNewDocType(e.target.value)}
                            className="block w-full text-[11px] border border-slate-200 dark:border-slate-850 rounded-lg p-1.5 focus:outline-none bg-white dark:bg-slate-900"
                          >
                            {['contrato', 'factura', 'boleta', 'comprobante de pago', 'manuscrito', 'portada', 'archivo final', 'documento legal', 'imagen', 'otro'].map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Notas (Opcional)</label>
                          <input
                            type="text"
                            value={newDocNotes}
                            onChange={(e) => setNewDocNotes(e.target.value)}
                            placeholder="Observaciones..."
                            className="block w-full text-[11px] border border-slate-200 dark:border-slate-850 rounded-lg p-1.5 focus:outline-none bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>

                      {isUploading && (
                        <div className="space-y-1 pt-1.5">
                          <div className="flex justify-between text-[10px] text-slate-450 font-bold">
                            <span>Subiendo archivo...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-850 h-1 rounded-full overflow-hidden">
                            <div className="bg-brand-500 h-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={isUploading || !newDocFile || !newDocTitle}
                        onClick={async () => {
                          await handleUploadClientDocument(newDocFile, newDocType, newDocNotes, newDocTitle);
                          setNewDocFile(null);
                          setNewDocTitle('');
                          setNewDocNotes('');
                        }}
                        className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold text-xs cursor-pointer transition-all disabled:opacity-50"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        Subir Documento
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end p-6 border-t border-slate-100 dark:border-slate-800">
              {!isReadOnly && (
                <button
                  onClick={() => {
                    setIsDetailOpen(false);
                    handleOpenEditModal(selectedClient);
                  }}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer shadow-md shadow-brand-600/20"
                >
                  Editar Ficha
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
