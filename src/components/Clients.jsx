import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatDate, exportToCSV } from '../utils';
import { 
  Plus, Search, Edit2, Trash2, Eye, X, 
  User, Mail, Phone, Globe, FileText, Download, DollarSign, MapPin, Clock
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
    timezone: '',
    status: 'prospecto',
    notes: ''
  });
  
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

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
      timezone: '',
      status: 'prospecto',
      notes: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client) => {
    setSelectedClient(client);
    setFormData({
      name: client.name || '',
      email: client.email || '',
      instagram: client.instagram || '',
      phone: client.phone || '',
      country: client.country || '',
      city: client.city || '',
      client_type: client.client_type || 'nacional',
      preferred_currency: client.preferred_currency || 'CLP',
      timezone: client.timezone || '',
      status: client.status || 'prospecto',
      notes: client.notes || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenDetailModal = (client) => {
    setSelectedClient(client);
    setIsDetailOpen(true);
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
    
    setIsSubmitting(true);
    setFormError('');

    try {
      if (selectedClient) {
        // Edit Mode
        const { error } = await supabase
          .from('clients')
          .update({
            name: formData.name,
            email: formData.email,
            instagram: formData.instagram,
            phone: formData.phone,
            country: formData.country,
            city: formData.city,
            client_type: formData.client_type,
            preferred_currency: formData.preferred_currency,
            timezone: formData.timezone,
            status: formData.status,
            notes: formData.notes
          })
          .eq('id', selectedClient.id);

        if (error) throw error;
      } else {
        // Add Mode
        const { error } = await supabase
          .from('clients')
          .insert([formData]);

        if (error) throw error;
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
      'Zona Horaria': c.timezone || '',
      Estado: c.status,
      Notas: c.notes || '',
      'Fecha Creación': c.created_at ? c.created_at.split('T')[0] : ''
    }));

    exportToCSV(
      csvData,
      'clientes',
      ['Nombre', 'Email', 'Instagram', 'Teléfono', 'País', 'Ciudad', 'Tipo Cliente', 'Moneda Preferida', 'Zona Horaria', 'Estado', 'Notas', 'Fecha Creación']
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'prospecto':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900';
      case 'cliente':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900';
      case 'activo':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900';
      case 'finalizado':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900';
      case 'perdido':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-450 dark:border-rose-900';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

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
              <option value="cliente">Cliente</option>
              <option value="activo">Activo (En Proceso)</option>
              <option value="finalizado">Finalizado</option>
              <option value="perdido">Perdido</option>
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
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
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
                      className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                      placeholder="e.g. Isabel Allende"
                    />
                  </div>
                </div>

                {/* Contacts row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Email</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Mail className="w-4 h-4" /></span>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                        placeholder="ejemplo@correo.com"
                      />
                    </div>
                  </div>

                  {/* Instagram */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Instagram</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><InstagramIcon className="w-4 h-4" /></span>
                      <input
                        type="text"
                        value={formData.instagram}
                        onChange={(e) => setFormData({...formData, instagram: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                        placeholder="@usuario"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Teléfono</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Phone className="w-4 h-4" /></span>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                        placeholder="+56 9..."
                      />
                    </div>
                  </div>

                  {/* Country */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">País</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Globe className="w-4 h-4" /></span>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={(e) => setFormData({...formData, country: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                        placeholder="e.g. Chile"
                      />
                    </div>
                  </div>
                </div>

                {/* Country details: City & Timezone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Ciudad (Opcional)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><MapPin className="w-4 h-4" /></span>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="e.g. Santiago"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Zona Horaria (Opcional)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Clock className="w-4 h-4" /></span>
                      <input
                        type="text"
                        value={formData.timezone}
                        onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="e.g. America/Santiago"
                      />
                    </div>
                  </div>
                </div>

                {/* Business classification: Client Type & Preferred Currency */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Clasificación de Cliente</label>
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
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><DollarSign className="w-4 h-4" /></span>
                      <select
                        value={formData.preferred_currency}
                        onChange={(e) => setFormData({...formData, preferred_currency: e.target.value})}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="CLP">CLP ($)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Estado</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white capitalize"
                  >
                    <option value="prospecto">Prospecto</option>
                    <option value="cliente">Cliente</option>
                    <option value="activo">Activo</option>
                    <option value="finalizado">Finalizado</option>
                    <option value="perdido">Perdido</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notas Internas</label>
                  <textarea
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                    placeholder="Información interna, historial del autor, preferencias..."
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
                className="p-1 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{selectedClient.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">Registrado el {formatDate(selectedClient.created_at)}</p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusColor(selectedClient.status)}`}>
                  {selectedClient.status}
                </span>
              </div>

              <div className="space-y-3 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Información de Contacto y Ubicación</h5>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {selectedClient.email && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-350">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium truncate">{selectedClient.email}</span>
                    </div>
                  )}
                  {selectedClient.instagram && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-350">
                      <InstagramIcon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium">{selectedClient.instagram}</span>
                    </div>
                  )}
                  {selectedClient.phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-350">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium">{selectedClient.phone}</span>
                    </div>
                  )}
                  {(selectedClient.country || selectedClient.city) && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-350">
                      <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium">
                        {selectedClient.city ? `${selectedClient.city}, ` : ''}{selectedClient.country || ''}
                      </span>
                    </div>
                  )}
                  {selectedClient.timezone && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-350">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium">{selectedClient.timezone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-350">
                    <DollarSign className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium">
                      Moneda: <strong className="font-mono">{selectedClient.preferred_currency || 'CLP'}</strong> ({selectedClient.client_type || 'nacional'})
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  Notas Internas
                </h5>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/50 rounded-xl text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedClient.notes || 'Sin notas registradas.'}
                </div>
              </div>
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
