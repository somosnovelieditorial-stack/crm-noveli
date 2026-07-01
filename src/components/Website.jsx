import React, { useState, useEffect } from 'react';
import { supabase, isMock } from '../supabaseClient';
import { 
  Globe, ArrowUpRight, ShieldCheck, Cpu, Layout, Server, ExternalLink, 
  Activity, ArrowLeft, Plus, Check, Eye, EyeOff, Edit, Trash2, Link, 
  BookOpen, Heart, ShoppingBag, ArrowUp, ArrowDown, Star, AlertTriangle, 
  Upload, Copy, Save, ExternalLink as ExtIcon
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

const DEFAULT_WEB_BOOKS = [
  { id: 'wb-1', title: 'El Eco de los Sauces', author: 'Clara Del Monte', genre: 'Novela Histórica', status: 'Destacado', cover_url: '', short_description: 'Una fascinante novela sobre secretos familiares en el sur de Chile.', featured: true, sale_url: 'https://amazon.com', sale_platform: 'Amazon', active: true, display_order: 1 },
  { id: 'wb-2', title: 'Cenizas de Neón', author: 'Julio Rivera', genre: 'Ciencia Ficción', status: 'Novedad', cover_url: '', short_description: 'Un futuro distópico donde los recuerdos son la moneda de cambio.', featured: true, sale_url: 'https://wattpad.com', sale_platform: 'Wattpad', active: true, display_order: 2 },
  { id: 'wb-3', title: 'Bajo la Sombra del Alerce', author: 'Marta Valdivia', genre: 'Poesía', status: 'Preventa', cover_url: '', short_description: 'Versos inspirados en los bosques milenarios y el paso del tiempo.', featured: false, sale_url: '', sale_platform: 'Amazon', active: false, display_order: 3 },
];

export default function Website({ isReadOnly, initialPath = 'dashboard', onChangePath }) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [services, setServices] = useState([]);
  const [books, setBooks] = useState([]);
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

  // Service Form states
  const [editingService, setEditingService] = useState(null);
  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceShortDesc, setServiceShortDesc] = useState('');
  const [serviceFullDesc, setServiceFullDesc] = useState('');
  const [servicePrice, setServicePrice] = useState('0');
  const [serviceCategory, setServiceCategory] = useState('Editorial');
  const [serviceFeatured, setServiceFeatured] = useState(false);

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

  // Clipboard feedbacks
  const [domainCopied, setDomainCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    setCurrentPath(initialPath);
  }, [initialPath]);

  useEffect(() => {
    fetchServices();
    fetchBooks();
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
      } else {
        // Empty table, insert defaults
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

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'domain') {
      setDomainCopied(true);
      setTimeout(() => setDomainCopied(false), 2000);
    } else {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }
  };

  // --- SERVICE PERSISTENCE ---
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

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!serviceTitle.trim()) return;

    setLoading(true);
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const parsedPrice = parseFloat(servicePrice) || 0;

      if (editingService) {
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

  const moveOrder = async (index, direction) => {
    if (isReadOnly) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= services.length) return;

    const list = [...services];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const updatedList = list.map((item, idx) => ({
      ...item,
      display_order: idx + 1
    }));

    setServices(updatedList);

    try {
      if (isMock || usingMockDb) {
        localStorage.setItem('somos_noveli_website_services', JSON.stringify(updatedList));
      } else {
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
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn("Table website_books query failed, falling back to local memory storage:", error.message);
        loadMockBooks();
      } else {
        if (data && data.length > 0) {
          setBooks(data);
        } else {
          await seedDefaultBooks();
        }
      }
    } catch (err) {
      console.error("Exception loading website books:", err);
      loadMockBooks();
    }
  };

  const loadMockBooks = () => {
    const saved = localStorage.getItem('somos_noveli_website_books');
    if (saved) {
      try {
        setBooks(JSON.parse(saved));
      } catch (_) {
        setBooks(DEFAULT_WEB_BOOKS);
        localStorage.setItem('somos_noveli_website_books', JSON.stringify(DEFAULT_WEB_BOOKS));
      }
    } else {
      setBooks(DEFAULT_WEB_BOOKS);
      localStorage.setItem('somos_noveli_website_books', JSON.stringify(DEFAULT_WEB_BOOKS));
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
        display_order: b.display_order,
        organization_id: orgId
      }));

      const { data, error } = await supabase
        .from('website_books')
        .insert(booksToInsert)
        .select();

      if (!error && data) {
        setBooks(data);
      } else {
        setBooks(DEFAULT_WEB_BOOKS);
      }
    } catch (_) {
      setBooks(DEFAULT_WEB_BOOKS);
    }
  };

  const handleSaveBook = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!bookTitle.trim() || !bookAuthor.trim()) return;

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
        organization_id: orgId
      };

      if (editingBook) {
        if (isMock || usingMockDb || !supabase) {
          const updated = books.map(b => b.id === editingBook.id ? { ...b, ...payload } : b);
          setBooks(updated);
          localStorage.setItem('somos_noveli_website_books', JSON.stringify(updated));
        } else {
          const { error } = await supabase
            .from('website_books')
            .update(payload)
            .eq('id', editingBook.id);
          if (error) throw error;
        }
        alert("Libro actualizado correctamente.");
      } else {
        const newOrder = books.length > 0 ? Math.max(...books.map(b => b.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, display_order: newOrder };

        if (isMock || usingMockDb || !supabase) {
          const newB = { ...insertPayload, id: `wb-${Date.now()}` };
          const updated = [...books, newB];
          setBooks(updated);
          localStorage.setItem('somos_noveli_website_books', JSON.stringify(updated));
        } else {
          const { error } = await supabase
            .from('website_books')
            .insert([insertPayload]);
          if (error) throw error;
        }
        alert("Libro destacado correctamente.");
      }

      resetBookForm();
      await fetchBooks();
    } catch (err) {
      console.error("Error saving book:", err);
      alert(`Error al guardar: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const startEditBook = (book) => {
    setEditingBook(book);
    setBookTitle(book.title || '');
    setBookAuthor(book.author || '');
    setBookGenre(book.genre || '');
    setBookStatus(book.status || 'Destacado');
    setBookShortDesc(book.short_description || '');
    setBookCoverUrl(book.cover_url || '');
    setBookSaleUrl(book.sale_url || '');
    setBookSalePlatform(book.sale_platform || 'Amazon');
    setBookFeatured(!!book.featured);
    setBookActive(!!book.active);
  };

  const resetBookForm = () => {
    setEditingBook(null);
    setBookTitle('');
    setBookAuthor('');
    setBookGenre('');
    setBookStatus('Destacado');
    setBookShortDesc('');
    setBookCoverUrl('');
    setBookSaleUrl('');
    setBookSalePlatform('Amazon');
    setBookFeatured(false);
    setBookActive(true);
  };

  const toggleBookActive = async (book) => {
    if (isReadOnly) return;
    const updatedStatus = !book.active;

    try {
      if (isMock || usingMockDb || !supabase) {
        const updated = books.map(b => b.id === book.id ? { ...b, active: updatedStatus } : b);
        setBooks(updated);
        localStorage.setItem('somos_noveli_website_books', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('website_books')
          .update({ active: updatedStatus })
          .eq('id', book.id);
        if (error) throw error;
      }
      setBooks(books.map(b => b.id === book.id ? { ...b, active: updatedStatus } : b));
    } catch (err) {
      console.error("Error toggling book active:", err);
    }
  };

  const toggleBookFeatured = async (book) => {
    if (isReadOnly) return;
    const updatedStatus = !book.featured;

    try {
      if (isMock || usingMockDb || !supabase) {
        const updated = books.map(b => b.id === book.id ? { ...b, featured: updatedStatus } : b);
        setBooks(updated);
        localStorage.setItem('somos_noveli_website_books', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('website_books')
          .update({ featured: updatedStatus })
          .eq('id', book.id);
        if (error) throw error;
      }
      setBooks(books.map(b => b.id === book.id ? { ...b, featured: updatedStatus } : b));
    } catch (err) {
      console.error("Error toggling book featured:", err);
    }
  };

  const handleUploadCover = async (e, bookId) => {
    const file = e.target.files[0];
    if (!file) return;
    if (isReadOnly) return;

    setLoading(true);
    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_cover.${fileExt}`;
      const storagePath = `${orgId}/website/covers/${fileName}`;

      let finalUrl = '';
      if (isMock || usingMockDb || !supabase) {
        finalUrl = `mock://covers/${storagePath}`;
      } else {
        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, file, { upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from('documents')
          .getPublicUrl(storagePath);
        
        finalUrl = publicUrlData?.publicUrl || '';
      }

      if (bookId) {
        if (isMock || usingMockDb || !supabase) {
          const updated = books.map(b => b.id === bookId ? { ...b, cover_url: finalUrl } : b);
          setBooks(updated);
          localStorage.setItem('somos_noveli_website_books', JSON.stringify(updated));
        } else {
          const { error } = await supabase
            .from('website_books')
            .update({ cover_url: finalUrl })
            .eq('id', bookId);
          if (error) throw error;
        }
        await fetchBooks();
        alert("Portada subida y actualizada con éxito.");
      } else {
        setBookCoverUrl(finalUrl);
        alert("Portada subida correctamente. Pulsa guardar para aplicar los cambios.");
      }
    } catch (err) {
      console.error("Error uploading cover:", err);
      alert(`Error al subir imagen: ${err.message || err}`);
    } finally {
      setLoading(false);
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
              {currentPath === 'servicios' ? 'Servicios Editoriales' : currentPath === 'libros' ? 'Libros Destacados' : 'Dominio y Vista Previa'}
            </span>
          </>
        )}
      </div>

      {/* Warning Badge for SQL / Mock Mode */}
      {usingMockDb && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Modo Respaldo Local:</strong> Tablas SQL no detectadas en Supabase. Se han cargado datos locales configurables. Ejecuta los archivos de migración SQL para habilitar almacenamiento persistente.
          </span>
        </div>
      )}

      {/* ------------------ MAIN VIEW: DASHBOARD ------------------ */}
      {currentPath === 'dashboard' && (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-855 dark:text-slate-100 tracking-tight font-serif">
                Sitio Web Noveli
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-sans">
                Configura y administra los contenidos del catálogo, servicios y hosting que se muestran al público.
              </p>
            </div>
            
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer w-fit shrink-0 border border-transparent"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Abrir sitio web</span>
            </a>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. Dominio y Vista Previa */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl w-fit">
                  <Layout className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Dominio y Preview</h3>
                <p className="text-xs text-slate-450 dark:text-slate-400 leading-relaxed">
                  Configura los DNS, dominios comprados y visualiza el sitio público en tiempo real con el panel de previsualización.
                </p>
                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 p-2 rounded-lg border border-slate-100 dark:border-slate-855 truncate">
                  {domain}
                </div>
              </div>
              <button
                onClick={() => navigateTo('dominio')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Dominio y Vista Previa</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 2. Servicios Editoriales */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-455 rounded-xl w-fit">
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
                onClick={() => navigateTo('servicios')}
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
                  <span>{books.length} libros cargados ({books.filter(b => b.active).length} activos)</span>
                </div>
              </div>
              <button
                onClick={() => navigateTo('libros')}
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
                onClick={() => navigateTo('libros')}
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
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{domain}</span>
                </div>
                
                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-850">
                  <span className="text-slate-400 font-medium">Hosting</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{hostingProvider}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-850">
                  <span className="text-slate-400 font-medium">Proveedor DNS</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{domainProvider}</span>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400 font-medium">Estado</span>
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 border rounded text-[10px] font-bold uppercase ${
                    domainStatus === 'conectado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/40' :
                    domainStatus === 'pendiente' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/40' :
                    'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/40'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${domainStatus === 'conectado' ? 'bg-emerald-500 animate-pulse' : domainStatus === 'pendiente' ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                    {domainStatus}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      {/* ------------------ SUB-VIEW: DOMINIO Y PREVIEW ------------------ */}
      {currentPath === 'dominio' && (
        <div className="space-y-6">
          {/* Header & Back Button */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => navigateTo('dashboard')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Dominio y Vista Previa</h2>
                <p className="text-xs text-slate-400 mt-0.5">Controla la infraestructura de red, dominios oficiales y previsualiza la web pública.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Domain Configuration Form (Left, 5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-5 h-fit">
              <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm flex items-center gap-2">
                <Server className="w-4.5 h-4.5 text-blue-500" />
                Ajustes de Dominio y Hosting
              </h3>

              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Dominio Principal</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="somosnovelieditorial.com"
                      value={domain}
                      onChange={e => setDomain(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(domain, 'domain')}
                      className="px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 flex items-center justify-center shrink-0 cursor-pointer"
                      title="Copiar Dominio"
                    >
                      {domainCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Dominio con WWW</label>
                  <input
                    type="text"
                    placeholder="www.somosnovelieditorial.com"
                    value={wwDomain}
                    onChange={e => setWwDomain(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">URL Pública Actual</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      required
                      placeholder="https://www.somosnovelieditorial.com/"
                      value={publicUrl}
                      onChange={e => setPublicUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(publicUrl, 'url')}
                      className="px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 flex items-center justify-center shrink-0 cursor-pointer"
                      title="Copiar URL Pública"
                    >
                      {urlCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">URL Vista Previa Vercel (Opcional)</label>
                  <input
                    type="url"
                    placeholder="https://somosnoveli-git-preview.vercel.app"
                    value={vercelPreviewUrl}
                    onChange={e => setVercelPreviewUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Proveedor de Dominio</label>
                    <input
                      type="text"
                      placeholder="Ej. Google Domains, GoDaddy"
                      value={domainProvider}
                      onChange={e => setDomainProvider(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Hosting</label>
                    <input
                      type="text"
                      placeholder="Vercel"
                      value={hostingProvider}
                      onChange={e => setHostingProvider(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Estado del Dominio</label>
                  <select
                    value={domainStatus}
                    onChange={e => setDomainStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  >
                    <option value="conectado">Conectado / Activo</option>
                    <option value="pendiente">Pendiente de verificación</option>
                    <option value="revisar DNS">Revisar DNS</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Notas DNS / Configuración</label>
                  <textarea
                    placeholder="Instrucciones para apuntar registros A y CNAME..."
                    value={dnsNotes}
                    onChange={e => setDnsNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-transparent text-xs text-slate-800 dark:text-slate-100 font-mono text-[10px]"
                  />
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

            {/* Preview Panel (Right, 7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs flex flex-col space-y-4 justify-between h-[600px]">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm flex items-center gap-2">
                  <Globe className="w-4.5 h-4.5 text-emerald-500 animate-pulse" />
                  Vista Previa del Sitio
                </h3>
                
                <div className="flex gap-2">
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <span>Sitio Público</span>
                    <ExtIcon className="w-3 h-3" />
                  </a>

                  {vercelPreviewUrl && (
                    <a
                      href={vercelPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 border border-purple-100 dark:border-purple-900/40 cursor-pointer"
                    >
                      <span>Vercel Preview</span>
                      <ExtIcon className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Browser Window Mock */}
              <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950/40 relative">
                
                {/* Header Mock */}
                <div className="h-9 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center gap-3 shrink-0">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-455"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-455"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-455"></span>
                  </div>
                  <div className="flex-1 bg-white dark:bg-slate-950 rounded px-2.5 py-0.5 text-[10px] text-slate-400 font-mono flex items-center gap-1 justify-center truncate">
                    <ShieldCheck className="w-3 h-3 text-emerald-500 inline shrink-0" />
                    <span>{publicUrl}</span>
                  </div>
                </div>

                {/* Content/Iframe */}
                <div className="flex-1 relative flex flex-col justify-center items-center">
                  
                  {/* Real Iframe */}
                  <iframe 
                    src={publicUrl}
                    title="Sitio Noveli Vista Previa"
                    className="w-full h-full border-none z-10 bg-white"
                  />

                  {/* Fallback Overlay for X-Frame-Options block */}
                  <div className="absolute inset-0 bg-slate-50/95 dark:bg-slate-900/95 z-0 flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-450 border border-blue-100 dark:border-blue-900 rounded-2xl w-fit">
                      <Globe className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Vista previa embebida activada</p>
                      <p className="text-[11px] text-slate-450 dark:text-slate-400 max-w-sm">
                        Si tu navegador bloquea la previsualización directa por políticas de seguridad contra secuestro de clics (X-Frame-Options), por favor usa el botón de abajo.
                      </p>
                    </div>

                    <a 
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 border border-transparent cursor-pointer"
                    >
                      <span>No se puede previsualizar aquí. Abrir en nueva pestaña.</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                </div>

              </div>

              {/* Tips Footer */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] text-slate-450 leading-relaxed flex gap-2">
                <InfoIcon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Tip de Seguridad:</strong> Vercel bloquea por defecto iframes de dominios externos no verificados. Al guardar la URL oficial en esta pantalla, se actualizan las cabeceras de previsualización en la CDN del sitio público.
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ------------------ SUB-VIEW: SERVICIOS ------------------ */}
      {currentPath === 'servicios' && (
        <div className="space-y-6">
          {/* Header & Back Button */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => navigateTo('dashboard')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-855 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Servicios Web Públicos</h2>
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
                onClick={() => navigateTo('dashboard')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-855 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Catálogo de Libros en la Web</h2>
                <p className="text-xs text-slate-400 mt-0.5">Controla las portadas, novedades y enlaces de venta en la web de Noveli.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* List & Links Editor */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Libros Publicados</h3>
              
              {books.map(b => (
                <div 
                  key={b.id} 
                  className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-start gap-4"
                >
                  <div className="w-20 h-28 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col items-center justify-center text-center overflow-hidden shrink-0 relative group">
                    {b.cover_url ? (
                      <img 
                        src={b.cover_url.startsWith('mock://') ? `https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=100&auto=format&fit=crop&q=60` : b.cover_url} 
                        alt="Portada" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <BookOpen className="w-7 h-7 text-slate-300 dark:text-slate-700" />
                    )}
                    
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[9px] font-bold cursor-pointer transition-opacity">
                      <Upload className="w-4 h-4 mb-1" />
                      <span>Subir foto</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        disabled={isReadOnly}
                        onChange={(e) => handleUploadCover(e, b.id)}
                        className="hidden" 
                      />
                    </label>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{b.title}</h4>
                          <span className="px-2.5 py-0.5 bg-purple-550/10 text-purple-655 dark:text-purple-400 rounded text-[9px] font-bold">
                            {b.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Autor: {b.author} • Género: {b.genre}</p>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => toggleBookFeatured(b)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all cursor-pointer border border-transparent bg-transparent"
                          title={b.featured ? 'Desmarcar de Inicio' : 'Destacar en Inicio'}
                        >
                          <Star className={`w-4 h-4 ${b.featured ? 'text-amber-500 fill-amber-500' : 'text-slate-350 dark:text-slate-700'}`} />
                        </button>
                        
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => toggleBookActive(b)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all cursor-pointer border border-transparent bg-transparent"
                          title={b.active ? 'Ocultar de la Web' : 'Mostrar en la Web'}
                        >
                          {b.active ? (
                            <Eye className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => startEditBook(b)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all cursor-pointer border border-transparent bg-transparent text-slate-400 hover:text-amber-600"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
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

                    {b.short_description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                        "{b.short_description}"
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-50 dark:border-slate-855 flex items-center justify-between text-[11px] text-slate-450">
                      <span className="font-semibold">Plataforma de Venta:</span>
                      {b.sale_url ? (
                        <a 
                          href={b.sale_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-amber-600 hover:underline font-bold"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>{b.sale_platform} (Comprar / Leer)</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">Sin enlace configurado</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add / Edit Book Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">
                  {editingBook ? 'Editar Libro Web' : 'Destacar Libro Web'}
                </h3>
                {editingBook && (
                  <button 
                    onClick={resetBookForm}
                    className="text-[10px] font-bold text-amber-600 hover:underline border border-transparent bg-transparent cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              
              <form onSubmit={handleSaveBook} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Título del Libro</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. El Canto del Cisne"
                    value={bookTitle}
                    onChange={e => setBookTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Autor</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Gabriel Fuentes"
                    value={bookAuthor}
                    onChange={e => setBookAuthor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Género</label>
                    <input
                      type="text"
                      placeholder="Ej. Poesía"
                      value={bookGenre}
                      onChange={e => setBookGenre(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Estado / Etiqueta</label>
                    <select
                      value={bookStatus}
                      onChange={e => setBookStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value="Destacado">Destacado</option>
                      <option value="Novedad">Novedad</option>
                      <option value="Preventa">Preventa</option>
                      <option value="Lanzamiento">Lanzamiento</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Imagen de Portada</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="URL de imagen..."
                      value={bookCoverUrl}
                      onChange={e => setBookCoverUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent text-xs text-slate-800 dark:text-slate-100 font-mono"
                    />
                    <label className="px-3 py-2 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/85 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        disabled={isReadOnly}
                        onChange={(e) => handleUploadCover(e)}
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Reseña o Descripción</label>
                  <textarea
                    placeholder="Escribe una pequeña sinopsis para los lectores..."
                    value={bookShortDesc}
                    onChange={e => setBookShortDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Plataforma</label>
                    <select
                      value={bookSalePlatform}
                      onChange={e => setBookSalePlatform(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value="Amazon">Amazon</option>
                      <option value="Buscalibre">Buscalibre</option>
                      <option value="Wattpad">Wattpad</option>
                      <option value="Página del autor">Página del autor</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Enlace de Venta / Lectura</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={bookSaleUrl}
                      onChange={e => setBookSaleUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent text-xs text-slate-800 dark:text-slate-100 font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-4 py-1">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="bookFeatured"
                      checked={bookFeatured}
                      onChange={e => setBookFeatured(e.target.checked)}
                      className="rounded border-slate-300 text-purple-500 focus:ring-purple-500 h-4 w-4"
                    />
                    <label htmlFor="bookFeatured" className="text-slate-655 dark:text-slate-350 font-bold cursor-pointer select-none">
                      Destacado
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="bookActive"
                      checked={bookActive}
                      onChange={e => setBookActive(e.target.checked)}
                      className="rounded border-slate-300 text-purple-500 focus:ring-purple-500 h-4 w-4"
                    />
                    <label htmlFor="bookActive" className="text-slate-655 dark:text-slate-350 font-bold cursor-pointer select-none">
                      Activo / Visible
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isReadOnly}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-1.5 border border-transparent"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingBook ? 'Actualizar Libro' : 'Destacar Libro'}</span>
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

function InfoIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
