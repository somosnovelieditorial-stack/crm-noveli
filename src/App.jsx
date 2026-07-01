import { useEffect, useState, useRef } from 'react';
import { supabase, isMock, getValidOrgId } from './supabaseClient';

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
import Documents from './components/Documents';
import Reports from './components/Reports';
import Integrations from './components/Integrations';
import CompletedSales from './components/CompletedSales';

// New Phase Components
import CurrencyRates from './components/CurrencyRates';
import Configuration from './components/Configuration';
import Staff from './components/Staff';
import Website from './components/Website';

// Permission Helper
import { hasPermission, formatCurrency } from './utils';

// Icons
import { 
  BookOpen, Users, UserCheck, Library, DollarSign, 
  Briefcase, Contact, Percent, LogOut, Sun, Moon, 
  Menu, X, Sparkles, User, Tag, Package, Receipt,
  MessageSquare, FileText, BarChart3, Settings2, CheckCircle,
  Calendar, Coins, Bell, Search, AlertTriangle, Info, Clock, ShieldCheck,
  ChevronDown, ChevronUp, ChevronRight, Wallet, Globe
} from 'lucide-react';

const WEBSITE_URL = "https://www.somosnovelieditorial.com/";

const menuGroups = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Library className="w-4 h-4" />,
    tab: 'dashboard'
  },
  {
    id: 'notifications',
    label: 'Notificaciones',
    icon: <Bell className="w-4 h-4" />,
    tab: 'notifications'
  },
  {
    id: 'clients_prospects',
    label: 'Clientes y Prospectos',
    icon: <Users className="w-4 h-4" />,
    items: [
      { id: 'clients', label: 'Clientes', tab: 'clients' },
      { id: 'prospects', label: 'Prospectos', tab: 'prospects' },
      { id: 'seguimientos', label: 'Seguimientos', tab: 'seguimientos' }
    ]
  },
  {
    id: 'editorial_management',
    label: 'Gestión Editorial',
    icon: <BookOpen className="w-4 h-4" />,
    items: [
      { id: 'services', label: 'Servicios Contratados', tab: 'services' },
      { id: 'timeline', label: 'Etapas / Timeline', tab: 'services' },
      { id: 'completed_sales', label: 'Ventas Finalizadas', tab: 'completed_sales' },
      { id: 'documents', label: 'Documentos', tab: 'documents' }
    ]
  },
  {
    id: 'sales_quotes',
    label: 'Catálogo y Packs',
    icon: <Receipt className="w-4 h-4" />,
    items: [
      { id: 'catalog', label: 'Catálogo', tab: 'catalog' },
      { id: 'packs', label: 'Packs Editoriales', tab: 'packs' }
    ]
  },
  {
    id: 'finances',
    label: 'Finanzas',
    icon: <DollarSign className="w-4 h-4" />,
    items: [
      { id: 'incomes', label: 'Ingresos', tab: 'incomes' },
      { id: 'expenses', label: 'Gastos', tab: 'expenses' },
      { id: 'taxes', label: 'Impuestos', tab: 'taxes' },
      { id: 'currency_rates', label: 'Monedas al día', tab: 'currency_rates' },
      { id: 'staff', label: 'Personal', tab: 'staff' },
      { id: 'reserve', label: 'Reserva operacional', tab: 'reserve' }
    ]
  },
  {
    id: 'website',
    label: 'Sitio Web',
    icon: <Globe className="w-4 h-4" />,
    tab: 'website'
  },
  {
    id: 'reports',
    label: 'Reportes',
    icon: <BarChart3 className="w-4 h-4" />,
    items: [
      { id: 'reports', label: 'Reportes', tab: 'reports' }
    ]
  },
  {
    id: 'configuration',
    label: 'Configuración',
    icon: <Settings2 className="w-4 h-4" />,
    items: [
      { id: 'configuration', label: 'Configuración General', tab: 'configuration' },
      { id: 'integrations', label: 'Integraciones', tab: 'integrations' }
    ]
  }
];

