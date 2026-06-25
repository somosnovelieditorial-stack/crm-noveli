import { useEffect, useState } from 'react';
import { supabase, isMock } from './supabaseClient';

// Original Components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import Prospects from './components/Prospects';
import Services from './components/Services';
import Incomes from './components/Incomes';
import Expenses from './components/Expenses';
import Providers from './components/Providers';
import Taxes from './components/Taxes';

// Advanced Components
import Catalog from './components/Catalog';
import Packs from './components/Packs';
import Quotations from './components/Quotations';
import QuickReplies from './components/QuickReplies';
import Documents from './components/Documents';
import Reports from './components/Reports';
import Integrations from './components/Integrations';
import CompletedSales from './components/CompletedSales';

// New Phase Components
import Agenda from './components/Agenda';
import CurrencyRates from './components/CurrencyRates';
import Configuration from './components/Configuration';

// Permission Helper
import { hasPermission, formatCurrency } from './utils';

// Icons
import { 
  BookOpen, Users, UserCheck, Library, DollarSign, 
  Briefcase, Contact, Percent, LogOut, Sun, Moon, 
  Menu, X, Sparkles, User, Tag, Package, Receipt,
  MessageSquare, FileText, BarChart3, Settings2, CheckCircle,
  Calendar, Coins, Bell, Search, AlertTriangle, Info, Clock, ShieldCheck
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Advanced States
  const [userRole, setUserRole] = useState('administrador');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    // 1. Fetch current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        setUserRole(activeUser.role || 'administrador');
      }
      setLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        setUserRole(activeUser.role || 'administrador');
      }
      setLoading(false);
    });

    // 3. Initialize theme
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }

    return () => subscription.unsubscribe();
  }, []);

  // Sync notifications whenever tab switches or user updates data
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [activeTab, user]);

  // Sync global search results
  useEffect(() => {
    setSearchResults(searchGlobal(searchQuery));
  }, [searchQuery]);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = async () => {
    if (window.confirm('¿Deseas cerrar sesión en el sistema?')) {
      await supabase.auth.signOut();
    }
  };

  const handleAuthSuccess = (authUser) => {
    setUser(authUser);
    setUserRole(authUser.role || 'administrador');
  };

  // Simulated Role Switcher
  const handleRoleChange = (newRole) => {
    setUserRole(newRole);
    const updatedUser = { ...user, role: newRole };
    setUser(updatedUser);
    localStorage.setItem('somos_noveli_crm_user', JSON.stringify(updatedUser));
    loadNotifications();
  };

  // Global Search Engine across tables
  const searchGlobal = (query) => {
    if (!query || query.trim().length < 2) return [];
    const term = query.toLowerCase().trim();
    const dbJson = localStorage.getItem('somos_noveli_crm_db');
    if (!dbJson) return [];
    
    const db = JSON.parse(dbJson);
    const results = [];
    
    // Clients
    if (db.clients) {
      db.clients.forEach(c => {
        if (c.name.toLowerCase().includes(term) || (c.email && c.email.toLowerCase().includes(term)) || (c.instagram && c.instagram.toLowerCase().includes(term))) {
          results.push({ tab: 'clients', type: 'Cliente', name: c.name, description: `${c.email || ''} • ${c.country || ''}`, id: c.id });
        }
      });
    }
    
    // Prospects
    if (db.prospects) {
      db.prospects.forEach(p => {
        if (p.name.toLowerCase().includes(term) || (p.contact && p.contact.toLowerCase().includes(term)) || (p.interest_service && p.interest_service.toLowerCase().includes(term))) {
          results.push({ tab: 'prospects', type: 'Prospecto', name: p.name, description: `Interés: ${p.interest_service || ''} • Origen: ${p.origin || ''}`, id: p.id });
        }
      });
    }
    
    // Services
    if (db.services) {
      db.services.forEach(s => {
        if (s.book_title.toLowerCase().includes(term) || s.type.toLowerCase().includes(term)) {
          results.push({ tab: 'services', type: 'Servicio Contratado', name: s.book_title, description: `Tipo: ${s.type} • Etapa: ${s.current_stage || ''}`, id: s.id });
        }
      });
    }
    
    // Quotations
    if (db.quotations) {
      db.quotations.forEach(q => {
        const clientName = q.client_id ? db.clients?.find(c => c.id === q.client_id)?.name : q.prospect_id ? db.prospects?.find(p => p.id === q.prospect_id)?.name : null;
        if ((clientName && clientName.toLowerCase().includes(term)) || q.id.toLowerCase().includes(term) || (q.notes && q.notes.toLowerCase().includes(term))) {
          results.push({ tab: 'quotations', type: 'Cotización', name: `Cotización: ${clientName || q.id}`, description: `Estado: ${q.status} • Total: ${formatCurrency(q.value_converted || 0, q.currency)}`, id: q.id });
        }
      });
    }
    
    // Incomes
    if (db.incomes) {
      db.incomes.forEach(i => {
        const clientName = i.client_id ? db.clients?.find(c => c.id === i.client_id)?.name : '';
        if ((clientName && clientName.toLowerCase().includes(term)) || (i.notes && i.notes.toLowerCase().includes(term)) || i.payment_method.toLowerCase().includes(term)) {
          results.push({ tab: 'incomes', type: 'Ingreso', name: `Ingreso: ${clientName || i.payment_method}`, description: `Monto: ${formatCurrency(i.amount, i.currency)} • ${i.notes || ''}`, id: i.id });
        }
      });
    }
    
    // Expenses
    if (db.expenses) {
      db.expenses.forEach(e => {
        if (e.category.toLowerCase().includes(term) || (e.notes && e.notes.toLowerCase().includes(term))) {
          results.push({ tab: 'expenses', type: 'Gasto', name: `Gasto: ${e.category}`, description: `Monto: ${formatCurrency(e.amount, e.currency)} • ${e.notes || ''}`, id: e.id });
        }
      });
    }
    
    // Providers
    if (db.providers) {
      db.providers.forEach(p => {
        if (p.name.toLowerCase().includes(term) || p.type.toLowerCase().includes(term) || (p.service_provided && p.service_provided.toLowerCase().includes(term))) {
          results.push({ tab: 'providers', type: 'Proveedor', name: p.name, description: `${p.type} • ${p.service_provided || ''}`, id: p.id });
        }
      });
    }
    
    // Documents
    if (db.documents) {
      db.documents.forEach(d => {
        if (d.name.toLowerCase().includes(term) || d.file_type.toLowerCase().includes(term)) {
          results.push({ tab: 'documents', type: 'Documento', name: d.name, description: `Tipo: ${d.file_type}`, id: d.id });
        }
      });
    }
    
    return results.slice(0, 10);
  };

  // Notification Alerts Analyzer
  const loadNotifications = () => {
    const dbJson = localStorage.getItem('somos_noveli_crm_db');
    if (!dbJson) return;
    const db = JSON.parse(dbJson);
    const list = [];
    const today = new Date();
    
    // 1. Servicio atrasado
    if (db.services) {
      db.services.forEach(s => {
        if (s.estimated_delivery && !['entregado', 'cerrado'].includes(s.status)) {
          const estDate = new Date(s.estimated_delivery);
          if (estDate < today) {
            const client = db.clients?.find(c => c.id === s.client_id);
            const clientName = client ? client.name : 'Cliente';
            list.push({
              id: `notif-serv-delay-${s.id}`,
              type: 'servicio_atrasado',
              title: `Servicio Atrasado: ${s.book_title}`,
              desc: `El plazo para ${clientName} venció el ${s.estimated_delivery}.`,
              tab: 'services',
              severity: 'high'
            });
          }
        }
      });
    }
    
    // 2. Servicio próximo a vencer (< 15 días)
    if (db.services) {
      db.services.forEach(s => {
        if (s.estimated_delivery && !['entregado', 'cerrado'].includes(s.status)) {
          const estDate = new Date(s.estimated_delivery);
          const diff = (estDate - today) / (1000 * 60 * 60 * 24);
          if (diff >= 0 && diff <= 15) {
            const client = db.clients?.find(c => c.id === s.client_id);
            const clientName = client ? client.name : 'Cliente';
            list.push({
              id: `notif-serv-expire-${s.id}`,
              type: 'servicio_vence',
              title: `Servicio Próximo a Vencer: ${s.book_title}`,
              desc: `Quedan ${Math.ceil(diff)} días para entregar a ${clientName}.`,
              tab: 'services',
              severity: 'medium'
            });
          }
        }
      });
    }
    
    // 3. Pago pendiente
    if (db.incomes) {
      db.incomes.forEach(i => {
        if (['pendiente', 'parcial'].includes(i.status)) {
          const client = db.clients?.find(c => c.id === i.client_id);
          const clientName = client ? client.name : 'Autor';
          list.push({
            id: `notif-inc-pending-${i.id}`,
            type: 'pago_pendiente',
            title: `Pago Pendiente: ${clientName}`,
            desc: `Monto pendiente de ${formatCurrency(i.amount, i.currency)}.`,
            tab: 'incomes',
            severity: 'medium'
          });
        }
      });
    }
    
    // 4. Contrato pendiente
    if (db.services) {
      db.services.forEach(s => {
        if (s.status === 'contrato pendiente') {
          const client = db.clients?.find(c => c.id === s.client_id);
          const clientName = client ? client.name : 'Autor';
          list.push({
            id: `notif-serv-contract-${s.id}`,
            type: 'contrato_pendiente',
            title: `Contrato Pendiente: ${s.book_title}`,
            desc: `Pendiente de firma con ${clientName}.`,
            tab: 'services',
            severity: 'medium'
          });
        }
      });
    }
    
    // 5. Seguimiento de prospecto pendiente
    if (db.prospects) {
      db.prospects.forEach(p => {
        if (p.followup_date && !p.converted_to_client_id) {
          const followDate = new Date(p.followup_date);
          const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const followNoTime = new Date(followDate.getFullYear(), followDate.getMonth(), followDate.getDate());
          
          if (followNoTime <= todayNoTime) {
            list.push({
              id: `notif-prosp-follow-${p.id}`,
              type: 'prospecto_seguimiento',
              title: `Seguimiento Pendiente: ${p.name}`,
              desc: `Revisión agendada para el ${p.followup_date}.`,
              tab: 'prospects',
              severity: 'medium'
            });
          }
        }
      });
    }
    
    // 6. Cotización vencida (> 15 días desde creación, status borrador/enviada)
    if (db.quotations) {
      db.quotations.forEach(q => {
        if (['borrador', 'enviada'].includes(q.status)) {
          const created = new Date(q.created_at);
          const diff = (today - created) / (1000 * 60 * 60 * 24);
          if (diff > 15) {
            list.push({
              id: `notif-quot-expired-${q.id}`,
              type: 'cotizacion_vencida',
              title: `Cotización Vencida: ${q.id.substring(0, 8)}...`,
              desc: `Emitida hace ${Math.floor(diff)} días sin aceptación.`,
              tab: 'quotations',
              severity: 'low'
            });
          }
        }
      });
    }
    
    // 7. Tipo de cambio no actualizado hoy
    if (db.exchange_rates) {
      const todayStr = today.toISOString().split('T')[0];
      const usdRateToday = db.exchange_rates.find(r => r.currency_from === 'USD' && r.date === todayStr);
      const eurRateToday = db.exchange_rates.find(r => r.currency_from === 'EUR' && r.date === todayStr);
      if (!usdRateToday || !eurRateToday) {
        list.push({
          id: 'notif-rate-outdated',
          type: 'tipo_cambio_desactualizado',
          title: `Tasa de Cambio Desactualizada`,
          desc: `No se han actualizado los valores de USD/EUR hoy.`,
          tab: 'currency_rates',
          severity: 'low'
        });
      }
    }
    
    setNotifications(list);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
          <span className="text-sm font-semibold text-slate-500">Cargando Somos Noveli CRM...</span>
        </div>
      </div>
    );
  }

  // Render auth view if user is not logged in
  if (!user) {
    return <Login onAuthSuccess={handleAuthSuccess} />;
  }

  // Expanded Tab definitions
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <Library className="w-4.5 h-4.5" /> },
    { id: 'agenda', label: 'Agenda Editorial', icon: <Calendar className="w-4.5 h-4.5" /> },
    { id: 'clients', label: 'Clientes', icon: <Users className="w-4.5 h-4.5" /> },
    { id: 'prospects', label: 'Prospectos', icon: <UserCheck className="w-4.5 h-4.5" /> },
    { id: 'services', label: 'Servicios Contratados', icon: <BookOpen className="w-4.5 h-4.5" /> },
    { id: 'completed_sales', label: 'Ventas Finalizadas', icon: <CheckCircle className="w-4.5 h-4.5" /> },
    { id: 'catalog', label: 'Catálogo', icon: <Tag className="w-4.5 h-4.5" /> },
    { id: 'packs', label: 'Packs Editoriales', icon: <Package className="w-4.5 h-4.5" /> },
    { id: 'quotations', label: 'Cotizaciones', icon: <Receipt className="w-4.5 h-4.5" /> },
    { id: 'incomes', label: 'Ingresos', icon: <DollarSign className="w-4.5 h-4.5" /> },
    { id: 'expenses', label: 'Gastos', icon: <Briefcase className="w-4.5 h-4.5" /> },
    { id: 'currency_rates', label: 'Monedas al día', icon: <Coins className="w-4.5 h-4.5" /> },
    { id: 'providers', label: 'Proveedores', icon: <Contact className="w-4.5 h-4.5" /> },
    { id: 'documents', label: 'Documentos', icon: <FileText className="w-4.5 h-4.5" /> },
    { id: 'replies', label: 'Respuestas Rápidas', icon: <MessageSquare className="w-4.5 h-4.5" /> },
    { id: 'taxes', label: 'Impuestos', icon: <Percent className="w-4.5 h-4.5" /> },
    { id: 'reports', label: 'Reportes', icon: <BarChart3 className="w-4.5 h-4.5" /> },
    { id: 'configuration', label: 'Configuración', icon: <Settings2 className="w-4.5 h-4.5" /> },
    { id: 'integrations', label: 'Integraciones', icon: <Settings2 className="w-4.5 h-4.5" /> }
  ];

  // Render current tab content with dynamic roles and write access checks
  const renderTabContent = () => {
    const isReadOnly = !hasPermission(userRole, activeTab);
    const commonProps = { isReadOnly, userRole };

    switch (activeTab) {
      case 'dashboard': return <Dashboard {...commonProps} />;
      case 'agenda': return <Agenda {...commonProps} />;
      case 'clients': return <Clients {...commonProps} />;
      case 'prospects': return <Prospects {...commonProps} />;
      case 'services': return <Services {...commonProps} />;
      case 'completed_sales': return <CompletedSales {...commonProps} />;
      case 'catalog': return <Catalog {...commonProps} />;
      case 'packs': return <Packs {...commonProps} />;
      case 'quotations': return <Quotations {...commonProps} />;
      case 'incomes': return <Incomes {...commonProps} />;
      case 'expenses': return <Expenses {...commonProps} />;
      case 'currency_rates': return <CurrencyRates {...commonProps} />;
      case 'providers': return <Providers {...commonProps} />;
      case 'documents': return <Documents {...commonProps} />;
      case 'replies': return <QuickReplies {...commonProps} />;
      case 'taxes': return <Taxes {...commonProps} />;
      case 'reports': return <Reports {...commonProps} />;
      case 'configuration': return <Configuration {...commonProps} />;
      case 'integrations': return <Integrations {...commonProps} />;
      default: return <Dashboard {...commonProps} />;
    }
  };

  const getActiveTabTitle = () => {
    const tab = tabs.find(t => t.id === activeTab);
    return tab ? tab.label : 'CRM Editorial';
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      
      {/* Sidebar - Desktop persistent / Mobile drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800/80 p-5 flex flex-col justify-between transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:h-screen lg:flex-shrink-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Upper menu links */}
        <div className="space-y-4 flex flex-col h-full overflow-hidden">
          {/* Logo & Branding */}
          <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-850 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-brand-500/10 text-brand-500 rounded-xl">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-855 dark:text-slate-150 font-sans tracking-tight">Somos Noveli</h2>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Editorial CRM</p>
              </div>
            </div>
            {/* Close Sidebar Mobile */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User profile with interactive simulation roles selector */}
          <div className="flex flex-col gap-2.5 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-850 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-brand-500/10 text-brand-500 rounded-full shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="font-extrabold text-[11px] text-slate-400 uppercase tracking-wider">Rol Simulado</p>
                <p className="font-semibold text-slate-400 truncate max-w-[150px]">{user.email}</p>
              </div>
            </div>
            
            <select
              value={userRole}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer text-xs transition-all shadow-sm"
            >
              <option value="administrador">Administrador</option>
              <option value="editor">Editor</option>
              <option value="diseñador">Diseñador</option>
              <option value="corrector">Corrector</option>
              <option value="contador">Contador</option>
              <option value="solo lectura">Solo Lectura</option>
            </select>
          </div>

          {/* Nav links (Scrollable area) */}
          <nav className="flex-1 overflow-y-auto pr-1 space-y-0.5 scrollbar-thin">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border
                  ${activeTab === tab.id 
                    ? 'bg-brand-50/50 border-brand-100 text-brand-600 dark:bg-brand-950/20 dark:border-brand-900/50 dark:text-brand-450' 
                    : 'border-transparent text-slate-550 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-slate-855 dark:hover:text-slate-200'}
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Lower actions */}
        <div className="space-y-2 pt-3 border-t border-slate-50 dark:border-slate-800/80 shrink-0">
          {/* Demo status alert */}
          {isMock && (
            <div className="p-2.5 bg-brand-950/30 border border-brand-500/20 rounded-xl text-[10px] text-brand-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span className="truncate">Modo Demo Local</span>
            </div>
          )}

          {/* Theme toggler */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-slate-855 dark:hover:text-slate-200 transition-all border border-transparent cursor-pointer"
          >
            <span className="flex items-center gap-3">
              {isDarkMode ? <Sun className="w-4.5 h-4.5 text-amber-500" /> : <Moon className="w-4.5 h-4.5 text-slate-500" />}
              <span>{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all border border-transparent cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Dynamic Global Top Header Bar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80 px-6 py-4 flex items-center justify-between z-30 shrink-0 shadow-xs">
          <div className="flex items-center gap-4 flex-1">
            {/* Hamburger for mobile */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Active Tab Title in desktop */}
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 hidden md:block select-none shrink-0 font-sans tracking-tight pr-4 border-r border-slate-100 dark:border-slate-800">
              {getActiveTabTitle()}
            </h1>

            {/* Global Search Box */}
            <div className="relative w-full max-w-sm">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar en el CRM..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-700 dark:text-slate-200"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Float Search Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850 p-2 animate-scale-up">
                  <div className="p-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                    Resultados de Búsqueda ({searchResults.length})
                  </div>
                  {searchResults.map((res, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setActiveTab(res.tab);
                        setSearchQuery('');
                      }}
                      className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-955 rounded-lg flex flex-col gap-0.5 transition-all text-xs cursor-pointer"
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-extrabold text-slate-800 dark:text-slate-100">{res.name}</span>
                        <span className="inline-flex px-1.5 py-0.5 bg-brand-50 text-brand-655 dark:bg-brand-950/20 dark:text-brand-400 rounded text-[9px] font-black uppercase tracking-wider">
                          {res.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">{res.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Notification Center Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`p-2 rounded-xl border text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer transition-all relative ${
                  isNotifOpen 
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' 
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-850/50 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                <Bell className="w-4.5 h-4.5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black rounded-full h-4 w-4 flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2.5 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-up">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center select-none bg-slate-50/50 dark:bg-slate-950/40">
                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-brand-500" />
                      Alertas de Control Interno
                    </span>
                    <span className="text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-955 dark:text-rose-400 px-2 py-0.5 rounded-full">
                      {notifications.length} alertas
                    </span>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                        <span>¡Al día! No se registran alertas de plazos o cobros pendientes hoy.</span>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          key={notif.id}
                          onClick={() => {
                            setActiveTab(notif.tab);
                            setIsNotifOpen(false);
                          }}
                          className="w-full text-left p-3.5 hover:bg-slate-50 dark:hover:bg-slate-955 flex items-start gap-3 transition-all text-xs cursor-pointer"
                        >
                          <span className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                            notif.severity === 'high' 
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' 
                              : notif.severity === 'medium'
                                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' 
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-850 dark:text-slate-400'
                          }`}>
                            {notif.severity === 'high' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          </span>
                          <div className="space-y-0.5">
                            <p className="font-extrabold text-slate-800 dark:text-slate-100">{notif.title}</p>
                            <p className="text-[10px] text-slate-400 leading-normal font-semibold">{notif.desc}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Read-Only Status Banner indicator in header if active role is read-only */}
            {!hasPermission(userRole, activeTab) && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900 shadow-xs select-none uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5" />
                Vista de lectura
              </span>
            )}
          </div>
        </header>

        {/* Dynamic View Scroll Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="max-w-6xl mx-auto">
            {/* Global read-only header warning banner */}
            {!hasPermission(userRole, activeTab) && (
              <div className="mb-6 p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2.5 shadow-xs select-none">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-500" />
                <span>
                  <strong>Modo Solo Lectura:</strong> Tu rol de <strong>{userRole}</strong> no tiene permisos de edición en el módulo de <strong>{getActiveTabTitle()}</strong>. Todos los botones de guardado e inserción han sido desactivados.
                </span>
              </div>
            )}

            {renderTabContent()}
          </div>
        </main>
      </div>

      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 lg:hidden"
        ></div>
      )}

    </div>
  );
}
