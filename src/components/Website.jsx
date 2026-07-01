import React, { useState, useEffect } from 'react';
import { supabase, isMock } from '../supabaseClient';
import { 
  Globe, ArrowUpRight, ShieldCheck, Cpu, Layout, Server, ExternalLink, 
  Activity, ArrowLeft, Plus, Check, Eye, EyeOff, Edit, Trash2, Link as LinkIcon, 
  BookOpen, Heart, ShoppingBag, ArrowUp, ArrowDown, Star, AlertTriangle, 
  Upload, Copy, Save, FileText, Settings, AlignLeft, Info
} from 'lucide-react';
import { formatCurrency } from '../utils';

const WEBSITE_URL = "https://www.somosnovelieditorial.com/";

// Default recommended web services
const DEFAULT_WEB_SERVICES = [
  { id: 'ws-1', title: 'Full eBook', category: 'Digitalización', price_from: 80000, short_description: 'Publicación completa de tu eBook en plataformas globales', featured: true, active: true, visible_on_website: true, display_order: 1 },
  { id: 'ws-2', title: 'Full Físico', category: 'Producción', price_from: 250000, short_description: 'Edición e impresión física de tu obra literaria', featured: true, active: true, visible_on_website: true, display_order: 2 },
  { id: 'ws-3', title: 'Full Total', category: 'Producción', price_from: 450000, short_description: 'El pack definitivo: eBook, libro físico, tapa blanda e ilustración', featured: true, active: true, visible_on_website: true, display_order: 3 },
  { id: 'ws-4', title: 'Corrección', category: 'Editorial', price_from: 2500, short_description: 'Corrección de estilo, gramática y ortografía profesional', featured: false, active: true, visible_on_website: true, display_order: 4 },
  { id: 'ws-5', title: 'Portada', category: 'Diseño', price_from: 120000, short_description: 'Diseño de portada personalizado y adaptado al género', featured: false, active: true, visible_on_website: true, display_order: 5 },
  { id: 'ws-6', title: 'Maquetación', category: 'Editorial', price_from: 90000, short_description: 'Maquetación interior profesional para impresión y digital', featured: false, active: true, visible_on_website: true, display_order: 6 },
  { id: 'ws-7', title: 'Difusión Editorial', category: 'Marketing', price_from: 150000, short_description: 'Campañas de marketing, notas de prensa y difusión', featured: false, active: true, visible_on_website: true, display_order: 7 },
  { id: 'ws-8', title: 'Registro de Derechos de Autor', category: 'Legal', price_from: 50000, short_description: 'Gestión legal de registro de propiedad intelectual', featured: false, active: true, visible_on_website: true, display_order: 8 }
];

const DEFAULT_WEB_BOOKS = [
  { id: 'wb-1', title: 'El Eco de los Sauces', author: 'Clara Del Monte', genre: 'Novela Histórica', status: 'Destacado', cover_url: '', short_description: 'Una fascinante novela sobre secretos familiares en el sur de Chile.', featured: true, sale_url: 'https://amazon.com', sale_platform: 'Amazon', active: true, visible_on_website: true, display_order: 1 },
  { id: 'wb-2', title: 'Cenizas de Neón', author: 'Julio Rivera', genre: 'Ciencia Ficción', status: 'Novedad', cover_url: '', short_description: 'Un futuro distópico donde los recuerdos son la moneda de cambio.', featured: true, sale_url: 'https://wattpad.com', sale_platform: 'Wattpad', active: true, visible_on_website: true, display_order: 2 },
  { id: 'wb-3', title: 'Bajo la Sombra del Alerce', author: 'Marta Valdivia', genre: 'Poesía', status: 'Preventa', cover_url: '', short_description: 'Versos inspirados en los bosques milenarios y el paso del tiempo.', featured: false, sale_url: '', sale_platform: 'Amazon', active: false, visible_on_website: false, display_order: 3 },
];

const DEFAULT_WEB_LINKS = [
  { id: 'wl-1', title: 'Amazon Oficial', url: 'https://www.amazon.com', platform: 'Amazon', active: true, featured: true, visible_on_website: true, display_order: 1 },
  { id: 'wl-2', title: 'Buscalibre Chile', url: 'https://www.buscalibre.cl', platform: 'Buscalibre', active: true, featured: true, visible_on_website: true, display_order: 2 },
  { id: 'wl-3', title: 'Wattpad Noveli', url: 'https://www.wattpad.com', platform: 'Wattpad', active: true, featured: false, visible_on_website: true, display_order: 3 }
];

const DEFAULT_WEB_SECTIONS = [
  { id: 'sec-1', section_key: 'hero', title: 'Somos Noveli Editorial', content: 'Creamos puentes entre autores y lectores. Tu historia merece ser contada de la manera más hermosa.', active: true, featured: true, visible_on_website: true, display_order: 1 },
  { id: 'sec-2', section_key: 'about', title: 'Sobre Nosotros', content: 'Noveli Editorial nació con la vocación de simplificar y dignificar el proceso de autopublicación. Ayudamos a autores independientes a maquetar, corregir, diseñar y distribuir sus libros a nivel global con calidad profesional.', active: true, featured: true, visible_on_website: true, display_order: 2 },
  { id: 'sec-3', section_key: 'contact', title: 'Ponte en contacto', content: '¿Tienes un manuscrito listo? Escríbenos a contacto@somosnovelieditorial.com o búscanos en redes sociales.', active: true, featured: false, visible_on_website: true, display_order: 3 }
];

