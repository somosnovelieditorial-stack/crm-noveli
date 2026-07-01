import React, { useState, useEffect } from 'react';
import { supabase, isMock } from '../supabaseClient';
import { 
  Globe, ArrowUpRight, ShieldCheck, Cpu, Layout, Server, ExternalLink, 
  Activity, ArrowLeft, Plus, Check, Eye, EyeOff, Edit, Trash2, Link, 
  BookOpen, Heart, ShoppingBag, ArrowUp, ArrowDown, Star, AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '../utils';

const WEBSITE_URL = "https://www.somosnovelieditorial.com/";

// Default recommended web services
const DEFAULT_WEB_SERVICES = [
  { id: 'ws-1', title: 'Full eBook', category: 'Digitalización', price_from: 80000, short_description: 'Publicación completa de tu eBook en plataformas globales', featured: true, active: true, display_order: 1 },
  { id: 'ws-2', title: 'Full Físico', category: 'Producción', price_from: 250000, short_description: 'Edición e impresión física de tu obra literaria', featured: true, active: true, display_order: 2 },
  { id: 'ws-3', title: 'Full Total', category: 'Producción', price_from: 450000, short_description: 'El pack definitivo: eBook, libro físico, tapa blanda e ilustración', featured: true, active: true, display_order: 3 },
  { id: 'ws-4', title: 'Corrección', category: 'Editorial', price_from: 2500, short_description: 'Corrección de estilo, gramática y ortografía profesional', featured: false, active: true, display_order: 4 },
  { id: 'ws-5', title: 'Portada', category: 'Diseño', price_from: 120000, short_description: 'Diseño de portada personalizado y adaptado al género', featured: false, active: true, display_order: 5 },
  { id: 'ws-6', title: 'Maquetación', category: 'Editorial', price_from: 90000, short_description: 'Maquetación interior profesional para impresión y digital', featured: false, active: true, display_order: 6 },
  { id: 'ws-7', title: 'Difusión Editorial', category: 'Marketing', price_from: 150000, short_description: 'Campañas de marketing, notas de prensa y difusión', featured: false, active: true, display_order: 7 },
  { id: 'ws-8', title: 'Registro de Derechos de Autor', category: 'Legal', price_from: 50000, short_description: 'Gestión legal de registro de propiedad intelectual', featured: false, active: true, display_order: 8 }
];

const INITIAL_BOOKS = [
  { id: 'wb-1', title: 'El Eco de los Sauces', author: 'Clara Del Monte', genre: 'Novela Histórica', badge: 'Destacado', visible: true, links: { amazon: 'https://amazon.com', buscalibre: 'https://buscalibre.com', wattpad: '', website: 'https://somosnovelieditorial.com' } },
  { id: 'wb-2', title: 'Cenizas de Neón', author: 'Julio Rivera', genre: 'Ciencia Ficción', badge: 'Novedad', visible: true, links: { amazon: 'https://amazon.com', buscalibre: '', wattpad: 'https://wattpad.com', website: '' } },
  { id: 'wb-3', title: 'Bajo la Sombra del Alerce', author: 'Marta Valdivia', genre: 'Poesía', badge: 'Preventa', visible: false, links: { amazon: '', buscalibre: '', wattpad: '', website: '' } },
];

export default function Website({ isReadOnly }) {
  const [currentPath, setCurrentPath] = useState('dashboard'); // 'dashboard', 'servicios', 'libros'
  const [services, setServices] = useState([]);
  const [books, setBooks] = useState(INITIAL_BOOKS);
  const [loading, setLoading] = useState(false);
  const [usingMockDb, setUsingMockDb] = useState(false);

  // Form states
  const [editingService, setEditingService] = useState(null);
  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceShortDesc, setServiceShortDesc] = useState('');
  const [serviceFullDesc, setServiceFullDesc] = useState('');
  const [servicePrice, setServicePrice] = useState('0');
  const [serviceCategory, setServiceCategory] = useState('Editorial');
  const [serviceFeatured, setServiceFeatured] = useState(false);

  // Book Form states
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookGenre, setNewBookGenre] = useState('');
  const [newBookBadge, setNewBookBadge] = useState('Novedad');

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      if (isMock) {
        loadMockServices();
        return;
      }

      const { data, error } = await supabase
        .from('website_services')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn("Table website_services query failed, falling back to local memory storage:", error.message);
        loadMockServices();
        setUsingMockDb(true);
      } else {
        if (data && data.length > 0) {
          setServices(data);
        } else {
          // If table is completely empty, insert defaults
          await seedDefaultServices();
        }
        setUsingMockDb(false);
      }
    } catch (err) {
      console.error("Exception loading website services:", err);
      loadMockServices();
      setUsingMockDb(true);
    } finally {
      setLoading(false);
    }
  };

  const loadMockServices = () => {
    const saved = localStorage.getItem('somos_noveli_website_services');
    if (saved) {
      try {
        setServices(JSON.parse(saved));
      } catch (_) {
        setServices(DEFAULT_WEB_SERVICES);
        localStorage.setItem('somos_noveli_website_services', JSON.stringify(DEFAULT_WEB_SERVICES));
      }
    } else {
      setServices(DEFAULT_WEB_SERVICES);
      localStorage.setItem('somos_noveli_website_services', JSON.stringify(DEFAULT_WEB_SERVICES));
    }
  };

  const seedDefaultServices = async () => {
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const servicesToInsert = DEFAULT_WEB_SERVICES.map(s => ({
        title: s.title,
        category: s.category,
        price_from: s.price_from,
        short_description: s.short_description,
        featured: s.featured,
        active: s.active,
        display_order: s.display_order,
        organization_id: orgId
      }));

      const { data, error } = await supabase
        .from('website_services')
        .insert(servicesToInsert)
        .select();

      if (!error && data) {
        setServices(data);
      } else {
        setServices(DEFAULT_WEB_SERVICES);
      }
    } catch (_) {
      setServices(DEFAULT_WEB_SERVICES);
    }
  };

  // Service Save (Create / Update)
  const handleSaveService = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!serviceTitle.trim()) return;

    setLoading(true);
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const parsedPrice = parseFloat(servicePrice) || 0;

      if (editingService) {
        // Update Mode
        if (isMock || usingMockDb) {
          const updated = services.map(s => s.id === editingService.id ? {
            ...s,
            title: serviceTitle,
            short_description: serviceShortDesc,
            full_description: serviceFullDesc,
            price_from: parsedPrice,
            category: serviceCategory,
            featured: serviceFeatured
          } : s);
          setServices(updated);
          localStorage.setItem('somos_noveli_website_services', JSON.stringify(updated));
        } else {
          const { error } = await supabase
            .from('website_services')
            .update({
              title: serviceTitle,
              short_description: serviceShortDesc,
              full_description: serviceFullDesc,
              price_from: parsedPrice,
              category: serviceCategory,
              featured: serviceFeatured
            })
            .eq('id', editingService.id);
          if (error) throw error;
        }
        alert("Servicio actualizado correctamente.");
      } else {
        // Create Mode
        const newOrder = services.length > 0 ? Math.max(...services.map(s => s.display_order || 0)) + 1 : 1;
        const payload = {
          title: serviceTitle,
          short_description: serviceShortDesc,
          full_description: serviceFullDesc,
          price_from: parsedPrice,
          currency: 'CLP',
          category: serviceCategory,
          featured: serviceFeatured,
          active: true,
          display_order: newOrder,
          organization_id: orgId
        };

        if (isMock || usingMockDb) {
          const newS = { ...payload, id: `ws-${Date.now()}` };
          const updated = [...services, newS];
          setServices(updated);
          localStorage.setItem('somos_noveli_website_services', JSON.stringify(updated));
        } else {
          const { error } = await supabase
            .from('website_services')
            .insert([payload]);
          if (error) throw error;
        }
        alert("Servicio creado y publicado correctamente.");
      }

      resetForm();
      await fetchServices();
    } catch (err) {
      console.error("Error saving website service:", err);
      alert(`Error al guardar: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingService(null);
    setServiceTitle('');
    setServiceShortDesc('');
    setServiceFullDesc('');
    setServicePrice('0');
    setServiceCategory('Editorial');
    setServiceFeatured(false);
  };

  const startEditService = (service) => {
    setEditingService(service);
    setServiceTitle(service.title || '');
    setServiceShortDesc(service.short_description || '');
    setServiceFullDesc(service.full_description || '');
    setServicePrice(String(service.price_from || '0'));
    setServiceCategory(service.category || 'Editorial');
    setServiceFeatured(!!service.featured);
  };

  // Toggle ToggleActive
  const handleToggleActive = async (service) => {
    if (isReadOnly) return;
    const updatedStatus = !service.active;

    try {
      if (isMock || usingMockDb) {
        const updated = services.map(s => s.id === service.id ? { ...s, active: updatedStatus } : s);
        setServices(updated);
        localStorage.setItem('somos_noveli_website_services', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('website_services')
          .update({ active: updatedStatus })
          .eq('id', service.id);
        if (error) throw error;
      }
      setServices(services.map(s => s.id === service.id ? { ...s, active: updatedStatus } : s));
    } catch (err) {
      console.error("Error toggling active state:", err);
    }
  };

  // Toggle Featured
  const handleToggleFeatured = async (service) => {
    if (isReadOnly) return;
    const updatedStatus = !service.featured;

    try {
      if (isMock || usingMockDb) {
        const updated = services.map(s => s.id === service.id ? { ...s, featured: updatedStatus } : s);
        setServices(updated);
        localStorage.setItem('somos_noveli_website_services', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('website_services')
          .update({ featured: updatedStatus })
          .eq('id', service.id);
        if (error) throw error;
      }
      setServices(services.map(s => s.id === service.id ? { ...s, featured: updatedStatus } : s));
    } catch (err) {
      console.error("Error toggling featured state:", err);
    }
  };

  // Delete Service
  const handleDeleteService = async (id) => {
    if (isReadOnly) return;
    if (!window.confirm("¿Estás seguro de que deseas eliminar este servicio de la web?")) return;

    try {
      if (isMock || usingMockDb) {
        const updated = services.filter(s => s.id !== id);
        setServices(updated);
        localStorage.setItem('somos_noveli_website_services', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('website_services')
          .delete()
          .eq('id', id);
        if (error) throw error;
      }
      setServices(services.filter(s => s.id !== id));
      if (editingService?.id === id) resetForm();
    } catch (err) {
      console.error("Error deleting service:", err);
    }
  };

  // Reorder Services
  const moveOrder = async (index, direction) => {
    if (isReadOnly) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= services.length) return;

    const list = [...services];
    // Swap items
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    // Update display_order fields
    const updatedList = list.map((item, idx) => ({
      ...item,
      display_order: idx + 1
    }));

    setServices(updatedList);

    try {
      if (isMock || usingMockDb) {
        localStorage.setItem('somos_noveli_website_services', JSON.stringify(updatedList));
      } else {
        // Save swaps to database
        const updates = updatedList.map(item => supabase
          .from('website_services')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
        );
        await Promise.all(updates);
      }
    } catch (err) {
      console.error("Error saving display order:", err);
    }
  };

  // Book CRUD states
  const toggleBookVisibility = (id) => {
    setBooks(books.map(b => b.id === id ? { ...b, visible: !b.visible } : b));
  };

  const handleAddBook = (e) => {
    e.preventDefault();
    if (!newBookTitle || !newBookAuthor) return;
    const newBook = {
      id: `wb-${Date.now()}`,
      title: newBookTitle,
      author: newBookAuthor,
      genre: newBookGenre || 'Novela',
      badge: newBookBadge,
      visible: true,
      links: { amazon: '', buscalibre: '', wattpad: '', website: '' }
    };
    setBooks([...books, newBook]);
    setNewBookTitle('');
    setNewBookAuthor('');
    setNewBookGenre('');
  };

  const handleDeleteBook = (id) => {
    setBooks(books.filter(b => b.id !== id));
  };

  const handleUpdateLink = (bookId, linkKey, value) => {
    setBooks(books.map(b => {
      if (b.id === bookId) {
        return {
          ...b,
          links: {
            ...b.links,
            [linkKey]: value
          }
        };
      }
      return b;
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 text-slate-800 dark:text-slate-100">
      
      {/* ------------------ BREADCRUMBS & NAVIGATION ------------------ */}
      <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400">
        <span 
          onClick={() => setCurrentPath('dashboard')} 
          className={`hover:text-amber-500 cursor-pointer transition-colors ${currentPath === 'dashboard' ? 'text-amber-600 font-bold' : ''}`}
        >
          Sitio Web
        </span>
        {currentPath !== 'dashboard' && (
          <>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-200 capitalize font-bold">
              {currentPath === 'servicios' ? 'Servicios Editoriales' : 'Libros Destacados'}
            </span>
          </>
        )}
      </div>

      {/* Warning Badge for SQL / Mock Mode */}
      {usingMockDb && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Modo Respaldo Local:</strong> La tabla <code>website_services</code> no existe o no está migrada en Supabase. Se han cargado datos simulados locales. Ejecuta el archivo <code>supabase_migration_20.sql</code> para habilitar persistencia real.
          </span>
        </div>
      )}

      {/* ------------------ MAIN VIEW: DASHBOARD ------------------ */}
      {currentPath === 'dashboard' && (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-855 dark:text-slate-100 tracking-tight">
                Sitio Web Noveli
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Configura y administra los contenidos del catálogo y servicios que se muestran al público.
              </p>
            </div>
            
            <a
              href={WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer w-fit shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Abrir sitio web</span>
            </a>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. Sitio Público */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl w-fit">
                  <Layout className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Sitio Público</h3>
                <p className="text-xs text-slate-450 dark:text-slate-400 leading-relaxed">
                  Visualiza el sitio público de la editorial. El dominio está configurado correctamente.
                </p>
                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 p-2 rounded-lg border border-slate-100 dark:border-slate-855 truncate">
                  {WEBSITE_URL}
                </div>
              </div>
              <a
                href={WEBSITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-slate-50 dark:bg-slate-950/20 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition-all"
              >
                <span>Visitar sitio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* 2. Servicios Editoriales */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 rounded-xl w-fit">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Servicios Editoriales</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Administra las ofertas, descripciones y precios de los servicios editoriales mostrados en la web pública.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  <span>{services.length} servicios definidos ({services.filter(s => s.active).length} activos)</span>
                </div>
              </div>
              <button
                onClick={() => setCurrentPath('servicios')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Gestionar servicios web</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3. Libros Destacados */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-xl w-fit">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Libros Destacados</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Selecciona y destaca las obras publicadas para la sección principal de catálogo digital de la web.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                  <span>{books.length} libros cargados ({books.filter(b => b.visible).length} visibles)</span>
                </div>
              </div>
              <button
                onClick={() => setCurrentPath('libros')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Gestionar libros</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4. Enlaces de Venta */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 col-span-1 md:col-span-2 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455 rounded-xl">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Enlaces de Venta Externos</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configura y redirige a los lectores a marketplaces externos donde se comercializan los libros del catálogo de Noveli.
                </p>
                <div className="flex flex-wrap gap-2 pt-1.5">
                  {['Amazon', 'Buscalibre', 'Wattpad', 'Página de Autor', 'Google Books'].map(linkName => (
                    <span 
                      key={linkName} 
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-855 rounded-lg text-[10px] font-semibold text-slate-600 dark:text-slate-350"
                    >
                      {linkName}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setCurrentPath('libros')}
                className="flex items-center justify-center space-x-1.5 w-fit px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/85 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-800 cursor-pointer self-start"
              >
                <span>Administrar enlaces en Libros</span>
              </button>
            </div>

            {/* 5. Estado del Sitio */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-855 dark:text-slate-100 flex items-center gap-2">
                <Activity className="w-4.5 h-4.5 text-emerald-500" />
                Estado del Sitio
              </h3>
              
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-850">
                  <span className="text-slate-400 font-medium">Dominio Conectado</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">somosnovelieditorial.com</span>
                </div>
                
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-850">
                  <span className="text-slate-400 font-medium">Hosting</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">Vercel Cloud</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-850">
                  <span className="text-slate-400 font-medium">Última actualización</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">Hoy, 12:45 PM</span>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400 font-medium">Estado del servidor</span>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 rounded text-[10px] font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    activo
                  </span>
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      {/* ------------------ SUB-VIEW: SERVICIOS ------------------ */}
      {currentPath === 'servicios' && (
        <div className="space-y-6">
          {/* Header & Back Button */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setCurrentPath('dashboard')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-850 dark:text-slate-100 font-serif">Servicios Web Públicos</h2>
                <p className="text-xs text-slate-400 mt-0.5">Define los servicios de la editorial que aparecerán en la web pública.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* List Table */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Servicios Web</h3>
                <span className="text-[10px] text-slate-400 font-medium">Usa las flechas para ordenar su aparición en la web</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                      <th className="py-2.5">Orden</th>
                      <th className="py-2.5">Título</th>
                      <th className="py-2.5">Categoría</th>
                      <th className="py-2.5">Precio Desde</th>
                      <th className="py-2.5 text-center">Destacado</th>
                      <th className="py-2.5 text-center">Visibilidad</th>
                      <th className="py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-855">
                    {services.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 group">
                        {/* Display Order controls */}
                        <td className="py-3">
                          <div className="flex items-center space-x-1">
                            <span className="font-bold text-slate-400 dark:text-slate-600 w-4">{s.display_order || idx + 1}</span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={idx === 0 || isReadOnly}
                                onClick={() => moveOrder(idx, -1)}
                                className="text-slate-350 dark:text-slate-700 hover:text-amber-500 disabled:opacity-30 cursor-pointer border border-transparent bg-transparent p-0"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === services.length - 1 || isReadOnly}
                                onClick={() => moveOrder(idx, 1)}
                                className="text-slate-350 dark:text-slate-700 hover:text-amber-500 disabled:opacity-30 cursor-pointer border border-transparent bg-transparent p-0"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <div>
                            <span className="font-bold text-slate-750 dark:text-slate-200">{s.title}</span>
                            {s.short_description && (
                              <p className="text-[10px] text-slate-400 line-clamp-1 max-w-[200px] mt-0.5">{s.short_description}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 rounded font-bold text-[9px] uppercase tracking-wider">
                            {s.category}
                          </span>
                        </td>
                        <td className="py-3 font-mono font-bold text-slate-600 dark:text-slate-300">
                          {formatCurrency(s.price_from, s.currency || 'CLP')}
                        </td>
                        {/* Featured (Star) */}
                        <td className="py-3 text-center">
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => handleToggleFeatured(s)}
                            className="focus:outline-none border border-transparent bg-transparent cursor-pointer"
                          >
                            <Star className={`w-4 h-4 ${s.featured ? 'text-amber-500 fill-amber-500' : 'text-slate-350 dark:text-slate-700'}`} />
                          </button>
                        </td>
                        {/* Visibilidad / Active */}
                        <td className="py-3 text-center">
                          <button 
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => handleToggleActive(s)}
                            className="text-slate-500 hover:text-amber-500 cursor-pointer focus:outline-none inline-flex items-center border border-transparent bg-transparent"
                          >
                            {s.active ? (
                              <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-650 bg-emerald-50 dark:text-emerald-450 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                                <Eye className="w-3.5 h-3.5" /> Activo
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-extrabold text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-950/10 px-2 py-0.5 rounded">
                                <EyeOff className="w-3.5 h-3.5" /> Inactivo
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-3 text-right space-x-1">
                          <button 
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => startEditService(s)}
                            className="p-1 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-slate-400 hover:text-amber-600 rounded transition-all cursor-pointer border border-transparent bg-transparent inline-flex items-center"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          
                          <button 
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => handleDeleteService(s.id)}
                            className="p-1 hover:bg-rose-50 hover:text-rose-655 dark:hover:bg-rose-950/20 text-slate-400 rounded transition-all cursor-pointer border border-transparent bg-transparent inline-flex items-center"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create or Edit Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">
                  {editingService ? 'Editar Servicio Web' : 'Agregar Servicio Web'}
                </h3>
                {editingService && (
                  <button 
                    onClick={resetForm}
                    className="text-[10px] font-bold text-amber-600 hover:underline border border-transparent bg-transparent cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              
              <form onSubmit={handleSaveService} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Título del Servicio</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Portada Ilustrada"
                    value={serviceTitle}
                    onChange={e => setServiceTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Categoría</label>
                  <select
                    value={serviceCategory}
                    onChange={e => setServiceCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  >
                    <option value="Editorial">Editorial</option>
                    <option value="Diseño">Diseño</option>
                    <option value="Digitalización">Digitalización</option>
                    <option value="Producción">Producción</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Precio Desde (CLP)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ej. 120000"
                    value={servicePrice}
                    onChange={e => setServicePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Descripción Corta</label>
                  <textarea
                    placeholder="Descripción resumida para cards o listados..."
                    value={serviceShortDesc}
                    onChange={e => setServiceShortDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Descripción Completa (Opcional)</label>
                  <textarea
                    placeholder="Detalles del servicio, condiciones de entrega..."
                    value={serviceFullDesc}
                    onChange={e => setServiceFullDesc(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center space-x-2 py-1.5">
                  <input
                    type="checkbox"
                    id="serviceFeatured"
                    checked={serviceFeatured}
                    onChange={e => setServiceFeatured(e.target.checked)}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 h-4 w-4"
                  />
                  <label htmlFor="serviceFeatured" className="text-slate-655 dark:text-slate-350 font-bold cursor-pointer select-none">
                    Destacar en la página de inicio
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isReadOnly}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-1.5 border border-transparent"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingService ? 'Actualizar Servicio' : 'Publicar Servicio'}</span>
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* ------------------ SUB-VIEW: LIBROS ------------------ */}
      {currentPath === 'libros' && (
        <div className="space-y-6">
          {/* Header & Back Button */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setCurrentPath('dashboard')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-855 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100">Libros Destacados en la Web</h2>
                <p className="text-xs text-slate-400 mt-0.5">Define las portadas, novedades y enlaces de venta para los lectores.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* List & Links Editor */}
            <div className="lg:col-span-2 space-y-5">
              {books.map(b => (
                <div 
                  key={b.id} 
                  className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-5 shadow-2xs space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-855 rounded-xl text-slate-400 shrink-0">
                        <BookOpen className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{b.title}</h4>
                          <span className="px-2 py-0.5 bg-purple-550/10 text-purple-650 dark:text-purple-400 rounded text-[9px] font-bold">
                            {b.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Autor: {b.author} • Género: {b.genre}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => toggleBookVisibility(b.id)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all cursor-pointer border border-transparent bg-transparent"
                        title={b.visible ? 'Ocultar de la Web' : 'Mostrar en la Web'}
                      >
                        {b.visible ? (
                          <Eye className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => handleDeleteBook(b.id)}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-550 text-slate-400 rounded transition-all cursor-pointer border border-transparent bg-transparent"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Links Manager Block */}
                  <div className="pt-3 border-t border-slate-50 dark:border-slate-850 space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Enlaces de Compra</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      {/* Amazon */}
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-lg">
                        <span className="font-bold text-slate-400 w-16">Amazon:</span>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          placeholder="Sin enlace"
                          value={b.links.amazon}
                          onChange={e => handleUpdateLink(b.id, 'amazon', e.target.value)}
                          className="bg-transparent border-none focus:outline-none w-full text-slate-655 dark:text-slate-300 font-mono text-[10px]"
                        />
                      </div>
                      
                      {/* Buscalibre */}
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-lg">
                        <span className="font-bold text-slate-400 w-16">Buscalibre:</span>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          placeholder="Sin enlace"
                          value={b.links.buscalibre}
                          onChange={e => handleUpdateLink(b.id, 'buscalibre', e.target.value)}
                          className="bg-transparent border-none focus:outline-none w-full text-slate-655 dark:text-slate-300 font-mono text-[10px]"
                        />
                      </div>

                      {/* Wattpad */}
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-lg">
                        <span className="font-bold text-slate-400 w-16">Wattpad:</span>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          placeholder="Sin enlace"
                          value={b.links.wattpad}
                          onChange={e => handleUpdateLink(b.id, 'wattpad', e.target.value)}
                          className="bg-transparent border-none focus:outline-none w-full text-slate-655 dark:text-slate-300 font-mono text-[10px]"
                        />
                      </div>

                      {/* Web Oficial */}
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-lg">
                        <span className="font-bold text-slate-400 w-16">Pág. Autor:</span>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          placeholder="Sin enlace"
                          value={b.links.website}
                          onChange={e => handleUpdateLink(b.id, 'website', e.target.value)}
                          className="bg-transparent border-none focus:outline-none w-full text-slate-655 dark:text-slate-300 font-mono text-[10px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Book Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
              <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">Destacar Nuevo Libro</h3>
              
              <form onSubmit={handleAddBook} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Título del Libro</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. El Canto del Cisne"
                    value={newBookTitle}
                    onChange={e => setNewBookTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Nombre del Autor</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Gabriel Fuentes"
                    value={newBookAuthor}
                    onChange={e => setNewBookAuthor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Género Literario</label>
                  <input
                    type="text"
                    placeholder="Ej. Poesía, Novela, Ensayo"
                    value={newBookGenre}
                    onChange={e => setNewBookGenre(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Etiqueta Destacada</label>
                  <select
                    value={newBookBadge}
                    onChange={e => setNewBookBadge(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  >
                    <option value="Destacado">Destacado</option>
                    <option value="Novedad">Novedad</option>
                    <option value="Preventa">Preventa</option>
                    <option value="Lanzamiento">Lanzamiento</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isReadOnly}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-1.5 border border-transparent"
                >
                  <Plus className="w-4 h-4" />
                  <span>Destacar en la Web</span>
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
