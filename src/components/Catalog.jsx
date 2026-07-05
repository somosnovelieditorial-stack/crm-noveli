import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatCurrency } from '../utils';
import { 
  Plus, Search, Edit2, Trash2, X, Sparkles,
  ToggleLeft, ToggleRight, DollarSign, Tag, Info 
} from 'lucide-react';

const categoryLabels = {
  'editorial': 'Editorial',
  'publicidad': 'Publicidad',
  'diseño': 'Diseño',
  'corrección': 'Corrección',
  'maquetación': 'Maquetación',
  'derechos de autor': 'Derechos de Autor',
  'asesoría': 'Asesoría',
  'legal': 'Legal',
  'impresión': 'Impresión',
  'otro': 'Otro'
};

export default function Catalog() {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [activeFilter, setActiveFilter] = useState('todos');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_price: 0,
    currency: 'CLP',
    includes_vat: false,
    category: 'corrección',
    active: true,
    requires_manuscript: true,
    requires_materials: false,
    requires_signed_contract: true,
    requires_agreement_sent: false,
    requires_duration: false
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_catalog')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCatalog(data || []);
    } catch (err) {
      console.error("Error loading catalog:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedItem(null);
    setFormData({
      name: '',
      description: '',
      base_price: 0,
      currency: 'CLP',
      includes_vat: false,
      category: 'editorial',
      active: true,
      requires_manuscript: true,
      requires_materials: false,
      requires_signed_contract: true,
      requires_agreement_sent: false,
      requires_duration: false
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setSelectedItem(item);
    setFormData({
      name: item.name || '',
      description: item.description || '',
      base_price: item.base_price || 0,
      currency: item.currency || 'CLP',
      includes_vat: item.includes_vat || false,
      category: item.category || 'editorial',
      active: item.active !== undefined ? item.active : true,
      requires_manuscript: item.requires_manuscript !== undefined ? item.requires_manuscript : true,
      requires_materials: item.requires_materials !== undefined ? item.requires_materials : false,
      requires_signed_contract: item.requires_signed_contract !== undefined ? item.requires_signed_contract : true,
      requires_agreement_sent: item.requires_agreement_sent !== undefined ? item.requires_agreement_sent : false,
      requires_duration: item.requires_duration !== undefined ? item.requires_duration : false
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este servicio del catálogo? Se podría ver afectado su uso en packs futuros.')) {
      try {
        const { error } = await supabase
          .from('service_catalog')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setCatalog(catalog.filter(item => item.id !== id));
      } catch (err) {
        console.error('Error deleting catalog item:', err);
        alert('Error al eliminar el ítem del catálogo');
      }
    }
  };

  const handleToggleActive = async (item) => {
    try {
      const newActiveState = !item.active;
      const { error } = await supabase
        .from('service_catalog')
        .update({ active: newActiveState })
        .eq('id', item.id);

      if (error) throw error;
      
      // Update local state
      setCatalog(catalog.map(c => c.id === item.id ? { ...c, active: newActiveState } : c));
    } catch (err) {
      console.error('Error toggling active state:', err);
      alert('Error al cambiar el estado del servicio');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('El nombre del servicio es requerido.');
      return;
    }
    if (formData.base_price < 0) {
      setFormError('El precio base no puede ser negativo.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (selectedItem) {
        // Edit Mode
        const { error } = await supabase
          .from('service_catalog')
          .update(formData)
          .eq('id', selectedItem.id);

        if (error) throw error;
      } else {
        // Add Mode
        const { error } = await supabase
          .from('service_catalog')
          .insert([formData]);

        if (error) throw error;
      }

      await fetchCatalog();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving catalog item:', err);
      setFormError(err.message || 'Error al guardar el servicio en el catálogo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    'editorial', 'publicidad', 'diseño', 'corrección', 'maquetación', 'derechos de autor', 'asesoría', 'otro'
  ];

  // Filters logic
  const filteredCatalog = catalog.filter(c => {
    if (!c) return false;
    const name = String(c.name || '').toLowerCase();
    const description = String(c.description || '').toLowerCase();
    const query = String(searchQuery || '').toLowerCase();
    const matchesSearch = name.includes(query) || description.includes(query);

    const matchesCategory = categoryFilter === 'todos' || c.category === categoryFilter;
    
    let matchesActive = true;
    if (activeFilter === 'si') matchesActive = c.active;
    else if (activeFilter === 'no') matchesActive = !c.active;

    return matchesSearch && matchesCategory && matchesActive;
  });

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'editorial': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900';
      case 'publicidad': return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-900';
      case 'diseño': return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900';
      case 'corrección': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900';
      case 'maquetación': return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900';
      case 'derechos de autor': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900';
      case 'asesoría': return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900';
      case 'legal': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900';
      case 'impresión': return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Catálogo de Servicios
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Define la lista de servicios editoriales estándar y sus tarifas de base.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-brand-600/20 cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" />
          Añadir al Catálogo
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Category */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Categoría:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="block px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
            >
              <option value="todos">Todos</option>
              {categories.map(c => (
                <option key={c} value={c}>{categoryLabels[c] || c}</option>
              ))}
            </select>
          </div>

          {/* Active */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Estado:</span>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="block px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
            >
              <option value="todos">Todos</option>
              <option value="si">Activos</option>
              <option value="no">Inactivos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Catalog Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : filteredCatalog.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400">
          No se encontraron servicios en el catálogo.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCatalog.map((item) => (
            <div 
              key={item.id} 
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 flex flex-col justify-between hover:shadow-md transition-all relative ${item.active ? 'border-slate-100 dark:border-slate-800' : 'border-slate-200/50 opacity-60 dark:border-slate-900/60'}`}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getCategoryColor(item.category)}`}>
                    {categoryLabels[item.category] || item.category}
                  </span>
                  
                  {/* Status Toggle Switch */}
                  <button 
                    onClick={() => handleToggleActive(item)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    title={item.active ? "Desactivar servicio" : "Activar servicio"}
                  >
                    {item.active ? (
                      <ToggleRight className="w-7 h-7 text-brand-600 dark:text-brand-400" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-400" />
                    )}
                  </button>
                </div>

                <div>
                  <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{item.name}</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed line-clamp-3">
                    {item.description || 'Sin descripción.'}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-50 dark:border-slate-850 flex justify-between items-end">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Tarifa Base</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-150 text-base mt-0.5 inline-block">
                    {formatCurrency(item.base_price, item.currency)}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1 font-semibold">
                    {item.includes_vat ? 'con IVA' : 'exento'}
                  </span>
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Tag className="w-5 h-5 text-brand-500" />
                {selectedItem ? 'Editar Ítem de Catálogo' : 'Añadir al Catálogo'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nombre del Servicio *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. Corrección de Estilo Avanzada"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Categoría</label>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      let defaults = {};
                      if (newCat === 'editorial' || newCat === 'corrección' || newCat === 'maquetación') {
                        defaults = {
                          requires_manuscript: true,
                          requires_materials: false,
                          requires_signed_contract: true,
                          requires_agreement_sent: false,
                          requires_duration: false
                        };
                      } else if (newCat === 'publicidad') {
                        defaults = {
                          requires_manuscript: false,
                          requires_materials: false,
                          requires_signed_contract: false,
                          requires_agreement_sent: true,
                          requires_duration: true
                        };
                      } else if (newCat === 'diseño') {
                        defaults = {
                          requires_manuscript: false,
                          requires_materials: true,
                          requires_signed_contract: false,
                          requires_agreement_sent: true,
                          requires_duration: false
                        };
                      } else if (newCat === 'asesoría') {
                        defaults = {
                          requires_manuscript: false,
                          requires_materials: false,
                          requires_signed_contract: false,
                          requires_agreement_sent: true,
                          requires_duration: true
                        };
                      } else {
                        defaults = {
                          requires_manuscript: false,
                          requires_materials: false,
                          requires_signed_contract: false,
                          requires_agreement_sent: true,
                          requires_duration: false
                        };
                      }
                      setFormData({...formData, category: newCat, ...defaults});
                    }}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{categoryLabels[c] || c}</option>
                    ))}
                  </select>
                </div>

                {/* Price, Currency & VAT */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Base Price */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Precio Base</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.base_price}
                      onChange={(e) => setFormData({...formData, base_price: Number(e.target.value)})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                    </select>
                  </div>

                  {/* VAT toggle */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">¿Precio Incluye IVA?</label>
                    <select
                      value={formData.includes_vat ? 'si' : 'no'}
                      onChange={(e) => setFormData({...formData, includes_vat: e.target.value === 'si'})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    >
                      <option value="no">No (Exento / Sin IVA)</option>
                      <option value="si">Sí (Incluye 19% IVA)</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Descripción</label>
                  <textarea
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Detalles sobre el servicio, lo que incluye, plazos promedio, etc..."
                  ></textarea>
                </div>

                {/* Requisitos de inicio */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Requisitos para iniciar trabajo</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-850 rounded-xl">
                    <label className="flex items-center gap-2 text-xs text-slate-750 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.requires_manuscript} 
                        onChange={(e) => setFormData({...formData, requires_manuscript: e.target.checked})}
                        className="rounded text-brand-650 focus:ring-brand-500 border-slate-300"
                      />
                      <span>Manuscrito/Archivos</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-750 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.requires_materials} 
                        onChange={(e) => setFormData({...formData, requires_materials: e.target.checked})}
                        className="rounded text-brand-650 focus:ring-brand-500 border-slate-300"
                      />
                      <span>Materiales/Briefing</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-750 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.requires_signed_contract} 
                        onChange={(e) => setFormData({...formData, requires_signed_contract: e.target.checked})}
                        className="rounded text-brand-650 focus:ring-brand-500 border-slate-300"
                      />
                      <span>Contrato Firmado</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-750 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.requires_agreement_sent} 
                        onChange={(e) => setFormData({...formData, requires_agreement_sent: e.target.checked})}
                        className="rounded text-brand-650 focus:ring-brand-500 border-slate-300"
                      />
                      <span>Acuerdo Enviado/Aceptado</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-750 dark:text-slate-300 cursor-pointer col-span-1 md:col-span-2">
                      <input 
                        type="checkbox" 
                        checked={formData.requires_duration} 
                        onChange={(e) => setFormData({...formData, requires_duration: e.target.checked})}
                        className="rounded text-brand-650 focus:ring-brand-500 border-slate-300"
                      />
                      <span>Periodo/Duración Definido</span>
                    </label>
                  </div>
                </div>

                {/* Active switch */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-850">
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-350 block">Servicio Activo</span>
                    <span className="text-[10px] text-slate-400 leading-normal">Los servicios activos definen las ofertas individuales y pueden combinarse en Packs.</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, active: !formData.active})}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {formData.active ? (
                      <ToggleRight className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
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
