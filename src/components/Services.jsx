import { useEffect, useState } from 'react';
import { supabase, isMock, getValidOrgId } from '../supabaseClient';
import { formatCurrency, formatDate, filterByPeriod, exportToCSV } from '../utils';
import PeriodFilter from './PeriodFilter';
import { 
  Plus, Search, Edit2, Trash2, X, BookOpen, User, 
  Calendar, ClipboardList, CheckCircle2, PlayCircle, Circle,
  Download, AlertTriangle, Clock, ChevronDown, ChevronUp, Check, Info, Trash,
  UploadCloud, FileSpreadsheet, Image, File, Eye, FileText
} from 'lucide-react';

export default function Services({ isReadOnly = false }) {
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);
  const [editorialStages, setEditorialStages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [typeFilter, setTypeFilter] = useState('todos');
  
  // Period filter settings
  const [period, setPeriod] = useState({
    mode: 'month',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  // Expandable sections
  const [expandedTimelineId, setExpandedTimelineId] = useState(null);
  const [expandedChecklistId, setExpandedChecklistId] = useState(null);
  const [expandedDocsId, setExpandedDocsId] = useState(null);
  const [serviceDocuments, setServiceDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [newDocFile, setNewDocFile] = useState(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState('otro');
  const [newDocNotes, setNewDocNotes] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    client_id: '',
    type: 'corrección',
    book_title: '',
    status: 'recibido',
    value: 0,
    currency: 'CLP',
    exchange_rate: 1,
    start_date: new Date().toISOString().split('T')[0],
    estimated_delivery: '',
    notes: '',
    current_stage: 'recepción de material',
    advance_percent: 0,
    contract_duration_value: '6',
    contract_duration_unit: 'meses',
    amount_paid: 0,
    balance_due: 0,
    payment_status: 'pendiente',
    payment_method: 'transferencia',
    paid_at: '',
    contract_notes: ''
  });

  // Checklist form inline state
  const [checklistForm, setChecklistForm] = useState({
    task: '',
    responsible: '',
    due_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Services list filtered for current selected client in form
  const [formServices, setFormServices] = useState([]);

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Sync exchange rate in form when currency changes
  useEffect(() => {
    if (formData.currency === 'CLP') {
      setFormData(prev => ({ ...prev, exchange_rate: 1 }));
    } else if (formData.currency === 'USD') {
      setFormData(prev => ({ ...prev, exchange_rate: 940 }));
    } else if (formData.currency === 'EUR') {
      setFormData(prev => ({ ...prev, exchange_rate: 1010 }));
    }
  }, [formData.currency]);

  // Recalculate estimated delivery date based on start date and contract duration
  useEffect(() => {
    if (formData.start_date) {
      const start = new Date(formData.start_date);
      if (!isNaN(start.getTime())) {
        const val = formData.contract_duration_value !== '' ? parseInt(formData.contract_duration_value, 10) : 6;
        const unit = formData.contract_duration_unit || 'meses';
        if (unit === 'meses') {
          start.setMonth(start.getMonth() + val);
        } else if (unit === 'semanas') {
          start.setDate(start.getDate() + (val * 7));
        } else if (unit === 'días') {
          start.setDate(start.getDate() + val);
        }
        const newDelivery = start.toISOString().split('T')[0];
        setFormData(prev => {
          if (prev.estimated_delivery !== newDelivery) {
            return { ...prev, estimated_delivery: newDelivery };
          }
          return prev;
        });
      }
    }
  }, [formData.start_date, formData.contract_duration_value, formData.contract_duration_unit]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicesRes, clientsRes, stagesRes] = await Promise.all([
        supabase.from('services').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name').order('name', { ascending: true }),
        supabase.from('editorial_stages').select('*').eq('active', true).order('order', { ascending: true })
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (stagesRes.error) throw stagesRes.error;

      setServices(servicesRes.data || []);
      setClients(clientsRes.data || []);
      setEditorialStages(stagesRes.data || []);
    } catch (err) {
      console.error('Error fetching services data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    if (isReadOnly) return;
    setSelectedService(null);
    setFormData({
      client_id: clients[0]?.id || '',
      type: 'corrección',
      book_title: '',
      status: 'recibido',
      value: 0,
      currency: 'CLP',
      exchange_rate: 1,
      start_date: new Date().toISOString().split('T')[0],
      estimated_delivery: '',
      notes: '',
      current_stage: editorialStages.filter(st => st.active)[0]?.name || 'recepción de material',
      advance_percent: 0,
      contract_duration_value: '6',
      contract_duration_unit: 'meses',
      amount_paid: 0,
      balance_due: 0,
      payment_status: 'pendiente',
      payment_method: 'transferencia',
      paid_at: '',
      contract_notes: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (service) => {
    if (isReadOnly) return;
    setSelectedService(service);
    setFormData({
      client_id: service.client_id || '',
      type: service.type || 'corrección',
      book_title: service.book_title || '',
      status: service.status || 'recibido',
      value: service.value || 0,
      currency: service.currency || 'CLP',
      exchange_rate: service.exchange_rate || 1,
      start_date: service.start_date || new Date().toISOString().split('T')[0],
      estimated_delivery: service.estimated_delivery || '',
      notes: service.notes || '',
      current_stage: service.current_stage || 'recepción de material',
      advance_percent: service.advance_percent || 0,
      contract_duration_value: service.contract_duration_value || '6',
      contract_duration_unit: service.contract_duration_unit || 'meses',
      amount_paid: service.amount_paid || 0,
      balance_due: service.balance_due || 0,
      payment_status: service.payment_status || 'pendiente',
      payment_method: service.payment_method || 'transferencia',
      paid_at: service.paid_at || '',
      contract_notes: service.contract_notes || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDeleteService = async (id) => {
    if (isReadOnly) {
      alert('Acceso denegado: Tu rol actual no tiene permisos para esta acción.');
      return;
    }
    if (window.confirm('¿Estás seguro de que deseas eliminar este servicio editorial?')) {
      try {
        const { error } = await supabase
          .from('services')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setServices(services.filter(s => s.id !== id));
      } catch (err) {
        console.error('Error deleting service:', err);
        alert('Error al eliminar el servicio');
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) {
      alert('Acceso denegado: Tu rol actual no tiene permisos para esta acción.');
      return;
    }
    if (!formData.client_id) {
      setFormError('Debe seleccionar un cliente.');
      return;
    }
    if (!formData.book_title.trim()) {
      setFormError('El título del libro es requerido.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const payload = {
      ...formData,
      exchange_rate: Number(formData.exchange_rate) || 1,
      value_converted: Number(formData.value) * (Number(formData.exchange_rate) || 1),
      rate_date: formData.start_date
    };

    try {
      if (selectedService) {
        // Edit Mode
        const { error } = await supabase
          .from('services')
          .update(payload)
          .eq('id', selectedService.id);

        if (error) throw error;
      } else {
        // Add Mode
        const { error } = await supabase
          .from('services')
          .insert([payload]);

        if (error) throw error;
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving service:', err);
      setFormError(err.message || 'Error al guardar el servicio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inline Stage Update
  const handleUpdateStageStatus = async (serviceId, stageId, newStatus) => {
    if (isReadOnly) {
      alert('Acceso denegado: Tu rol actual no tiene permisos para esta acción.');
      return;
    }
    try {
      const { error } = await supabase
        .from('service_stages')
        .update({ status: newStatus })
        .eq('id', stageId);

      if (error) throw error;
      
      // Update local services stages
      setServices(services.map(s => {
        if (s.id === serviceId) {
          const updatedStages = s.stages.map(st => st.id === stageId ? { ...st, status: newStatus } : st);
          const completedCount = updatedStages.filter(st => st.status === 'completada').length;
          const advance_percent = Math.round((completedCount / updatedStages.length) * 100) || 0;
          
          supabase.from('services').update({ advance_percent }).eq('id', serviceId).then(() => {});

          return { ...s, stages: updatedStages, advance_percent };
        }
        return s;
      }));
    } catch (err) {
      console.error("Error updating stage status:", err);
      alert("Error al actualizar la etapa de la línea de tiempo.");
    }
  };

  // Checklist Action Handlers
  const handleAddChecklistTask = async (e, serviceId) => {
    e.preventDefault();
    if (isReadOnly) {
      alert('Acceso denegado: Tu rol actual no tiene permisos para esta acción.');
      return;
    }
    if (!checklistForm.task.trim()) return;

    try {
      const { error } = await supabase
        .from('service_checklists')
        .insert([{
          service_id: serviceId,
          task: checklistForm.task,
          status: 'pendiente',
          responsible: checklistForm.responsible,
          due_date: checklistForm.due_date,
          notes: checklistForm.notes
        }]);

      if (error) throw error;

      setChecklistForm({
        task: '',
        responsible: '',
        due_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      await fetchData();
    } catch (err) {
      console.error('Error adding checklist task:', err);
      alert('Error al agregar tarea del checklist.');
    }
  };

  const handleUpdateChecklistTaskStatus = async (taskId, newStatus) => {
    if (isReadOnly) return;
    try {
      const { error } = await supabase
        .from('service_checklists')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error updating checklist status:', err);
    }
  };

  const handleDeleteChecklistTask = async (taskId) => {
    if (window.confirm('¿Deseas eliminar esta tarea del checklist?')) {
      try {
        const { error } = await supabase
          .from('service_checklists')
          .delete()
          .eq('id', taskId);
        if (error) throw error;
        await fetchData();
      } catch (err) {
        console.error('Error deleting checklist task:', err);
      }
    }
  };

  // Document integration handlers and helper functions
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
          bgClass: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/25 dark:text-emerald-450 dark:border-emerald-900/40',
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

  const handleFetchServiceDocuments = async (serviceId) => {
    setLoadingDocuments(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServiceDocuments(data || []);
    } catch (err) {
      console.error('Error fetching service documents:', err);
      setServiceDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleUploadServiceDocument = async (file, docType, notes, docTitle, service) => {
    if (!file || !docTitle) {
      alert('Debe seleccionar un archivo y especificar un título.');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      let orgId = service.organization_id;
      if (!orgId) {
        orgId = await getValidOrgId();
      }

      const fileName = file.name;
      const sanitizedFileName = fileName.replace(/\s+/g, '_');
      const storagePath = `${orgId}/clientes/${service.client_id}/servicios/${service.id}/${docType}/${sanitizedFileName}`;

      setUploadProgress(55);

      const isMockVal = typeof isMock !== 'undefined' ? isMock : (supabase.isMock || false);

      let fileUrl = '';
      if (!isMockVal) {
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

      setUploadProgress(85);

      let userId = 'mock-user-123';
      if (!isMockVal) {
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
        client_id: service.client_id,
        service_id: service.id
      };

      const { error: dbErr } = await supabase
        .from('documents')
        .insert([dbPayload]);

      if (dbErr) throw dbErr;

      setUploadProgress(100);
      setNewDocFile(null);
      setNewDocTitle('');
      setNewDocNotes('');
      
      // Refresh documents
      await handleFetchServiceDocuments(service.id);
    } catch (err) {
      console.error('Error uploading service document:', err);
      alert(err.message || 'Error al subir el archivo.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteServiceDocument = async (doc, serviceId) => {
    const docName = doc.title || doc.name || doc.file_name || 'Documento';
    if (window.confirm(`¿Estás seguro de que deseas eliminar el documento "${docName}"?`)) {
      try {
        const isMockVal = typeof isMock !== 'undefined' ? isMock : (supabase.isMock || false);
        if (!isMockVal) {
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

        setServiceDocuments(prev => prev.filter(d => d.id !== doc.id));
      } catch (err) {
        console.error("Error deleting document:", err);
        alert("Error al eliminar el documento.");
      }
    }
  };

  const handleDownloadServiceFile = (doc) => {
    const docName = doc.title || doc.name || doc.file_name || 'Documento';
    const isMockVal = typeof isMock !== 'undefined' ? isMock : (supabase.isMock || false);
    if (isMockVal) {
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

  const handleViewServiceFile = (doc) => {
    const docName = doc.title || doc.name || doc.file_name || 'Documento';
    const isMockVal = typeof isMock !== 'undefined' ? isMock : (supabase.isMock || false);
    if (isMockVal) {
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

  // Duration computations
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

  const serviceTypes = [
    'corrección', 'maquetación', 'portada', 'ebook', 
    'libro físico', 'difusión', 'derechos de autor', 
    'asesoría de publicación', 'otro'
  ];

  const serviceStatuses = [
    'recibido', 'contrato pendiente', 'pago pendiente', 'en revisión', 
    'en corrección', 'en diseño', 'en maquetación', 'entregado', 'cerrado'
  ];

  // Exporter to CSV
  const handleExportCSV = () => {
    const csvData = finalFilteredServices.map(s => {
      const duration = getDurationStats(s.start_date, s.estimated_delivery, s.contract_duration_value, s.contract_duration_unit);
      return {
        Autor: s.clientName,
        Libro: s.book_title,
        Servicio: s.type,
        Valor: s.value,
        Moneda: s.currency,
        'Tasa Cambio': s.exchange_rate || 1,
        'Valor CLP': s.value_converted || s.value,
        Estado: s.status,
        'Fecha Inicio': s.start_date,
        'Entrega Estimada': s.estimated_delivery,
        'Etapa Actual': s.current_stage,
        'Avance %': s.advance_percent,
        'Días Transcurridos': duration.elapsedDays,
        'Días Restantes': duration.remainingDays < 0 ? `Atrasado (${duration.remainingDays})` : duration.remainingDays
      };
    });

    exportToCSV(
      csvData,
      `servicios_contratados_${period.mode}_${period.year || ''}_${period.month || ''}`,
      ['Autor', 'Libro', 'Servicio', 'Valor', 'Moneda', 'Tasa Cambio', 'Valor CLP', 'Estado', 'Fecha Inicio', 'Entrega Estimada', 'Etapa Actual', 'Avance %', 'Días Transcurridos', 'Días Restantes']
    );
  };

  // Filters logic
  const allServicesMapped = services.map(s => {
    const client = clients.find(c => c.id === s.client_id);
    return {
      ...s,
      clientName: client ? client.name : 'Cliente no encontrado'
    };
  });

  const periodFilteredServices = filterByPeriod(allServicesMapped, 'start_date', period);

  const finalFilteredServices = periodFilteredServices.filter(s => {
    if (!s) return false;
    const bookTitle = String(s.book_title || '').toLowerCase();
    const clientName = String(s.clientName || '').toLowerCase();
    const query = String(searchQuery || '').toLowerCase();
    
    const matchesSearch = 
      bookTitle.includes(query) ||
      clientName.includes(query);

    const matchesStatus = statusFilter === 'todos' || s.status === statusFilter;
    const matchesType = typeFilter === 'todos' || s.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'cerrado': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900';
      case 'entregado': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900';
      case 'contrato pendiente': return 'bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/30 dark:text-amber-450 dark:border-amber-900';
      case 'pago pendiente': return 'bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/30 dark:text-rose-455 dark:border-rose-900';
      case 'en revisión': return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-455 dark:border-cyan-900';
      default: return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-450 dark:border-blue-900';
    }
  };

  const getTimelineStatusIcon = (status) => {
    switch (status) {
      case 'completada': return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
      case 'en proceso': return <PlayCircle className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />;
      default: return <Circle className="w-5 h-5 text-slate-300 dark:text-slate-700 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Servicios Contratados
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Control detallado de plazos de entrega, etapas de producción editorial y avance por obra.
          </p>
        </div>
        
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={finalFilteredServices.length === 0}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={handleOpenAddModal}
            disabled={clients.length === 0 || isReadOnly}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-xs transition-all shadow-md shadow-brand-600/20 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Añadir Contrato
          </button>
        </div>
      </div>

      {clients.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 text-amber-700 dark:text-amber-300 p-4 rounded-xl text-sm">
          Debes crear al menos un <strong>Cliente</strong> antes de poder añadir servicios editoriales.
        </div>
      )}

      {/* Period Filter Component */}
      <PeriodFilter onChange={setPeriod} />

      {/* Filter Options */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Buscar por libro o cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Tipo:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block w-full px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs focus:outline-none capitalize"
            >
              <option value="todos">Todos</option>
              {serviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Proceso:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs focus:outline-none capitalize"
            >
              <option value="todos">Todos</option>
              {serviceStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Services List/Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : finalFilteredServices.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400">
          No se encontraron servicios contratados en este período.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {finalFilteredServices.map(service => {
            const duration = getDurationStats(service.start_date, service.estimated_delivery, service.contract_duration_value, service.contract_duration_unit);
            const showConverted = service.currency !== 'CLP';

            // Calculate checklist progress
            const checklistTasks = service.checklists || [];
            const totalTasks = checklistTasks.length;
            const completedTasks = checklistTasks.filter(t => t.status === 'completada').length;
            const checklistProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <div key={service.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 space-y-4 relative flex flex-col justify-between hover:shadow-md transition-shadow">
                
                {/* Header card info */}
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded capitalize dark:bg-brand-950/30 dark:text-brand-400 dark:border-brand-900">
                        {service.type}
                      </span>
                      {duration.alertLate ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded uppercase tracking-wider dark:bg-rose-950/30 dark:text-rose-455">
                          <AlertTriangle className="w-3 h-3" /> Atrasado
                        </span>
                      ) : duration.alertNear ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded uppercase tracking-wider dark:bg-amber-950/30 dark:text-amber-455">
                          <Clock className="w-3 h-3" /> Cerca de Vencer
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase tracking-wider dark:bg-emerald-950/30 dark:text-emerald-455">
                          En plazo
                        </span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 mt-1">{service.book_title}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5" />
                      {service.clientName}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(service)}
                      className="p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-600 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteService(service.id)}
                      className="p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Deadlines and calculated times */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/80 rounded-xl text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">Fechas Clave</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-350 block mt-1">Inicio: {formatDate(service.start_date)}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-350 block mt-0.5">Fin Est: {formatDate(service.estimated_delivery)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">Valor Contrato</span>
                    <span className="font-extrabold text-slate-805 dark:text-slate-150 text-sm block mt-1">
                      {formatCurrency(service.value, service.currency)}
                    </span>
                    {showConverted && (
                      <span className="text-[10px] text-brand-600 dark:text-brand-400 font-bold block mt-0.5">
                        ≈ {formatCurrency(service.value_converted || (service.value * (service.exchange_rate || 1)), 'CLP')}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 tracking-widest font-bold block">Tiempo Transcurrido</span>
                    <span className="font-semibold text-slate-755 dark:text-slate-350 block mt-1">
                      {duration.elapsedDays} días trabajados
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 tracking-widest font-bold block">Plazo Restante</span>
                    <span className={`font-bold block mt-1 ${duration.alertLate ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {duration.remainingDays < 0 ? `Atrasado por ${Math.abs(duration.remainingDays)} días` : `${duration.remainingDays} días restantes`}
                    </span>
                  </div>
                </div>

                {/* Real-time automated status text */}
                <div className="text-xs text-brand-700 dark:text-brand-350 p-3 bg-brand-50/20 dark:bg-brand-950/25 border border-brand-100/50 dark:border-brand-900/50 rounded-xl font-medium">
                  {duration.autoText}
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold capitalize">Etapa: <span className="text-slate-700 dark:text-slate-205">{service.current_stage}</span></span>
                    <span className="font-extrabold text-brand-600 dark:text-brand-400">{service.advance_percent}% de Avance (Flujo)</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${service.advance_percent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Checklist Progress Bar */}
                <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-850">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-brand-500" />
                      Checklist de Tareas: <span className="text-slate-655 dark:text-slate-350">{completedTasks} de {totalTasks} completadas</span>
                    </span>
                    <span className="font-extrabold text-brand-600 dark:text-brand-400">{checklistProgress}% de Tareas</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-850 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${checklistProgress}%` }}
                    ></div>
                  </div>
                </div>

                {/* TIMELINE & CHECKLIST TRIGGERS */}
                <div className="flex gap-2 pt-2 border-t border-slate-50 dark:border-slate-850 flex-col sm:flex-row">
                  <button
                    onClick={() => {
                      setExpandedTimelineId(expandedTimelineId === service.id ? null : service.id);
                      setExpandedChecklistId(null);
                      setExpandedDocsId(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-slate-50 dark:bg-slate-955/40 hover:bg-slate-100 dark:hover:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-550 dark:text-slate-350 cursor-pointer"
                  >
                    <span>Línea de Tiempo</span>
                    {expandedTimelineId === service.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => {
                      setExpandedChecklistId(expandedChecklistId === service.id ? null : service.id);
                      setExpandedTimelineId(null);
                      setExpandedDocsId(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-slate-50 dark:bg-slate-955/40 hover:bg-slate-100 dark:hover:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-550 dark:text-slate-350 cursor-pointer"
                  >
                    <span>Checklist</span>
                    {expandedChecklistId === service.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => {
                      const willExpand = expandedDocsId !== service.id;
                      setExpandedDocsId(willExpand ? service.id : null);
                      setExpandedTimelineId(null);
                      setExpandedChecklistId(null);
                      if (willExpand) {
                        handleFetchServiceDocuments(service.id);
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-slate-50 dark:bg-slate-955/40 hover:bg-slate-100 dark:hover:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-550 dark:text-slate-350 cursor-pointer"
                  >
                    <span>Documentos</span>
                    {expandedDocsId === service.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* TIMELINE DRAWER */}
                {expandedTimelineId === service.id && (
                  <div className="mt-2 p-4 border border-slate-100 dark:border-slate-850 rounded-xl bg-slate-50/30 dark:bg-slate-950/20 animate-slide-down space-y-4">
                    <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-5 py-2">
                      {(service.stages || []).map((stage) => (
                        <div key={stage.id} className="relative flex items-start gap-4 text-xs">
                          <span className="absolute -left-[37px] top-0.5 bg-white dark:bg-slate-900 rounded-full border-2 border-transparent">
                            {getTimelineStatusIcon(stage.status)}
                          </span>
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-slate-800 dark:text-slate-150 capitalize">{stage.stage_name}</span>
                              <span className={`text-[9px] font-extrabold border px-2 py-0.2 rounded-full uppercase tracking-wider ${stage.status === 'completada' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : stage.status === 'en proceso' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                {stage.status}
                              </span>
                            </div>
                            {stage.responsible && (
                              <p className="text-[10px] text-slate-405">Asignado: <span className="font-semibold">{stage.responsible}</span></p>
                            )}
                            {stage.start_date && (
                              <p className="text-[10px] text-slate-400">Plazo: {stage.start_date} {stage.end_date ? `a ${stage.end_date}` : '(En curso)'}</p>
                            )}
                            {stage.notes && (
                              <p className="text-[11px] text-slate-500 italic mt-1 bg-white/50 dark:bg-slate-900/30 p-2 rounded-lg border border-slate-100/30">"{stage.notes}"</p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleUpdateStageStatus(service.id, stage.id, 'pendiente')}
                              className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${stage.status === 'pendiente' ? 'bg-slate-200 dark:bg-slate-800' : 'bg-white dark:bg-slate-900 hover:bg-slate-50'}`}
                            >
                              Pend
                            </button>
                            <button
                              onClick={() => handleUpdateStageStatus(service.id, stage.id, 'en proceso')}
                              className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${stage.status === 'en proceso' ? 'bg-amber-500 text-white border-transparent' : 'bg-white dark:bg-slate-900 hover:bg-slate-50'}`}
                            >
                              Proc
                            </button>
                            <button
                              onClick={() => handleUpdateStageStatus(service.id, stage.id, 'completada')}
                              className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${stage.status === 'completada' ? 'bg-emerald-500 text-white border-transparent' : 'bg-white dark:bg-slate-900 hover:bg-slate-50'}`}
                            >
                              Compl
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CHECKLIST DRAWER */}
                {expandedChecklistId === service.id && (
                  <div className="mt-2 p-4 border border-slate-100 dark:border-slate-850 rounded-xl bg-slate-50/30 dark:bg-slate-950/20 animate-slide-down space-y-4">
                    <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Tareas Checklist</h4>
                    
                    {checklistTasks.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">No hay tareas creadas para este servicio. Agrega una abajo.</p>
                    ) : (
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {checklistTasks.map(task => (
                          <div key={task.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-start justify-between gap-3 text-xs">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-semibold ${task.status === 'completada' ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                                  {task.task}
                                </span>
                                <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase tracking-wider ${
                                  task.status === 'completada' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-450' 
                                    : task.status === 'en proceso'
                                    ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                  {task.status}
                                </span>
                              </div>
                              <div className="flex gap-3 text-[10px] text-slate-400 font-medium">
                                {task.responsible && <span>Resp: <strong>{task.responsible}</strong></span>}
                                {task.due_date && <span>Límite: <strong>{task.due_date}</strong></span>}
                              </div>
                              {task.notes && <p className="text-[10px] text-slate-400 italic">Nota: {task.notes}</p>}
                            </div>

                            <div className="flex gap-1.5 items-center shrink-0">
                              <select
                                value={task.status}
                                onChange={(e) => handleUpdateChecklistTaskStatus(task.id, e.target.value)}
                                className="px-2 py-1 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-bold bg-slate-50 dark:bg-slate-950"
                              >
                                <option value="pendiente">Pendiente</option>
                                <option value="en proceso">En Proceso</option>
                                <option value="completada">Completada</option>
                              </select>
                              <button
                                onClick={() => handleDeleteChecklistTask(task.id)}
                                className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/25 border border-transparent cursor-pointer"
                                title="Eliminar tarea"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add checklist task inline form */}
                    <form onSubmit={(e) => handleAddChecklistTask(e, service.id)} className="border-t border-slate-100 dark:border-slate-850 pt-3 space-y-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Nueva Tarea</span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          placeholder="Descripción de la tarea *..."
                          value={checklistForm.task}
                          onChange={(e) => setChecklistForm({ ...checklistForm, task: e.target.value })}
                          className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Responsable (e.g. Diseñador)..."
                          value={checklistForm.responsible}
                          onChange={(e) => setChecklistForm({ ...checklistForm, responsible: e.target.value })}
                          className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs focus:outline-none"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="date"
                          required
                          value={checklistForm.due_date}
                          onChange={(e) => setChecklistForm({ ...checklistForm, due_date: e.target.value })}
                          className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Notas opcionales..."
                          value={checklistForm.notes}
                          onChange={(e) => setChecklistForm({ ...checklistForm, notes: e.target.value })}
                          className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-[10px] cursor-pointer"
                      >
                        + Agregar Tarea
                      </button>
                    </form>
                  </div>
                )}

                {/* DOCUMENTS DRAWER */}
                {expandedDocsId === service.id && (
                  <div className="mt-2 p-4 border border-slate-100 dark:border-slate-850 rounded-xl bg-slate-50/30 dark:bg-slate-950/20 animate-slide-down space-y-4">
                    <h4 className="font-bold text-xs text-slate-550 dark:text-slate-350 uppercase tracking-wider text-left">Documentos del Servicio</h4>
                    
                    {loadingDocuments ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
                      </div>
                    ) : serviceDocuments.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center italic">Este servicio no posee documentos asociados.</p>
                    ) : (
                      <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1">
                        {serviceDocuments.map((doc) => {
                          const fileFormat = getFileFormatDetails(doc.file_name);
                          const FormatIcon = fileFormat.icon;
                          const docName = doc.title || doc.name || doc.file_name || 'Sin título';
                          const docTypeVal = doc.document_type || doc.file_type || 'otro';
                          return (
                            <div key={doc.id} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-brand-200 transition-all gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`p-1.5 rounded-lg border shrink-0 ${fileFormat.bgClass}`}>
                                  <FormatIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 text-left">
                                  <h6 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate" title={docName}>{docName}</h6>
                                  <span className="text-[9px] font-mono text-slate-450 truncate block">{doc.file_name}</span>
                                  {doc.notes && <span className="text-[10px] text-slate-500 italic block truncate">"{doc.notes}"</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-right">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider mr-2 ${getDocTypeColor(docTypeVal)}`}>
                                  {docTypeVal}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleViewServiceFile(doc)}
                                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-slate-900 cursor-pointer mr-1"
                                  title="Ver"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadServiceFile(doc)}
                                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-slate-900 cursor-pointer mr-1"
                                  title="Descargar"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteServiceDocument(doc, service.id)}
                                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-405 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-900 cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Direct upload form */}
                    <div className="border-t border-slate-100 dark:border-slate-850 pt-4 space-y-3">
                      <h6 className="text-[11px] font-bold uppercase tracking-wider text-slate-450 text-left">Subir Documento Nuevo</h6>
                      <div className="space-y-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs text-left">
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
                              className="block w-full text-[11px] text-slate-500 border border-slate-200 dark:border-slate-850 rounded-lg p-1.5 focus:outline-none bg-slate-50 dark:bg-slate-950"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">Nombre Visual *</label>
                            <input
                              type="text"
                              value={newDocTitle}
                              onChange={(e) => setNewDocTitle(e.target.value)}
                              placeholder="Título del documento"
                              className="block w-full text-[11px] border border-slate-200 dark:border-slate-850 rounded-lg p-1.5 focus:outline-none bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">Categoría</label>
                            <select
                              value={newDocType}
                              onChange={(e) => setNewDocType(e.target.value)}
                              className="block w-full text-[11px] border border-slate-205 dark:border-slate-850 rounded-lg p-1.5 focus:outline-none bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                            >
                              {['contrato', 'factura', 'boleta', 'comprobante de pago', 'manuscrito', 'portada', 'archivo final', 'documento legal', 'imagen', 'otro'].map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">Notas (Opcional)</label>
                            <input
                              type="text"
                              value={newDocNotes}
                              onChange={(e) => setNewDocNotes(e.target.value)}
                              placeholder="Observaciones..."
                              className="block w-full text-[11px] border border-slate-205 dark:border-slate-850 rounded-lg p-1.5 focus:outline-none bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                            />
                          </div>
                        </div>

                        {isUploading && (
                          <div className="space-y-1 pt-1.5">
                            <div className="flex justify-between text-[10px] text-slate-455 font-bold">
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
                          onClick={() => handleUploadServiceDocument(newDocFile, newDocType, newDocNotes, newDocTitle, service)}
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
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-500" />
                {selectedService ? 'Editar Contrato Editorial' : 'Añadir Contrato Editorial'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                {/* Client link */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Cliente (Autor) *</label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Service Type & Book Title */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipo de Servicio</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/55 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
                    >
                      {serviceTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Título del Libro *</label>
                    <input
                      type="text"
                      required
                      value={formData.book_title}
                      onChange={(e) => setFormData({...formData, book_title: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                      placeholder="e.g. Cien Años de Soledad"
                    />
                  </div>
                </div>

                {/* Value & Currency */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Value */}
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Valor Contrato</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.value}
                      onChange={(e) => setFormData({...formData, value: Number(e.target.value)})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Moneda</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    >
                      <option value="CLP">CLP ($)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>

                  {/* Overall Process Status */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Estado Proceso</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
                    >
                      {serviceStatuses.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Multicurrency Exchange Rate Input (Conditional) */}
                {formData.currency !== 'CLP' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-brand-100 dark:border-brand-900 bg-brand-50/10">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-1.5">Tasa de Cambio del Día</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0.01"
                        value={formData.exchange_rate}
                        onChange={(e) => setFormData({...formData, exchange_rate: Number(e.target.value)})}
                        className="block w-full px-3 py-2 border border-brand-200 dark:border-brand-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                      />
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Total CLP Equivalente</span>
                      <span className="text-base font-extrabold text-slate-850 dark:text-slate-100 mt-1">
                        {formatCurrency(formData.value * formData.exchange_rate, 'CLP')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Date */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha Inicio</label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    />
                  </div>
                  {/* Estimated Delivery */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha Est. Entrega</label>
                    <input
                      type="date"
                      value={formData.estimated_delivery}
                      onChange={(e) => setFormData({...formData, estimated_delivery: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                {/* Advance percentage & current stage (manual) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Advance percent */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Avance Manual (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={formData.advance_percent}
                      onChange={(e) => setFormData({...formData, advance_percent: Number(e.target.value)})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Current stage text */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Etapa Actual (Texto)</label>
                    <select
                      value={formData.current_stage}
                      onChange={(e) => setFormData({...formData, current_stage: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
                    >
                      {editorialStages.filter(st => st.active).map(st => (
                        <option key={st.id} value={st.name}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notas Internas</label>
                  <textarea
                    rows="2"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    placeholder="Detalles del contrato, plazos, requerimientos..."
                  ></textarea>
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
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
