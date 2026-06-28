import { useEffect, useState } from 'react';
import { supabase, isMock, getValidOrgId } from '../supabaseClient';
import { 
  Settings2, Building2, Landmark, ShieldAlert,
  Save, Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, ArrowUpDown
} from 'lucide-react';

export default function Configuration() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    id: "settings-1",
    organization_id: "11111111-1111-1111-1111-111111111111",
    editorial_name: "",
    logo: "",
    logo_url: "",
    favicon_url: "",
    email: "",
    address: "",
    base_country: "",
    currency_primary: "CLP",
    currencies_secondary: [],
    vat_rate: 19,
    bank_details: "",
    quotation_notes: "",
    quotation_legal: ""
  });

  const [stages, setStages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'success' });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  // Stage edit states
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [stageFormData, setStageFormData] = useState({
    name: '',
    description: '',
    order: 1,
    color: '#3b82f6',
    active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const uploadBrandAsset = async (file, assetType) => {
    const orgId = await getValidOrgId();
    const fileExt = file.name.split('.').pop().toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'svg', 'ico'];
    if (!allowedExts.includes(fileExt)) {
      throw new Error('Formato no permitido. Solo se aceptan: JPG, PNG, WEBP, SVG, ICO.');
    }

    const storagePath = `${orgId}/${assetType}_${Date.now()}.${fileExt}`;

    if (isMock) {
      return `mock://brand-assets/${storagePath}`;
    } else {
      const { error: uploadErr } = await supabase.storage
        .from('brand-assets')
        .upload(storagePath, file, { upsert: true });

      if (uploadErr) {
        console.error("Supabase storage upload error complete:", uploadErr);
        throw uploadErr;
      }

      const { data: publicUrlData } = supabase.storage
        .from('brand-assets')
        .getPublicUrl(storagePath);
      
      return publicUrlData?.publicUrl || '';
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    setMessage({ text: '', type: 'success' });
    try {
      const url = await uploadBrandAsset(file, 'logo');
      setSettings(prev => ({ ...prev, logo_url: url }));
      setMessage({ text: 'Logo subido temporalmente. Guarda los cambios para aplicar.', type: 'success' });
    } catch (err) {
      console.error("Error uploading logo:", err);
      alert(err.message || 'Error al subir el logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFaviconChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFavicon(true);
    setMessage({ text: '', type: 'success' });
    try {
      const url = await uploadBrandAsset(file, 'favicon');
      setSettings(prev => ({ ...prev, favicon_url: url }));
      setMessage({ text: 'Favicon subido temporalmente. Guarda los cambios para aplicar.', type: 'success' });
    } catch (err) {
      console.error("Error uploading favicon:", err);
      alert(err.message || 'Error al subir el favicon');
    } finally {
      setUploadingFavicon(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const orgId = await getValidOrgId();
      const [settingsRes, stagesRes] = await Promise.all([
        supabase.from('settings').select('*').eq('organization_id', orgId),
        supabase.from('editorial_stages').select('*').order('order', { ascending: true })
      ]);

      if (settingsRes.data && settingsRes.data.length > 0) {
        setSettings(settingsRes.data[0]);
      } else {
        setSettings(prev => ({
          ...prev,
          organization_id: orgId
        }));
      }
      setStages(stagesRes.data || []);
    } catch (err) {
      console.error("Error loading config data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ text: '', type: 'success' });
    try {
      const orgId = await getValidOrgId();
      
      const payload = {
        editorial_name: settings.editorial_name,
        logo: settings.logo || '',
        logo_url: settings.logo_url || '',
        favicon_url: settings.favicon_url || '',
        email: settings.email || '',
        address: settings.address || '',
        base_country: settings.base_country || '',
        currency_primary: settings.currency_primary || 'CLP',
        currencies_secondary: settings.currencies_secondary || [],
        vat_rate: Number(settings.vat_rate) || 19,
        bank_details: settings.bank_details || '',
        quotation_notes: settings.quotation_notes || '',
        quotation_legal: settings.quotation_legal || '',
        organization_id: orgId
      };

      if (settings.id && !settings.id.startsWith('settings-')) {
        payload.id = settings.id;
      }

      const { data, error } = await supabase
        .from('settings')
        .upsert(payload, { onConflict: 'organization_id' })
        .select()
        .single();

      if (error) {
        console.error("Supabase settings upsert error complete:", error);
        throw error;
      }

      if (data) {
        setSettings(data);
        
        if (data.editorial_name) {
          document.title = data.editorial_name;
        }
        
        const logoOrFavicon = data.favicon_url || data.logo_url;
        if (logoOrFavicon) {
          let faviconLink = document.querySelector("link[rel~='icon']");
          if (!faviconLink) {
            faviconLink = document.createElement('link');
            faviconLink.rel = 'icon';
            document.head.appendChild(faviconLink);
          }
          faviconLink.href = logoOrFavicon;
        }

        window.dispatchEvent(new CustomEvent('editorial-settings-updated', { detail: data }));
      }

      setMessage({ text: 'Configuración general guardada exitosamente.', type: 'success' });
    } catch (err) {
      console.error("Error updating settings:", err);
      setMessage({ text: `Error al guardar la configuración: ${err.message || 'Error desconocido'}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddStage = () => {
    setEditingStage(null);
    setStageFormData({
      name: '',
      description: '',
      order: stages.length + 1,
      color: '#3b82f6',
      active: true
    });
    setIsStageModalOpen(true);
  };

  const handleOpenEditStage = (stage) => {
    setEditingStage(stage);
    setStageFormData({
      name: stage.name,
      description: stage.description || '',
      order: stage.order,
      color: stage.color || '#3b82f6',
      active: stage.active
    });
    setIsStageModalOpen(true);
  };

  const handleStageSubmit = async (e) => {
    e.preventDefault();
    if (!stageFormData.name.trim()) return;

    try {
      if (editingStage) {
        // Update stage
        const { error } = await supabase
          .from('editorial_stages')
          .update(stageFormData)
          .eq('id', editingStage.id);
        if (error) throw error;
      } else {
        // Insert stage
        const { error } = await supabase
          .from('editorial_stages')
          .insert([stageFormData]);
        if (error) throw error;
      }
      setIsStageModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error saving stage:", err);
      alert("Error al guardar la etapa editorial.");
    }
  };

  const handleDeleteStage = async (id) => {
    if (window.confirm("¿Estás seguro de eliminar esta etapa del flujo de trabajo? Los servicios asociados a esta etapa podrían desconfigurar su timeline.")) {
      try {
        const { error } = await supabase
          .from('editorial_stages')
          .delete()
          .eq('id', id);
        if (error) throw error;
        fetchData();
      } catch (err) {
        console.error("Error deleting stage:", err);
      }
    }
  };

  const userRoles = [
    { name: "Administrador", desc: "Acceso total al sistema, configuraciones, monedas y logs de actividad.", color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200" },
    { name: "Editor", desc: "Edita clientes, prospectos, servicios contratados, checklist de tareas y documentos.", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200" },
    { name: "Diseñador", desc: "Gestión de tareas de portadas y maquetación, subida de portadas y entregas.", color: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400 border-pink-200" },
    { name: "Corrector", desc: "Acceso a tareas de corrección, descarga de manuscritos y subida de revisiones.", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200" },
    { name: "Contador", desc: "Gestión completa de ingresos, gastos, conciliaciones de pagos e impuestos del periodo.", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200" },
    { name: "Solo Lectura", desc: "Visualización de reportes, agendas, buscador global y tableros sin poder guardar cambios.", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350 border-slate-200" }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
          Configuración del Sistema
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Edita el perfil de la editorial, tasas, monedas activas y personaliza las etapas del flujo de trabajo editorial.
        </p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border flex items-center gap-2.5 text-sm ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900' 
            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-450 dark:border-rose-900'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'general' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-450' 
              : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          Perfil de Editorial
        </button>
        <button
          onClick={() => setActiveTab('workflow')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'workflow' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-450' 
              : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          Flujo de Trabajo (Workflow)
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'roles' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-450' 
              : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          Roles y Permisos
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'general' && (
        <form onSubmit={handleSettingsSubmit} className="space-y-6">
          {/* General editorial parameters */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-500" />
              Identidad Editorial
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nombre de la Editorial</label>
                <input
                  type="text"
                  required
                  value={settings.editorial_name}
                  onChange={(e) => setSettings({...settings, editorial_name: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Correo Oficial de Contacto</label>
                <input
                  type="email"
                  required
                  value={settings.email}
                  onChange={(e) => setSettings({...settings, email: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Dirección Física</label>
                <input
                  type="text"
                  value={settings.address}
                  onChange={(e) => setSettings({...settings, address: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">País Base</label>
                <input
                  type="text"
                  value={settings.base_country}
                  onChange={(e) => setSettings({...settings, base_country: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                />
              </div>

              {/* Logo Upload & Preview */}
              <div className="border border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-3 col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Logo de la Editorial (SVG, PNG, JPG, WEBP)</label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.svg"
                    onChange={handleLogoChange}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-slate-800 dark:file:text-slate-350"
                  />
                  {uploadingLogo && <p className="text-[10px] text-brand-500 font-bold mt-1 animate-pulse">Subiendo logo...</p>}
                  
                  {settings.logo_url && (
                    <div className="mt-2.5 p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-850 inline-block">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Vista Previa del Logo:</p>
                      <img src={settings.logo_url} alt="Logo de la Editorial" className="max-h-16 max-w-full object-contain rounded" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Favicon del Navegador (ICO, PNG, SVG)</label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.svg,.ico"
                    onChange={handleFaviconChange}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-slate-800 dark:file:text-slate-350"
                  />
                  {uploadingFavicon && <p className="text-[10px] text-brand-500 font-bold mt-1 animate-pulse">Subiendo favicon...</p>}

                  {settings.favicon_url && (
                    <div className="mt-2.5 p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-850 inline-block">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Vista Previa del Favicon:</p>
                      <img src={settings.favicon_url} alt="Favicon" className="w-8 h-8 object-contain rounded" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Currency and tributation parameters */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-brand-500" />
              Parámetros Fiscales y Monedas
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Moneda Principal</label>
                <select
                  value={settings.currency_primary}
                  onChange={(e) => setSettings({...settings, currency_primary: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                >
                  <option value="CLP">CLP ($)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Monedas Secundarias Habilitadas</label>
                <div className="flex gap-4 items-center pt-2">
                  {['USD', 'EUR', 'CLP'].filter(c => c !== settings.currency_primary).map(currency => {
                    const isChecked = settings.currencies_secondary?.includes(currency);
                    return (
                      <label key={currency} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let list = [...(settings.currencies_secondary || [])];
                            if (e.target.checked) {
                              list.push(currency);
                            } else {
                              list = list.filter(c => c !== currency);
                            }
                            setSettings({...settings, currencies_secondary: list});
                          }}
                          className="rounded text-brand-500 focus:ring-brand-500"
                        />
                        <span>{currency}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tasa del Impuesto IVA (%)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="50"
                  value={settings.vat_rate}
                  onChange={(e) => setSettings({...settings, vat_rate: Number(e.target.value)})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Datos de Transferencia Bancaria</label>
              <textarea
                rows="2"
                value={settings.bank_details}
                onChange={(e) => setSettings({...settings, bank_details: e.target.value})}
                className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                placeholder="RUT, Cta, Banco, email de confirmación"
              />
            </div>
          </div>

          {/* Quotations templates and signatures */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-brand-500" />
              Condiciones de Cotización
            </h3>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notas / Métodos de Pago Habilitados</label>
              <textarea
                rows="2"
                value={settings.quotation_notes}
                onChange={(e) => setSettings({...settings, quotation_notes: e.target.value})}
                className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                placeholder="Escribe aquí plazos de validez, abonos de entrada, etc."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Texto Legal / Firma de Pie de Cotización</label>
              <textarea
                rows="3"
                value={settings.quotation_legal}
                onChange={(e) => setSettings({...settings, quotation_legal: e.target.value})}
                className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                placeholder="Texto legal sobre derechos de autor, confidencialidad, etc."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-brand-600/20 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar Parámetros'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'workflow' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Configuración del Flujo Editorial</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  Organiza y define las etapas que todo servicio contratado seguirá de forma automática.
                </p>
              </div>
              <button
                onClick={handleOpenAddStage}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva Etapa
              </button>
            </div>

            {/* Stages Timeline table */}
            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-655 dark:text-slate-350 border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-4 py-3 text-center w-16">Orden</th>
                    <th className="px-4 py-3">Nombre Etapa</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3 w-28">Color Visual</th>
                    <th className="px-4 py-3 w-20 text-center">Estado</th>
                    <th className="px-4 py-3 text-right w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stages.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-10 text-slate-400">
                        No hay etapas editoriales activas.
                      </td>
                    </tr>
                  ) : (
                    stages.map(stage => (
                      <tr key={stage.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                        <td className="px-4 py-3 font-bold text-center text-slate-700 dark:text-slate-100">
                          {stage.order}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-855 dark:text-slate-100 capitalize">
                          {stage.name}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                          {stage.description || 'Sin descripción'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span 
                              className="w-4 h-4 rounded-full border border-white dark:border-slate-900 shadow-sm"
                              style={{ backgroundColor: stage.color }}
                            ></span>
                            <span className="font-mono text-[10px] text-slate-400">{stage.color}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            stage.active 
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900' 
                              : 'bg-slate-100 text-slate-550 dark:bg-slate-800 dark:text-slate-400 border border-transparent'
                          }`}>
                            {stage.active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEditStage(stage)}
                            className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-600 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStage(stage.id)}
                            className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-brand-500" />
              Estructura de Roles de Usuarios
            </h3>
            <p className="text-slate-455 text-xs mt-0.5">
              Control de políticas y permisos. Asigna perfiles para controlar las vistas a las que cada miembro de la editorial puede acceder.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userRoles.map((role, idx) => (
              <div 
                key={idx} 
                className="p-4 border border-slate-100 dark:border-slate-850 rounded-2xl bg-slate-50/20 dark:bg-slate-950/20 space-y-1.5 flex flex-col justify-between"
              >
                <div>
                  <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${role.color}`}>
                    {role.name}
                  </span>
                  <p className="text-xs text-slate-550 dark:text-slate-400 mt-2 font-medium">
                    {role.desc}
                  </p>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold pt-2">
                  Estado: <span className="text-emerald-500 font-bold">Listas para Control de Acceso (RBAC)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow Stage Modal */}
      {isStageModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-brand-500" />
                {editingStage ? 'Editar Etapa Editorial' : 'Nueva Etapa Editorial'}
              </h3>
              <button 
                onClick={() => setIsStageModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleStageSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nombre de la Etapa *</label>
                <input
                  type="text"
                  required
                  value={stageFormData.name}
                  onChange={(e) => setStageFormData({...stageFormData, name: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                  placeholder="ej: corrección de estilo"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Descripción de Hitos</label>
                <input
                  type="text"
                  value={stageFormData.description}
                  onChange={(e) => setStageFormData({...stageFormData, description: e.target.value})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                  placeholder="ej: Revisión de ortotipografía y estilo..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Orden Visual (Número)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={stageFormData.order}
                    onChange={(e) => setStageFormData({...stageFormData, order: Number(e.target.value)})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Color en Timeline</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={stageFormData.color}
                      onChange={(e) => setStageFormData({...stageFormData, color: e.target.value})}
                      className="w-10 h-8 p-0 border border-slate-200 rounded cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={stageFormData.color}
                      onChange={(e) => setStageFormData({...stageFormData, color: e.target.value})}
                      className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg text-slate-700 dark:text-slate-200 font-mono text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Estado</label>
                <select
                  value={stageFormData.active ? 'si' : 'no'}
                  onChange={(e) => setStageFormData({...stageFormData, active: e.target.value === 'si'})}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                >
                  <option value="si">Activa en Flujo</option>
                  <option value="no">Inactiva (Oculta)</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsStageModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-55 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  {editingStage ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
