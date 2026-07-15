import React, { useState, useEffect } from 'react';
import { supabase, isMock } from '../supabaseClient';
import { 
  Globe, ArrowUpRight, ShieldCheck, Cpu, Layout, Server, ExternalLink, 
  Activity, ArrowLeft, Plus, Check, Eye, EyeOff, Edit, Trash2, Link as LinkIcon, 
  BookOpen, Heart, ShoppingBag, ArrowUp, ArrowDown, Star, AlertTriangle, 
  Upload, Copy, Save, FileText, Settings, AlignLeft, Info, UserCheck, Mail, Phone, Calendar, X
} from 'lucide-react';
import { formatCurrency } from '../utils';

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

// Fallback values
const DEFAULT_SITE_SETTINGS = {
  site_name: 'Somos Noveli Editorial',
  public_url: 'https://www.somosnovelieditorial.com/',
  short_description: 'Editorial independiente enfocada en la publicación digital y física de autores independientes.',
  contact_email: 'contacto@somosnovelieditorial.com',
  instagram_url: 'https://instagram.com/somosnovelieditorial',
  hero_title: 'Somos Noveli Editorial',
  hero_subtitle: 'Tu historia merece ser contada de la manera más hermosa.',
  logo_url: '',
  favicon_url: '',
  active: true
};

const DEFAULT_WEB_SERVICES = [
  { title: 'Full eBook', category: 'Digitalización', price_from: 80000, short_description: 'Publicación completa de tu eBook en plataformas globales', featured: true, visible_on_website: true, active: true, display_order: 1 },
  { title: 'Full Físico', category: 'Producción', price_from: 250000, short_description: 'Edición e impresión física de tu obra literaria', featured: true, visible_on_website: true, active: true, display_order: 2 },
  { title: 'Full Total', category: 'Producción', price_from: 450000, short_description: 'El pack definitivo: eBook, libro físico, tapa blanda e ilustración', featured: true, visible_on_website: true, active: true, display_order: 3 },
  { title: 'Corrección', category: 'Editorial', price_from: 2500, short_description: 'Corrección de estilo, gramática y ortografía profesional', featured: false, visible_on_website: true, active: true, display_order: 4 },
  { title: 'Portada', category: 'Diseño', price_from: 120000, short_description: 'Diseño de portada personalizado y adaptado al género', featured: false, visible_on_website: true, active: true, display_order: 5 },
  { title: 'Maquetación', category: 'Editorial', price_from: 90000, short_description: 'Maquetación interior profesional para impresión y digital', featured: false, visible_on_website: true, active: true, display_order: 6 },
  { title: 'Difusión Editorial', category: 'Marketing', price_from: 150000, short_description: 'Campañas de marketing, notas de prensa y difusión', featured: false, visible_on_website: true, active: true, display_order: 7 },
  { title: 'Registro de Derechos de Autor', category: 'Legal', price_from: 50000, short_description: 'Gestión legal de registro de propiedad intelectual', featured: false, visible_on_website: true, active: true, display_order: 8 }
];

const DEFAULT_WEB_BOOKS = [
  { title: 'El Eco de los Sauces', author: 'Clara Del Monte', genre: 'Novela Histórica', status: 'Destacado', cover_url: '', short_description: 'Una fascinante novela sobre secretos familiares en el sur de Chile.', featured: true, visible_on_website: true, sale_url: 'https://amazon.com', sale_platform: 'Amazon', display_order: 1 },
  { title: 'Cenizas de Neón', author: 'Julio Rivera', genre: 'Ciencia Ficción', status: 'Novedad', cover_url: '', short_description: 'Un futuro distópico donde los recuerdos son la moneda de cambio.', featured: true, visible_on_website: true, sale_url: 'https://wattpad.com', sale_platform: 'Wattpad', display_order: 2 }
];

const DEFAULT_WEB_LINKS = [
  { label: 'Amazon Oficial', url: 'https://www.amazon.com', link_type: 'compra', active: true, display_order: 1 },
  { label: 'Buscalibre Chile', url: 'https://www.buscalibre.cl', link_type: 'compra', active: true, display_order: 2 },
  { label: 'Wattpad Noveli', url: 'https://www.wattpad.com', link_type: 'lectura', active: true, display_order: 3 }
];

const DEFAULT_WEB_SECTIONS = [
  { section_key: 'inicio', title: 'Somos Noveli Editorial', subtitle: 'Tu historia merece ser contada', content: 'Creamos puentes entre autores y lectores. Tu historia merece ser contada de la manera más hermosa.', active: true, display_order: 1 },
  { section_key: 'nosotros', title: 'Sobre Nosotros', subtitle: 'Nuestra vocación', content: 'Noveli Editorial nació con la vocación de simplificar y dignificar el proceso de autopublicación. Ayudamos a autores independientes a maquetar, corregir, diseñar y distribuir sus libros a nivel global con calidad profesional.', active: true, display_order: 2 },
  { section_key: 'contacto', title: 'Ponte en contacto', subtitle: 'Hablemos hoy', content: '¿Tienes un manuscrito listo? Escríbenos a contacto@somosnovelieditorial.com o búscanos en redes sociales.', active: true, display_order: 3 }
];