function SeguimientosView({ isReadOnly }) {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowups = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('prospects')
          .select('*')
          .is('converted_to_client_id', null)
          .not('followup_date', 'is', null)
          .order('followup_date', { ascending: true });

        if (error) throw error;
        setFollowups(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFollowups();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 dark:text-slate-100">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
          Seguimiento de Prospectos
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Planificación de próximas acciones y fechas de contacto para interesados.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-205 dark:border-slate-800 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
          </div>
        ) : followups.length === 0 ? (
          <p className="text-slate-450 py-6 text-center">No hay seguimientos planificados actualmente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-450 font-bold uppercase">
                  <th className="py-3 px-4">Prospecto</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4">Servicio de Interés</th>
                  <th className="py-3 px-4">Próxima Acción</th>
                  <th className="py-3 px-4">Fecha Límite</th>
                  <th className="py-3 px-4 text-center">Probabilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                {followups.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                    <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-200">{item.name}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{item.contact || '-'}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-200 capitalize">{item.interest_service || '-'}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-350">{item.next_action || '-'}</td>
                    <td className="py-3.5 px-4 font-bold text-brand-600 dark:text-brand-400">{item.followup_date}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                        item.probability === 'alta' 
                          ? 'bg-emerald-50 text-emerald-650 dark:bg-emerald-950/30' 
                          : item.probability === 'media'
                            ? 'bg-amber-50 text-amber-650 dark:bg-amber-950/30'
                            : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.probability}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const getTabFromPath = (path) => {
  const cleanPath = path.toLowerCase().replace(/^\/|\/$/g, '');
  
  if (cleanPath === 'sitio-web/servicios') return 'website-servicios';
  if (cleanPath === 'sitio-web/libros') return 'website-libros';
  if (cleanPath === 'sitio-web/dominio') return 'website-dominio';
  if (cleanPath === 'sitio-web') return 'website';

  const mapping = {
    '': 'dashboard',
    'dashboard': 'dashboard',
    'agenda': 'agenda',
    'clientes': 'clients',
    'clients': 'clients',
    'prospectos': 'prospects',
    'prospects': 'prospects',
    'servicios': 'services',
    'services': 'services',
    'timeline': 'services',
    'completed_sales': 'completed_sales',
    'ventas_finalizadas': 'completed_sales',
    'catalogo': 'catalog',
    'catalog': 'catalog',
    'packs': 'packs',
    'incomes': 'incomes',
    'ingresos': 'incomes',
    'expenses': 'expenses',
    'gastos': 'expenses',
    'currency_rates': 'currency_rates',
    'monedas': 'currency_rates',
    'providers': 'providers',
    'proveedores': 'providers',
    'personal': 'staff',
    'staff': 'staff',
    'reserva': 'reserve',
    'reserve': 'reserve',
    'documents': 'documents',
    'documentos': 'documents',
    'taxes': 'taxes',
    'impuestos': 'taxes',
    'reports': 'reports',
    'reportes': 'reports',
    'configuration': 'configuration',
    'configuracion': 'configuration',
    'integrations': 'integrations',
    'integraciones': 'integrations',
    'notifications': 'notifications',
    'notificaciones': 'notifications',
    'seguimientos': 'seguimientos'
  };

  return mapping[cleanPath] || 'dashboard';
};

const getPathFromTab = (tab) => {
  const mapping = {
    'dashboard': '/dashboard',
    'agenda': '/agenda',
    'clients': '/clientes',
    'prospects': '/prospects',
    'services': '/services',
    'completed_sales': '/completed_sales',
    'catalog': '/catalogo',
    'packs': '/packs',
    'incomes': '/ingresos',
    'expenses': '/gastos',
    'currency_rates': '/currency_rates',
    'providers': '/proveedores',
    'staff': '/personal',
    'reserve': '/reserva',
    'documents': '/documentos',
    'taxes': '/taxes',
    'reports': '/reportes',
    'configuration': '/configuration',
    'integrations': '/integraciones',
    'notifications': '/notifications',
    'seguimientos': '/seguimientos',
    'website': '/sitio-web',
    'website-servicios': '/sitio-web/servicios',
    'website-libros': '/sitio-web/libros',
    'website-dominio': '/sitio-web/dominio'
  };

  return mapping[tab] || '/';
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => getTabFromPath(window.location.pathname));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [editorialSettings, setEditorialSettings] = useState({
    editorial_name: 'Somos Noveli',
    logo_url: '',
    favicon_url: ''
  });

  const fetchEditorialSettings = async () => {
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const { data, error } = await supabase
        .from('settings')
        .select('editorial_name, logo_url, favicon_url')
        .eq('organization_id', orgId);
        
      if (!error && data && data.length > 0) {
        const item = data[0];
        setEditorialSettings({
          editorial_name: item.editorial_name || 'Somos Noveli',
          logo_url: item.logo_url || '',
          favicon_url: item.favicon_url || ''
        });

        if (item.editorial_name) {
          document.title = item.editorial_name;
        }
        const faviconSrc = item.favicon_url || item.logo_url;
        if (faviconSrc) {
          let faviconLink = document.querySelector("link[rel~='icon']");
          if (!faviconLink) {
            faviconLink = document.createElement('link');
            faviconLink.rel = 'icon';
            document.head.appendChild(faviconLink);
          }
          faviconLink.href = faviconSrc;
        }
      }
    } catch (e) {
      console.error("Error fetching editorial settings:", e);
    }
  };

  useEffect(() => {
    fetchEditorialSettings();

    const handleSettingsUpdate = (e) => {
      if (e.detail) {
        const item = e.detail;
        setEditorialSettings({
          editorial_name: item.editorial_name || 'Somos Noveli',
          logo_url: item.logo_url || '',
          favicon_url: item.favicon_url || ''
        });
        if (item.editorial_name) {
          document.title = item.editorial_name;
        }
        const faviconSrc = item.favicon_url || item.logo_url;
        if (faviconSrc) {
          let faviconLink = document.querySelector("link[rel~='icon']");
          if (!faviconLink) {
            faviconLink = document.createElement('link');
            faviconLink.rel = 'icon';
            document.head.appendChild(faviconLink);
          }
          faviconLink.href = faviconSrc;
        }
      }
    };

    window.addEventListener('editorial-settings-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('editorial-settings-updated', handleSettingsUpdate);
    };
  }, [user]);

  // Sync activeTab to window.location.pathname on popstate (back/forward browser buttons)
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync activeTab changes to browser history URL pathname
  useEffect(() => {
    if (user) {
      const targetPath = getPathFromTab(activeTab);
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  }, [activeTab, user]);

  // Handle redirects on login / initial load
  useEffect(() => {
    if (user) {
      const currentTab = getTabFromPath(window.location.pathname);
      const targetPath = getPathFromTab(currentTab);
      const cleanPath = window.location.pathname.toLowerCase().replace(/^\/|\/$/g, '');
      if (cleanPath === '' || cleanPath === 'login') {
        window.history.replaceState(null, '', '/dashboard');
        setActiveTab('dashboard');
      } else {
        setActiveTab(currentTab);
        if (window.location.pathname !== targetPath) {
          window.history.replaceState(null, '', targetPath);
        }
      }
    }
  }, [user]);

  // Advanced States
  const [userRole, setUserRole] = useState('administrador');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const userRef = useRef(null);

  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('noveli_expanded_groups');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      localStorage.setItem('noveli_expanded_groups', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const group = menuGroups.find(g => 
      g.tab === activeTab || 
      (g.items && g.items.some(item => item.id === activeTab || item.tab === activeTab))
    );
    if (group && !expandedGroups[group.id]) {
      setExpandedGroups(prev => {
        const next = { ...prev, [group.id]: true };
        localStorage.setItem('noveli_expanded_groups', JSON.stringify(next));
        return next;
      });
    }
  }, [activeTab]);

  const fetchUserRoleAndOrg = async (activeUser) => {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('role, organization_id')
        .eq('user_id', activeUser.id);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        const membership = data[0];
        setUserRole(membership.role || 'solo lectura');
        localStorage.setItem('somos_noveli_crm_org_id', membership.organization_id || '11111111-1111-1111-1111-111111111111');
      } else {
        setUserRole('solo lectura');
        localStorage.setItem('somos_noveli_crm_org_id', '11111111-1111-1111-1111-111111111111');
      }
    } catch (err) {
      console.error("Error fetching database role:", err);
      setUserRole(activeUser.role || 'solo lectura');
      localStorage.setItem('somos_noveli_crm_org_id', '11111111-1111-1111-1111-111111111111');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadUserRoleAndOrg = async (activeUser) => {
      if (!activeUser) {
        if (active) {
          setUser(null);
          userRef.current = null;
          setUserRole('solo lectura');
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('organization_members')
          .select('role, organization_id')
          .eq('user_id', activeUser.id);
          
        if (error) throw error;
        
        if (active) {
          setUser(activeUser);
          userRef.current = activeUser;
          if (data && data.length > 0) {
            const membership = data[0];
            setUserRole(membership.role || 'solo lectura');
            localStorage.setItem('somos_noveli_crm_org_id', membership.organization_id || '11111111-1111-1111-1111-111111111111');
          } else {
            setUserRole('solo lectura');
            localStorage.setItem('somos_noveli_crm_org_id', '11111111-1111-1111-1111-111111111111');
          }
        }
      } catch (err) {
        console.error("Error fetching database role:", err);
        if (active) {
          setUser(activeUser);
          userRef.current = activeUser;
          setUserRole(activeUser.role || 'solo lectura');
          localStorage.setItem('somos_noveli_crm_org_id', '11111111-1111-1111-1111-111111111111');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    // 1. Fetch session first
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      const activeUser = session?.user ?? null;
      loadUserRoleAndOrg(activeUser);
    }).catch(err => {
      console.error("Error getting session:", err);
      if (active) {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const activeUser = session?.user ?? null;

      const prevUserId = userRef.current ? userRef.current.id : null;
      const nextUserId = activeUser ? activeUser.id : null;

      if (prevUserId !== nextUserId || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        if (prevUserId !== nextUserId) {
          setLoading(true);
          loadUserRoleAndOrg(activeUser);
        } else {
          setUser(activeUser);
          userRef.current = activeUser;
        }
      }
    });

    // 3. Initialize theme (default to light mode, ignore OS preferences unless explicitly saved)
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }

    return () => {
      active = false;
      subscription.unsubscribe();
    };
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
    userRef.current = authUser;
    setUserRole(authUser.role || 'administrador');
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
        if (!c) return;
        const name = String(c.name || '').toLowerCase();
        const email = String(c.email || '').toLowerCase();
        const instagram = String(c.instagram || '').toLowerCase();
        if (name.includes(term) || email.includes(term) || instagram.includes(term)) {
          results.push({ tab: 'clients', type: 'Cliente', name: c.name || 'Sin nombre', description: `${c.email || ''} • ${c.country || ''}`, id: c.id });
        }
      });
    }
    
    // Prospects
    if (db.prospects) {
      db.prospects.forEach(p => {
        if (!p) return;
        const name = String(p.name || '').toLowerCase();
        const contact = String(p.contact || '').toLowerCase();
        const interest = String(p.interest_service || '').toLowerCase();
        if (name.includes(term) || contact.includes(term) || interest.includes(term)) {
          results.push({ tab: 'prospects', type: 'Prospecto', name: p.name || 'Sin nombre', description: `Interés: ${p.interest_service || ''} • Origen: ${p.origin || ''}`, id: p.id });
        }
      });
    }
    
    // Services
    if (db.services) {
      db.services.forEach(s => {
        if (!s) return;
        const title = String(s.book_title || '').toLowerCase();
        const type = String(s.type || '').toLowerCase();
        if (title.includes(term) || type.includes(term)) {
          results.push({ tab: 'services', type: 'Servicio Contratado', name: s.book_title || 'Sin título', description: `Tipo: ${s.type || ''} • Etapa: ${s.current_stage || ''}`, id: s.id });
        }
      });
    }
    
    // Incomes
    if (db.incomes) {
      db.incomes.forEach(i => {
        if (!i) return;
        const clientName = i.client_id ? String(db.clients?.find(c => c.id === i.client_id)?.name || '').toLowerCase() : '';
        const notes = String(i.notes || '').toLowerCase();
        const method = String(i.payment_method || '').toLowerCase();
        if (clientName.includes(term) || notes.includes(term) || method.includes(term)) {
          results.push({ tab: 'incomes', type: 'Ingreso', name: `Ingreso: ${db.clients?.find(c => c.id === i.client_id)?.name || i.payment_method || ''}`, description: `Monto: ${formatCurrency(i.amount, i.currency)} • ${i.notes || ''}`, id: i.id });
        }
      });
    }
    
    // Expenses
    if (db.expenses) {
      db.expenses.forEach(e => {
        if (!e) return;
        const category = String(e.category || '').toLowerCase();
        const notes = String(e.notes || '').toLowerCase();
        if (category.includes(term) || notes.includes(term)) {
          results.push({ tab: 'expenses', type: 'Gasto', name: `Gasto: ${e.category || ''}`, description: `Monto: ${formatCurrency(e.amount, e.currency)} • ${e.notes || ''}`, id: e.id });
        }
      });
    }
    
    // Providers
    if (db.providers) {
      db.providers.forEach(p => {
        if (!p) return;
        const name = String(p.name || '').toLowerCase();
        const type = String(p.type || '').toLowerCase();
        const service = String(p.service_provided || '').toLowerCase();
        if (name.includes(term) || type.includes(term) || service.includes(term)) {
          results.push({ tab: 'providers', type: 'Proveedor', name: p.name || 'Sin nombre', description: `${p.type || ''} • ${p.service_provided || ''}`, id: p.id });
        }
      });
    }
    
    // Documents
    if (db.documents) {
      db.documents.forEach(d => {
        if (!d) return;
        const name = String(d.name || d.title || '').toLowerCase();
        const fileType = String(d.file_type || d.document_type || '').toLowerCase();
        if (name.includes(term) || fileType.includes(term)) {
          results.push({ tab: 'documents', type: 'Documento', name: d.name || d.title || 'Sin nombre', description: `Tipo: ${d.file_type || d.document_type || ''}`, id: d.id });
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
        if (!s) return;
        if (s.estimated_delivery && !['entregado', 'cerrado'].includes(String(s.status || '').toLowerCase())) {
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
        if (!s) return;
        if (s.estimated_delivery && !['entregado', 'cerrado'].includes(String(s.status || '').toLowerCase())) {
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
        if (!i) return;
        if (['pendiente', 'parcial'].includes(String(i.status || '').toLowerCase())) {
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
    { id: 'clients', label: 'Clientes', icon: <Users className="w-4.5 h-4.5" /> },
    { id: 'prospects', label: 'Prospectos', icon: <UserCheck className="w-4.5 h-4.5" /> },
    { id: 'services', label: 'Servicios Contratados', icon: <BookOpen className="w-4.5 h-4.5" /> },
    { id: 'completed_sales', label: 'Ventas Finalizadas', icon: <CheckCircle className="w-4.5 h-4.5" /> },
    { id: 'catalog', label: 'Catálogo', icon: <Tag className="w-4.5 h-4.5" /> },
    { id: 'packs', label: 'Packs Editoriales', icon: <Package className="w-4.5 h-4.5" /> },
    { id: 'incomes', label: 'Ingresos', icon: <DollarSign className="w-4.5 h-4.5" /> },
    { id: 'expenses', label: 'Gastos', icon: <Briefcase className="w-4.5 h-4.5" /> },
    { id: 'currency_rates', label: 'Monedas al día', icon: <Coins className="w-4.5 h-4.5" /> },
    { id: 'providers', label: 'Proveedores', icon: <Contact className="w-4.5 h-4.5" /> },
    { id: 'documents', label: 'Documentos', icon: <FileText className="w-4.5 h-4.5" /> },
    { id: 'taxes', label: 'Impuestos', icon: <Percent className="w-4.5 h-4.5" /> },
    { id: 'reports', label: 'Reportes', icon: <BarChart3 className="w-4.5 h-4.5" /> },
    { id: 'configuration', label: 'Configuración', icon: <Settings2 className="w-4.5 h-4.5" /> },
    { id: 'integrations', label: 'Integraciones', icon: <Settings2 className="w-4.5 h-4.5" /> },
    { id: 'staff', label: 'Personal', icon: <Users className="w-4.5 h-4.5" /> },
    { id: 'reserve', label: 'Reserva operacional', icon: <Wallet className="w-4.5 h-4.5" /> },
    { id: 'website', label: 'Sitio Web', icon: <Globe className="w-4.5 h-4.5" /> },
    { id: 'website-servicios', label: 'Servicios Web', icon: <Globe className="w-4.5 h-4.5" /> },
    { id: 'website-libros', label: 'Libros Web', icon: <Globe className="w-4.5 h-4.5" /> },
    { id: 'website-dominio', label: 'Dominio Web', icon: <Globe className="w-4.5 h-4.5" /> }
  ];

  const handleWebsitePathChange = (path) => {
    if (path === 'dashboard') setActiveTab('website');
    else if (path === 'servicios') setActiveTab('website-servicios');
    else if (path === 'libros') setActiveTab('website-libros');
    else if (path === 'dominio') setActiveTab('website-dominio');
  };

  // Render current tab content with dynamic roles and write access checks
  const renderTabContent = () => {
    const isReadOnly = !hasPermission(userRole, activeTab);
    const commonProps = { isReadOnly, userRole };

    switch (activeTab) {
      case 'dashboard': return <Dashboard {...commonProps} />;
      case 'clients': return <Clients {...commonProps} />;
      case 'prospects': return <Prospects {...commonProps} />;
      case 'services': return <Services {...commonProps} />;
      case 'completed_sales': return <CompletedSales {...commonProps} />;
      case 'catalog': return <Catalog {...commonProps} />;
      case 'packs': return <Packs {...commonProps} />;
      case 'incomes': return <Incomes {...commonProps} />;
      case 'expenses': return <Expenses {...commonProps} />;
      case 'currency_rates': return <CurrencyRates {...commonProps} />;
      case 'providers': return <Providers {...commonProps} />;
      case 'staff': return <Staff {...commonProps} defaultSubTab="members" />;
      case 'reserve': return <Staff {...commonProps} defaultSubTab="reserve" />;
      case 'website': return <Website {...commonProps} initialPath="dashboard" onChangePath={handleWebsitePathChange} />;
      case 'website-servicios': return <Website {...commonProps} initialPath="servicios" onChangePath={handleWebsitePathChange} />;
      case 'website-libros': return <Website {...commonProps} initialPath="libros" onChangePath={handleWebsitePathChange} />;
      case 'website-dominio': return <Website {...commonProps} initialPath="dominio" onChangePath={handleWebsitePathChange} />;
      case 'documents': return <Documents {...commonProps} />;
      case 'taxes': return <Taxes {...commonProps} />;
      case 'reports': return <Reports {...commonProps} />;
      case 'configuration': return <Configuration {...commonProps} />;
      case 'integrations': return <Integrations {...commonProps} />;
      case 'notifications': return (
        <div className="space-y-6 animate-fade-in text-slate-800 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-brand-500" />
              Notificaciones y Alertas de Control Interno
            </h2>
            <div className="divide-y divide-slate-150 dark:divide-slate-800 text-sm">
              {notifications.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-semibold flex flex-col items-center gap-2">
                  <CheckCircle className="w-12 h-12 text-emerald-500 shrink-0" />
                  <span>¡Al día! No se registran alertas de plazos o cobros pendientes hoy.</span>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div key={notif.id} className="py-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        notif.severity === 'high' 
                          ? 'bg-rose-50 text-rose-650 dark:bg-rose-950/30' 
                          : notif.severity === 'medium'
                            ? 'bg-amber-50 text-amber-650 dark:bg-amber-950/30' 
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                      }`}>
                        {notif.severity === 'high' ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">{notif.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{notif.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab(notif.tab)}
                      className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
                    >
                      Ir al Módulo
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      );
      case 'seguimientos': return <SeguimientosView isReadOnly={isReadOnly} />;
      default: return <Dashboard {...commonProps} />;
    }
  };

  const getActiveTabTitle = () => {
    if (activeTab === 'notifications') return 'Notificaciones';
    if (activeTab === 'seguimientos') return 'Seguimiento de Prospectos';
    const tab = tabs.find(t => t.id === activeTab);
    return tab ? tab.label : 'CRM Editorial';
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      
      {/* Sidebar - Desktop persistent / Mobile drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[var(--sidebar-bg)] border-r border-slate-200 dark:border-slate-800/80 p-5 flex flex-col justify-between transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:h-screen lg:flex-shrink-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Upper menu links */}
        <div className="space-y-3.5 flex flex-col h-full overflow-hidden">
          {/* Logo & Branding */}
          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-brand-500/10 text-brand-600 rounded-lg flex items-center justify-center min-w-8 min-h-8">
                {editorialSettings.logo_url ? (
                  <img src={editorialSettings.logo_url} alt="Logo" className="w-5 h-5 object-contain" />
                ) : (
                  <BookOpen className="w-4.5 h-4.5" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-150 font-sans tracking-tight">
                  {editorialSettings.editorial_name}
                </h2>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Editorial CRM</p>
              </div>
            </div>
            {/* Close Sidebar Mobile */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* User profile */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950/20 rounded-lg border border-slate-205 dark:border-slate-850 text-[11px] shrink-0 font-sans">
            <div className="p-1 bg-brand-500/10 text-brand-500 rounded-full shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="truncate flex-1">
              <p className="font-bold text-slate-700 dark:text-slate-200 truncate" title={user?.email}>
                {user?.email}
              </p>
            </div>
          </div>

          {/* Nav links (Scrollable area) */}
          <nav className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-thin text-xs">
            {menuGroups.map((group) => {
              const isGroupActive = group.tab === activeTab || 
                (group.items && group.items.some(item => item.id === activeTab || item.tab === activeTab));
              const isExpanded = expandedGroups[group.id];

              if (group.url) {
                return (
                  <a
                    key={group.id}
                    href={group.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border border-transparent text-slate-655 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {group.icon}
                    <span className="font-bold">{group.label}</span>
                  </a>
                );
              }

              if (group.tab) {
                return (
                  <button
                    key={group.id}
                    onClick={() => {
                      setActiveTab(group.tab);
                      setIsSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border
                      ${activeTab === group.tab 
                        ? 'bg-[var(--menu-active-bg)] border-[var(--menu-active-border)] text-[var(--menu-active-text)]' 
                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'}
                    `}
                  >
                    {group.icon}
                    <span className="font-bold">{group.label}</span>
                  </button>
                );
              }

              return (
                <div key={group.id} className="space-y-0.5">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`
                      w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border text-xs
                      ${isGroupActive 
                        ? 'border-brand-300/30 text-brand-655 dark:text-brand-400 font-bold bg-brand-50/10 dark:bg-brand-950/5' 
                        : 'border-transparent text-slate-655 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-800'}
                    `}
                  >
                    <span className="flex items-center gap-2.5">
                      {group.icon}
                      <span className="font-bold">{group.label}</span>
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="pl-3.5 space-y-0.5 border-l border-slate-200 dark:border-slate-800 ml-4.5 my-1 animate-slide-down">
                      {group.items.map((item) => {
                        const isItemActive = activeTab === item.id || activeTab === item.tab;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.tab);
                              setIsSidebarOpen(false);
                            }}
                            className={`
                              w-full flex items-center px-3 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer text-left
                              ${isItemActive 
                                ? 'bg-[var(--menu-active-bg)] text-[var(--menu-active-text)] font-bold shadow-xs' 
                                : 'text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/20'}
                            `}
                          >
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Lower actions */}
        <div className="space-y-2 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 shrink-0">
          {/* Demo status alert */}
          {isMock && (
            <div className="p-2 bg-brand-950/20 border border-brand-500/10 rounded-lg text-[9px] text-brand-400 dark:text-brand-300 flex items-center gap-1.5 justify-center">
              <Sparkles className="w-3 h-3 text-brand-450 shrink-0 animate-pulse" />
              <span className="truncate font-semibold">Demo Local</span>
            </div>
          )}

          {/* Compact Buttons Row */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="flex-1 flex items-center justify-center gap-1.5 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 hover:text-brand-600 dark:text-slate-400 dark:hover:text-slate-250 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs hover:shadow-sm text-[11px] font-semibold font-sans"
              title={isDarkMode ? 'Activar Modo Claro' : 'Activar Modo Nocturno'}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-slate-500" />}
              <span>{isDarkMode ? 'Claro' : 'Oscuro'}</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 p-1.5 rounded-lg border border-rose-200 dark:border-rose-955/20 bg-rose-50 dark:bg-rose-955/20 text-rose-650 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 cursor-pointer transition-all hover:shadow-xs text-[11px] font-bold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Dynamic Global Top Header Bar */}
        <header className="bg-[var(--header-bg)] border-b border-slate-200 dark:border-slate-800/80 px-6 py-4 flex items-center justify-between z-30 shrink-0 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            {/* Hamburger for mobile */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Active Tab Title in desktop */}
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 hidden md:block select-none shrink-0 font-sans tracking-tight pr-4 border-r border-slate-200 dark:border-slate-800">
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
                  className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-700 dark:text-slate-200"
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
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 hover:text-brand-600 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs hover:shadow-sm"
              title={isDarkMode ? 'Activar Modo Claro' : 'Activar Modo Nocturno'}
            >
              {isDarkMode ? <Sun className="w-4.5 h-4.5 text-amber-500" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* Notification Center Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`p-2 rounded-xl border text-slate-600 hover:text-brand-600 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer transition-all relative shadow-xs hover:shadow-sm ${
                  isNotifOpen 
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-750' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
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
                        <CheckCircle className="w-8 h-8 text-emerald-500 shrink-0" />
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
