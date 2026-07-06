import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import QuickQuoteModal from './QuickQuoteModal';
import { formatCurrency } from '../utils';
import { 
  Plus, Search, Edit2, Trash2, X, Info,
  Package, ToggleLeft, ToggleRight, Check, ListChecks, FileText 
} from 'lucide-react';

export default function Packs() {
  const [packs, setPacks] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('todos');
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_special: 0,
    currency: 'CLP',
    includes_vat: false,
    active: true,
    category: 'editorial',
    requires_manuscript: true,
    requires_materials: false,
    requires_signed_contract: true,
    requires_agreement_sent: false,
    requires_duration: false,
    selectedServiceIds: [] // local array of catalog IDs
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch packs
      const packsRes = await supabase.from('service_packs').select('*').order('name', { ascending: true });
      if (packsRes.error) throw packsRes.error;

      // 2. Fetch catalog services (only active for adding to pack)
      const catalogRes = await supabase.from('service_catalog').select('*').order('name', { ascending: true });
      if (catalogRes.error) throw catalogRes.error;

      // 3. For each pack, fetch pack items using pivot table
      const packsData = packsRes.data || [];
      const catalogData = catalogRes.data || [];
      setCatalog(catalogData);

      const packsWithItems = await Promise.all(packsData.map(async (pack) => {
        const { data: packItems, error: itemsErr } = await supabase
          .from('service_pack_items')
          .select('service_id')
          .eq('pack_id', pack.id);
        
        if (itemsErr) throw itemsErr;

        const serviceIds = (packItems || []).map(pi => pi.service_id);
        const includedServices = catalogData.filter(c => serviceIds.includes(c.id));

        // Calculate automated sum
        const autoSum = includedServices.reduce((sum, item) => sum + Number(item.base_price), 0);

        return {
          ...pack,
          serviceIds,
          includedServices,
          autoSum
        };
      }));

      setPacks(packsWithItems);
    } catch (err) {
      console.error("Error loading packs data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedPack(null);
    setFormData({
      name: '',
      description: '',
      price_special: 0,
      currency: 'CLP',
      includes_vat: false,
      active: true,
      category: 'editorial',
      requires_manuscript: true,
      requires_materials: false,
      requires_signed_contract: true,
      requires_agreement_sent: false,
      requires_duration: false,
      selectedServiceIds: []
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (pack) => {
    setSelectedPack(pack);
    setFormData({
      name: pack.name || '',
      description: pack.description || '',
      price_special: pack.price_special || 0,
      currency: pack.currency || 'CLP',
      includes_vat: pack.includes_vat || false,
      active: pack.active !== undefined ? pack.active : true,
      category: pack.category || 'editorial',
      requires_manuscript: pack.requires_manuscript !== undefined ? pack.requires_manuscript : true,
      requires_materials: pack.requires_materials !== undefined ? pack.requires_materials : false,
      requires_signed_contract: pack.requires_signed_contract !== undefined ? pack.requires_signed_contract : true,
      requires_agreement_sent: pack.requires_agreement_sent !== undefined ? pack.requires_agreement_sent : false,
      requires_duration: pack.requires_duration !== undefined ? pack.requires_duration : false,
      selectedServiceIds: pack.serviceIds || []
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDeletePack = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este pack editorial?')) {
      try {
        const { error } = await supabase
          .from('service_packs')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setPacks(packs.filter(p => p.id !== id));
      } catch (err) {
        console.error('Error deleting pack:', err);
        alert('Error al eliminar el pack');
      }
    }
  };

  const handleToggleActive = async (pack) => {
    try {
      const newActiveState = !pack.active;
      const { error } = await supabase
        .from('service_packs')
        .update({ active: newActiveState })
        .eq('id', pack.id);

      if (error) throw error;
      
      setPacks(packs.map(p => p.id === pack.id ? { ...p, active: newActiveState } : p));
    } catch (err) {
      console.error('Error toggling pack active:', err);
      alert('Error al cambiar el estado del pack');
    }
  };

  const handleServiceCheckboxToggle = (serviceId) => {
    const ids = [...formData.selectedServiceIds];
    const idx = ids.indexOf(serviceId);
    if (idx === -1) {
      ids.push(serviceId);
    } else {
      ids.splice(idx, 1);
    }
    setFormData({ ...formData, selectedServiceIds: ids });
  };

  // Get price sum of currently selected services in form
  const getSelectedServicesPriceSum = () => {
    const selected = catalog.filter(c => Array.isArray(formData.selectedServiceIds) ? formData.selectedServiceIds.includes(c.id) : false);
    return selected.reduce((sum, item) => sum + Number(item.base_price), 0);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('El nombre del pack es requerido.');
      return;
    }
    if (!Array.isArray(formData.selectedServiceIds) || formData.selectedServiceIds.length === 0) {
      setFormError('Debe seleccionar al menos un servicio del catálogo.');
      return;
    }
    if (formData.price_special < 0) {
      setFormError('El precio especial no puede ser negativo.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      let packId = selectedPack?.id;

      if (selectedPack) {
        // 1. Update Pack details
        const { error } = await supabase
          .from('service_packs')
          .update({
            name: formData.name,
            description: formData.description,
            price_special: formData.price_special,
            currency: formData.currency,
            includes_vat: formData.includes_vat,
            active: formData.active,
            category: formData.category,
            requires_manuscript: formData.requires_manuscript,
            requires_materials: formData.requires_materials,
            requires_signed_contract: formData.requires_signed_contract,
            requires_agreement_sent: formData.requires_agreement_sent,
            requires_duration: formData.requires_duration
          })
          .eq('id', packId);

        if (error) throw error;

        // 2. Delete previous associations
        const { error: delErr } = await supabase
          .from('service_pack_items')
          .delete()
          .eq('pack_id', packId);

        if (delErr) throw delErr;
      } else {
        // Add Mode
        const { data, error } = await supabase
          .from('service_packs')
          .insert([{
            name: formData.name,
            description: formData.description,
            price_special: formData.price_special,
            currency: formData.currency,
            includes_vat: formData.includes_vat,
            active: formData.active,
            category: formData.category,
            requires_manuscript: formData.requires_manuscript,
            requires_materials: formData.requires_materials,
            requires_signed_contract: formData.requires_signed_contract,
            requires_agreement_sent: formData.requires_agreement_sent,
            requires_duration: formData.requires_duration
          }])
          .select()
          .single();

        if (error) throw error;
        packId = data.id;
      }

      // 3. Add new associations
      const newItems = formData.selectedServiceIds.map(sid => ({
        pack_id: packId,
        service_id: sid
      }));

      const { error: insErr } = await supabase
        .from('service_pack_items')
        .insert(newItems);

      if (insErr) throw insErr;

      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving pack:', err);
      setFormError(err.message || 'Error al guardar el pack.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter list
  const filteredPacks = packs.filter(p => {
    if (!p) return false;
    const name = String(p.name || '').toLowerCase();
    const description = String(p.description || '').toLowerCase();
    const query = String(searchQuery || '').toLowerCase();
    
    const matchesSearch = 
      name.includes(query) ||
      description.includes(query);

    let matchesActive = true;
    if (activeFilter === 'si') matchesActive = p.active;
    else if (activeFilter === 'no') matchesActive = !p.active;

    return matchesSearch && matchesActive;
  });

  const categories = [
    'editorial', 'publicidad', 'diseño', 'corrección', 'maquetación', 'derechos de autor', 'asesoría', 'otro'
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Packs Editoriales
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Crea promociones y combinaciones de servicios del catálogo con precios especiales.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsProposalModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 dark:bg-indigo-950/20 dark:text-indigo-400 rounded-xl font-semibold text-sm transition-all cursor-pointer w-fit"
          >
            <FileText className="w-4 h-4" />
            Crear cotización desde catálogo
          </button>
          <button
            onClick={handleOpenAddModal}
            disabled={catalog.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-brand-600/20 disabled:opacity-50 cursor-pointer w-fit"
          >
            <Plus className="w-4 h-4" />
            Añadir Pack Editorial
          </button>
        </div>
      </div>

      {catalog.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 text-amber-700 dark:text-amber-300 p-4 rounded-xl text-sm">
          Debes añadir servicios en el <strong>Catálogo</strong> antes de poder estructurar un pack.
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre de pack..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Estado:</span>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="block w-full md:w-44 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
          >
            <option value="todos">Todos</option>
            <option value="si">Activos</option>
            <option value="no">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Packs Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : filteredPacks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400">
          No se encontraron packs editoriales.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPacks.map((pack) => {
            const savings = pack.autoSum - pack.price_special;
            const savingsPercent = Math.round((savings / (pack.autoSum || 1)) * 100);

            return (
              <div 
                key={pack.id} 
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 flex flex-col justify-between hover:shadow-md transition-all ${pack.active ? 'border-slate-100 dark:border-slate-800' : 'border-slate-200/50 opacity-60 dark:border-slate-900/60'}`}
              >
                <div className="space-y-4">
                  {/* Title and toggle active */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="p-2 bg-brand-500/10 text-brand-500 rounded-lg"><Package className="w-5 h-5" /></span>
                      <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100">{pack.name}</h3>
                    </div>
                    <button 
                      onClick={() => handleToggleActive(pack)}
                      className="text-slate-400 hover:text-slate-650 cursor-pointer"
                      title={pack.active ? "Desactivar pack" : "Activar pack"}
                    >
                      {pack.active ? (
                        <ToggleRight className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-slate-400" />
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{pack.description || 'Sin descripción.'}</p>

                  {/* Included services list */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Servicios Incluidos</span>
                    <div className="flex flex-wrap gap-1.5">
                      {pack.includedServices.map((s, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-350 rounded-lg border border-slate-100 dark:border-slate-850">
                          <Check className="w-3.5 h-3.5 text-brand-500" />
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Prices & CRUD Actions */}
                <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-850 flex items-center justify-between">
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Suma Original</span>
                      <span className="text-xs font-semibold text-slate-400 line-through">
                        {formatCurrency(pack.autoSum, pack.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-455 uppercase tracking-wider block">Precio Especial</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-150 text-base">
                        {formatCurrency(pack.price_special, pack.currency)}
                      </span>
                      <span className="text-[9px] text-slate-400 ml-1 font-bold">
                        {pack.includes_vat ? 'c/IVA' : 's/IVA'}
                      </span>
                    </div>
                    {savings > 0 && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-950 px-2 py-0.5 rounded-lg flex flex-col justify-center text-center">
                        <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-450 uppercase block">Ahorro</span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {savingsPercent}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenEditModal(pack)}
                      className="p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePack(pack.id)}
                      className="p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
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
                <Package className="w-5 h-5 text-brand-500" />
                {selectedPack ? 'Editar Pack Editorial' : 'Añadir Pack Editorial'}
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nombre del Pack *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    placeholder="e.g. Pack Portada + Maquetación"
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
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-705 dark:text-slate-200 text-sm focus:outline-none capitalize"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Services Checkboxes Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                    <ListChecks className="w-4 h-4 text-brand-500" />
                    Servicios Incluidos (Selecciona al menos uno) *
                  </label>
                  <div className="border border-slate-100 dark:border-slate-850 p-4 rounded-xl space-y-2.5 max-h-48 overflow-y-auto bg-slate-50/20 dark:bg-slate-950/30">
                    {catalog.filter(c => c.active || (Array.isArray(formData.selectedServiceIds) && formData.selectedServiceIds.includes(c.id))).map(service => (
                      <label key={service.id} className="flex items-start gap-3 text-xs cursor-pointer select-none text-slate-700 dark:text-slate-350">
                        <input
                          type="checkbox"
                          checked={Array.isArray(formData.selectedServiceIds) && formData.selectedServiceIds.includes(service.id)}
                          onChange={() => handleServiceCheckboxToggle(service.id)}
                          className="mt-0.5 rounded text-brand-600 focus:ring-brand-500 border-slate-350"
                        />
                        <div>
                          <span className="font-bold">{service.name}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5">({formatCurrency(service.base_price, service.currency)})</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Prices & Currency row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Auto Calculated Sum */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Suma Estándar</label>
                    <div className="px-3 py-2 border border-slate-250 dark:border-slate-850 rounded-xl bg-slate-100 dark:bg-slate-950/50 text-slate-550 text-sm font-bold">
                      {formatCurrency(getSelectedServicesPriceSum(), formData.currency)}
                    </div>
                  </div>

                  {/* Special Editable Price */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Precio Especial *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.price_special}
                      onChange={(e) => setFormData({...formData, price_special: Number(e.target.value)})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Moneda Pack</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    >
                      <option value="CLP">CLP ($)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>

                {/* VAT Toggle */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">¿Precio Especial Incluye IVA?</label>
                  <select
                    value={formData.includes_vat ? 'si' : 'no'}
                    onChange={(e) => setFormData({...formData, includes_vat: e.target.value === 'si'})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                  >
                    <option value="no">No (Exento / Sin IVA)</option>
                    <option value="si">Sí (Incluye 19% IVA)</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Descripción del Pack</label>
                  <textarea
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Detalles comercial, plazos promedio..."
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
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-350 block">Pack Activo</span>
                    <span className="text-[10px] text-slate-400 leading-normal">Los packs activos definen las ofertas predeterminadas de servicios de la editorial.</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, active: !formData.active})}
                    className="text-slate-400 hover:text-slate-650 cursor-pointer"
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

      <QuickQuoteModal
        isOpen={isProposalModalOpen}
        onClose={() => setIsProposalModalOpen(false)}
        onSuccess={() => {
          alert('¡Propuesta comercial guardada con éxito!');
        }}
      />
    </div>
  );
}