export default function Website({ isReadOnly, initialPath = 'dashboard', onChangePath }) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [services, setServices] = useState([]);
  const [books, setBooks] = useState([]);
  const [links, setLinks] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usingMockDb, setUsingMockDb] = useState(false);

  // Domain Settings State
  const [domainId, setDomainId] = useState(null);
  const [domain, setDomain] = useState('somosnovelieditorial.com');
  const [wwDomain, setWwDomain] = useState('www.somosnovelieditorial.com');
  const [publicUrl, setPublicUrl] = useState('https://www.somosnovelieditorial.com/');
  const [vercelPreviewUrl, setVercelPreviewUrl] = useState('');
  const [domainProvider, setDomainProvider] = useState('Google Domains');
  const [hostingProvider, setHostingProvider] = useState('Vercel');
  const [domainStatus, setDomainStatus] = useState('conectado');
  const [dnsNotes, setDnsNotes] = useState('Apuntar registro CNAME a cname.vercel-dns.com y registro A a 76.76.21.21');
  const [domainVisible, setDomainVisible] = useState(true);

  // Service Form states
  const [editingService, setEditingService] = useState(null);
  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceShortDesc, setServiceShortDesc] = useState('');
  const [serviceFullDesc, setServiceFullDesc] = useState('');
  const [servicePrice, setServicePrice] = useState('0');
  const [serviceCategory, setServiceCategory] = useState('Editorial');
  const [serviceFeatured, setServiceFeatured] = useState(false);
  const [serviceVisible, setServiceVisible] = useState(true);

  // Book Form states
  const [editingBook, setEditingBook] = useState(null);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookGenre, setBookGenre] = useState('');
  const [bookStatus, setBookStatus] = useState('Destacado');
  const [bookShortDesc, setBookShortDesc] = useState('');
  const [bookCoverUrl, setBookCoverUrl] = useState('');
  const [bookSaleUrl, setBookSaleUrl] = useState('');
  const [bookSalePlatform, setBookSalePlatform] = useState('Amazon');
  const [bookFeatured, setBookFeatured] = useState(false);
  const [bookActive, setBookActive] = useState(true);
  const [bookVisible, setBookVisible] = useState(true);

  // Links Form states
  const [editingLink, setEditingLink] = useState(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPlatform, setLinkPlatform] = useState('Amazon');
  const [linkFeatured, setLinkFeatured] = useState(false);
  const [linkActive, setLinkActive] = useState(true);
  const [linkVisible, setLinkVisible] = useState(true);

  // Sections Form states
  const [editingSection, setEditingSection] = useState(null);
  const [sectionKey, setSectionKey] = useState('hero');
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionContent, setSectionContent] = useState('');
  const [sectionFeatured, setSectionFeatured] = useState(false);
  const [sectionActive, setSectionActive] = useState(true);
  const [sectionVisible, setSectionVisible] = useState(true);

  // Clipboard feedbacks
  const [domainCopied, setDomainCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    setCurrentPath(initialPath);
  }, [initialPath]);

  useEffect(() => {
    fetchServices();
    fetchBooks();
    fetchLinks();
    fetchSections();
    fetchSettings();
  }, []);

  const navigateTo = (path) => {
    setCurrentPath(path);
    if (onChangePath) {
      onChangePath(path);
    }
  };

  // --- SETTINGS PERSISTENCE ---
  const fetchSettings = async () => {
    try {
      if (isMock) {
        loadMockSettings();
        return;
      }
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .limit(1);

      if (error) {
        console.warn("Table website_settings query failed, using local memory settings:", error.message);
        loadMockSettings();
        setUsingMockDb(true);
      } else if (data && data.length > 0) {
        const row = data[0];
        setDomainId(row.id);
        setDomain(row.domain || 'somosnovelieditorial.com');
        setWwDomain(row.www_domain || 'www.somosnovelieditorial.com');
        setPublicUrl(row.public_url || 'https://www.somosnovelieditorial.com/');
        setVercelPreviewUrl(row.vercel_preview_url || '');
        setDomainProvider(row.domain_provider || 'Google Domains');
        setHostingProvider(row.hosting_provider || 'Vercel');
        setDomainStatus(row.domain_status || 'conectado');
        setDnsNotes(row.dns_notes || '');
        setDomainVisible(row.visible_on_website !== false);
      } else {
        await seedDefaultSettings();
      }
    } catch (err) {
      console.error("Exception loading settings:", err);
      loadMockSettings();
      setUsingMockDb(true);
    }
  };

  const loadMockSettings = () => {
    const saved = localStorage.getItem('somos_noveli_website_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDomain(parsed.domain || 'somosnovelieditorial.com');
        setWwDomain(parsed.www_domain || 'www.somosnovelieditorial.com');
        setPublicUrl(parsed.public_url || 'https://www.somosnovelieditorial.com/');
        setVercelPreviewUrl(parsed.vercel_preview_url || '');
        setDomainProvider(parsed.domain_provider || 'Google Domains');
        setHostingProvider(parsed.hosting_provider || 'Vercel');
        setDomainStatus(parsed.domain_status || 'conectado');
        setDnsNotes(parsed.dns_notes || '');
        setDomainVisible(parsed.visible_on_website !== false);
      } catch (_) {}
    }
  };

  const seedDefaultSettings = async () => {
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const payload = {
        domain: 'somosnovelieditorial.com',
        www_domain: 'www.somosnovelieditorial.com',
        public_url: 'https://www.somosnovelieditorial.com/',
        vercel_preview_url: '',
        domain_provider: 'Google Domains',
        hosting_provider: 'Vercel',
        domain_status: 'conectado',
        dns_notes: 'Apuntar registro CNAME a cname.vercel-dns.com y registro A a 76.76.21.21',
        visible_on_website: true,
        organization_id: orgId
      };
      const { data, error } = await supabase
        .from('website_settings')
        .insert([payload])
        .select();
      if (!error && data && data.length > 0) {
        setDomainId(data[0].id);
      }
    } catch (_) {}
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const payload = {
        domain,
        www_domain: wwDomain,
        public_url: publicUrl,
        vercel_preview_url: vercelPreviewUrl,
        domain_provider: domainProvider,
        hosting_provider: hostingProvider,
        domain_status: domainStatus,
        dns_notes: dnsNotes,
        visible_on_website: domainVisible,
        organization_id: orgId
      };

      if (isMock || usingMockDb || !supabase) {
        localStorage.setItem('somos_noveli_website_settings', JSON.stringify(payload));
        alert("Configuración local de dominio guardada correctamente.");
      } else {
        if (domainId) {
          const { error } = await supabase
            .from('website_settings')
            .update(payload)
            .eq('id', domainId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('website_settings')
            .insert([payload])
            .select();
          if (error) throw error;
          if (data && data.length > 0) setDomainId(data[0].id);
        }
        alert("Configuración de dominio y hosting guardada en Supabase.");
      }
      await fetchSettings();
    } catch (err) {
      console.error("Error saving website settings:", err);
      alert(`Error al guardar: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // --- SERVICE PERSISTENCE ---
  const fetchServices = async () => {
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
        loadMockServices();
        setUsingMockDb(true);
      } else {
        if (data && data.length > 0) {
          setServices(data);
        } else {
          await seedDefaultServices();
        }
      }
    } catch (_) {
      loadMockServices();
    }
  };

  const loadMockServices = () => {
    const saved = localStorage.getItem('somos_noveli_website_services');
    if (saved) {
      try { setServices(JSON.parse(saved)); } catch (_) { setServices(DEFAULT_WEB_SERVICES); }
    } else {
      setServices(DEFAULT_WEB_SERVICES);
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
        visible_on_website: s.visible_on_website,
        display_order: s.display_order,
        organization_id: orgId
      }));
      await supabase.from('website_services').insert(servicesToInsert);
      const { data } = await supabase.from('website_services').select('*').order('display_order');
      if (data) setServices(data);
    } catch (_) {}
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!serviceTitle.trim()) return;

    setLoading(true);
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const parsedPrice = parseFloat(servicePrice) || 0;
      const payload = {
        title: serviceTitle,
        short_description: serviceShortDesc,
        full_description: serviceFullDesc,
        price_from: parsedPrice,
        category: serviceCategory,
        featured: serviceFeatured,
        visible_on_website: serviceVisible,
        organization_id: orgId
      };

      if (editingService) {
        if (isMock || usingMockDb) {
          const updated = services.map(s => s.id === editingService.id ? { ...s, ...payload } : s);
          setServices(updated);
          localStorage.setItem('somos_noveli_website_services', JSON.stringify(updated));
        } else {
          await supabase.from('website_services').update(payload).eq('id', editingService.id);
        }
      } else {
        const newOrder = services.length > 0 ? Math.max(...services.map(s => s.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, active: true, display_order: newOrder };
        if (isMock || usingMockDb) {
          const updated = [...services, { ...insertPayload, id: `ws-${Date.now()}` }];
          setServices(updated);
          localStorage.setItem('somos_noveli_website_services', JSON.stringify(updated));
        } else {
          await supabase.from('website_services').insert([insertPayload]);
        }
      }
      resetForm();
      await fetchServices();
      alert("Servicio guardado con éxito.");
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startEditService = (service) => {
    setEditingService(service);
    setServiceTitle(service.title || '');
    setServiceShortDesc(service.short_description || '');
    setServiceFullDesc(service.full_description || '');
    setServicePrice(String(service.price_from || '0'));
    setServiceCategory(service.category || 'Editorial');
    setServiceFeatured(!!service.featured);
    setServiceVisible(service.visible_on_website !== false);
  };

  const toggleServiceBoolean = async (service, field) => {
    if (isReadOnly) return;
    const newVal = !service[field];
    try {
      if (isMock || usingMockDb) {
        const updated = services.map(s => s.id === service.id ? { ...s, [field]: newVal } : s);
        setServices(updated);
        localStorage.setItem('somos_noveli_website_services', JSON.stringify(updated));
      } else {
        await supabase.from('website_services').update({ [field]: newVal }).eq('id', service.id);
      }
      setServices(services.map(s => s.id === service.id ? { ...s, [field]: newVal } : s));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteService = async (id) => {
    if (isReadOnly) return;
    if (!window.confirm("¿Seguro de que deseas eliminar este servicio de la web pública?")) return;
    try {
      if (isMock || usingMockDb) {
        const updated = services.filter(s => s.id !== id);
        setServices(updated);
        localStorage.setItem('somos_noveli_website_services', JSON.stringify(updated));
      } else {
        await supabase.from('website_services').delete().eq('id', id);
      }
      setServices(services.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // --- BOOK PERSISTENCE ---
  const fetchBooks = async () => {
    try {
      if (isMock) {
        loadMockBooks();
        return;
      }
      const { data, error } = await supabase
        .from('website_books')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        loadMockBooks();
      } else {
        if (data && data.length > 0) {
          setBooks(data);
        } else {
          await seedDefaultBooks();
        }
      }
    } catch (_) {
      loadMockBooks();
    }
  };

  const loadMockBooks = () => {
    const saved = localStorage.getItem('somos_noveli_website_books');
    if (saved) {
      try { setBooks(JSON.parse(saved)); } catch (_) { setBooks(DEFAULT_WEB_BOOKS); }
    } else {
      setBooks(DEFAULT_WEB_BOOKS);
    }
  };

  const seedDefaultBooks = async () => {
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const booksToInsert = DEFAULT_WEB_BOOKS.map(b => ({
        title: b.title,
        author: b.author,
        genre: b.genre,
        status: b.status,
        short_description: b.short_description,
        featured: b.featured,
        sale_url: b.sale_url,
        sale_platform: b.sale_platform,
        active: b.active,
        visible_on_website: b.visible_on_website,
        display_order: b.display_order,
        organization_id: orgId
      }));
      await supabase.from('website_books').insert(booksToInsert);
      const { data } = await supabase.from('website_books').select('*').order('display_order');
      if (data) setBooks(data);
    } catch (_) {}
  };

  const handleSaveBook = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!bookTitle.trim()) return;

    setLoading(true);
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const payload = {
        title: bookTitle,
        author: bookAuthor,
        genre: bookGenre,
        status: bookStatus,
        short_description: bookShortDesc,
        cover_url: bookCoverUrl,
        sale_url: bookSaleUrl,
        sale_platform: bookSalePlatform,
        featured: bookFeatured,
        active: bookActive,
        visible_on_website: bookVisible,
        organization_id: orgId
      };

      if (editingBook) {
        if (isMock || usingMockDb) {
          const updated = books.map(b => b.id === editingBook.id ? { ...b, ...payload } : b);
          setBooks(updated);
          localStorage.setItem('somos_noveli_website_books', JSON.stringify(updated));
        } else {
          await supabase.from('website_books').update(payload).eq('id', editingBook.id);
        }
      } else {
        const newOrder = books.length > 0 ? Math.max(...books.map(b => b.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, display_order: newOrder };
        if (isMock || usingMockDb) {
          const updated = [...books, { ...insertPayload, id: `wb-${Date.now()}` }];
          setBooks(updated);
          localStorage.setItem('somos_noveli_website_books', JSON.stringify(updated));
        } else {
          await supabase.from('website_books').insert([insertPayload]);
        }
      }
      resetBookForm();
      await fetchBooks();
      alert("Libro guardado con éxito.");
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleBookBoolean = async (book, field) => {
    if (isReadOnly) return;
    const newVal = !book[field];
    try {
      if (isMock || usingMockDb) {
        const updated = books.map(b => b.id === book.id ? { ...b, [field]: newVal } : b);
        setBooks(updated);
        localStorage.setItem('somos_noveli_website_books', JSON.stringify(updated));
      } else {
        await supabase.from('website_books').update({ [field]: newVal }).eq('id', book.id);
      }
      setBooks(books.map(b => b.id === book.id ? { ...b, [field]: newVal } : b));
    } catch (err) {
      console.error(err);
    }
  };

  // --- LINKS PERSISTENCE (website_links) ---
  const fetchLinks = async () => {
    try {
      if (isMock) {
        loadMockLinks();
        return;
      }
      const { data, error } = await supabase
        .from('website_links')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        loadMockLinks();
      } else {
        if (data && data.length > 0) {
          setLinks(data);
        } else {
          await seedDefaultLinks();
        }
      }
    } catch (_) {
      loadMockLinks();
    }
  };

  const loadMockLinks = () => {
    const saved = localStorage.getItem('somos_noveli_website_links');
    if (saved) {
      try { setLinks(JSON.parse(saved)); } catch (_) { setLinks(DEFAULT_WEB_LINKS); }
    } else {
      setLinks(DEFAULT_WEB_LINKS);
    }
  };

  const seedDefaultLinks = async () => {
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const toInsert = DEFAULT_WEB_LINKS.map(l => ({
        title: l.title,
        url: l.url,
        platform: l.platform,
        active: l.active,
        featured: l.featured,
        visible_on_website: l.visible_on_website,
        display_order: l.display_order,
        organization_id: orgId
      }));
      await supabase.from('website_links').insert(toInsert);
      const { data } = await supabase.from('website_links').select('*').order('display_order');
      if (data) setLinks(data);
    } catch (_) {}
  };

  const handleSaveLink = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!linkTitle.trim() || !linkUrl.trim()) return;

    setLoading(true);
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const payload = {
        title: linkTitle,
        url: linkUrl,
        platform: linkPlatform,
        featured: linkFeatured,
        active: linkActive,
        visible_on_website: linkVisible,
        organization_id: orgId
      };

      if (editingLink) {
        if (isMock || usingMockDb) {
          const updated = links.map(l => l.id === editingLink.id ? { ...l, ...payload } : l);
          setLinks(updated);
          localStorage.setItem('somos_noveli_website_links', JSON.stringify(updated));
        } else {
          await supabase.from('website_links').update(payload).eq('id', editingLink.id);
        }
      } else {
        const newOrder = links.length > 0 ? Math.max(...links.map(l => l.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, display_order: newOrder };
        if (isMock || usingMockDb) {
          const updated = [...links, { ...insertPayload, id: `wl-${Date.now()}` }];
          setLinks(updated);
          localStorage.setItem('somos_noveli_website_links', JSON.stringify(updated));
        } else {
          await supabase.from('website_links').insert([insertPayload]);
        }
      }
      resetLinkForm();
      await fetchLinks();
      alert("Enlace guardado correctamente.");
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startEditLink = (link) => {
    setEditingLink(link);
    setLinkTitle(link.title || '');
    setLinkUrl(link.url || '');
    setLinkPlatform(link.platform || 'Amazon');
    setLinkFeatured(!!link.featured);
    setLinkActive(!!link.active);
    setLinkVisible(link.visible_on_website !== false);
  };

  const resetLinkForm = () => {
    setEditingLink(null);
    setLinkTitle('');
    setLinkUrl('');
    setLinkPlatform('Amazon');
    setLinkFeatured(false);
    setLinkActive(true);
    setLinkVisible(true);
  };

  const toggleLinkBoolean = async (link, field) => {
    if (isReadOnly) return;
    const newVal = !link[field];
    try {
      if (isMock || usingMockDb) {
        const updated = links.map(l => l.id === link.id ? { ...l, [field]: newVal } : l);
        setLinks(updated);
        localStorage.setItem('somos_noveli_website_links', JSON.stringify(updated));
      } else {
        await supabase.from('website_links').update({ [field]: newVal }).eq('id', link.id);
      }
      setLinks(links.map(l => l.id === link.id ? { ...l, [field]: newVal } : l));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLink = async (id) => {
    if (isReadOnly) return;
    if (!window.confirm("¿Seguro de que deseas eliminar este enlace?")) return;
    try {
      if (isMock || usingMockDb) {
        const updated = links.filter(l => l.id !== id);
        setLinks(updated);
        localStorage.setItem('somos_noveli_website_links', JSON.stringify(updated));
      } else {
        await supabase.from('website_links').delete().eq('id', id);
      }
      setLinks(links.filter(l => l.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // --- SECTIONS PERSISTENCE (website_sections) ---
  const fetchSections = async () => {
    try {
      if (isMock) {
        loadMockSections();
        return;
      }
      const { data, error } = await supabase
        .from('website_sections')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        loadMockSections();
      } else {
        if (data && data.length > 0) {
          setSections(data);
        } else {
          await seedDefaultSections();
        }
      }
    } catch (_) {
      loadMockSections();
    }
  };

  const loadMockSections = () => {
    const saved = localStorage.getItem('somos_noveli_website_sections');
    if (saved) {
      try { setSections(JSON.parse(saved)); } catch (_) { setSections(DEFAULT_WEB_SECTIONS); }
    } else {
      setSections(DEFAULT_WEB_SECTIONS);
    }
  };

  const seedDefaultSections = async () => {
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const toInsert = DEFAULT_WEB_SECTIONS.map(s => ({
        section_key: s.section_key,
        title: s.title,
        content: s.content,
        active: s.active,
        featured: s.featured,
        visible_on_website: s.visible_on_website,
        display_order: s.display_order,
        organization_id: orgId
      }));
      await supabase.from('website_sections').insert(toInsert);
      const { data } = await supabase.from('website_sections').select('*').order('display_order');
      if (data) setSections(data);
    } catch (_) {}
  };

  const handleSaveSection = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!sectionTitle.trim() || !sectionContent.trim()) return;

    setLoading(true);
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const payload = {
        section_key: sectionKey,
        title: sectionTitle,
        content: sectionContent,
        featured: sectionFeatured,
        active: sectionActive,
        visible_on_website: sectionVisible,
        organization_id: orgId
      };

      if (editingSection) {
        if (isMock || usingMockDb) {
          const updated = sections.map(s => s.id === editingSection.id ? { ...s, ...payload } : s);
          setSections(updated);
          localStorage.setItem('somos_noveli_website_sections', JSON.stringify(updated));
        } else {
          await supabase.from('website_sections').update(payload).eq('id', editingSection.id);
        }
      } else {
        const newOrder = sections.length > 0 ? Math.max(...sections.map(s => s.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, display_order: newOrder };
        if (isMock || usingMockDb) {
          const updated = [...sections, { ...insertPayload, id: `sec-${Date.now()}` }];
          setSections(updated);
          localStorage.setItem('somos_noveli_website_sections', JSON.stringify(updated));
        } else {
          await supabase.from('website_sections').insert([insertPayload]);
        }
      }
      resetSectionForm();
      await fetchSections();
      alert("Sección de texto guardada con éxito.");
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startEditSection = (sec) => {
    setEditingSection(sec);
    setSectionKey(sec.section_key || 'hero');
    setSectionTitle(sec.title || '');
    setSectionContent(sec.content || '');
    setSectionFeatured(!!sec.featured);
    setSectionActive(!!sec.active);
    setSectionVisible(sec.visible_on_website !== false);
  };

  const resetSectionForm = () => {
    setEditingSection(null);
    setSectionKey('hero');
    setSectionTitle('');
    setSectionContent('');
    setSectionFeatured(false);
    setSectionActive(true);
    setSectionVisible(true);
  };

  const toggleSectionBoolean = async (sec, field) => {
    if (isReadOnly) return;
    const newVal = !sec[field];
    try {
      if (isMock || usingMockDb) {
        const updated = sections.map(s => s.id === sec.id ? { ...s, [field]: newVal } : s);
        setSections(updated);
        localStorage.setItem('somos_noveli_website_sections', JSON.stringify(updated));
      } else {
        await supabase.from('website_sections').update({ [field]: newVal }).eq('id', sec.id);
      }
      setSections(sections.map(s => s.id === sec.id ? { ...s, [field]: newVal } : s));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSection = async (id) => {
    if (isReadOnly) return;
    if (!window.confirm("¿Seguro de que deseas eliminar este bloque de texto?")) return;
    try {
      if (isMock || usingMockDb) {
        const updated = sections.filter(s => s.id !== id);
        setSections(updated);
        localStorage.setItem('somos_noveli_website_sections', JSON.stringify(updated));
      } else {
        await supabase.from('website_sections').delete().eq('id', id);
      }
      setSections(sections.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 text-slate-800 dark:text-slate-100">
      
      {/* ------------------ BREADCRUMBS & NAVIGATION ------------------ */}
      <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400">
        <span 
          onClick={() => navigateTo('dashboard')} 
          className={`hover:text-amber-500 cursor-pointer transition-colors ${currentPath === 'dashboard' ? 'text-amber-600 font-bold' : ''}`}
        >
          Sitio Web
        </span>
        {currentPath !== 'dashboard' && (
          <>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-200 capitalize font-bold">
              {currentPath === 'servicios' ? 'Servicios Web' : 
               currentPath === 'libros' ? 'Libros Destacados' : 
               currentPath === 'enlaces' ? 'Enlaces de Venta' : 
               currentPath === 'textos' ? 'Textos Principales' : 'Configuración de Dominio'}
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
              <h1 className="text-3xl font-extrabold text-slate-855 dark:text-slate-100 tracking-tight font-serif flex items-center gap-2">
                <Globe className="w-8 h-8 text-amber-500" />
                Panel de Sitio Web Público
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-sans">
                Administra todos los textos, ofertas y contenidos que consume la página pública de Noveli desde Supabase.
              </p>
            </div>
            
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer border border-transparent"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Ver sitio oficial</span>
            </a>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. Configuración Web */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl w-fit">
                  <Settings className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Configuración Web</h3>
                <p className="text-xs text-slate-450 dark:text-slate-400 leading-relaxed">
                  Configura el dominio, hosting y el estado de visibilidad general de la página pública en la red.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                  {domain}
                </div>
              </div>
              <button
                onClick={() => navigateTo('dominio')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Administrar Dominio</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 2. Servicios Editoriales */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-455 rounded-xl w-fit">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Servicios Web</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Crea y destaca los servicios que se muestran públicamente (eBook, Físico, Difusión, etc.).
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  <span>{services.length} servicios ({services.filter(s => s.visible_on_website).length} visibles)</span>
                </div>
              </div>
              <button
                onClick={() => navigateTo('servicios')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Gestionar Servicios</span>
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
                  Administra las obras que se destacan en el catálogo público de la editorial.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                  <span>{books.length} libros ({books.filter(b => b.visible_on_website).length} visibles)</span>
                </div>
              </div>
              <button
                onClick={() => navigateTo('libros')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Gestionar Libros</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4. Enlaces de Venta */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455 rounded-xl w-fit">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Enlaces de Venta</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Gestiona enlaces globales de venta y lectura oficial de Noveli (Amazon, Buscalibre, Wattpad).
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                  <span>{links.length} enlaces ({links.filter(l => l.visible_on_website).length} visibles)</span>
                </div>
              </div>
              <button
                onClick={() => navigateTo('enlaces')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Gestionar Enlaces</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 5. Textos Principales */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 rounded-xl w-fit">
                  <AlignLeft className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Textos de la Página</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Modifica los textos principales de las secciones públicas: Hero, Quiénes Somos y Contacto.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <span>{sections.length} secciones ({sections.filter(s => s.visible_on_website).length} visibles)</span>
                </div>
              </div>
              <button
                onClick={() => navigateTo('textos')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Gestionar Textos</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 6. Estado General */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-855 dark:text-slate-100 flex items-center gap-2">
                <Activity className="w-4.5 h-4.5 text-emerald-500 animate-pulse" />
                Arquitectura CMS Pública
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Este panel opera como CMS desacoplado. Los datos guardados aquí son consumidos por el sitio público mediante la API cliente de Supabase.
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl space-y-2 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Datos Privados del CRM:</span>
                  <span className="text-rose-500 font-bold uppercase">No compartidos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Base de Datos:</span>
                  <span className="text-slate-600 dark:text-slate-300 font-bold">PostgreSQL / Supabase</span>
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      {/* ------------------ SUB-VIEW: DOMINIO Y PREVIEW ------------------ */}
      {currentPath === 'dominio' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => navigateTo('dashboard')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Configuración de Dominio</h2>
                <p className="text-xs text-slate-400 mt-0.5">Controla la infraestructura de red, dominios oficiales y previsualiza la web pública.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Form */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-5 h-fit">
              <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm flex items-center gap-2">
                <Server className="w-4.5 h-4.5 text-blue-500" />
                Infraestructura Web
              </h3>

              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Dominio Principal</label>
                  <input
                    type="text"
                    required
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent text-xs text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Dominio con WWW</label>
                  <input
                    type="text"
                    value={wwDomain}
                    onChange={e => setWwDomain(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent text-xs text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">URL Pública Actual</label>
                  <input
                    type="url"
                    required
                    value={publicUrl}
                    onChange={e => setPublicUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent text-xs text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">URL Vista Previa Vercel</label>
                  <input
                    type="url"
                    value={vercelPreviewUrl}
                    onChange={e => setVercelPreviewUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent text-xs text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Proveedor</label>
                    <input
                      type="text"
                      value={domainProvider}
                      onChange={e => setDomainProvider(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent text-xs text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Hosting</label>
                    <input
                      type="text"
                      value={hostingProvider}
                      onChange={e => setHostingProvider(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent text-xs text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Estado</label>
                  <select
                    value={domainStatus}
                    onChange={e => setDomainStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  >
                    <option value="conectado">Conectado / Activo</option>
                    <option value="pendiente">Pendiente de verificación</option>
                    <option value="revisar DNS">Revisar DNS</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 py-1.5">
                  <input
                    type="checkbox"
                    id="domainVisible"
                    checked={domainVisible}
                    onChange={e => setDomainVisible(e.target.checked)}
                    className="rounded border-slate-300 text-amber-500 h-4 w-4"
                  />
                  <label htmlFor="domainVisible" className="text-slate-655 dark:text-slate-350 font-bold cursor-pointer">
                    Dominio visible en la web pública
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isReadOnly}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-1.5 border border-transparent"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar configuración</span>
                </button>
              </form>
            </div>

            {/* Iframe View */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs flex flex-col space-y-4 justify-between h-[600px]">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm flex items-center gap-2">
                  <Globe className="w-4.5 h-4.5 text-emerald-500 animate-pulse" />
                  Vista Previa del Sitio
                </h3>
              </div>

              <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950/40 relative">
                <div className="h-9 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center gap-3 shrink-0">
                  <div className="flex-1 bg-white dark:bg-slate-950 rounded px-2.5 py-0.5 text-[10px] text-slate-450 font-mono truncate text-center">
                    {publicUrl}
                  </div>
                </div>
                <div className="flex-1 relative flex flex-col justify-center items-center">
                  <iframe src={publicUrl} title="Preview" className="w-full h-full border-none z-10 bg-white" />
                  <div className="absolute inset-0 bg-slate-50/90 dark:bg-slate-900/90 z-0 flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Vista previa del sitio oficial</p>
                    <p className="text-[11px] text-slate-400 max-w-sm">Si tu navegador bloquea el iframe por políticas del hosting, abre el sitio externamente.</p>
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 border border-transparent">
                      <span>No se puede previsualizar aquí. Abrir en nueva pestaña.</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ------------------ SUB-VIEW: SERVICIOS ------------------ */}
      {currentPath === 'servicios' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigateTo('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Servicios Web Públicos</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">Configura qué servicios aparecen en la web y si se destacan en la portada.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-150 dark:border-slate-800 text-slate-400 font-bold">
                      <th className="py-2.5">Título</th>
                      <th className="py-2.5">Categoría</th>
                      <th className="py-2.5">Precio</th>
                      <th className="py-2.5 text-center">Destacado</th>
                      <th className="py-2.5 text-center">Activo</th>
                      <th className="py-2.5 text-center">En Web</th>
                      <th className="py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-855">
                    {services.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                        <td className="py-3 font-bold text-slate-750 dark:text-slate-200">{s.title}</td>
                        <td className="py-3"><span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 rounded font-bold text-[9px] uppercase tracking-wider">{s.category}</span></td>
                        <td className="py-3 font-mono font-bold">{formatCurrency(s.price_from, 'CLP')}</td>
                        {/* Destacado */}
                        <td className="py-3 text-center">
                          <button type="button" onClick={() => toggleServiceBoolean(s, 'featured')} className="focus:outline-none bg-transparent border border-transparent cursor-pointer">
                            <Star className={`w-4 h-4 ${s.featured ? 'text-amber-500 fill-amber-500' : 'text-slate-350 dark:text-slate-700'}`} />
                          </button>
                        </td>
                        {/* Activo */}
                        <td className="py-3 text-center">
                          <button type="button" onClick={() => toggleServiceBoolean(s, 'active')} className="focus:outline-none bg-transparent border border-transparent cursor-pointer">
                            {s.active ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <EyeOff className="w-4 h-4 text-slate-400 mx-auto" />}
                          </button>
                        </td>
                        {/* visible_on_website */}
                        <td className="py-3 text-center">
                          <button type="button" onClick={() => toggleServiceBoolean(s, 'visible_on_website')} className="focus:outline-none bg-transparent border border-transparent cursor-pointer">
                            {s.visible_on_website !== false ? (
                              <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border border-emerald-100 rounded text-[9px] font-bold">visible</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-950/10 text-slate-500 border border-slate-200 rounded text-[9px] font-bold">oculto</span>
                            )}
                          </button>
                        </td>
                        <td className="py-3 text-right space-x-1.5">
                          <button onClick={() => startEditService(s)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-450 rounded border border-transparent bg-transparent cursor-pointer inline-flex items-center"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteService(s.id)} className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-455 rounded border border-transparent bg-transparent cursor-pointer inline-flex items-center"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
              <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">
                {editingService ? 'Editar Servicio' : 'Agregar Servicio Web'}
              </h3>
              <form onSubmit={handleSaveService} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Título</label>
                  <input type="text" required placeholder="Ej. Full eBook" value={serviceTitle} onChange={e => setServiceTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Categoría</label>
                  <select value={serviceCategory} onChange={e => setServiceCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent">
                    <option value="Editorial">Editorial</option>
                    <option value="Diseño">Diseño</option>
                    <option value="Digitalización">Digitalización</option>
                    <option value="Producción">Producción</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Precio Desde</label>
                  <input type="number" value={servicePrice} onChange={e => setServicePrice(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Descripción Corta</label>
                  <textarea value={serviceShortDesc} onChange={e => setServiceShortDesc(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Descripción Completa</label>
                  <textarea value={serviceFullDesc} onChange={e => setServiceFullDesc(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                
                <div className="flex gap-4 py-1.5">
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer">
                    <input type="checkbox" checked={serviceFeatured} onChange={e => setServiceFeatured(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                    <span>Destacado</span>
                  </label>
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer">
                    <input type="checkbox" checked={serviceVisible} onChange={e => setServiceVisible(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                    <span>Visible en la web</span>
                  </label>
                </div>

                <button type="submit" disabled={isReadOnly} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" />
                  <span>Guardar Servicio</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ------------------ SUB-VIEW: LIBROS ------------------ */}
      {currentPath === 'libros' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigateTo('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-855 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Libros Destacados</h2>
                <p className="text-xs text-slate-400 mt-0.5">Controla las portadas, novedades y enlaces de venta en la web de Noveli.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {books.map(b => (
                <div key={b.id} className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-5 shadow-2xs flex gap-4">
                  <div className="w-20 h-28 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col items-center justify-center overflow-hidden shrink-0 relative group">
                    {b.cover_url ? <img src={b.cover_url.startsWith('mock://') ? `https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=100&auto=format&fit=crop&q=60` : b.cover_url} className="w-full h-full object-cover" /> : <BookOpen className="w-7 h-7 text-slate-300" />}
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[9px] font-bold cursor-pointer">
                      <Upload className="w-4 h-4 mb-1" />
                      <span>Subir foto</span>
                      <input type="file" accept="image/*" disabled={isReadOnly} onChange={(e) => handleUploadCover(e, b.id)} className="hidden" />
                    </label>
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{b.title}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Autor: {b.author} • Género: {b.genre}</p>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Featured */}
                        <button type="button" onClick={() => toggleBookBoolean(b, 'featured')} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-transparent bg-transparent cursor-pointer">
                          <Star className={`w-4 h-4 ${b.featured ? 'text-amber-500 fill-amber-500' : 'text-slate-350'}`} />
                        </button>
                        {/* Active */}
                        <button type="button" onClick={() => toggleBookBoolean(b, 'active')} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-transparent bg-transparent cursor-pointer">
                          {b.active ? <Check className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                        </button>
                        {/* visible_on_website */}
                        <button type="button" onClick={() => toggleBookBoolean(b, 'visible_on_website')} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-transparent bg-transparent cursor-pointer">
                          {b.visible_on_website !== false ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-350" />}
                        </button>
                        
                        <button onClick={() => startEditBook(b)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600 rounded border border-transparent bg-transparent cursor-pointer"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteBook(b.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 rounded border border-transparent bg-transparent cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {b.short_description && <p className="text-xs text-slate-500 italic">"{b.short_description}"</p>}
                  </div>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
              <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">{editingBook ? 'Editar Libro' : 'Destacar Libro'}</h3>
              <form onSubmit={handleSaveBook} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Título del Libro</label>
                  <input type="text" required value={bookTitle} onChange={e => setBookTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Autor</label>
                  <input type="text" required value={bookAuthor} onChange={e => setBookAuthor(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Género</label>
                  <input type="text" value={bookGenre} onChange={e => setBookGenre(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Imagen de Portada</label>
                  <div className="flex gap-2">
                    <input type="text" value={bookCoverUrl} onChange={e => setBookCoverUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono" />
                    <label className="px-3 py-2 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border cursor-pointer text-xs font-bold shrink-0 flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir</span>
                      <input type="file" accept="image/*" disabled={isReadOnly} onChange={(e) => handleUploadCover(e)} className="hidden" />
                    </label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Reseña</label>
                  <textarea value={bookShortDesc} onChange={e => setBookShortDesc(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Plataforma</label>
                    <select value={bookSalePlatform} onChange={e => setBookSalePlatform(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent">
                      <option value="Amazon">Amazon</option>
                      <option value="Buscalibre">Buscalibre</option>
                      <option value="Wattpad">Wattpad</option>
                      <option value="Página del autor">Página del autor</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Enlace</label>
                    <input type="text" value={bookSaleUrl} onChange={e => setBookSaleUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                  </div>
                </div>

                <div className="flex gap-4 py-1">
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer">
                    <input type="checkbox" checked={bookFeatured} onChange={e => setBookFeatured(e.target.checked)} className="rounded text-purple-550 h-4 w-4" />
                    <span>Destacado</span>
                  </label>
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer">
                    <input type="checkbox" checked={bookVisible} onChange={e => setBookVisible(e.target.checked)} className="rounded text-purple-550 h-4 w-4" />
                    <span>Visible en Web</span>
                  </label>
                </div>

                <button type="submit" disabled={isReadOnly} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" />
                  <span>Guardar Libro</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ------------------ SUB-VIEW: ENLACES (website_links) ------------------ */}
      {currentPath === 'enlaces' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigateTo('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Enlaces de Venta y Lectura</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">Administra los enlaces externos oficiales de Noveli para marketplaces y plataformas.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-150 dark:border-slate-800 text-slate-400 font-bold">
                      <th className="py-2.5">Título</th>
                      <th className="py-2.5">Plataforma</th>
                      <th className="py-2.5">Enlace</th>
                      <th className="py-2.5 text-center">Destacado</th>
                      <th className="py-2.5 text-center">Activo</th>
                      <th className="py-2.5 text-center">En Web</th>
                      <th className="py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-855">
                    {links.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                        <td className="py-3 font-bold text-slate-750 dark:text-slate-200">{l.title}</td>
                        <td className="py-3"><span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 rounded font-bold text-[9px] uppercase tracking-wider">{l.platform}</span></td>
                        <td className="py-3 font-mono text-[10px] text-slate-400 truncate max-w-[150px]"><a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">{l.url} <ExternalLink className="w-2.5 h-2.5" /></a></td>
                        {/* Destacado */}
                        <td className="py-3 text-center">
                          <button type="button" onClick={() => toggleLinkBoolean(l, 'featured')} className="focus:outline-none bg-transparent border border-transparent cursor-pointer">
                            <Star className={`w-4 h-4 ${l.featured ? 'text-amber-500 fill-amber-500' : 'text-slate-350'}`} />
                          </button>
                        </td>
                        {/* Activo */}
                        <td className="py-3 text-center">
                          <button type="button" onClick={() => toggleLinkBoolean(l, 'active')} className="focus:outline-none bg-transparent border border-transparent cursor-pointer">
                            {l.active ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <EyeOff className="w-4 h-4 text-slate-400 mx-auto" />}
                          </button>
                        </td>
                        {/* visible_on_website */}
                        <td className="py-3 text-center">
                          <button type="button" onClick={() => toggleLinkBoolean(l, 'visible_on_website')} className="focus:outline-none bg-transparent border border-transparent cursor-pointer">
                            {l.visible_on_website !== false ? (
                              <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border border-emerald-100 rounded text-[9px] font-bold">visible</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-950/10 text-slate-500 border border-slate-200 rounded text-[9px] font-bold">oculto</span>
                            )}
                          </button>
                        </td>
                        <td className="py-3 text-right space-x-1.5">
                          <button onClick={() => startEditLink(l)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-450 rounded border border-transparent bg-transparent cursor-pointer inline-flex items-center"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteLink(l.id)} className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-455 rounded border border-transparent bg-transparent cursor-pointer inline-flex items-center"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
              <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">
                {editingLink ? 'Editar Enlace' : 'Agregar Enlace'}
              </h3>
              <form onSubmit={handleSaveLink} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Título Visible</label>
                  <input type="text" required placeholder="Ej. Tienda Amazon" value={linkTitle} onChange={e => setLinkTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Plataforma</label>
                  <select value={linkPlatform} onChange={e => setLinkPlatform(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent">
                    <option value="Amazon">Amazon</option>
                    <option value="Buscalibre">Buscalibre</option>
                    <option value="Wattpad">Wattpad</option>
                    <option value="Página del autor">Página del autor</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Enlace URL</label>
                  <input type="url" required placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono" />
                </div>
                
                <div className="flex gap-4 py-1.5">
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer">
                    <input type="checkbox" checked={linkFeatured} onChange={e => setLinkFeatured(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                    <span>Destacado</span>
                  </label>
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer">
                    <input type="checkbox" checked={linkVisible} onChange={e => setLinkVisible(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                    <span>Visible en Web</span>
                  </label>
                </div>

                <button type="submit" disabled={isReadOnly} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" />
                  <span>Guardar Enlace</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ------------------ SUB-VIEW: TEXTOS (website_sections) ------------------ */}
      {currentPath === 'textos' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigateTo('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Textos Principales de la Página</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">Administra los textos principales de la página: Hero title, Sobre Nosotros, Contacto, etc.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {sections.map((sec) => (
                <div key={sec.id} className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-100 rounded text-[9px] font-bold uppercase font-mono tracking-wider">{sec.section_key}</span>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 mt-1.5">{sec.title || 'Bloque sin título'}</h4>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {/* Active */}
                      <button type="button" onClick={() => toggleSectionBoolean(sec, 'active')} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-transparent bg-transparent cursor-pointer">
                        {sec.active ? <Check className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                      </button>
                      {/* visible_on_website */}
                      <button type="button" onClick={() => toggleSectionBoolean(sec, 'visible_on_website')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-transparent bg-transparent cursor-pointer">
                        {sec.visible_on_website !== false ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-350" />}
                      </button>
                      
                      <button onClick={() => startEditSection(sec)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600 rounded border border-transparent bg-transparent cursor-pointer"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteSection(sec.id)} className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 rounded border border-transparent bg-transparent cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">{sec.content}</p>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
              <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">{editingSection ? 'Editar Texto' : 'Nuevo Bloque de Texto'}</h3>
              <form onSubmit={handleSaveSection} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Llave de Sección</label>
                  <select value={sectionKey} onChange={e => setSectionKey(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent">
                    <option value="hero">Hero (Encabezado principal)</option>
                    <option value="about">About (Sobre nosotros)</option>
                    <option value="contact">Contact (Contacto oficial)</option>
                    <option value="custom">Custom (Sección personalizada)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Título de Sección</label>
                  <input type="text" required placeholder="Ej. Sobre Nosotros" value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Contenido de Sección</label>
                  <textarea required placeholder="Escribe el cuerpo de texto que consumirá la web pública..." value={sectionContent} onChange={e => setSectionContent(e.target.value)} rows={5} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>

                <div className="flex gap-4 py-1.5">
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer">
                    <input type="checkbox" checked={sectionFeatured} onChange={e => setSectionFeatured(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                    <span>Destacado</span>
                  </label>
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer">
                    <input type="checkbox" checked={sectionVisible} onChange={e => setSectionVisible(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                    <span>Visible en la web</span>
                  </label>
                </div>

                <button type="submit" disabled={isReadOnly} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" />
                  <span>Guardar Sección</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
