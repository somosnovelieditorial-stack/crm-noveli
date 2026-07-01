import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Calendar as CalendarIcon, Clock, Users, BookOpen, DollarSign, FileText, 
  Plus, Check, Filter, AlertTriangle, Trash2, Edit2, X, CheckCircle
} from 'lucide-react';
import { syncPaymentStatus, recalculateClientStartStatus, recalculateServiceProgress } from '../utils';

export default function Agenda() {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('esta_semana'); // hoy, esta_semana, este_mes, atrasados
  const [events, setEvents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    type: 'reunión'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAgendaData();
  }, [filter]);

  const fetchAgendaData = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get dates limits
      let maxDate = new Date(today);
      if (filter === 'hoy') {
        maxDate.setDate(today.getDate() + 1);
      } else if (filter === 'esta_semana') {
        maxDate.setDate(today.getDate() + 7);
      } else if (filter === 'este_mes') {
        maxDate.setDate(today.getDate() + 30);
      }

      // Fetch all sources
      const [prospectsRes, servicesRes, incomesRes, documentsRes, manualEventsRes, clientsRes] = await Promise.all([
        supabase.from('prospects').select('*'),
        supabase.from('services').select('*'),
        supabase.from('incomes').select('*'),
        supabase.from('documents').select('*'),
        supabase.from('agenda_events').select('*'),
        supabase.from('clients').select('*')
      ]);

      const prospectsList = prospectsRes.data || [];
      const servicesList = servicesRes.data || [];
      const incomesList = incomesRes.data || [];
      const documentsList = documentsRes.data || [];
      const manualEventsList = manualEventsRes.data || [];
      const clientsList = clientsRes.data || [];

      // 1. Sincronizar eventos antiguos (agenda_events en Supabase) en base al estado real de clientes/servicios
      for (const evt of manualEventsList) {
        if (evt.status === 'completada') continue;

        const clientObj = clientsList.find(c => c.id === evt.client_id);
        const serviceObj = servicesList.find(s => s.id === evt.service_id);

        const titleLower = String(evt.title || '').toLowerCase();
        const descLower = String(evt.description || '').toLowerCase();
        const typeLower = String(evt.type || '').toLowerCase();

        let shouldMarkCompleted = false;

        // Contrato
        if (typeLower === 'contrato' || titleLower.includes('contrato') || descLower.includes('contrato')) {
          if (clientObj?.contract_signed_received || serviceObj?.contract_signed_received) {
            shouldMarkCompleted = true;
          }
        }

        // Pago
        if (typeLower === 'pago' || titleLower.includes('pago') || titleLower.includes('cobro') || descLower.includes('pago') || descLower.includes('cobro')) {
          if (clientObj?.payment_status === 'pagado' || serviceObj?.payment_status === 'pagado') {
            shouldMarkCompleted = true;
          }
        }

        // Archivos / Manuscrito
        if (typeLower === 'archivos' || titleLower.includes('manuscrito') || titleLower.includes('archivo') || descLower.includes('manuscrito') || descLower.includes('archivo')) {
          if (clientObj?.files_received || serviceObj?.files_received) {
            shouldMarkCompleted = true;
          }
        }

        // Materiales / Briefing
        if (typeLower === 'materiales' || titleLower.includes('materiales') || titleLower.includes('briefing') || descLower.includes('materiales') || descLower.includes('briefing')) {
          if (clientObj?.materials_received || serviceObj?.materials_received) {
            shouldMarkCompleted = true;
          }
        }

        if (shouldMarkCompleted) {
          evt.status = 'completada';
          // Actualización asíncrona en Supabase
          supabase
            .from('agenda_events')
            .update({ status: 'completada' })
            .eq('id', evt.id)
            .then(({ error }) => {
              if (error) console.error("Error auto-completing manual agenda event:", error);
            });
        }
      }

      // Combine into unified agenda items list
      const items = [];

      // 1. Prospect followups
      prospectsList.forEach(p => {
        if (p.followup_date && !p.converted_to_client_id) {
          items.push({
            id: `prosp-follow-${p.id}`,
            title: `Seguimiento: ${p.name}`,
            description: `Origen: ${p.origin}. Próxima acción: ${p.next_action || 'Sin acción definida'}. Notas: ${p.notes || ''}`,
            date: p.followup_date,
            time: '09:00',
            type: 'seguimiento',
            entity_id: p.id,
            completed: false,
            prospect: p
          });
        }
      });

      // 2. Service deliveries
      servicesList.forEach(s => {
        if (s.estimated_delivery && s.status !== 'cerrado') {
          const isNear = new Date(s.estimated_delivery) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const serviceClient = clientsList.find(c => c.id === s.client_id);
          items.push({
            id: `serv-delivery-${s.id}`,
            title: `Entrega: ${s.book_title}`,
            description: `Servicio contratado (${s.type}). Etapa actual: ${s.current_stage || 'N/A'}. Avance: ${s.advance_percent || 0}%`,
            date: s.estimated_delivery,
            time: '18:00',
            type: 'etapa_servicio',
            entity_id: s.id,
            completed: false,
            alert: isNear,
            service: s,
            client: serviceClient
          });
        }
      });

      // 3. Pending payments
      incomesList.forEach(inc => {
        if (inc.status !== 'pagado') {
          const incomeClient = clientsList.find(c => c.id === inc.client_id) || inc.client;
          // Si el cliente/servicio ya está pagado, no generar evento virtual de pago pendiente
          if (incomeClient?.payment_status === 'pagado') return;

          const clientName = incomeClient ? incomeClient.name : 'Cliente General';
          items.push({
            id: `income-pending-${inc.id}`,
            title: `Pago Pendiente: ${clientName}`,
            description: `Monto esperado: ${inc.amount} ${inc.currency} (${inc.notes || 'Factura/Boleta parcial'})`,
            date: inc.date,
            time: '12:00',
            type: 'pago',
            entity_id: inc.id,
            completed: false,
            income: inc,
            client: incomeClient
          });
        }
      });

      // 4. Pending contracts
      servicesList.forEach(s => {
        if (s.status !== 'cerrado') {
          const serviceClient = clientsList.find(c => c.id === s.client_id);
          // Si el cliente o servicio ya tiene el contrato firmado recibido, no generar evento virtual de contrato pendiente
          if (serviceClient?.contract_signed_received || s.contract_signed_received) return;

          const hasContract = documentsList.some(doc => doc.service_id === s.id && doc.file_type === 'contrato');
          if (!hasContract) {
            items.push({
              id: `contract-pending-${s.id}`,
              title: `Contrato Pendiente: ${s.book_title}`,
              description: `Falta cargar contrato firmado para el libro de ${s.client ? s.client.name : 'autor'}.`,
              date: s.start_date || todayStr,
              time: '10:00',
              type: 'contrato',
              entity_id: s.id,
              completed: false,
              alert: true,
              service: s,
              client: serviceClient
            });
          }
        }
      });

      // 5. Manual events
      manualEventsList.forEach(evt => {
        const isCompleted = evt.status === 'completada' || evt.completed === true;
        const serviceClient = clientsList.find(c => c.id === evt.client_id);
        const eventService = servicesList.find(s => s.id === evt.service_id);

        items.push({
          id: `manual-evt-${evt.id}`,
          title: evt.title,
          description: evt.notes || evt.description || 'Sin descripción',
          date: evt.date,
          time: evt.time || '12:00',
          type: evt.type || 'otro',
          entity_id: evt.id,
          completed: isCompleted,
          isManual: true,
          client_id: evt.client_id,
          service_id: evt.service_id,
          stage_id: evt.stage_id,
          client: serviceClient,
          service: eventService,
          rawEvent: evt
        });
      });

      // Filter items according to active tab
      const filteredItems = items.filter(item => {
        if (item.completed) {
          return false;
        }

        const itemDateOnly = new Date(item.date + 'T00:00:00');

        if (filter === 'hoy') {
          return item.date === todayStr;
        } else if (filter === 'esta_semana') {
          return itemDateOnly >= today && itemDateOnly < new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else if (filter === 'este_mes') {
          return itemDateOnly >= today && itemDateOnly < new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else if (filter === 'atrasados') {
          return itemDateOnly < today;
        }
        return true;
      });

      // Sort chronological
      filteredItems.sort((a, b) => {
        const dateA = new Date(a.date + 'T' + a.time);
        const dateB = new Date(b.date + 'T' + b.time);
        return dateA - dateB;
      });

      setEvents(filteredItems);
    } catch (err) {
      console.error('Error generating agenda list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (event, actionType) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const client = event.client;
    const service = event.service;
    
    // Validate IDs
    if (
      actionType === 'marcar_contrato_enviado' || 
      actionType === 'marcar_contrato_firmado' || 
      actionType === 'marcar_pagado' || 
      actionType === 'payment_received' || 
      actionType === 'marcar_archivos_recibidos' || 
      actionType === 'marcar_materiales_recibidos'
    ) {
      const clientId = client?.id || event.client_id || service?.client_id;
      if (!clientId) {
        alert("Error: No se encontró el client_id necesario para esta acción.");
        return;
      }
    }

    if (actionType === 'marcar_etapa_completada') {
      const stageId = event.stage_id || (event.rawEvent && event.rawEvent.stage_id);
      const sId = event.service_id || (event.rawEvent && event.rawEvent.service_id) || service?.id;
      if (!stageId) {
        alert("Error: No se encontró el stage_id necesario para completar la etapa.");
        return;
      }
      if (!sId) {
        alert("Error: No se encontró el service_id necesario para recalcular el avance.");
        return;
      }
    }

    const confirmMsg = `¿Estás seguro de que deseas realizar esta acción rápida?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      if (actionType === 'marcar_contrato_enviado') {
        const clientId = client?.id || event.client_id || service?.client_id;
        const { error: clientErr } = await supabase
          .from('clients')
          .update({
            contract_sent: true,
            contract_sent_at: todayStr
          })
          .eq('id', clientId);
        if (clientErr) throw clientErr;

        const sId = service?.id || event.service_id;
        if (sId) {
          await supabase
            .from('services')
            .update({
              contract_sent: true,
              contract_sent_at: todayStr
            })
            .eq('id', sId);
        }

        alert("Contrato marcado como enviado con éxito.");
      }

      else if (actionType === 'marcar_contrato_firmado') {
        const clientId = client?.id || event.client_id || service?.client_id;
        const { error: clientErr } = await supabase
          .from('clients')
          .update({
            contract_signed_received: true,
            contract_signed_received_at: todayStr
          })
          .eq('id', clientId);
        if (clientErr) throw clientErr;

        const sId = service?.id || event.service_id;
        if (sId) {
          await supabase
            .from('services')
            .update({
              contract_signed_received: true,
              contract_signed_received_at: todayStr
            })
            .eq('id', sId);
        }

        if (event.isManual) {
          await supabase
            .from('agenda_events')
            .update({ status: 'completada' })
            .eq('id', event.entity_id);
        }

        await recalculateClientStartStatus(clientId);
        alert("Contrato firmado marcado como recibido con éxito.");
      }

      else if (actionType === 'marcar_pagado' || actionType === 'payment_received') {
        const clientId = client?.id || event.client_id || service?.client_id;
        const clientTotal = client ? parseFloat(client.total_agreed_amount || client.agreed_amount || client.amount || 0) : 0;
        let amountPaid = clientTotal;
        
        if (amountPaid <= 0) {
          const amtStr = prompt("Ingrese el monto del pago realizado:", "0");
          if (amtStr === null) return;
          amountPaid = parseFloat(amtStr) || 0;
        }

        const { error: clientErr } = await supabase
          .from('clients')
          .update({
            payment_status: 'pagado',
            balance_due: 0,
            amount_paid: amountPaid,
            paid_at: todayStr
          })
          .eq('id', clientId);
        if (clientErr) throw clientErr;

        await syncPaymentStatus(clientId, true);

        if (event.isManual) {
          await supabase
            .from('agenda_events')
            .update({ status: 'completada' })
            .eq('id', event.entity_id);
        }

        await recalculateClientStartStatus(clientId);
        alert("Pago marcado como completado y sincronizado con éxito.");
      }

      else if (actionType === 'marcar_archivos_recibidos') {
        const clientId = client?.id || event.client_id || service?.client_id;
        const { error: clientErr } = await supabase
          .from('clients')
          .update({
            files_received: true,
            files_received_at: todayStr
          })
          .eq('id', clientId);
        if (clientErr) throw clientErr;

        const sId = service?.id || event.service_id;
        if (sId) {
          await supabase
            .from('services')
            .update({
              files_received: true,
              files_received_at: todayStr
            })
            .eq('id', sId);
        }

        if (event.isManual) {
          await supabase
            .from('agenda_events')
            .update({ status: 'completada' })
            .eq('id', event.entity_id);
        }

        await recalculateClientStartStatus(clientId);
        alert("Archivos del manuscrito marcados como recibidos con éxito.");
      }

      else if (actionType === 'marcar_materiales_recibidos') {
        const clientId = client?.id || event.client_id || service?.client_id;
        const { error: clientErr } = await supabase
          .from('clients')
          .update({
            materials_received: true,
            materials_received_at: todayStr
          })
          .eq('id', clientId);
        if (clientErr) throw clientErr;

        const sId = service?.id || event.service_id;
        if (sId) {
          await supabase
            .from('services')
            .update({
              materials_received: true,
              materials_received_at: todayStr
            })
            .eq('id', sId);
        }

        if (event.isManual) {
          await supabase
            .from('agenda_events')
            .update({ status: 'completada' })
            .eq('id', event.entity_id);
        }

        await recalculateClientStartStatus(clientId);
        alert("Materiales y briefing marcados como recibidos con éxito.");
      }

      else if (actionType === 'marcar_etapa_completada') {
        const stageId = event.stage_id || (event.rawEvent && event.rawEvent.stage_id);
        const sId = event.service_id || (event.rawEvent && event.rawEvent.service_id) || service?.id;

        const { error: stageErr } = await supabase
          .from('service_stages')
          .update({
            status: 'completada',
            completed_at: todayStr
          })
          .eq('id', stageId);
        if (stageErr) throw stageErr;

        await supabase
          .from('agenda_events')
          .update({ status: 'completada' })
          .eq('id', event.entity_id);

        await recalculateServiceProgress(sId);
        alert("Etapa marcada como completada con éxito.");
      }

      await fetchAgendaData();
    } catch (err) {
      console.error("Error executing quick action:", err);
      alert(`Error al procesar la acción: ${err.message || err}`);
    }
  };

  const renderQuickActions = (event) => {
    const buttons = [];
    const client = event.client;
    const service = event.service;
    const isCompleted = event.completed;

    if (isCompleted) return null;

    const addButton = (label, actionType, icon) => {
      buttons.push(
        <button
          key={actionType}
          onClick={() => handleQuickAction(event, actionType)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-700 hover:text-white dark:text-amber-400 dark:hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer shadow-2xs"
        >
          {icon}
          <span>{label}</span>
        </button>
      );
    };

    const titleLower = String(event.title || '').toLowerCase();
    const descLower = String(event.description || '').toLowerCase();
    const typeLower = String(event.type || '').toLowerCase();

    // 1. Si el evento es de contrato pendiente:
    if (
      typeLower === 'contrato' || 
      titleLower.includes('contrato') || 
      descLower.includes('contrato') || 
      event.action_key === 'contrato'
    ) {
      const clientSent = client?.contract_sent ?? false;
      const clientSigned = client?.contract_signed_received ?? false;
      
      if (!clientSent) {
        addButton("Marcar contrato enviado", "marcar_contrato_enviado", <CalendarIcon className="w-3.5 h-3.5" />);
      }
      if (!clientSigned) {
        addButton("Contrato recibido", "marcar_contrato_firmado", <CheckCircle className="w-3.5 h-3.5" />);
      }
    }

    // 2. Si evento contiene pago pendiente:
    if (
      typeLower === 'pago' || 
      titleLower.includes('pago') || 
      titleLower.includes('cobro') || 
      descLower.includes('pago') || 
      descLower.includes('cobro') || 
      event.action_key === 'pago'
    ) {
      const isPaid = client?.payment_status === 'pagado';
      if (!isPaid) {
        addButton("Marcar pagado", "payment_received", <DollarSign className="w-3.5 h-3.5" />);
      }
    }

    // 3. Si evento contiene manuscrito/archivos:
    if (
      typeLower === 'archivos' || 
      titleLower.includes('manuscrito') || 
      titleLower.includes('archivo') || 
      descLower.includes('manuscrito') || 
      descLower.includes('archivo') || 
      event.action_key === 'archivos'
    ) {
      const filesOk = client?.files_received ?? false;
      if (!filesOk) {
        addButton("Archivos recibidos", "marcar_archivos_recibidos", <FileText className="w-3.5 h-3.5" />);
      }
    }

    // 4. Si evento contiene materiales/briefing:
    if (
      typeLower === 'materiales' || 
      titleLower.includes('materiales') || 
      titleLower.includes('briefing') || 
      descLower.includes('materiales') || 
      descLower.includes('briefing') || 
      event.action_key === 'materiales'
    ) {
      const matOk = client?.materials_received ?? false;
      if (!matOk) {
        addButton("Materiales recibidos", "marcar_materiales_recibidos", <FileText className="w-3.5 h-3.5" />);
      }
    }

    // 5. Si event.type === "etapa_servicio":
    if (
      typeLower === 'etapa_servicio' || 
      typeLower === 'entrega' || 
      event.stage_id || 
      event.action_key === 'etapa_servicio'
    ) {
      addButton("Completar etapa", "marcar_etapa_completada", <CheckCircle className="w-3.5 h-3.5" />);
    }

    return buttons.length > 0 ? <div className="flex flex-wrap gap-2 mt-2 md:mt-0">{buttons}</div> : null;
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('agenda_events')
        .insert([formData]);

      if (error) throw error;

      setIsModalOpen(false);
      setFormData({
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: '12:00',
        type: 'reunión'
      });
      await fetchAgendaData();
    } catch (err) {
      console.error('Error saving manual event:', err);
      alert('Error al guardar el evento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteManualEvent = async (eventId) => {
    if (window.confirm('¿Deseas eliminar este evento de la agenda?')) {
      try {
        const { error } = await supabase
          .from('agenda_events')
          .delete()
          .eq('id', eventId);
        if (error) throw error;
        await fetchAgendaData();
      } catch (err) {
        console.error('Error deleting event:', err);
      }
    }
  };

  const getEventBadge = (type) => {
    switch (type) {
      case 'prospecto':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900';
      case 'entrega':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900';
      case 'pago':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900';
      case 'contrato':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-450 dark:border-rose-900';
      case 'reunión':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900';
      default:
        return 'bg-slate-55 text-slate-700 dark:bg-slate-800 dark:text-slate-350';
    }
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'prospecto': return <Users className="w-4 h-4" />;
      case 'entrega': return <BookOpen className="w-4 h-4" />;
      case 'pago': return <DollarSign className="w-4 h-4" />;
      case 'contrato': return <FileText className="w-4 h-4" />;
      default: return <CalendarIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Agenda Editorial
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Calendario unificado de hitos, entregas, seguimientos comerciales y reuniones de la editorial.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-brand-600/20 cursor-pointer w-fit shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo Evento / Reunión
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setFilter('hoy')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            filter === 'hoy' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-450' 
              : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          Hoy
        </button>
        <button
          onClick={() => setFilter('esta_semana')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            filter === 'esta_semana' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-450' 
              : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          Esta Semana
        </button>
        <button
          onClick={() => setFilter('este_mes')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            filter === 'este_mes' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-450' 
              : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          Este Mes
        </button>
        <button
          onClick={() => setFilter('atrasados')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === 'atrasados' 
              ? 'border-brand-500 text-rose-600 dark:text-rose-450' 
              : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          Atrasados / Vencidos
        </button>
      </div>

      {/* Agenda Feed */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400">
          No hay actividades ni compromisos en esta vista de la agenda.
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div 
              key={event.id}
              className={`p-5 bg-white dark:bg-slate-900 rounded-2xl border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md ${
                event.alert 
                  ? 'border-rose-100 dark:border-rose-950/60 bg-rose-50/10' 
                  : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-xl border shrink-0 ${getEventBadge(event.type)}`}>
                  {getEventIcon(event.type)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{event.title}</h3>
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${getEventBadge(event.type)}`}>
                      {event.type}
                    </span>
                    {event.alert && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/30 dark:text-rose-450 dark:border-rose-900 uppercase">
                        Próximo a Vencer
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed font-medium">
                    {event.description}
                  </p>
                  
                  {/* Date/Time badge */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-semibold pt-1">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                      {event.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {event.time}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action side */}
              <div className="flex flex-col md:flex-row gap-3 items-end md:items-center justify-end shrink-0">
                {renderQuickActions(event)}
                {event.isManual && (
                  <button
                    onClick={() => handleDeleteManualEvent(event.entity_id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg border border-slate-100 dark:border-slate-800 transition-all cursor-pointer"
                    title="Eliminar evento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-brand-500" />
                Agendar Reunión o Evento
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Título del Evento *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="ej: Reunión de diseño con corrector"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Descripción o Notas</label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Agregar detalles, enlaces de Zoom, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Hora *</label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipo de Evento</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                >
                  <option value="reunión">Reunión</option>
                  <option value="evento">Evento General</option>
                  <option value="entrega">Entrega / Hito</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-55 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Agendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
