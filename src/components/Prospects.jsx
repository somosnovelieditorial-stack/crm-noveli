import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatDate, exportToCSV } from '../utils';
import { 
  Plus, Search, Edit2, Trash2, X, Sparkles, Check,
  User, Send, Target, Calendar, HelpCircle, FileText, Download, Globe, MapPin, Clock, DollarSign
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
    interest_service: '',
    probability: 'media',
    next_action: '',
    followup_date: '',
    country: '',
    city: '',
    client_type: 'nacional',
    preferred_currency: 'CLP',
    timezone: '',
    notes: ''
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
    timezone: '',
    status: 'cliente',
    notes: ''
  });
  
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProspects();
  }, []);

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
      interest_service: '',
      probability: 'media',
      next_action: '',
      followup_date: '',
      country: '',
      city: '',
      client_type: 'nacional',
      preferred_currency: 'CLP',
      timezone: '',
      notes: ''
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
      interest_service: prospect.interest_service || '',
      probability: prospect.probability || 'media',
      next_action: prospect.next_action || '',
      followup_date: prospect.followup_date || '',
      country: prospect.country || '',
      city: prospect.city || '',
      client_type: prospect.client_type || 'nacional',
      preferred_currency: prospect.preferred_currency || 'CLP',
      timezone: prospect.timezone || '',
      notes: prospect.notes || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenConvertModal = (prospect) => {
    setSelectedProspect(prospect);
    
    // Guess contact type (is it an email? is it instagram handle starting with @?)
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
      timezone: prospect.timezone || '',
      status: 'cliente',
      notes: `Convertido desde prospecto. Servicio de interés: ${prospect.interest_service || 'Ninguno'}. Origen: ${prospect.origin}.\n\nNotas originales: ${prospect.notes || ''}`
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
      if (selectedProspect) {
        // Edit Mode
        const { error } = await supabase
          .from('prospects')
          .update({
            name: formData.name,
            contact: formData.contact,
            origin: formData.origin,
            interest_service: formData.interest_service,
            probability: formData.probability,
            next_action: formData.next_action,
            followup_date: formData.followup_date || null,
            country: formData.country,
            city: formData.city,
            client_type: formData.client_type,
            preferred_currency: formData.preferred_currency,
            timezone: formData.timezone,
            notes: formData.notes
          })
          .eq('id', selectedProspect.id);

        if (error) throw error;
      } else {
        // Add Mode
        const { error } = await supabase
          .from('prospects')
          .insert([formData]);

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

    setIsSubmitting(true);
    setFormError('');

    try {
      // 1. Insert into clients
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert([convertData])
        .select()
        .single();

      if (clientError) throw clientError;

      // 2. Link prospect with new client
      const { error: prospectError } = await supabase
        .from('prospects')
        .update({ converted_to_client_id: newClient.id })
        .eq('id', selectedProspect.id);

      if (prospectError) throw prospectError;

      await fetchProspects();
      setIsConvertModalOpen(false);
      alert(`¡Prospecto convertido en cliente con éxito! Nuevo cliente: ${newClient.name}`);
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
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.contact && p.contact.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.interest_service && p.interest_service.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesProb = probabilityFilter === 'todos' || p.probability === probabilityFilter;
    const matchesOrig = originFilter === 'todos' || p.origin === originFilter;
    const matchesCountry = countryFilter === 'todos' || p.country === countryFilter;
    const matchesType = clientTypeFilter === 'todos' || p.client_type === clientTypeFilter;
    
    let matchesConv = true;
    if (conversionStatus === 'pendientes') {
      matchesConv = !p.converted_to_client_id;
    } else if (conversionStatus === 'convertidos') {
      matchesConv = !!p.converted_to_client_id;
    }

    return matchesSearch && matchesProb && matchesOrig && matchesCountry && matchesType && matchesConv;
  });

  const handleExportCSV = () => {
    const csvData = filteredProspects.map(p => ({
      Nombre: p.name,
      Contacto: p.contact || '',
      Origen: p.origin || 'Instagram',
      'Servicio Interés': p.interest_service || '',
      Probabilidad: p.probability || 'media',
      'Próxima Acción': p.next_action || '',
      'Fecha Seguimiento': p.followup_date || '',
      País: p.country || '',
      Ciudad: p.city || '',
      'Tipo Cliente': p.client_type || 'nacional',
      'Moneda Preferida': p.preferred_currency || 'CLP',
      'Zona Horaria': p.timezone || '',
      'Convertido a Cliente': p.converted_to_client_id ? 'Sí' : 'No',
      Notas: p.notes || '',
      'Fecha Creación': p.created_at ? p.created_at.split('T')[0] : ''
    }));

    exportToCSV(
      csvData,
      'prospectos',
      ['Nombre', 'Contacto', 'Origen', 'Servicio Interés', 'Probabilidad', 'Próxima Acción', 'Fecha Seguimiento', 'País', 'Ciudad', 'Tipo Cliente', 'Moneda Preferida', 'Zona Horaria', 'Convertido a Cliente', 'Notas', 'Fecha Creación']
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
                          {!p.converted_to_client_id && (
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
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
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
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
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
                      className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                      placeholder="e.g. Gabriel García Márquez"
                    />
                  </div>
                </div>

                {/* Contact & Origin */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Contact */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Contacto (Email, Tel o Red)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Send className="w-4 h-4" /></span>
                      <input
                        type="text"
                        value={formData.contact}
                        onChange={(e) => setFormData({...formData, contact: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                        placeholder="e.g. @instagram o email@test.com"
                      />
                    </div>
                  </div>

                  {/* Origin */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Origen del Lead</label>
                    <select
                      value={formData.origin}
                      onChange={(e) => setFormData({...formData, origin: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white capitalize"
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
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="e.g. Colombia"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Ciudad (Opcional)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><MapPin className="w-4 h-4" /></span>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="e.g. Bogotá"
                      />
                    </div>
                  </div>
                </div>

                {/* Classifications and preferences */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipo Cliente</label>
                    <select
                      value={formData.client_type}
                      onChange={(e) => setFormData({...formData, client_type: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="CLP">CLP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Zona Horaria</label>
                    <input
                      type="text"
                      value={formData.timezone}
                      onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="e.g. America/Bogota"
                    />
                  </div>
                </div>

                {/* Service Interest & Probability */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Interest */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Servicio de Interés</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Target className="w-4 h-4" /></span>
                      <input
                        type="text"
                        value={formData.interest_service}
                        onChange={(e) => setFormData({...formData, interest_service: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                        placeholder="e.g. maquetación o corrección"
                      />
                    </div>
                  </div>

                  {/* Probability */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Probabilidad de Cierre</label>
                    <select
                      value={formData.probability}
                      onChange={(e) => setFormData({...formData, probability: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white capitalize"
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                </div>

                {/* Next Action & Followup date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Next action */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Próxima Acción</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><HelpCircle className="w-4 h-4" /></span>
                      <input
                        type="text"
                        value={formData.next_action}
                        onChange={(e) => setFormData({...formData, next_action: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                        placeholder="Enviar cotización, llamar..."
                      />
                    </div>
                  </div>

                  {/* Followup date */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha de Seguimiento</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Calendar className="w-4 h-4" /></span>
                      <input
                        type="date"
                        value={formData.followup_date}
                        onChange={(e) => setFormData({...formData, followup_date: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notas</label>
                  <textarea
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                    placeholder="Detalles sobre lo conversado, requerimientos específicos del libro..."
                  ></textarea>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-55 cursor-pointer"
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

      {/* Convert to Client Confirmation Modal */}
      {isConvertModalOpen && selectedProspect && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
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
            
            <form onSubmit={handleConvertSubmit} className="p-6 space-y-4">
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 p-4 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed font-medium">
                Vas a registrar formalmente a <strong>{selectedProspect.name}</strong> en la base de datos de Clientes. Se conservarán los datos de contacto y se actualizará su estado comercial a Cliente.
              </div>

              {formError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                {/* Client Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nombre Completo *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><User className="w-4 h-4" /></span>
                    <input
                      type="text"
                      required
                      value={convertData.name}
                      onChange={(e) => setConvertData({...convertData, name: e.target.value})}
                      className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Instagram</label>
                    <input
                      type="text"
                      value={convertData.instagram}
                      onChange={(e) => setConvertData({...convertData, instagram: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="+56 9..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">País</label>
                    <input
                      type="text"
                      value={convertData.country}
                      onChange={(e) => setConvertData({...convertData, country: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="e.g. Chile"
                    />
                  </div>
                </div>

                {/* City & Timezone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Ciudad</label>
                    <input
                      type="text"
                      value={convertData.city}
                      onChange={(e) => setConvertData({...convertData, city: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Zona Horaria</label>
                    <input
                      type="text"
                      value={convertData.timezone}
                      onChange={(e) => setConvertData({...convertData, timezone: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                {/* Client Type & Preferred Currency */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipo Cliente</label>
                    <select
                      value={convertData.client_type}
                      onChange={(e) => setConvertData({...convertData, client_type: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
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
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    >
                      <option value="CLP">CLP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notas Internas de Cliente</label>
                  <textarea
                    rows="4"
                    value={convertData.notes}
                    onChange={(e) => setConvertData({...convertData, notes: e.target.value})}
                    className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  ></textarea>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-55 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
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
