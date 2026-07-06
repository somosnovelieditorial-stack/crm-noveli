import { useEffect, useState } from 'react';
import { supabase, isMock, getValidOrgId } from '../supabaseClient';
import { formatCurrency, formatDate, filterByPeriod, exportToCSV, syncPaymentStatus } from '../utils';
import PeriodFilter from './PeriodFilter';
import { 
  Plus, Search, Edit2, Trash2, X, BookOpen, User, 
  Calendar, ClipboardList, CheckCircle2, PlayCircle, Circle,
  Download, AlertTriangle, Clock, ChevronDown, ChevronUp, Check, Info, Trash,
  UploadCloud, FileSpreadsheet, Image, File, Eye, FileText, Settings, ArrowUp, ArrowDown
} from 'lucide-react';

export default function Services({ isReadOnly = false, realtimeTrigger }) {
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

  // Advanced progress, template and config states
  const [autoApplyTemplate, setAutoApplyTemplate] = useState(true);
  const [isStageConfigOpen, setIsStageConfigOpen] = useState(false);
  const [activeServiceForConfig, setActiveServiceForConfig] = useState(null);
  const [configStages, setConfigStages] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('editorial');
  const [editingStageId, setEditingStageId] = useState(null);
  const [stageEditForm, setStageEditForm] = useState({ name: '', status: '', started_at: '', completed_at: '', notes: '' });

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



  // Services list filtered for current selected client in form
  const [formServices, setFormServices] = useState([]);

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [realtimeTrigger]);

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

  const STAGE_TEMPLATES = {
    editorial: [
      { name: 'Recepción de material', description: '', order_index: 0, status: 'pendiente' },
      { name: 'Revisión inicial', description: '', order_index: 1, status: 'pendiente' },
      { name: 'Corrección', description: '', order_index: 2, status: 'pendiente' },
      { name: 'Diseño de portada', description: '', order_index: 3, status: 'pendiente' },
      { name: 'Maquetación', description: '', order_index: 4, status: 'pendiente' },
      { name: 'Revisión del autor', description: '', order_index: 5, status: 'pendiente' },
      { name: 'Ajustes finales', description: '', order_index: 6, status: 'pendiente' },
      { name: 'Entrega final', description: '', order_index: 7, status: 'pendiente' },
      { name: 'Cerrado', description: '', order_index: 8, status: 'pendiente' }
    ],
    publicidad: [
      { name: 'Acuerdo confirmado', description: '', order_index: 0, status: 'pendiente' },
      { name: 'Pago confirmado', description: '', order_index: 1, status: 'pendiente' },
      { name: 'Material recibido', description: '', order_index: 2, status: 'pendiente' },
      { name: 'Diseño o preparación de publicación', description: '', order_index: 3, status: 'pendiente' },
      { name: 'Programación de campaña', description: '', order_index: 4, status: 'pendiente' },
      { name: 'Publicación realizada', description: '', order_index: 5, status: 'pendiente' },
      { name: 'Historias / reposts activos', description: '', order_index: 6, status: 'pendiente' },
      { name: 'Cierre de campaña', description: '', order_index: 7, status: 'pendiente' },
      { name: 'Informe o seguimiento final', description: '', order_index: 8, status: 'pendiente' }
    ],
    diseño: [
      { name: 'Briefing recibido', description: '', order_index: 0, status: 'pendiente' },
      { name: 'Referencias recibidas', description: '', order_index: 1, status: 'pendiente' },
      { name: 'Primera propuesta', description: '', order_index: 2, status: 'pendiente' },
      { name: 'Revisión del autor', description: '', order_index: 3, status: 'pendiente' },
      { name: 'Ajustes', description: '', order_index: 4, status: 'pendiente' },
      { name: 'Aprobación final', description: '', order_index: 5, status: 'pendiente' },
      { name: 'Entrega de archivos finales', description: '', order_index: 6, status: 'pendiente' }
    ],
    asesoría: [
      { name: 'Pago confirmado', description: '', order_index: 0, status: 'pendiente' },
      { name: 'Fecha definida', description: '', order_index: 1, status: 'pendiente' },
      { name: 'Sesión realizada', description: '', order_index: 2, status: 'pendiente' },
      { name: 'Material complementario enviado', description: '', order_index: 3, status: 'pendiente' },
      { name: 'Cerrado', description: '', order_index: 4, status: 'pendiente' }
    ]
  };

  const getRecommendedCategory = (type) => {
    const t = String(type || '').toLowerCase();
    if (['corrección', 'maquetación', 'ebook', 'libro físico', 'derechos de autor'].includes(t)) {
      return 'editorial';
    }
    if (['portada', 'diseño'].includes(t)) {
      return 'diseño';
    }
    if (['difusión', 'publicidad'].includes(t)) {
      return 'publicidad';
    }
    if (['asesoría de publicación', 'asesoría'].includes(t)) {
      return 'asesoría';
    }
    return 'editorial';
  };

  const getServiceBadges = (service, duration) => {
    const badges = [];
    const isFinalizado = service.status === 'cerrado' || service.status === 'entregado' || service.advance_percent === 100;
    
    if (isFinalizado) {
      badges.push({ text: 'Finalizado', classes: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-205' });
    } else {
      if (service.status === 'recibido' || service.advance_percent === 0) {
        badges.push({ text: 'Pendiente', classes: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-955/20 dark:text-blue-400 dark:border-blue-900' });
      } else {
        badges.push({ text: 'En proceso', classes: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-955/20 dark:text-amber-400 dark:border-amber-900' });
      }

      if (duration.alertLate) {
        badges.push({ text: 'Atrasado', classes: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-955/20 dark:text-rose-455 dark:border-rose-900' });
      } else if (duration.alertNear) {
        badges.push({ text: 'Próximo a vencer', classes: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' });
      } else {
        badges.push({ text: 'En plazo', classes: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-955/20 dark:text-emerald-450 dark:border-emerald-900' });
      }
    }
    return badges;
  };

  const syncStageEventsToAgenda = async (serviceId) => {
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data?.user?.id || (typeof getMockUser === 'function' ? getMockUser().id : 'mock-user-123');

      // 1. Fetch current service details (we need client_id and book_title)
      const { data: service, error: serviceErr } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();

      if (serviceErr || !service) {
        console.error("Error fetching service for agenda sync:", serviceErr);
        return;
      }

      // 2. Fetch current stages of the service
      const { data: stages, error: stagesErr } = await supabase
        .from('service_stages')
        .select('*')
        .eq('service_id', serviceId);

      if (stagesErr) {
        console.error("Error fetching stages for agenda sync:", stagesErr);
        return;
      }

      // 3. Fetch existing agenda events for this service (type = 'etapa_servicio')
      const { data: existingEvents, error: eventsErr } = await supabase
        .from('agenda_events')
        .select('*')
        .eq('service_id', serviceId)
        .eq('type', 'etapa_servicio');

      if (eventsErr) {
        console.error("Error fetching agenda events:", eventsErr);
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];

      // 4. For each stage:
      for (const stage of (stages || [])) {
        const eventDate = stage.completed_at || stage.end_date || stage.started_at || stage.start_date;
        const stageName = stage.name || stage.stage_name;
        
        // If there is no date, delete any existing event for this stage
        if (!eventDate) {
          const matchingEvent = (existingEvents || []).find(evt => evt.stage_id === stage.id);
          if (matchingEvent) {
            await supabase
              .from('agenda_events')
              .delete()
              .eq('id', matchingEvent.id);
          }
          continue;
        }

        // Determine event status:
        let eventStatus = stage.status || 'pendiente';
        if (eventStatus !== 'completada' && eventDate < todayStr) {
          eventStatus = 'vencida';
        }

        const title = `${stageName} - ${service.book_title}`;
        const notes = stage.notes || '';

        const eventPayload = {
          user_id: userId,
          organization_id: orgId,
          service_id: serviceId,
          client_id: service.client_id || null,
          stage_id: stage.id,
          title: title,
          type: 'etapa_servicio',
          date: eventDate,
          status: eventStatus,
          notes: notes,
          description: notes,
          category: 'entrega'
        };

        const matchingEvent = (existingEvents || []).find(evt => evt.stage_id === stage.id);

        if (matchingEvent) {
          await supabase
            .from('agenda_events')
            .update(eventPayload)
            .eq('id', matchingEvent.id);
        } else {
          await supabase
            .from('agenda_events')
            .insert([eventPayload]);
        }
      }

      // 5. Delete events for stages that no longer exist
      for (const evt of (existingEvents || [])) {
        const stillExists = (stages || []).some(st => st.id === evt.stage_id);
        if (!stillExists) {
          await supabase
            .from('agenda_events')
            .delete()
            .eq('id', evt.id);
        }
      }

    } catch (err) {
      console.error("Error in syncStageEventsToAgenda:", err);
    }
  };

  const recalculateServiceProgress = async (serviceId) => {
    try {
      // Fetch service stages
      const { data: stages, error: err1 } = await supabase
        .from('service_stages')
        .select('*')
        .eq('service_id', serviceId);

      if (err1) throw err1;

      // Calculate stages progress (only based on stages now!)
      const totalStages = (stages || []).length;
      const completedStages = (stages || []).filter(st => st.status === 'completada').length;
      const stage_progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
      const progress = stage_progress;

      // Determine current stage name
      const sortedStages = [...(stages || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.id.localeCompare(b.id));
      const firstActiveStage = sortedStages.find(st => st.status !== 'completada');
      const current_stage = firstActiveStage 
        ? (firstActiveStage.name || firstActiveStage.stage_name) 
        : (sortedStages[sortedStages.length - 1]?.name || sortedStages[sortedStages.length - 1]?.stage_name || 'cerrado');

      // Update service row
      await supabase
        .from('services')
        .update({
          progress,
          advance_percent: progress,
          stage_progress,
          current_stage
        })
        .eq('id', serviceId);

      // Sync calendar events
      await syncStageEventsToAgenda(serviceId);

    } catch (err) {
      console.error("Error recalculating service progress:", err);
    }
  };

  const handleToggleStageCompleted = async (service, stageId, isCompleted) => {
    try {
      const newStatus = isCompleted ? 'completada' : 'pendiente';
      const today = new Date().toISOString().split('T')[0];
      
      const currentStage = (service.stages || []).find(st => st.id === stageId);
      if (!currentStage) return;

      const completed_at_val = isCompleted 
        ? (currentStage.completed_at || currentStage.end_date || today) 
        : null;

      const { error: err1 } = await supabase
        .from('service_stages')
        .update({
          status: newStatus,
          completed_at: completed_at_val,
          end_date: completed_at_val
        })
        .eq('id', stageId);

      if (err1) throw err1;

      // If completed, set next stage to "en proceso"
      if (isCompleted) {
        const sortedStages = [...(service.stages || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.id.localeCompare(b.id));
        const currentIndex = sortedStages.findIndex(st => st.id === stageId);
        if (currentIndex !== -1 && currentIndex < sortedStages.length - 1) {
          const nextStage = sortedStages[currentIndex + 1];
          if (nextStage.status === 'pendiente') {
            await supabase
              .from('service_stages')
              .update({
                status: 'en proceso',
                started_at: today,
                start_date: today
              })
              .eq('id', nextStage.id);
          }
        }
      }

      await recalculateServiceProgress(service.id);
      await fetchData();
    } catch (err) {
      console.error("Error toggling stage completion:", err);
      alert("Error al actualizar estado de la etapa.");
    }
  };

  const handleSaveStage = async (serviceId, stageId) => {
    try {
      const payload = {
        name: stageEditForm.name,
        stage_name: stageEditForm.name,
        status: stageEditForm.status,
        started_at: stageEditForm.started_at || null,
        start_date: stageEditForm.started_at || null,
        completed_at: stageEditForm.completed_at || null,
        end_date: stageEditForm.completed_at || null,
        notes: stageEditForm.notes
      };

      const { error } = await supabase
        .from('service_stages')
        .update(payload)
        .eq('id', stageId);

      if (error) throw error;

      setEditingStageId(null);
      await recalculateServiceProgress(serviceId);
      await fetchData();
    } catch (err) {
      console.error("Error saving stage:", err);
      alert("Error al guardar la etapa.");
    }
  };

  const handleOpenStageConfig = (service) => {
    setActiveServiceForConfig(service);
    setConfigStages(service.stages || []);
    setSelectedTemplate(getRecommendedCategory(service.type));
    setIsStageConfigOpen(true);
  };

  const handleApplyTemplateToConfig = () => {
    const templateStages = STAGE_TEMPLATES[selectedTemplate] || STAGE_TEMPLATES.editorial;
    const newStages = templateStages.map((st, idx) => ({
      ...st,
      order_index: idx
    }));
    setConfigStages(newStages);
  };

  const handleSaveConfigStages = async () => {
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data?.user?.id || getMockUser().id;

      // 1. Delete old stages
      const { error: deleteErr } = await supabase
        .from('service_stages')
        .delete()
        .eq('service_id', activeServiceForConfig.id);

      if (deleteErr) throw deleteErr;

      // 2. Insert new stages
      const stagesToInsert = configStages.map((stage, idx) => ({
        service_id: activeServiceForConfig.id,
        organization_id: orgId,
        user_id: userId,
        name: stage.name || stage.stage_name || 'Sin nombre',
        stage_name: stage.name || stage.stage_name || 'Sin nombre',
        status: stage.status || 'pendiente',
        order_index: idx,
        started_at: stage.started_at || stage.start_date || null,
        completed_at: stage.completed_at || stage.end_date || null,
        notes: stage.notes || '',
        active: stage.active !== undefined ? stage.active : true
      }));

      if (stagesToInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from('service_stages')
          .insert(stagesToInsert);

        if (insertErr) throw insertErr;
      }

      setIsStageConfigOpen(false);
      await recalculateServiceProgress(activeServiceForConfig.id);
      await fetchData();
    } catch (err) {
      console.error("Error saving config stages:", err);
      alert("Error al guardar la configuración de etapas.");
    }
  };



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

    const normalizeDate = (value) => value && String(value).trim() !== '' ? value : null;

    const payload = {
      ...formData,
      exchange_rate: Number(formData.exchange_rate) || 1,
      value_converted: Number(formData.value) * (Number(formData.exchange_rate) || 1),
      rate_date: formData.start_date
    };

    const dateFields = [
      'start_date',
      'estimated_delivery',
      'estimated_delivery_date',
      'contract_start_date',
      'contract_end_date',
      'paid_at',
      'payment_date',
      'payment_link_sent_at',
      'contract_sent_at',
      'contract_signed_received_at',
      'files_received_at',
      'materials_received_at',
      'rate_date'
    ];

    dateFields.forEach(field => {
      if (payload[field] !== undefined) {
        payload[field] = normalizeDate(payload[field]);
      }
    });

    try {
      // Rule: If client is already paid, the service must be marked as paid automatically
      const { data: clientObj } = await supabase
        .from('clients')
        .select('payment_status')
        .eq('id', formData.client_id)
        .single();
      
      const clientIsPaid = clientObj && clientObj.payment_status === 'pagado';
      if (clientIsPaid) {
        payload.payment_status = 'pagado';
        payload.balance_due = 0;
        payload.amount_paid = parseFloat(formData.total_agreed_amount || formData.value || 0);
        payload.paid_at = payload.paid_at || new Date().toISOString().split('T')[0];
      }

      if (selectedService) {
        // Edit Mode
        const { error } = await supabase
          .from('services')
          .update(payload)
          .eq('id', selectedService.id);

        if (error) throw error;
      } else {
        // Add Mode
        const res = await supabase
          .from('services')
          .insert([payload]);

        if (res.error) throw res.error;

        const newService = Array.isArray(res.data) ? res.data[0] : res.data;

        if (autoApplyTemplate && newService && newService.id) {
          const recCat = getRecommendedCategory(newService.type);
          const defaultStages = STAGE_TEMPLATES[recCat] || STAGE_TEMPLATES.editorial;
          const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
          const userRes = await supabase.auth.getUser();
          const userId = userRes.data?.user?.id || getMockUser().id;

          const stagesToInsert = defaultStages.map((stage, idx) => ({
            service_id: newService.id,
            organization_id: orgId,
            user_id: userId,
            name: stage.name,
            stage_name: stage.name,
            status: idx === 0 ? 'en proceso' : 'pendiente',
            order_index: idx,
            started_at: idx === 0 ? new Date().toISOString().split('T')[0] : null,
            start_date: idx === 0 ? new Date().toISOString().split('T')[0] : null,
            completed_at: null,
            end_date: null,
            notes: '',
            active: true
          }));

          if (stagesToInsert.length > 0) {
            await supabase.from('service_stages').insert(stagesToInsert);
          }

          await recalculateServiceProgress(newService.id);
        }
      }

      // Synchronize client payment status, services, and incomes!
      await syncPaymentStatus(formData.client_id);

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

            // Calculate stages progress (overall progress is only based on stages now)
            const stagesList = service.stages || [];
            const totalStages = stagesList.length;
            const completedStages = stagesList.filter(st => st.status === 'completada').length;
            const overallProgress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

            return (
              <div key={service.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 space-y-4 relative flex flex-col justify-between hover:shadow-md transition-shadow">
                
                {/* Header card info */}
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded capitalize dark:bg-brand-950/30 dark:text-brand-400 dark:border-brand-900">
                        {service.service_name || service.type}
                      </span>
                      {getServiceBadges(service, duration).map((badge, bidx) => (
                        <span key={bidx} className={`inline-flex items-center gap-1 text-[9px] font-bold border px-2 py-0.5 rounded uppercase tracking-wider ${badge.classes}`}>
                          {badge.text}
                        </span>
                      ))}
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

                {/* Overall Progress Bar */}
                <div className="space-y-2 p-4 bg-brand-50/5 dark:bg-brand-950/10 border border-brand-100/30 dark:border-brand-900/30 rounded-2xl">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">Avance General</span>
                    <span className="font-extrabold text-brand-600 dark:text-brand-400 text-sm">{overallProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-brand-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${overallProgress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium pt-1">
                    <span>Etapas completadas: {completedStages} de {totalStages}</span>
                    <span>Etapa actual: <strong className="capitalize text-slate-700 dark:text-slate-200">{service.current_stage || 'Sin etapas'}</strong></span>
                  </div>
                </div>

                {/* Etapa Actual Card with Config button */}
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-955/30 border border-slate-100 dark:border-slate-850 rounded-xl text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Etapa Actual</span>
                    <span className="font-extrabold text-slate-700 dark:text-slate-200 capitalize text-sm">
                      {service.current_stage || 'Sin etapas configuradas'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenStageConfig(service)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500 text-slate-655 dark:text-slate-350 hover:text-brand-600 dark:hover:text-brand-400 rounded-xl text-[11px] font-bold cursor-pointer transition-all shadow-sm"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Configurar etapas</span>
                  </button>
                </div>

                {/* TIMELINE & DOCUMENTS TRIGGERS */}
                <div className="flex gap-2 pt-2 border-t border-slate-50 dark:border-slate-850 flex-col sm:flex-row">
                  <button
                    onClick={() => {
                      setExpandedTimelineId(expandedTimelineId === service.id ? null : service.id);
                      setExpandedDocsId(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-slate-50 dark:bg-slate-955/40 hover:bg-slate-100 dark:hover:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-550 dark:text-slate-350 cursor-pointer"
                  >
                    <span>Línea de Tiempo</span>
                    {expandedTimelineId === service.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => {
                      const willExpand = expandedDocsId !== service.id;
                      setExpandedDocsId(willExpand ? service.id : null);
                      setExpandedTimelineId(null);
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
                    <div className="flex justify-between items-center pb-2 border-b border-slate-150 dark:border-slate-800">
                      <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Línea de Tiempo del Servicio</h4>
                      <button
                        onClick={() => handleOpenStageConfig(service)}
                        className="px-2.5 py-1 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-955/20 dark:text-brand-400 border border-brand-200/30 dark:border-brand-900/30 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Configurar Etapas
                      </button>
                    </div>

                    <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-5 py-2">
                      {(service.stages || []).map((stage) => {
                        const isEditing = editingStageId === stage.id;
                        const isCompleted = stage.status === 'completada';
                        const stageName = stage.name || stage.stage_name;
                        const startedAt = stage.started_at || stage.start_date;
                        const completedAt = stage.completed_at || stage.end_date;

                        return (
                          <div key={stage.id} className="relative flex items-start gap-4 text-xs">
                            <span className="absolute -left-[37px] top-0.5 bg-white dark:bg-slate-900 rounded-full border-2 border-transparent">
                              {getTimelineStatusIcon(stage.status)}
                            </span>
                            
                            <div className="flex-1 space-y-1">
                              {isEditing ? (
                                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nombre de la Etapa</label>
                                    <input
                                      type="text"
                                      value={stageEditForm.name}
                                      onChange={(e) => setStageEditForm({ ...stageEditForm, name: e.target.value })}
                                      className="w-full px-2.5 py-1 border border-slate-200 dark:border-slate-800 rounded text-xs focus:outline-none"
                                    />
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Estado</label>
                                      <select
                                        value={stageEditForm.status}
                                        onChange={(e) => setStageEditForm({ ...stageEditForm, status: e.target.value })}
                                        className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 rounded text-[11px] font-medium bg-slate-50 dark:bg-slate-950 focus:outline-none"
                                      >
                                        <option value="pendiente">Pendiente</option>
                                        <option value="en proceso">En proceso</option>
                                        <option value="completada">Completada</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">F. Inicio</label>
                                      <input
                                        type="date"
                                        value={stageEditForm.started_at}
                                        onChange={(e) => setStageEditForm({ ...stageEditForm, started_at: e.target.value })}
                                        className="w-full px-2 py-0.5 border border-slate-200 dark:border-slate-800 rounded text-[10px] focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">F. Término</label>
                                      <input
                                        type="date"
                                        value={stageEditForm.completed_at}
                                        onChange={(e) => setStageEditForm({ ...stageEditForm, completed_at: e.target.value })}
                                        className="w-full px-2 py-0.5 border border-slate-200 dark:border-slate-800 rounded text-[10px] focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notas</label>
                                    <textarea
                                      rows="1"
                                      value={stageEditForm.notes}
                                      onChange={(e) => setStageEditForm({ ...stageEditForm, notes: e.target.value })}
                                      className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded text-xs focus:outline-none"
                                      placeholder="Comentarios sobre la etapa..."
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setEditingStageId(null)}
                                      className="px-2.5 py-1 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-bold hover:bg-slate-50 cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveStage(service.id, stage.id)}
                                      className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded text-[10px] font-bold cursor-pointer"
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <input
                                        type="checkbox"
                                        checked={isCompleted}
                                        onChange={(e) => handleToggleStageCompleted(service, stage.id, e.target.checked)}
                                        className="w-3.5 h-3.5 text-brand-600 rounded cursor-pointer"
                                      />
                                      <span className={`font-extrabold ${isCompleted ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-150'} capitalize`}>
                                        {stageName}
                                      </span>
                                      <span className={`text-[8px] font-extrabold border px-2 py-0.2 rounded-full uppercase tracking-wider ${stage.status === 'completada' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900' : stage.status === 'en proceso' ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-955/20 dark:text-amber-400 dark:border-amber-900' : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-850 dark:text-slate-400 dark:border-slate-800'}`}>
                                        {stage.status}
                                      </span>
                                    </div>
                                    <div className="flex gap-3 text-[10px] text-slate-400 font-semibold pl-5">
                                      {startedAt && <span>Inicio: <strong>{formatDate(startedAt)}</strong></span>}
                                      {completedAt && <span>Término: <strong>{formatDate(completedAt)}</strong></span>}
                                    </div>
                                    {stage.notes && (
                                      <p className="text-[11px] text-slate-500 italic mt-1 bg-white/50 dark:bg-slate-900/30 p-2 rounded-lg border border-slate-100/30 pl-5">
                                        "{stage.notes}"
                                      </p>
                                    )}
                                  </div>

                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingStageId(stage.id);
                                        setStageEditForm({
                                          name: stageName || '',
                                          status: stage.status || 'pendiente',
                                          started_at: startedAt || '',
                                          completed_at: completedAt || '',
                                          notes: stage.notes || ''
                                        });
                                      }}
                                      className="px-2 py-1 text-[10px] font-bold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-955/30 rounded border border-transparent hover:border-brand-200/50 cursor-pointer"
                                    >
                                      Editar
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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

                {/* Auto Apply Stages Template (Only on creation) */}
                {!selectedService && (
                  <div className="flex items-center gap-2.5 p-3.5 bg-brand-50/10 border border-brand-100 dark:border-brand-900 rounded-xl">
                    <input
                      type="checkbox"
                      id="autoApplyTemplate"
                      checked={autoApplyTemplate}
                      onChange={(e) => setAutoApplyTemplate(e.target.checked)}
                      className="w-4 h-4 text-brand-600 rounded cursor-pointer shrink-0"
                    />
                    <label htmlFor="autoApplyTemplate" className="text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer text-left">
                      Crear y aplicar automáticamente la plantilla de etapas sugerida para <span className="text-brand-600 dark:text-brand-400 capitalize">"{getRecommendedCategory(formData.type)}"</span>
                    </label>
                  </div>
                )}

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

      {/* CONFIGURAR ETAPAS MODAL */}
      {isStageConfigOpen && activeServiceForConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col justify-between animate-scale-up">
            
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 text-left">Configurar Etapas</h3>
                <p className="text-xs text-slate-400 mt-1 text-left">Servicio: <span className="font-semibold text-brand-600 dark:text-brand-400">{activeServiceForConfig.book_title}</span></p>
              </div>
              <button
                onClick={() => setIsStageConfigOpen(false)}
                className="p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Selector Section */}
            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-955/30 border border-slate-150 dark:border-slate-850 rounded-2xl space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">Aplicar Plantilla Predefinida</span>
              <div className="flex gap-2">
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-white dark:bg-slate-900 focus:outline-none"
                >
                  <option value="editorial">Editorial / eBook / Libro físico</option>
                  <option value="publicidad">Publicidad / Difusión</option>
                  <option value="diseño">Diseño / Portada</option>
                  <option value="asesoría">Asesoría</option>
                </select>
                <button
                  type="button"
                  onClick={handleApplyTemplateToConfig}
                  className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0"
                >
                  Aplicar
                </button>
              </div>
              <p className="text-[10px] text-slate-400 italic text-left">Nota: Aplicar una plantilla reemplazará la configuración actual de etapas de este servicio.</p>
            </div>

            {/* Configured Stages List */}
            <div className="flex-1 my-4 overflow-y-auto pr-1 max-h-[45vh] space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left mb-1">Flujo de Etapas ({configStages.length})</span>
              
              {configStages.length === 0 ? (
                <div className="text-center text-xs text-slate-450 py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  No hay etapas configuradas para este servicio. Agrega una personalizada o aplica una plantilla arriba.
                </div>
              ) : (
                configStages.map((stage, idx) => {
                  const stageName = stage.name || stage.stage_name || '';
                  
                  const moveUp = () => {
                    if (idx === 0) return;
                    const list = [...configStages];
                    const temp = list[idx];
                    list[idx] = list[idx - 1];
                    list[idx - 1] = temp;
                    setConfigStages(list);
                  };

                  const moveDown = () => {
                    if (idx === configStages.length - 1) return;
                    const list = [...configStages];
                    const temp = list[idx];
                    list[idx] = list[idx + 1];
                    list[idx + 1] = temp;
                    setConfigStages(list);
                  };

                  const deleteStage = () => {
                    setConfigStages(configStages.filter((_, i) => i !== idx));
                  };

                  const renameStage = (newVal) => {
                    const list = [...configStages];
                    list[idx] = { ...list[idx], name: newVal, stage_name: newVal };
                    setConfigStages(list);
                  };

                  return (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-950/20 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                      
                      {/* Reorder Buttons */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={moveUp}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === configStages.length - 1}
                          onClick={moveDown}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Number Indicator */}
                      <span className="text-[11px] font-extrabold text-slate-400 w-5 text-center">{idx + 1}</span>

                      {/* Stage Name Input */}
                      <input
                        type="text"
                        value={stageName}
                        onChange={(e) => renameStage(e.target.value)}
                        placeholder="Nombre de la etapa..."
                        className="flex-1 px-3 py-1.5 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs focus:outline-none"
                      />

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={deleteStage}
                        className="p-1.5 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/20 border border-transparent cursor-pointer shrink-0"
                        title="Eliminar etapa"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add custom stage button */}
            <button
              type="button"
              onClick={() => {
                setConfigStages([
                  ...configStages,
                  { name: 'Nueva etapa', stage_name: 'Nueva etapa', status: 'pendiente', order_index: configStages.length }
                ]);
              }}
              className="w-full flex items-center justify-center gap-1 py-2 border border-dashed border-slate-200 hover:border-brand-500 dark:border-slate-800 hover:text-brand-600 rounded-xl text-xs font-bold text-slate-500 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Etapa Personalizada</span>
            </button>

            {/* Footer Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setIsStageConfigOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-350 rounded-xl text-sm font-semibold hover:bg-slate-55 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveConfigStages}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer shadow-md"
              >
                Guardar Etapas
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
