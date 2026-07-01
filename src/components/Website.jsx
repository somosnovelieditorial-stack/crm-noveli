import React, { useState } from 'react';
import { 
  Globe, ArrowUpRight, ShieldCheck, Cpu, Layout, Server, ExternalLink, 
  Activity, ArrowLeft, Plus, Check, Eye, EyeOff, Edit, Trash2, Link, 
  BookOpen, Heart, ShoppingBag, ToggleLeft, ToggleRight
} from 'lucide-react';

const WEBSITE_URL = "https://www.somosnovelieditorial.com/";

// Mock Data representing state
const INITIAL_SERVICES = [
  { id: 'ws-1', name: 'Corrección de Estilo', category: 'Editorial', price: '$2,500 CLP / pág', visible: true },
  { id: 'ws-2', name: 'Diseño de Portada Premium', category: 'Diseño', price: '$150,000 CLP', visible: true },
  { id: 'ws-3', name: 'Maquetación Digital (ePub/Mobi)', category: 'Digitalización', price: '$80,000 CLP', visible: true },
  { id: 'ws-4', name: 'Impresión Bajo Demanda', category: 'Producción', price: 'Cotización personalizada', visible: false },
  { id: 'ws-5', name: 'Distribución Global en Tiendas', category: 'Marketing', price: '$50,000 CLP', visible: true },
];

const INITIAL_BOOKS = [
  { id: 'wb-1', title: 'El Eco de los Sauces', author: 'Clara Del Monte', genre: 'Novela Histórica', badge: 'Destacado', visible: true, links: { amazon: 'https://amazon.com', buscalibre: 'https://buscalibre.com', wattpad: '', website: 'https://somosnovelieditorial.com' } },
  { id: 'wb-2', title: 'Cenizas de Neón', author: 'Julio Rivera', genre: 'Ciencia Ficción', badge: 'Novedad', visible: true, links: { amazon: 'https://amazon.com', buscalibre: '', wattpad: 'https://wattpad.com', website: '' } },
  { id: 'wb-3', title: 'Bajo la Sombra del Alerce', author: 'Marta Valdivia', genre: 'Poesía', badge: 'Preventa', visible: false, links: { amazon: '', buscalibre: '', wattpad: '', website: '' } },
];

export default function Website() {
  const [currentPath, setCurrentPath] = useState('dashboard'); // 'dashboard', 'servicios', 'libros'
  const [services, setServices] = useState(INITIAL_SERVICES);
  const [books, setBooks] = useState(INITIAL_BOOKS);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceCat, setNewServiceCat] = useState('Editorial');
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookGenre, setNewBookGenre] = useState('');
  const [newBookBadge, setNewBookBadge] = useState('Novedad');

  // Service toggle visibility
  const toggleServiceVisibility = (id) => {
    setServices(services.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
  };

  // Add mock service
  const handleAddService = (e) => {
    e.preventDefault();
    if (!newServiceName) return;
    const newService = {
      id: `ws-${Date.now()}`,
      name: newServiceName,
      category: newServiceCat,
      price: newServicePrice || 'Cotización',
      visible: true
    };
    setServices([...services, newService]);
    setNewServiceName('');
    setNewServicePrice('');
  };

  // Delete service
  const handleDeleteService = (id) => {
    setServices(services.filter(s => s.id !== id));
  };

  // Book toggle visibility
  const toggleBookVisibility = (id) => {
    setBooks(books.map(b => b.id === id ? { ...b, visible: !b.visible } : b));
  };

  // Add mock book
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

  // Delete book
  const handleDeleteBook = (id) => {
    setBooks(books.filter(b => b.id !== id));
  };

  // Update book link
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
                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 p-2 rounded-lg border border-slate-100 dark:border-slate-850 truncate">
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
                  <span>{services.length} servicios definidos ({services.filter(s => s.visible).length} visibles)</span>
                </div>
              </div>
              <button
                onClick={() => setCurrentPath('servicios')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
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
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
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
                <h2 className="text-2xl font-bold text-slate-850 dark:text-slate-100">Servicios Editoriales en Web</h2>
                <p className="text-xs text-slate-400 mt-0.5">Controla la oferta que ven los autores en la página principal.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* List Table */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Servicios Registrados</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                      <th className="py-2.5">Nombre</th>
                      <th className="py-2.5">Categoría</th>
                      <th className="py-2.5">Precio Público</th>
                      <th className="py-2.5 text-center">Visibilidad</th>
                      <th className="py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
                    {services.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                        <td className="py-3 font-bold text-slate-700 dark:text-slate-200">{s.name}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 rounded font-semibold text-[10px]">
                            {s.category}
                          </span>
                        </td>
                        <td className="py-3 font-mono font-bold text-slate-600 dark:text-slate-300">{s.price}</td>
                        <td className="py-3 text-center">
                          <button 
                            type="button"
                            onClick={() => toggleServiceVisibility(s.id)}
                            className="text-slate-500 hover:text-amber-500 cursor-pointer focus:outline-none inline-flex items-center border border-transparent bg-transparent"
                          >
                            {s.visible ? (
                              <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-650 bg-emerald-50 dark:text-emerald-450 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                                <Eye className="w-3.5 h-3.5" /> Visible
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-extrabold text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-950/10 px-2 py-0.5 rounded">
                                <EyeOff className="w-3.5 h-3.5" /> Borrador
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-3 text-right space-x-1.5">
                          <button 
                            type="button"
                            onClick={() => handleDeleteService(s.id)}
                            className="p-1 hover:bg-rose-50 hover:text-rose-655 dark:hover:bg-rose-950/20 text-slate-400 rounded transition-all cursor-pointer inline-flex items-center border border-transparent bg-transparent"
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

            {/* Add Service form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">Agregar Nuevo Servicio</h3>
              
              <form onSubmit={handleAddService} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Nombre del Servicio</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Diseño Editorial"
                    value={newServiceName}
                    onChange={e => setNewServiceName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Categoría</label>
                  <select
                    value={newServiceCat}
                    onChange={e => setNewServiceCat(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  >
                    <option value="Editorial">Editorial</option>
                    <option value="Diseño">Diseño</option>
                    <option value="Digitalización">Digitalización</option>
                    <option value="Producción">Producción</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Precio Público o Rango</label>
                  <input
                    type="text"
                    placeholder="Ej. $100,000 CLP"
                    value={newServicePrice}
                    onChange={e => setNewServicePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publicar en Web</span>
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
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-850 rounded-xl text-slate-400 shrink-0">
                        <BookOpen className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{b.title}</h4>
                          <span className="px-2 py-0.5 bg-purple-500/10 text-purple-605 dark:text-purple-400 rounded text-[9px] font-bold">
                            {b.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Autor: {b.author} • Género: {b.genre}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
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
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
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
