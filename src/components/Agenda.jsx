import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Calendar as CalendarIcon, Clock, Users, BookOpen, DollarSign, FileText, 
  Plus, Check, Filter, AlertTriangle, Trash2, Edit2, X
} from 'lucide-react';

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
      const [prospectsRes, servicesRes, incomesRes, documentsRes, manualEventsRes] = await Promise.all([
        supabase.from('prospects').select('*'),
        supabase.from('services').select('*'),
        supabase.from('incomes').select('*'),
        supabase.from('documents').select('*'),
        supabase.from('agenda_events').select('*')
      ]);

      const prospectsList = prospectsRes.data || [];
      const servicesList = servicesRes.data || [];
      const incomesList = incomesRes.data || [];
      const documentsList = documentsRes.data || [];
      const manualEventsList = manualEventsRes.data || [];

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
            type: 'prospecto',
            entity_id: p.id,
            completed: false
          });
        }
      });

      // 2. Service deliveries
      servicesList.forEach(s => {
        if (s.estimated_delivery && s.status !== 'cerrado') {
          const isNear = new Date(s.estimated_delivery) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          items.push({
            id: `serv-delivery-${s.id}`,
            title: `Entrega: ${s.book_title}`,
            description: `Servicio contratado (${s.type}). Etapa actual: ${s.current_stage || 'N/A'}. Avance: ${s.advance_percent || 0}%`,
            date: s.estimated_delivery,
            time: '18:00',
            type: 'entrega',
            entity_id: s.id,
            completed: false,
            alert: isNear
          });
        }
      });

      // 3. Pending payments
      incomesList.forEach(inc => {
        if (inc.status !== 'pagado') {
          // If due date is not directly in DB, use transaction date as expected date
          const clientName = inc.client ? inc.client.name : 'Cliente General';
          items.push({
            id: `income-pending-${inc.id}`,
            title: `Pago Pendiente: ${clientName}`,
            description: `Monto esperado: ${inc.amount} ${inc.currency} (${inc.notes || 'Factura/Boleta parcial'})`,
            date: inc.date,
            time: '12:00',
            type: 'pago',
            entity_id: inc.id,
            completed: false
          });
        }
      });

      // 4. Pending contracts
      // Active services that do not have a linked document of type 'contrato'
      servicesList.forEach(s => {
        if (s.status !== 'cerrado') {
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
              alert: true
            });
          }
        }
      });

      // 5. Manual events
      manualEventsList.forEach(evt => {
        const isStageEvent = evt.type === 'etapa_servicio';
        const isCompleted = evt.status === 'completada' || evt.completed === true;

        items.push({
          id: `manual-evt-${evt.id}`,
          title: evt.title,
          description: evt.notes || evt.description || 'Sin descripción',
          date: evt.date,
          time: evt.time || '12:00',
          type: isStageEvent ? 'entrega' : (evt.type || 'reunión'),
          entity_id: evt.id,
          completed: isCompleted,
          isManual: !isStageEvent
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
              <div className="flex gap-2 justify-end items-center shrink-0">
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