export default function Website({ isReadOnly, initialPath = 'dashboard', onChangePath, realtimeTrigger }) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [loading, setLoading] = useState(false);
  const [usingMockDb, setUsingMockDb] = useState(false);

  // States for lists
  const [services, setServices] = useState([]);
  const [books, setBooks] = useState([]);
  const [links, setLinks] = useState([]);
  const [sections, setSections] = useState([]);
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [leadsFilter, setLeadsFilter] = useState('todos');

  // 1. Configuración Web states
  const [configId, setConfigId] = useState(null);
  const [siteName, setSiteName] = useState(DEFAULT_SITE_SETTINGS.site_name);
  const [publicUrl, setPublicUrl] = useState(DEFAULT_SITE_SETTINGS.public_url);
  const [shortDesc, setShortDesc] = useState(DEFAULT_SITE_SETTINGS.short_description);
  const [contactEmail, setContactEmail] = useState(DEFAULT_SITE_SETTINGS.contact_email);
  const [instagramUrl, setInstagramUrl] = useState(DEFAULT_SITE_SETTINGS.instagram_url);
  const [heroTitle, setHeroTitle] = useState(DEFAULT_SITE_SETTINGS.hero_title);
  const [heroSubtitle, setHeroSubtitle] = useState(DEFAULT_SITE_SETTINGS.hero_subtitle);
  const [logoUrl, setLogoUrl] = useState(DEFAULT_SITE_SETTINGS.logo_url);
  const [faviconUrl, setFaviconUrl] = useState(DEFAULT_SITE_SETTINGS.favicon_url);
  const [configActive, setConfigActive] = useState(DEFAULT_SITE_SETTINGS.active);

  // 2. Servicios Form states
  const [editingService, setEditingService] = useState(null);
  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceShortDesc, setServiceShortDesc] = useState('');
  const [serviceFullDesc, setServiceFullDesc] = useState('');
  const [servicePrice, setServicePrice] = useState('0');
  const [serviceCategory, setServiceCategory] = useState('Editorial');
  const [serviceFeatured, setServiceFeatured] = useState(false);
  const [serviceVisible, setServiceVisible] = useState(true);
  const [serviceActive, setServiceActive] = useState(true);

  // 3. Libros Form states
  const [editingBook, setEditingBook] = useState(null);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookCoverUrl, setBookCoverUrl] = useState('');
  const [bookShortDesc, setBookShortDesc] = useState('');
  const [bookGenre, setBookGenre] = useState('');
  const [bookStatus, setBookStatus] = useState('Destacado');
  const [bookFeatured, setBookFeatured] = useState(false);
  const [bookVisible, setBookVisible] = useState(true);
  const [bookSaleUrl, setBookSaleUrl] = useState('');
  const [bookSalePlatform, setBookSalePlatform] = useState('Amazon');

  // 4. Enlaces Form states
  const [editingLink, setEditingLink] = useState(null);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkType, setLinkType] = useState('compra'); // compra, lectura, autor, red social, otro
  const [linkActive, setLinkActive] = useState(true);

  // 5. Secciones Form states
  const [editingSection, setEditingSection] = useState(null);
  const [sectionKey, setSectionKey] = useState('inicio'); // inicio, servicios, libros, contacto, nosotros
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionSubtitle, setSectionSubtitle] = useState('');
  const [sectionContent, setSectionContent] = useState('');
  const [sectionImageUrl, setSectionImageUrl] = useState('');
  const [sectionActive, setSectionActive] = useState(true);

  // Copy feedbacks
  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    setCurrentPath(initialPath);
  }, [initialPath]);

  useEffect(() => {
    fetchSettings();
    fetchServices();
    fetchBooks();
    fetchLinks();
    fetchSections();
    fetchLeads();
  }, [realtimeTrigger]);

  const navigateTo = (path) => {
    setCurrentPath(path);
    if (onChangePath) {
      onChangePath(path);
    }
  };

  // Helper to read organization ID
  const getOrgId = () => {
    return localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
  };

  // --- 1. SETTINGS DATABASE OPS ---
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
        console.warn("Table website_settings query failed, using local fallback settings:", error.message);
        loadMockSettings();
        setUsingMockDb(true);
      } else if (data && data.length > 0) {
        const row = data[0];
        setConfigId(row.id);
        setSiteName(row.site_name || DEFAULT_SITE_SETTINGS.site_name);
        setPublicUrl(row.public_url || DEFAULT_SITE_SETTINGS.public_url);
        setShortDesc(row.short_description || '');
        setContactEmail(row.contact_email || '');
        setInstagramUrl(row.instagram_url || '');
        setHeroTitle(row.hero_title || '');
        setHeroSubtitle(row.hero_subtitle || '');
        setLogoUrl(row.logo_url || '');
        setFaviconUrl(row.favicon_url || '');
        setConfigActive(row.active !== false);
      } else {
        await seedDefaultSettings();
      }
    } catch (err) {
      console.error(err);
      loadMockSettings();
      setUsingMockDb(true);
    }
  };

  const loadMockSettings = () => {
    const saved = localStorage.getItem('somos_noveli_website_settings_cms');
    if (saved) {
      try {
        const row = JSON.parse(saved);
        setSiteName(row.site_name);
        setPublicUrl(row.public_url);
        setShortDesc(row.short_description);
        setContactEmail(row.contact_email);
        setInstagramUrl(row.instagram_url);
        setHeroTitle(row.hero_title);
        setHeroSubtitle(row.hero_subtitle);
        setLogoUrl(row.logo_url);
        setFaviconUrl(row.favicon_url);
        setConfigActive(row.active);
      } catch (_) {}
    }
  };

  const seedDefaultSettings = async () => {
    try {
      const payload = {
        organization_id: getOrgId(),
        ...DEFAULT_SITE_SETTINGS
      };
      const { data, error } = await supabase
        .from('website_settings')
        .insert([payload])
        .select();
      if (!error && data && data.length > 0) {
        setConfigId(data[0].id);
      }
    } catch (_) {}
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    try {
      const payload = {
        site_name: siteName,
        public_url: publicUrl,
        short_description: shortDesc,
        contact_email: contactEmail,
        instagram_url: instagramUrl,
        hero_title: heroTitle,
        hero_subtitle: heroSubtitle,
        logo_url: logoUrl,
        favicon_url: faviconUrl,
        active: configActive,
        organization_id: getOrgId()
      };

      if (isMock || usingMockDb || !supabase) {
        localStorage.setItem('somos_noveli_website_settings_cms', JSON.stringify(payload));
        alert("Configuración de sitio guardada en memoria local.");
      } else {
        if (configId) {
          const { error } = await supabase
            .from('website_settings')
            .update(payload)
            .eq('id', configId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('website_settings')
            .insert([payload])
            .select();
          if (error) throw error;
          if (data && data.length > 0) setConfigId(data[0].id);
        }
        alert("Configuración web guardada correctamente en Supabase.");
      }
      await fetchSettings();
    } catch (err) {
      alert(`Error al guardar configuración: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. SERVICIOS DATABASE OPS ---
  const fetchServices = async () => {
    try {
      if (isMock) {
        loadMockServices();
        return;
      }
      const { data, error } = await supabase
        .from('website_services')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        loadMockServices();
      } else {
        setServices(data || []);
      }
    } catch (_) {
      loadMockServices();
    }
  };

  const loadMockServices = () => {
    const saved = localStorage.getItem('somos_noveli_services_cms');
    setServices(saved ? JSON.parse(saved) : DEFAULT_WEB_SERVICES);
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    try {
      const payload = {
        title: serviceTitle,
        short_description: serviceShortDesc,
        full_description: serviceFullDesc,
        price_from: parseFloat(servicePrice) || 0,
        currency: 'CLP',
        category: serviceCategory,
        featured: serviceFeatured,
        visible_on_website: serviceVisible,
        active: serviceActive,
        organization_id: getOrgId()
      };

      if (editingService) {
        if (isMock || usingMockDb) {
          const updated = services.map(s => s.id === editingService.id ? { ...s, ...payload } : s);
          setServices(updated);
          localStorage.setItem('somos_noveli_services_cms', JSON.stringify(updated));
        } else {
          await supabase.from('website_services').update(payload).eq('id', editingService.id);
        }
      } else {
        const newOrder = services.length > 0 ? Math.max(...services.map(s => s.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, display_order: newOrder };
        if (isMock || usingMockDb) {
          const updated = [...services, { ...insertPayload, id: `ws-${Date.now()}` }];
          setServices(updated);
          localStorage.setItem('somos_noveli_services_cms', JSON.stringify(updated));
        } else {
          await supabase.from('website_services').insert([insertPayload]);
        }
      }
      resetForm();
      await fetchServices();
      alert("Servicio guardado.");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleServiceBool = async (service, field) => {
    if (isReadOnly) return;
    const newVal = !service[field];
    try {
      if (isMock || usingMockDb) {
        const updated = services.map(s => s.id === service.id ? { ...s, [field]: newVal } : s);
        setServices(updated);
        localStorage.setItem('somos_noveli_services_cms', JSON.stringify(updated));
      } else {
        await supabase.from('website_services').update({ [field]: newVal }).eq('id', service.id);
      }
      setServices(services.map(s => s.id === service.id ? { ...s, [field]: newVal } : s));
    } catch (_) {}
  };

  const moveServiceOrder = async (index, direction) => {
    if (isReadOnly) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= services.length) return;

    const list = [...services];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const updated = list.map((item, idx) => ({ ...item, display_order: idx + 1 }));
    setServices(updated);

    try {
      if (isMock || usingMockDb) {
        localStorage.setItem('somos_noveli_services_cms', JSON.stringify(updated));
      } else {
        const promises = updated.map(item => supabase
          .from('website_services')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
        );
        await Promise.all(promises);
      }
    } catch (_) {}
  };

  const handleDeleteService = async (id) => {
    if (isReadOnly) return;
    if (!window.confirm("¿Eliminar este servicio?")) return;
    try {
      if (isMock || usingMockDb) {
        const updated = services.filter(s => s.id !== id);
        setServices(updated);
        localStorage.setItem('somos_noveli_services_cms', JSON.stringify(updated));
      } else {
        await supabase.from('website_services').delete().eq('id', id);
      }
      setServices(services.filter(s => s.id !== id));
    } catch (_) {}
  };

  // --- 3. LIBROS DATABASE OPS ---
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
        setBooks(data || []);
      }
    } catch (_) {
      loadMockBooks();
    }
  };

  const loadMockBooks = () => {
    const saved = localStorage.getItem('somos_noveli_books_cms');
    setBooks(saved ? JSON.parse(saved) : DEFAULT_WEB_BOOKS);
  };

  const handleSaveBook = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    try {
      const payload = {
        title: bookTitle,
        author: bookAuthor,
        cover_url: bookCoverUrl,
        short_description: bookShortDesc,
        genre: bookGenre,
        status: bookStatus,
        featured: bookFeatured,
        visible_on_website: bookVisible,
        sale_url: bookSaleUrl,
        sale_platform: bookSalePlatform,
        organization_id: getOrgId()
      };

      if (editingBook) {
        if (isMock || usingMockDb) {
          const updated = books.map(b => b.id === editingBook.id ? { ...b, ...payload } : b);
          setBooks(updated);
          localStorage.setItem('somos_noveli_books_cms', JSON.stringify(updated));
        } else {
          await supabase.from('website_books').update(payload).eq('id', editingBook.id);
        }
      } else {
        const newOrder = books.length > 0 ? Math.max(...books.map(b => b.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, display_order: newOrder };
        if (isMock || usingMockDb) {
          const updated = [...books, { ...insertPayload, id: `wb-${Date.now()}` }];
          setBooks(updated);
          localStorage.setItem('somos_noveli_books_cms', JSON.stringify(updated));
        } else {
          await supabase.from('website_books').insert([insertPayload]);
        }
      }
      resetBookForm();
      await fetchBooks();
      alert("Libro guardado.");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleBookBool = async (book, field) => {
    if (isReadOnly) return;
    const newVal = !book[field];
    try {
      if (isMock || usingMockDb) {
        const updated = books.map(b => b.id === book.id ? { ...b, [field]: newVal } : b);
        setBooks(updated);
        localStorage.setItem('somos_noveli_books_cms', JSON.stringify(updated));
      } else {
        await supabase.from('website_books').update({ [field]: newVal }).eq('id', book.id);
      }
      setBooks(books.map(b => b.id === book.id ? { ...b, [field]: newVal } : b));
    } catch (_) {}
  };

  const moveBookOrder = async (index, direction) => {
    if (isReadOnly) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= books.length) return;

    const list = [...books];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const updated = list.map((item, idx) => ({ ...item, display_order: idx + 1 }));
    setBooks(updated);

    try {
      if (isMock || usingMockDb) {
        localStorage.setItem('somos_noveli_books_cms', JSON.stringify(updated));
      } else {
        const promises = updated.map(item => supabase
          .from('website_books')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
        );
        await Promise.all(promises);
      }
    } catch (_) {}
  };

  const handleDeleteBook = async (id) => {
    if (isReadOnly) return;
    if (!window.confirm("¿Eliminar este libro?")) return;
    try {
      if (isMock || usingMockDb) {
        const updated = books.filter(b => b.id !== id);
        setBooks(updated);
        localStorage.setItem('somos_noveli_books_cms', JSON.stringify(updated));
      } else {
        await supabase.from('website_books').delete().eq('id', id);
      }
      setBooks(books.filter(b => b.id !== id));
    } catch (_) {}
  };

  const handleUploadCover = async (e, bookId) => {
    const file = e.target.files[0];
    if (!file || isReadOnly) return;
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_cover.${fileExt}`;
      const storagePath = `${getOrgId()}/website/covers/${fileName}`;

      let finalUrl = '';
      if (isMock || usingMockDb) {
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
        if (isMock || usingMockDb) {
          const updated = books.map(b => b.id === bookId ? { ...b, cover_url: finalUrl } : b);
          setBooks(updated);
          localStorage.setItem('somos_noveli_books_cms', JSON.stringify(updated));
        } else {
          await supabase.from('website_books').update({ cover_url: finalUrl }).eq('id', bookId);
        }
        await fetchBooks();
      } else {
        setBookCoverUrl(finalUrl);
      }
      alert("Portada subida correctamente.");
    } catch (err) {
      alert(`Error al subir portada: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- 4. ENLACES DATABASE OPS ---
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
        setLinks(data || []);
      }
    } catch (_) {
      loadMockLinks();
    }
  };

  const loadMockLinks = () => {
    const saved = localStorage.getItem('somos_noveli_links_cms');
    setLinks(saved ? JSON.parse(saved) : DEFAULT_WEB_LINKS);
  };

  const handleSaveLink = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    try {
      const payload = {
        label: linkLabel,
        url: linkUrl,
        link_type: linkType,
        active: linkActive,
        organization_id: getOrgId()
      };

      if (editingLink) {
        if (isMock || usingMockDb) {
          const updated = links.map(l => l.id === editingLink.id ? { ...l, ...payload } : l);
          setLinks(updated);
          localStorage.setItem('somos_noveli_links_cms', JSON.stringify(updated));
        } else {
          await supabase.from('website_links').update(payload).eq('id', editingLink.id);
        }
      } else {
        const newOrder = links.length > 0 ? Math.max(...links.map(l => l.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, display_order: newOrder };
        if (isMock || usingMockDb) {
          const updated = [...links, { ...insertPayload, id: `wl-${Date.now()}` }];
          setLinks(updated);
          localStorage.setItem('somos_noveli_links_cms', JSON.stringify(updated));
        } else {
          await supabase.from('website_links').insert([insertPayload]);
        }
      }
      resetLinkForm();
      await fetchLinks();
      alert("Enlace guardado.");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleLinkBool = async (link, field) => {
    if (isReadOnly) return;
    const newVal = !link[field];
    try {
      if (isMock || usingMockDb) {
        const updated = links.map(l => l.id === link.id ? { ...l, [field]: newVal } : l);
        setLinks(updated);
        localStorage.setItem('somos_noveli_links_cms', JSON.stringify(updated));
      } else {
        await supabase.from('website_links').update({ [field]: newVal }).eq('id', link.id);
      }
      setLinks(links.map(l => l.id === link.id ? { ...l, [field]: newVal } : l));
    } catch (_) {}
  };

  const moveLinkOrder = async (index, direction) => {
    if (isReadOnly) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= links.length) return;

    const list = [...links];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const updated = list.map((item, idx) => ({ ...item, display_order: idx + 1 }));
    setLinks(updated);

    try {
      if (isMock || usingMockDb) {
        localStorage.setItem('somos_noveli_links_cms', JSON.stringify(updated));
      } else {
        const promises = updated.map(item => supabase
          .from('website_links')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
        );
        await Promise.all(promises);
      }
    } catch (_) {}
  };

  const handleDeleteLink = async (id) => {
    if (isReadOnly) return;
    if (!window.confirm("¿Eliminar este enlace?")) return;
    try {
      if (isMock || usingMockDb) {
        const updated = links.filter(l => l.id !== id);
        setLinks(updated);
        localStorage.setItem('somos_noveli_links_cms', JSON.stringify(updated));
      } else {
        await supabase.from('website_links').delete().eq('id', id);
      }
      setLinks(links.filter(l => l.id !== id));
    } catch (_) {}
  };

  // --- 5. SECCIONES DATABASE OPS ---
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
        setSections(data || []);
      }
    } catch (_) {
      loadMockSections();
    }
  };

  const loadMockSections = () => {
    const saved = localStorage.getItem('somos_noveli_sections_cms');
    setSections(saved ? JSON.parse(saved) : DEFAULT_WEB_SECTIONS);
  };

  const handleSaveSection = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    try {
      const payload = {
        section_key: sectionKey,
        title: sectionTitle,
        subtitle: sectionSubtitle,
        content: sectionContent,
        image_url: sectionImageUrl,
        active: sectionActive,
        organization_id: getOrgId()
      };

      if (editingSection) {
        if (isMock || usingMockDb) {
          const updated = sections.map(s => s.id === editingSection.id ? { ...s, ...payload } : s);
          setSections(updated);
          localStorage.setItem('somos_noveli_sections_cms', JSON.stringify(updated));
        } else {
          await supabase.from('website_sections').update(payload).eq('id', editingSection.id);
        }
      } else {
        const newOrder = sections.length > 0 ? Math.max(...sections.map(s => s.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, display_order: newOrder };
        if (isMock || usingMockDb) {
          const updated = [...sections, { ...insertPayload, id: `sec-${Date.now()}` }];
          setSections(updated);
          localStorage.setItem('somos_noveli_sections_cms', JSON.stringify(updated));
        } else {
          await supabase.from('website_sections').insert([insertPayload]);
        }
      }
      resetSectionForm();
      await fetchSections();
      alert("Sección de página guardada.");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSectionBool = async (sec, field) => {
    if (isReadOnly) return;
    const newVal = !sec[field];
    try {
      if (isMock || usingMockDb) {
        const updated = sections.map(s => s.id === sec.id ? { ...s, [field]: newVal } : s);
        setSections(updated);
        localStorage.setItem('somos_noveli_sections_cms', JSON.stringify(updated));
      } else {
        await supabase.from('website_sections').update({ [field]: newVal }).eq('id', sec.id);
      }
      setSections(sections.map(s => s.id === sec.id ? { ...s, [field]: newVal } : s));
    } catch (_) {}
  };

  const handleDeleteSection = async (id) => {
    if (isReadOnly) return;
    if (!window.confirm("¿Eliminar esta sección?")) return;
    try {
      if (isMock || usingMockDb) {
        const updated = sections.filter(s => s.id !== id);
        setSections(updated);
        localStorage.setItem('somos_noveli_sections_cms', JSON.stringify(updated));
      } else {
        await supabase.from('website_sections').delete().eq('id', id);
      }
      setSections(sections.filter(s => s.id !== id));
    } catch (_) {}
  };

  // Form resets
  const resetForm = () => {
    setEditingService(null);
    setServiceTitle('');
    setServiceShortDesc('');
    setServiceFullDesc('');
    setServicePrice('0');
    setServiceCategory('Editorial');
    setServiceFeatured(false);
    setServiceVisible(true);
    setServiceActive(true);
  };

  const resetBookForm = () => {
    setEditingBook(null);
    setBookTitle('');
    setBookAuthor('');
    setBookCoverUrl('');
    setBookShortDesc('');
    setBookGenre('');
    setBookStatus('Destacado');
    setBookFeatured(false);
    setBookVisible(true);
    setBookSaleUrl('');
    setBookSalePlatform('Amazon');
  };

  const resetLinkForm = () => {
    setEditingLink(null);
    setLinkLabel('');
    setLinkUrl('');
    setLinkType('compra');
    setLinkActive(true);
  };

  const resetSectionForm = () => {
    setEditingSection(null);
    setSectionKey('inicio');
    setSectionTitle('');
    setSectionSubtitle('');
    setSectionContent('');
    setSectionImageUrl('');
    setSectionActive(true);
  };

  const startEditBook = (book) => {
    setEditingBook(book);
    setBookTitle(book.title || '');
    setBookAuthor(book.author || '');
    setBookCoverUrl(book.cover_url || '');
    setBookShortDesc(book.short_description || '');
    setBookGenre(book.genre || '');
    setBookStatus(book.status || 'Destacado');
    setBookFeatured(!!book.featured);
    setBookVisible(book.visible_on_website !== false);
    setBookSaleUrl(book.sale_url || '');
  // --- 6. WEBSITE LEADS OPS ---
  const fetchLeads = async () => {
    try {
      const orgId = getOrgId();
      // No filtering by user_id
      const { data, error } = await supabase
        .from('website_leads')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error('Error fetching website leads:', err);
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: err.message,
          error_stack: err.stack || '',
          module: 'website-solicitudes',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
      }
    }
  };

  const handleUpdateStatus = async (leadId, newStatus) => {
    if (isReadOnly) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('website_leads')
        .update({ status: newStatus })
        .eq('id', leadId);

      if (error) throw error;
      await fetchLeads();
      
      // Update selected lead state if open
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null);
      }
      
      alert(`Estado de la solicitud actualizado a "${newStatus}" correctamente.`);
    } catch (err) {
      console.error('Error updating status:', err);
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: err.message,
          error_stack: err.stack || '',
          module: 'website-solicitudes',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error:', logErr);
      }
      alert('Error al actualizar el estado: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuotation = async (lead) => {
    if (isReadOnly) return;
    
    // Check if already converted
    if (lead.converted_to_proposal) {
      alert("Esta solicitud ya tiene una propuesta asociada.");
      return;
    }

    setLoading(true);
    try {
      const orgId = getOrgId();
      const randNum = Math.floor(100000 + Math.random() * 900000);
      const quoteNumber = `COT-${randNum}`;
      
      const newQuote = {
        organization_id: orgId,
        author_name: lead.name,
        author_email: lead.email,
        author_phone: lead.phone,
        author_instagram: lead.instagram,
        origin: 'web',
        object: lead.service_of_interest || 'Servicio de Interés Web',
        other_notes: `[Solicitud Web] Mensaje original: ${lead.message || ''}`,
        quote_number: quoteNumber,
        issue_date: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        validity_days: 15,
        status: 'borrador',
        currency: 'CLP',
        subtotal: 0,
        discount: 0,
        total: 0,
        net_amount: 0,
        tax_amount: 0,
        included_items: [],
        excluded_items: [],
        start_condition_items: []
      };

      // Create quote
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotations')
        .insert([newQuote])
        .select('id')
        .single();

      if (quoteError) throw quoteError;
      const createdQuoteId = quoteData.id;

      // Update lead
      const { error: leadUpdateError } = await supabase
        .from('website_leads')
        .update({
          converted_to_proposal: true,
          converted_quotation_id: createdQuoteId,
          status: 'propuesta creada'
        })
        .eq('id', lead.id);

      if (leadUpdateError) throw leadUpdateError;

      await fetchLeads();
      
      // Update selected lead state if open
      if (selectedLead && selectedLead.id === lead.id) {
        setSelectedLead(prev => prev ? { 
          ...prev, 
          status: 'propuesta creada',
          converted_to_proposal: true,
          converted_quotation_id: createdQuoteId
        } : null);
      }

      alert(`Propuesta comercial ${quoteNumber} creada exitosamente.`);
    } catch (err) {
      console.error('Error creating quotation:', err);
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: err.message,
          error_stack: err.stack || '',
          module: 'website-solicitudes',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error:', logErr);
      }
      alert('Error al crear propuesta: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToProspect = async (lead) => {
    if (isReadOnly) return;
    
    // Check if already converted
    if (lead.converted_to_prospect) {
      alert("Esta solicitud ya ha sido convertida a prospecto.");
      return;
    }

    setLoading(true);
    try {
      const orgId = getOrgId();
      const newProspect = {
        organization_id: orgId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        instagram: lead.instagram,
        origin: 'web',
        interest_service: lead.service_of_interest,
        notes: `[Convertido desde Solicitud Web] Mensaje original: ${lead.message || ''}`,
        probability: 'media',
        currency: 'CLP',
        client_type: 'Nacional',
        preferred_currency: 'CLP'
      };

      // Create prospect
      const { data: prospectData, error: prospectError } = await supabase
        .from('prospects')
        .insert([newProspect])
        .select('id')
        .single();

      if (prospectError) throw prospectError;
      const createdProspectId = prospectData.id;

      // Update lead
      const { error: leadUpdateError } = await supabase
        .from('website_leads')
        .update({
          converted_to_prospect: true,
          converted_prospect_id: createdProspectId,
          status: 'convertido a prospecto'
        })
        .eq('id', lead.id);

      if (leadUpdateError) throw leadUpdateError;

      await fetchLeads();
      
      // Update selected lead state if open
      if (selectedLead && selectedLead.id === lead.id) {
        setSelectedLead(prev => prev ? { 
          ...prev, 
          status: 'convertido a prospecto',
          converted_to_prospect: true,
          converted_prospect_id: createdProspectId
        } : null);
      }

      alert(`Lead ${lead.name} convertido a Prospecto exitosamente.`);
    } catch (err) {
      console.error('Error converting to prospect:', err);
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: err.message,
          error_stack: err.stack || '',
          module: 'website-solicitudes',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error:', logErr);
      }
      alert('Error al convertir a prospecto: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    if (leadsFilter === 'todos') return true;
    if (leadsFilter === 'nuevo') return lead.status === 'nuevo';
    if (leadsFilter === 'revisado') return lead.status === 'revisado';
    if (leadsFilter === 'contactado') return lead.status === 'contactado';
    if (leadsFilter === 'propuesta') return lead.status === 'propuesta creada';
    if (leadsFilter === 'prospecto') return lead.status === 'convertido a prospecto';
    if (leadsFilter === 'descartado') return lead.status === 'descartado';
    return true;
  });

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
              {currentPath === 'configuracion' ? 'Configuración Web' :
               currentPath === 'servicios' ? 'Servicios Web' : 
               currentPath === 'libros' ? 'Libros Web' : 
               currentPath === 'enlaces' ? 'Enlaces de Venta' : 'Secciones de Página'}
            </span>
          </>
        )}
      </div>

      {/* Warning Badge for SQL / Mock Mode */}
      {usingMockDb && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Modo Respaldo Local:</strong> Se están utilizando datos en memoria del navegador. Por favor ejecuta el script <code>supabase_migration_24.sql</code> en tu consola de Supabase para activar persistencia real.
          </span>
        </div>
      )}

      {/* ------------------ MAIN VIEW: DASHBOARD ------------------ */}
      {currentPath === 'dashboard' && (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-855 dark:text-slate-100 tracking-tight font-serif flex items-center gap-2">
                <Globe className="w-8 h-8 text-amber-500" />
                CMS Sitio Web Público
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-sans">
                Panel administrativo para controlar las ofertas, libros destacados, secciones y enlaces del portal oficial de Noveli.
              </p>
            </div>
            
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer border border-transparent"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Abrir web pública</span>
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
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">1. Configuración Web</h3>
                <p className="text-xs text-slate-450 dark:text-slate-400 leading-relaxed">
                  Configura la información del sitio, meta descripción, logotipo, favicon y enlaces de redes sociales.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono truncate">
                  {siteName}
                </div>
              </div>
              <button
                onClick={() => navigateTo('configuracion')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Configurar Sitio</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 2. Servicios Web */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-455 rounded-xl w-fit">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">2. Servicios Web</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Agrega y edita los servicios ofrecidos en la web con sus respectivos precios, categorías y descripciones.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                  {services.length} servicios registrados ({services.filter(s => s.visible_on_website).length} visibles)
                </div>
              </div>
              <button
                onClick={() => navigateTo('servicios')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Configurar Servicios</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3. Libros Web */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-xl w-fit">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">3. Libros Web</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Carga libros destacados en el catálogo, sube portadas de libros y asocia enlaces de venta directa.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                  {books.length} libros cargados ({books.filter(b => b.visible_on_website).length} visibles)
                </div>
              </div>
              <button
                onClick={() => navigateTo('libros')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Configurar Catálogo</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4. Enlaces de Venta */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455 rounded-xl w-fit">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">4. Enlaces de Venta/Lectura</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Administra las redirecciones externas de la web (enlaces de compra, lectura, redes sociales o páginas de autor).
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                  {links.length} enlaces activos
                </div>
              </div>
              <button
                onClick={() => navigateTo('enlaces')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Configurar Enlaces</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 5. Secciones de Página */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 rounded-xl w-fit">
                  <AlignLeft className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">5. Secciones de Página</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Modifica los bloques de texto estáticos y secciones de la landing page (inicio, nosotros, contacto).
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                  {sections.length} secciones configuradas ({sections.filter(s => s.active).length} activas)
                </div>
              </div>
              <button
                onClick={() => navigateTo('secciones')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Configurar Secciones</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 6. Solicitudes Web */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-455 rounded-xl w-fit">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">6. Solicitudes Web</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Revisa y gestiona las solicitudes y cotizaciones enviadas por los autores desde el formulario de contacto web.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                  {leads.length} solicitudes registradas ({leads.filter(l => l.status === 'nuevo').length} nuevas)
                </div>
              </div>
              <button
                onClick={() => navigateTo('solicitudes')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Ver Solicitudes</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </>
      )}

      {/* ------------------ SUB-VIEW: CONFIGURACION ------------------ */}
      {currentPath === 'configuracion' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigateTo('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Configuración de Sitio Web</h2>
                <p className="text-xs text-slate-400 mt-0.5">Controla la metadata principal, imagen de marca y textos globales de la web.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Form */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Ajustes Generales</h3>
              
              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Nombre del Sitio</label>
                    <input type="text" required value={siteName} onChange={e => setSiteName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">URL Pública Oficial</label>
                    <input type="url" required value={publicUrl} onChange={e => setPublicUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Descripción Breve (SEO)</label>
                  <textarea value={shortDesc} onChange={e => setShortDesc(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Correo de Contacto Público</label>
                    <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Instagram URL</label>
                    <input type="url" value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-50 dark:border-slate-800">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Título Principal Hero</label>
                    <input type="text" value={heroTitle} onChange={e => setHeroTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-serif" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Subtítulo Hero</label>
                    <input type="text" value={heroSubtitle} onChange={e => setHeroSubtitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-50 dark:border-slate-800">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Logo URL (Brand Assets)</label>
                    <input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Favicon URL</label>
                    <input type="text" value={faviconUrl} onChange={e => setFaviconUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono" />
                  </div>
                </div>

                <div className="flex items-center space-x-2 py-1">
                  <input type="checkbox" id="configActive" checked={configActive} onChange={e => setConfigActive(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                  <label htmlFor="configActive" className="text-slate-655 dark:text-slate-350 font-bold cursor-pointer select-none">Sitio Web Activo y Verificable</label>
                </div>

                <button type="submit" disabled={isReadOnly} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center gap-1.5 border border-transparent shadow-md">
                  <Save className="w-4 h-4" />
                  <span>Guardar Configuración</span>
                </button>
              </form>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
              <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">Previsualizador Rápido</h3>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950/40 relative h-64">
                <iframe src={publicUrl} title="Small Preview" className="w-full h-full border-none z-10 bg-white" />
                <div className="absolute inset-0 bg-slate-50/95 dark:bg-slate-900/95 z-0 flex flex-col items-center justify-center text-center p-4 space-y-2">
                  <Globe className="w-6 h-6 text-slate-400" />
                  <p className="text-[10px] text-slate-500 leading-relaxed">Vista previa estática. Puedes abrir el portal público en una nueva ventana.</p>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 text-[10px] font-bold flex items-center gap-1">
                    <span>Ver Sitio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
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
                <p className="text-xs text-slate-400 mt-0.5 font-sans">Administra los servicios de Noveli visibles de cara al público.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-150 dark:border-slate-800 text-slate-400 font-bold">
                      <th className="py-2.5">Orden</th>
                      <th className="py-2.5">Título</th>
                      <th className="py-2.5">Categoría</th>
                      <th className="py-2.5">Precio Desde</th>
                      <th className="py-2.5 text-center">Destacado</th>
                      <th className="py-2.5 text-center">Activo</th>
                      <th className="py-2.5 text-center">En Web</th>
                      <th className="py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-855">
                    {services.map((s, idx) => (
                      <tr key={s.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                        {/* Order arrow controls */}
                        <td className="py-3">
                          <div className="flex items-center space-x-1">
                            <span className="font-bold text-slate-400 w-4">{s.display_order || idx + 1}</span>
                            <div className="flex flex-col">
                              <button type="button" disabled={idx === 0 || isReadOnly} onClick={() => moveServiceOrder(idx, -1)} className="text-slate-350 hover:text-amber-500 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"><ArrowUp className="w-3 h-3" /></button>
                              <button type="button" disabled={idx === services.length - 1 || isReadOnly} onClick={() => moveServiceOrder(idx, 1)} className="text-slate-350 hover:text-amber-500 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"><ArrowDown className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 font-bold text-slate-750 dark:text-slate-200">{s.title}</td>
                        <td className="py-3"><span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 rounded font-bold text-[9px] uppercase tracking-wider">{s.category}</span></td>
                        <td className="py-3 font-mono font-bold">{formatCurrency(s.price_from, s.currency || 'CLP')}</td>
                        
                        {/* Destacado */}
                        <td className="py-3 text-center">
                          <button type="button" onClick={() => toggleServiceBool(s, 'featured')} className="focus:outline-none bg-transparent border-none cursor-pointer">
                            <Star className={`w-4 h-4 ${s.featured ? 'text-amber-500 fill-amber-500' : 'text-slate-350'}`} />
                          </button>
                        </td>
                        {/* Activo */}
                        <td className="py-3 text-center">
                          <button type="button" onClick={() => toggleServiceBool(s, 'active')} className="focus:outline-none bg-transparent border-none cursor-pointer">
                            {s.active !== false ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <EyeOff className="w-4 h-4 text-slate-400 mx-auto" />}
                          </button>
                        </td>
                        {/* En Web / visible_on_website */}
                        <td className="py-3 text-center">
                          <button type="button" onClick={() => toggleServiceBool(s, 'visible_on_website')} className="focus:outline-none bg-transparent border-none cursor-pointer">
                            {s.visible_on_website !== false ? (
                              <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border border-emerald-100 rounded text-[9px] font-bold">visible</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-950/10 text-slate-500 border border-slate-250 rounded text-[9px] font-bold">oculto</span>
                            )}
                          </button>
                        </td>
                        <td className="py-3 text-right space-x-1">
                          <button onClick={() => startEditService(s)} className="p-1 hover:bg-slate-100 text-slate-450 rounded border-none bg-transparent cursor-pointer inline-flex items-center"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteService(s.id)} className="p-1 hover:bg-rose-50 text-slate-450 rounded border-none bg-transparent cursor-pointer inline-flex items-center"><Trash2 className="w-3.5 h-3.5" /></button>
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
                  <label className="text-slate-400 font-bold block">Título del Servicio</label>
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
                    <option value="Legal">Legal</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Precio Desde (CLP)</label>
                  <input type="number" value={servicePrice} onChange={e => setServicePrice(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Descripción Corta</label>
                  <textarea value={serviceShortDesc} onChange={e => setServiceShortDesc(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Descripción Completa</label>
                  <textarea value={serviceFullDesc} onChange={e => setServiceFullDesc(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                
                <div className="flex gap-4 py-1">
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                    <input type="checkbox" checked={serviceFeatured} onChange={e => setServiceFeatured(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                    <span>Destacado</span>
                  </label>
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                    <input type="checkbox" checked={serviceVisible} onChange={e => setServiceVisible(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                    <span>Visible en Web</span>
                  </label>
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                    <input type="checkbox" checked={serviceActive} onChange={e => setServiceActive(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                    <span>Activo</span>
                  </label>
                </div>

                <button type="submit" disabled={isReadOnly} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 border border-transparent">
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
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Catálogo de Libros Web</h2>
                <p className="text-xs text-slate-400 mt-0.5">Define las portadas, novedades y enlaces de venta para los lectores.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {books.map((b, idx) => (
                <div key={b.id || idx} className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-5 shadow-2xs flex gap-4 relative">
                  {/* Reorder Arrows in Book Container */}
                  <div className="flex flex-col justify-center items-center gap-2 border-r border-slate-50 dark:border-slate-800 pr-3 shrink-0">
                    <button type="button" disabled={idx === 0 || isReadOnly} onClick={() => moveBookOrder(idx, -1)} className="text-slate-300 hover:text-amber-500 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"><ArrowUp className="w-4 h-4" /></button>
                    <span className="text-[10px] font-bold text-slate-400">{b.display_order || idx + 1}</span>
                    <button type="button" disabled={idx === books.length - 1 || isReadOnly} onClick={() => moveBookOrder(idx, 1)} className="text-slate-300 hover:text-amber-500 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"><ArrowDown className="w-4 h-4" /></button>
                  </div>

                  <div className="w-20 h-28 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col items-center justify-center overflow-hidden shrink-0 relative group">
                    {b.cover_url ? <img src={b.cover_url.startsWith('mock://') ? `https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=100&auto=format&fit=crop&q=60` : b.cover_url} className="w-full h-full object-cover" /> : <BookOpen className="w-7 h-7 text-slate-350" />}
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
                        <p className="text-xs text-slate-400 mt-0.5">Autor: {b.author} • Género: {b.genre} • <span className="text-purple-600 dark:text-purple-400 font-bold uppercase text-[9px] bg-purple-50 dark:bg-purple-950/20 px-1.5 py-0.5 rounded">{b.status || 'Destacado'}</span></p>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Destacado */}
                        <button type="button" onClick={() => toggleBookBool(b, 'featured')} className="p-1 hover:bg-slate-100 rounded border-none bg-transparent cursor-pointer">
                          <Star className={`w-4 h-4 ${b.featured ? 'text-amber-500 fill-amber-500' : 'text-slate-350'}`} />
                        </button>
                        {/* En Web / visible_on_website */}
                        <button type="button" onClick={() => toggleBookBool(b, 'visible_on_website')} className="p-1 hover:bg-slate-100 rounded border-none bg-transparent cursor-pointer">
                          {b.visible_on_website !== false ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-350" />}
                        </button>
                        
                        <button onClick={() => startEditBook(b)} className="p-1 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded border-none bg-transparent cursor-pointer inline-flex items-center"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteBook(b.id)} className="p-1 hover:bg-rose-50 text-slate-400 rounded border-none bg-transparent cursor-pointer inline-flex items-center"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {b.short_description && <p className="text-xs text-slate-500 italic">"{b.short_description}"</p>}
                    {b.sale_url && (
                      <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Enlace: {b.sale_platform} ➔ </span>
                        <a href={b.sale_url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[200px] font-mono">{b.sale_url}</a>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
              <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">{editingBook ? 'Editar Libro' : 'Destacar Libro'}</h3>
              <form onSubmit={handleSaveBook} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Título</label>
                  <input type="text" required value={bookTitle} onChange={e => setBookTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Autor</label>
                  <input type="text" required value={bookAuthor} onChange={e => setBookAuthor(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Género</label>
                    <input type="text" value={bookGenre} onChange={e => setBookGenre(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Estado/Etiqueta</label>
                    <select value={bookStatus} onChange={e => setBookStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent">
                      <option value="Destacado">Destacado</option>
                      <option value="Novedad">Novedad</option>
                      <option value="Preventa">Preventa</option>
                      <option value="Lanzamiento">Lanzamiento</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Portada URL</label>
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
                    <label className="text-slate-400 font-bold block">Plataforma de Venta</label>
                    <select value={bookSalePlatform} onChange={e => setBookSalePlatform(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent">
                      <option value="Amazon">Amazon</option>
                      <option value="Buscalibre">Buscalibre</option>
                      <option value="Wattpad">Wattpad</option>
                      <option value="Página del autor">Página del autor</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Enlace de Compra</label>
                    <input type="url" value={bookSaleUrl} onChange={e => setBookSaleUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                  </div>
                </div>

                <div className="flex gap-4 py-1">
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                    <input type="checkbox" checked={bookFeatured} onChange={e => setBookFeatured(e.target.checked)} className="rounded text-purple-550 h-4 w-4" />
                    <span>Destacado</span>
                  </label>
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                    <input type="checkbox" checked={bookVisible} onChange={e => setBookVisible(e.target.checked)} className="rounded text-purple-550 h-4 w-4" />
                    <span>Visible en Web</span>
                  </label>
                </div>

                <button type="submit" disabled={isReadOnly} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 border border-transparent">
                  <Plus className="w-4 h-4" />
                  <span>Guardar Libro</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ------------------ SUB-VIEW: ENLACES ------------------ */}
      {currentPath === 'enlaces' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigateTo('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-855 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Enlaces de Venta y Redes</h2>
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
                      <th className="py-2.5">Orden</th>
                      <th className="py-2.5">Etiqueta</th>
                      <th className="py-2.5">Tipo de Enlace</th>
                      <th className="py-2.5">URL</th>
                      <th className="py-2.5 text-center">Activo</th>
                      <th className="py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-855">
                    {links.map((l, idx) => (
                      <tr key={l.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                        <td className="py-3">
                          <div className="flex items-center space-x-1">
                            <span className="font-bold text-slate-400 w-4">{l.display_order || idx + 1}</span>
                            <div className="flex flex-col">
                              <button type="button" disabled={idx === 0 || isReadOnly} onClick={() => moveLinkOrder(idx, -1)} className="text-slate-300 hover:text-amber-500 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"><ArrowUp className="w-3 h-3" /></button>
                              <button type="button" disabled={idx === links.length - 1 || isReadOnly} onClick={() => moveLinkOrder(idx, 1)} className="text-slate-300 hover:text-amber-500 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"><ArrowDown className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 font-bold text-slate-750 dark:text-slate-200">{l.label}</td>
                        <td className="py-3"><span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 rounded font-bold text-[9px] uppercase tracking-wider">{l.link_type}</span></td>
                        <td className="py-3 font-mono text-[10px] text-slate-400 truncate max-w-[150px]"><a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">{l.url} <ExternalLink className="w-2.5 h-2.5" /></a></td>
                        {/* Activo */}
                        <td className="py-3 text-center">
                          <button type="button" onClick={() => toggleLinkBool(l, 'active')} className="focus:outline-none bg-transparent border-none cursor-pointer">
                            {l.active !== false ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <EyeOff className="w-4 h-4 text-slate-400 mx-auto" />}
                          </button>
                        </td>
                        <td className="py-3 text-right space-x-1.5">
                          <button onClick={() => startEditLink(l)} className="p-1 hover:bg-slate-100 text-slate-455 rounded border-none bg-transparent cursor-pointer inline-flex items-center"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteLink(l.id)} className="p-1 hover:bg-rose-50 text-slate-455 rounded border-none bg-transparent cursor-pointer inline-flex items-center"><Trash2 className="w-3.5 h-3.5" /></button>
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
                  <label className="text-slate-400 font-bold block">Etiqueta Visible</label>
                  <input type="text" required placeholder="Ej. Tienda Amazon" value={linkLabel} onChange={e => setLinkLabel(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Tipo de Enlace</label>
                  <select value={linkType} onChange={e => setLinkType(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent">
                    <option value="compra">Compra</option>
                    <option value="lectura">Lectura</option>
                    <option value="autor">Página del Autor</option>
                    <option value="red social">Red Social</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Enlace URL</label>
                  <input type="url" required placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono" />
                </div>
                
                <div className="flex gap-4 py-1.5">
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                    <input type="checkbox" checked={linkActive} onChange={e => setLinkActive(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                    <span>Activo / Visible en la web</span>
                  </label>
                </div>

                <button type="submit" disabled={isReadOnly} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 border border-transparent">
                  <Plus className="w-4 h-4" />
                  <span>Guardar Enlace</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ------------------ SUB-VIEW: SECCIONES ------------------ */}
      {currentPath === 'secciones' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigateTo('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-855 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Secciones de Página</h2>
                <p className="text-xs text-slate-400 mt-0.5">Modifica los bloques de texto estáticos y el contenido de las secciones públicas.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {sections.map((sec, idx) => (
                <div key={sec.id || idx} className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-100 rounded text-[9px] font-bold uppercase font-mono tracking-wider">{sec.section_key}</span>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 mt-1.5">{sec.title || 'Bloque sin título'}</h4>
                      {sec.subtitle && <p className="text-[10px] text-slate-400">{sec.subtitle}</p>}
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {/* Active */}
                      <button type="button" onClick={() => toggleSectionBool(sec, 'active')} className="p-1 hover:bg-slate-100 rounded border-none bg-transparent cursor-pointer">
                        {sec.active !== false ? <Check className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                      </button>
                      
                      <button onClick={() => startEditSection(sec)} className="p-1 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded border-none bg-transparent cursor-pointer"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteSection(sec.id)} className="p-1 hover:bg-rose-50 text-slate-400 rounded border-none bg-transparent cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">{sec.content}</p>
                  {sec.image_url && (
                    <div className="font-mono text-[9px] text-slate-400 truncate bg-slate-50 dark:bg-slate-950/20 p-2 rounded">
                      Imagen URL: {sec.image_url}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
              <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">{editingSection ? 'Editar Sección' : 'Nueva Sección de Página'}</h3>
              <form onSubmit={handleSaveSection} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Llave de Sección (section_key)</label>
                  <select value={sectionKey} onChange={e => setSectionKey(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent">
                    <option value="inicio">Inicio (Home Hero)</option>
                    <option value="servicios">Servicios (Sección Servicios)</option>
                    <option value="libros">Libros (Sección Libros)</option>
                    <option value="contacto">Contacto (Sección Contacto)</option>
                    <option value="nosotros">Nosotros (Sección Nosotros)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Título</label>
                  <input type="text" required placeholder="Ej. Sobre Nosotros" value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Subtítulo</label>
                  <input type="text" placeholder="Ej. Quiénes somos" value={sectionSubtitle} onChange={e => setSectionSubtitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Contenido</label>
                  <textarea required placeholder="Escribe el cuerpo de texto..." value={sectionContent} onChange={e => setSectionContent(e.target.value)} rows={5} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Imagen URL</label>
                  <input type="text" placeholder="https://..." value={sectionImageUrl} onChange={e => setSectionImageUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono" />
                </div>

                <div className="flex gap-4 py-1.5">
                  <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                    <input type="checkbox" checked={sectionActive} onChange={e => setSectionActive(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                    <span>Sección Activa / Visible en la Web</span>
                  </label>
                </div>

                <button type="submit" disabled={isReadOnly} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 border border-transparent">
                  <Plus className="w-4 h-4" />
                  <span>Guardar Sección</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ------------------ SUB-VIEW: SOLICITUDES ------------------ */}
      {currentPath === 'solicitudes' && (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <button onClick={() => navigateTo('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-855 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Solicitudes Web (Leads)</h2>
                  <p className="text-xs text-slate-400 mt-0.5 font-sans">Gestiona los contactos de autores y cotizaciones recibidas desde el portal público.</p>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-slate-850">
              {[
                { id: 'todos', label: 'Todos', count: leads.length },
                { id: 'nuevo', label: 'Nuevos', count: leads.filter(l => l.status === 'nuevo').length, color: 'bg-blue-500' },
                { id: 'revisado', label: 'Revisados', count: leads.filter(l => l.status === 'revisado').length, color: 'bg-amber-500' },
                { id: 'contactado', label: 'Contactados', count: leads.filter(l => l.status === 'contactado').length, color: 'bg-purple-500' },
                { id: 'propuesta', label: 'Propuesta Creada', count: leads.filter(l => l.status === 'propuesta creada').length, color: 'bg-indigo-500' },
                { id: 'prospecto', label: 'Convertidos', count: leads.filter(l => l.status === 'convertido a prospecto').length, color: 'bg-emerald-500' },
                { id: 'descartado', label: 'Descartados', count: leads.filter(l => l.status === 'descartado').length, color: 'bg-slate-500' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setLeadsFilter(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border ${
                    leadsFilter === tab.id
                      ? 'bg-amber-500 text-white border-transparent shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-805 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    leadsFilter === tab.id 
                      ? 'bg-white/20 text-white' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Leads Table Container */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs">
              <div className="overflow-x-auto text-xs">
                {filteredLeads.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-semibold flex flex-col items-center justify-center gap-3">
                    <Globe className="w-12 h-12 text-slate-300 dark:text-slate-700 animate-pulse" />
                    <p>No se encontraron solicitudes con este filtro.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-150 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3">Fecha</th>
                        <th className="py-3">Nombre</th>
                        <th className="py-3">Contacto</th>
                        <th className="py-3">Servicio de Interés</th>
                        <th className="py-3">Mensaje</th>
                        <th className="py-3">Estado</th>
                        <th className="py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredLeads.map((lead) => {
                        const dateStr = lead.created_at
                          ? new Date(lead.created_at).toLocaleDateString('es-CL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'S/F';

                        return (
                          <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all duration-200">
                            <td className="py-3.5 text-slate-500 font-mono text-[10px] whitespace-nowrap">{dateStr}</td>
                            <td className="py-3.5 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">{lead.name}</td>
                            <td className="py-3.5 space-y-1">
                              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-350">
                                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[150px]" title={lead.email}>{lead.email}</span>
                              </div>
                              {lead.phone && (
                                <div className="flex items-center gap-1 text-slate-600 dark:text-slate-350">
                                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{lead.phone}</span>
                                </div>
                              )}
                              {lead.instagram && (
                                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                  <InstagramIcon className="w-3.5 h-3.5 text-pink-500/70 shrink-0" />
                                  <span>@{lead.instagram}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3.5">
                              <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900 rounded-lg font-bold text-[10px] uppercase tracking-wider">
                                {lead.service_of_interest || 'General'}
                              </span>
                            </td>
                            <td className="py-3.5 text-slate-500 font-sans max-w-[200px] truncate" title={lead.message}>
                              {lead.message}
                            </td>
                            <td className="py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider whitespace-nowrap ${
                                lead.status === 'nuevo'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-955/20 dark:text-blue-400 dark:border-blue-900/50'
                                  : lead.status === 'revisado'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-955/20 dark:text-amber-400 dark:border-amber-900/50'
                                  : lead.status === 'contactado'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-955/20 dark:text-purple-400 dark:border-purple-900/50'
                                  : lead.status === 'propuesta creada'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-955/20 dark:text-indigo-400 dark:border-indigo-900/50'
                                  : lead.status === 'convertido a prospecto'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-955/20 dark:text-emerald-450 dark:border-emerald-900/50'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                              }`}>
                                {lead.status || 'nuevo'}
                              </span>
                            </td>
                            <td className="py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedLead(lead);
                                    setIsDetailModalOpen(true);
                                  }}
                                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-805 rounded-lg text-slate-500 hover:text-amber-500 cursor-pointer transition-colors"
                                  title="Ver detalle"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                
                                {lead.status === 'nuevo' && (
                                  <button
                                    onClick={() => handleUpdateStatus(lead.id, 'revisado')}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-805 rounded-lg text-slate-400 hover:text-amber-600 cursor-pointer transition-colors"
                                    title="Marcar como revisado"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}

                                {(lead.status === 'nuevo' || lead.status === 'revisado') && (
                                  <button
                                    onClick={() => handleUpdateStatus(lead.id, 'contactado')}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-805 rounded-lg text-slate-400 hover:text-purple-600 cursor-pointer transition-colors"
                                    title="Marcar como contactado"
                                  >
                                    <Mail className="w-4 h-4" />
                                  </button>
                                )}

                                {!lead.converted_to_proposal && lead.status !== 'descartado' && (
                                  <button
                                    onClick={() => handleCreateQuotation(lead)}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-805 rounded-lg text-slate-400 hover:text-indigo-650 cursor-pointer transition-colors"
                                    title="Crear propuesta comercial"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                )}

                                {!lead.converted_to_prospect && lead.status !== 'descartado' && (
                                  <button
                                    onClick={() => handleConvertToProspect(lead)}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-805 rounded-lg text-slate-400 hover:text-emerald-650 cursor-pointer transition-colors"
                                    title="Convertir a prospecto"
                                  >
                                    <UserCheck className="w-4 h-4" />
                                  </button>
                                )}

                                {lead.status !== 'descartado' && lead.status !== 'convertido a prospecto' && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm('¿Confirmas descartar esta solicitud?')) {
                                        handleUpdateStatus(lead.id, 'descartado');
                                      }
                                    }}
                                    className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-955/20 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                                    title="Descartar solicitud"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

      {/* ------------------ MODAL: DETALLE DE SOLICITUD ------------------ */}
      {isDetailModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-250 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up font-sans text-xs">
            {/* Header */}
            <div className="p-6 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/20 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded text-[9px] font-extrabold uppercase font-mono tracking-wider">
                    ID: {selectedLead.id.slice(0, 8)}...
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                    selectedLead.status === 'nuevo'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-955/20 dark:text-blue-400 dark:border-blue-900/50'
                      : selectedLead.status === 'revisado'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-955/20 dark:text-amber-400 dark:border-amber-900/50'
                      : selectedLead.status === 'contactado'
                      ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-955/20 dark:text-purple-400 dark:border-purple-900/50'
                      : selectedLead.status === 'propuesta creada'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-955/20 dark:text-indigo-400 dark:border-indigo-900/50'
                      : selectedLead.status === 'convertido a prospecto'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-955/20 dark:text-emerald-450 dark:border-emerald-900/50'
                      : 'bg-slate-105 text-slate-655 border-slate-205 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}>
                    {selectedLead.status}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-855 dark:text-slate-150 font-serif">{selectedLead.name}</h3>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white rounded-xl text-slate-500 dark:text-slate-400 cursor-pointer transition-all border border-transparent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 scrollbar-thin">
              {/* Date & Interest Service */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Fecha de Recepción</span>
                  <div className="flex items-center gap-2 font-mono text-slate-700 dark:text-slate-200 font-bold">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{new Date(selectedLead.created_at).toLocaleString('es-CL')}</span>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Servicio de Interés</span>
                  <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                    <Globe className="w-4 h-4 text-amber-500/70" />
                    <span>{selectedLead.service_of_interest || 'Consulta General'}</span>
                  </div>
                </div>
              </div>

              {/* Contact Grid */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 rounded-2xl space-y-3">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Información de Contacto</span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Email */}
                  <div className="flex items-center gap-2 border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900/50 p-2.5 rounded-xl">
                    <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="truncate flex-1">
                      <span className="text-[9px] text-slate-455 block">Correo Electrónico</span>
                      <a href={`mailto:${selectedLead.email}`} className="font-bold text-slate-800 dark:text-slate-150 hover:underline truncate block">{selectedLead.email}</a>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(selectedLead.email);
                        alert("Correo copiado al portapapeles.");
                      }}
                      className="p-1 text-slate-400 hover:text-slate-655 cursor-pointer bg-transparent border-none"
                      title="Copiar correo"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-2 border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900/50 p-2.5 rounded-xl">
                    <Phone className="w-4 h-4 text-green-500 shrink-0" />
                    <div className="truncate flex-1">
                      <span className="text-[9px] text-slate-455 block">Teléfono</span>
                      {selectedLead.phone ? (
                        <a href={`tel:${selectedLead.phone}`} className="font-bold text-slate-800 dark:text-slate-150 hover:underline block">{selectedLead.phone}</a>
                      ) : (
                        <span className="font-bold text-slate-400 block">No provisto</span>
                      )}
                    </div>
                    {selectedLead.phone && (
                      <a 
                        href={`https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-1 text-green-500 hover:text-green-600 cursor-pointer"
                        title="Enviar WhatsApp"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {/* Instagram */}
                  <div className="flex items-center gap-2 border border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900/50 p-2.5 rounded-xl">
                    <InstagramIcon className="w-4 h-4 text-pink-500 shrink-0" />
                    <div className="truncate flex-1">
                      <span className="text-[9px] text-slate-455 block">Instagram</span>
                      {selectedLead.instagram ? (
                        <a 
                          href={`https://instagram.com/${selectedLead.instagram.replace(/^@/, '')}`}
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="font-bold text-slate-800 dark:text-slate-150 hover:underline block"
                        >
                          @{selectedLead.instagram}
                        </a>
                      ) : (
                        <span className="font-bold text-slate-400 block">No provisto</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Mensaje Enviado</span>
                <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 rounded-2xl text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans text-xs italic">
                  "{selectedLead.message}"
                </div>
              </div>

              {/* Conversion Information */}
              {(selectedLead.converted_to_proposal || selectedLead.converted_to_prospect) && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-905 rounded-2xl space-y-2">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block uppercase tracking-wider">Historial de Conversión</span>
                  <div className="space-y-1.5 font-sans">
                    {selectedLead.converted_to_proposal && (
                      <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-350 font-bold">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Propuesta comercial creada exitosamente.</span>
                      </div>
                    )}
                    {selectedLead.converted_to_prospect && (
                      <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-350 font-bold">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Convertido exitosamente en prospecto del CRM.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="p-5 border-t border-slate-150 dark:border-slate-805 bg-slate-50 dark:bg-slate-950/25 flex flex-wrap gap-2 justify-between shrink-0">
              <div className="flex gap-2">
                {selectedLead.status !== 'descartado' && selectedLead.status !== 'convertido a prospecto' && (
                  <button
                    onClick={() => {
                      if(window.confirm('¿Confirmas descartar esta solicitud?')) {
                        handleUpdateStatus(selectedLead.id, 'descartado');
                      }
                    }}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-955/20 dark:text-rose-400 dark:hover:bg-rose-950/40 rounded-xl font-bold transition-all border border-transparent cursor-pointer"
                  >
                    Descartar
                  </button>
                )}
              </div>
              
              <div className="flex gap-2">
                {selectedLead.status === 'nuevo' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedLead.id, 'revisado')}
                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400 dark:hover:bg-amber-950/40 rounded-xl font-bold transition-all border border-transparent cursor-pointer"
                  >
                    Marcar Revisado
                  </button>
                )}

                {(selectedLead.status === 'nuevo' || selectedLead.status === 'revisado') && (
                  <button
                    onClick={() => handleUpdateStatus(selectedLead.id, 'contactado')}
                    className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-955/20 dark:text-purple-400 dark:hover:bg-purple-950/40 rounded-xl font-bold transition-all border border-transparent cursor-pointer"
                  >
                    Marcar Contactado
                  </button>
                )}

                {!selectedLead.converted_to_proposal && selectedLead.status !== 'descartado' && (
                  <button
                    onClick={() => handleCreateQuotation(selectedLead)}
                    className="px-3.5 py-2 bg-indigo-500 hover:bg-indigo-650 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm hover:shadow transition-all border border-transparent cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Crear Propuesta</span>
                  </button>
                )}

                {!selectedLead.converted_to_prospect && selectedLead.status !== 'descartado' && (
                  <button
                    onClick={() => handleConvertToProspect(selectedLead)}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-650 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm hover:shadow transition-all border border-transparent cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Convertir a Prospecto</span>
                  </button>
                )}

                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 border border-slate-250 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
}
