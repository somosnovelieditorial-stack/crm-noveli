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
  { title: 'Full eBook', category: 'Digitalización', price_from: 80000, short_description: 'Publicación completa de tu eBook en plataformas globales', featured: true, visible_on_website: true, active: true, display_order: 1, image_url: '', background_url: '', icon_name: 'book', color_theme: 'blue' },
  { title: 'Full Físico', category: 'Producción', price_from: 250000, short_description: 'Edición e impresión física de tu obra literaria', featured: true, visible_on_website: true, active: true, display_order: 2, image_url: '', background_url: '', icon_name: 'layout', color_theme: 'gold' },
  { title: 'Full Total', category: 'Producción', price_from: 450000, short_description: 'El pack definitivo: eBook, libro físico, tapa blanda e ilustración', featured: true, visible_on_website: true, active: true, display_order: 3, image_url: '', background_url: '', icon_name: 'upload', color_theme: 'purple' },
  { title: 'Corrección', category: 'Editorial', price_from: 2500, short_description: 'Corrección de estilo, gramática y ortografía profesional', featured: false, visible_on_website: true, active: true, display_order: 4, image_url: '', background_url: '', icon_name: 'pen', color_theme: 'rose' },
  { title: 'Portada', category: 'Diseño', price_from: 120000, short_description: 'Diseño de portada personalizado y adaptado al género', featured: false, visible_on_website: true, active: true, display_order: 5, image_url: '', background_url: '', icon_name: 'layout', color_theme: 'burgundy' },
  { title: 'Maquetación', category: 'Editorial', price_from: 90000, short_description: 'Maquetación interior profesional para impresión y digital', featured: false, visible_on_website: true, active: true, display_order: 6, image_url: '', background_url: '', icon_name: 'file', color_theme: 'green' },
  { title: 'Difusión Editorial', category: 'Marketing', price_from: 150000, short_description: 'Campañas de marketing, notas de prensa y difusión', featured: false, visible_on_website: true, active: true, display_order: 7, image_url: '', background_url: '', icon_name: 'megaphone', color_theme: 'blue' },
  { title: 'Registro de Derechos de Autor', category: 'Legal', price_from: 50000, short_description: 'Gestión legal de registro de propiedad intelectual', featured: false, visible_on_website: true, active: true, display_order: 8, image_url: '', background_url: '', icon_name: 'shield', color_theme: 'gold' }
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

const DEFAULT_FOOTER_SETTINGS = {
  contact_title: 'Ponte en contacto',
  contact_email: 'contacto@somosnovelieditorial.com',
  contact_location: 'Santiago, Chile',
  contact_description: 'Ayudamos a autores independientes a maquetar, corregir, diseñar y distribuir sus libros a nivel global con calidad profesional.',
  instagram_title: 'Síguenos en Instagram',
  instagram_url: 'https://instagram.com/somosnovelieditorial',
  instagram_enabled: true,
  active: true
};

const DEFAULT_FOOTER_GALLERY = [
  { id: 'fg-1', image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=150&auto=format&fit=crop&q=60', title: 'Lectura otoñal', link_url: 'https://instagram.com', display_order: 1, active: true },
  { id: 'fg-2', image_url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=150&auto=format&fit=crop&q=60', title: 'Nuestra biblioteca', link_url: 'https://instagram.com', display_order: 2, active: true },
  { id: 'fg-3', image_url: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=150&auto=format&fit=crop&q=60', title: 'Manuscritos', link_url: 'https://instagram.com', display_order: 3, active: true },
  { id: 'fg-4', image_url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=150&auto=format&fit=crop&q=60', title: 'Nuevos lanzamientos', link_url: 'https://instagram.com', display_order: 4, active: true }
];
const DEFAULT_HERO_SETTINGS = {
  eyebrow: 'EDITORIAL INDEPENDIENTE',
  title: 'Tu historia merece ser contada de la manera más',
  highlighted_word: 'hermosa',
  subtitle: 'Ayudamos a autores independientes a maquetar, corregir, diseñar y distribuir sus libros a nivel global con calidad profesional.',
  primary_button_text: 'Ver Servicios',
  primary_button_url: '#servicios',
  secondary_button_text: 'Conoce el Catálogo',
  secondary_button_url: '#libros',
  background_image_url: '',
  side_image_url: '',
  featured_book_id: '',
  show_featured_book: true,
  active: true
};

const DEFAULT_HERO_QUICK_SERVICES = [
  { id: 'hqs-1', label: 'Feather Pen', icon_name: 'feather', link_url: '#servicios', display_order: 1, active: true },
  { id: 'hqs-2', label: 'E-Books', icon_name: 'book', link_url: '#servicios', display_order: 2, active: true },
  { id: 'hqs-3', label: 'Maquetación', icon_name: 'layout', link_url: '#servicios', display_order: 3, active: true },
  { id: 'hqs-4', label: 'Publicación', icon_name: 'upload', link_url: '#servicios', display_order: 4, active: true }
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
  const [error, setError] = useState(null);

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
  const [serviceImageUrl, setServiceImageUrl] = useState('');
  const [serviceBackgroundUrl, setServiceBackgroundUrl] = useState('');
  const [serviceIconName, setServiceIconName] = useState('feather');
  const [serviceColorTheme, setServiceColorTheme] = useState('gold');

  // 3. Libros Form states
  const [booksTab, setBooksTab] = useState('libros'); // 'libros' o 'categorias'
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

  // New Libros fields
  const [bookOrigin, setBookOrigin] = useState('published_by_noveli'); // published_by_noveli, author_purchase
  const [bookPurchaseType, setBookPurchaseType] = useState('noveli'); // noveli, external_author, no_purchase
  const [bookAuthorPurchaseLink, setBookAuthorPurchaseLink] = useState('');
  const [bookNoveliPurchaseLink, setBookNoveliPurchaseLink] = useState('');
  const [bookNovelty, setBookNovelty] = useState(false);
  const [bookUpcoming, setBookUpcoming] = useState(false);
  const [bookSelectedCategories, setBookSelectedCategories] = useState([]); // array of category IDs

  // Categorías Form states
  const [categories, setCategories] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [categoryType, setCategoryType] = useState('genre'); // main, genre, collection
  const [categoryParentId, setCategoryParentId] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryActive, setCategoryActive] = useState(true);

  // Hero Form states
  const [heroTab, setHeroTab] = useState('configuracion'); // 'configuracion' o 'servicios'
  const [heroConfigId, setHeroConfigId] = useState(null);
  const [heroEyebrow, setHeroEyebrow] = useState('');
  const [heroTitleState, setHeroTitleState] = useState(''); // named State to avoid name collision with standard browser globals
  const [heroHighlightedWord, setHeroHighlightedWord] = useState('');
  const [heroSubtitleText, setHeroSubtitleText] = useState('');
  const [heroPrimaryBtnText, setHeroPrimaryBtnText] = useState('');
  const [heroPrimaryBtnUrl, setHeroPrimaryBtnUrl] = useState('');
  const [heroSecondaryBtnText, setHeroSecondaryBtnText] = useState('');
  const [heroSecondaryBtnUrl, setHeroSecondaryBtnUrl] = useState('');
  const [heroBgImageUrl, setHeroBgImageUrl] = useState('');
  const [heroSideImageUrl, setHeroSideImageUrl] = useState('');
  const [heroFeaturedBookId, setHeroFeaturedBookId] = useState('');
  const [heroShowFeaturedBook, setHeroShowFeaturedBook] = useState(true);
  const [heroActive, setHeroActive] = useState(true);

  const [heroQuickServices, setHeroQuickServices] = useState([]);
  const [editingQuickService, setEditingQuickService] = useState(null);
  const [quickServiceLabel, setQuickServiceLabel] = useState('');
  const [quickServiceIconName, setQuickServiceIconName] = useState('feather');
  const [quickServiceLinkUrl, setQuickServiceLinkUrl] = useState('');
  const [quickServiceActive, setQuickServiceActive] = useState(true);

  // Footer Form states
  const [footerTab, setFooterTab] = useState('configuracion'); // 'configuracion' o 'galeria'
  const [footerConfigId, setFooterConfigId] = useState(null);
  const [footerContactTitle, setFooterContactTitle] = useState('');
  const [footerContactEmail, setFooterContactEmail] = useState('');
  const [footerContactLocation, setFooterContactLocation] = useState('');
  const [footerContactDescription, setFooterContactDescription] = useState('');
  const [footerInstagramTitle, setFooterInstagramTitle] = useState('');
  const [footerInstagramUrl, setFooterInstagramUrl] = useState('');
  const [footerInstagramEnabled, setFooterInstagramEnabled] = useState(true);
  const [footerActive, setFooterActive] = useState(true);

  const [footerGallery, setFooterGallery] = useState([]);
  const [editingFooterImage, setEditingFooterImage] = useState(null);
  const [footerImageUrl, setFooterImageUrl] = useState('');
  const [footerImageTitle, setFooterImageTitle] = useState('');
  const [footerImageLinkUrl, setFooterImageLinkUrl] = useState('');
  const [footerImageActive, setFooterImageActive] = useState(true);

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
    fetchCategories();
    fetchBooks();
    fetchLinks();
    fetchSections();
    fetchLeads();
    fetchFooterSettings();
    fetchFooterGallery();
    fetchHeroSettings();
    fetchHeroQuickServices();
  }, [realtimeTrigger]);

  useEffect(() => {
    if (currentPath === 'solicitudes') {
      fetchLeads();
    } else if (currentPath === 'libros') {
      fetchCategories();
      fetchBooks();
    } else if (currentPath === 'footer') {
      fetchFooterSettings();
      fetchFooterGallery();
    } else if (currentPath === 'hero') {
      fetchBooks();
      fetchHeroSettings();
      fetchHeroQuickServices();
    }
  }, [currentPath]);

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

  const organizationId = getOrgId();

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('website_leads')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLeads(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando solicitudes web:', error);
      setError(error.message || 'Error cargando solicitudes web');
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: error.message,
          error_stack: error.stack || '',
          module: 'website-solicitudes',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchLeads();
    }
  }, [organizationId]);

  // --- FOOTER DATABASE OPS ---
  const fetchFooterSettings = async () => {
    try {
      if (isMock) {
        loadMockFooterSettings();
        return;
      }
      const { data, error } = await supabase
        .from('website_footer_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .limit(1);

      if (error) {
        throw error;
      } else if (data && data.length > 0) {
        const row = data[0];
        setFooterConfigId(row.id);
        setFooterContactTitle(row.contact_title || '');
        setFooterContactEmail(row.contact_email || '');
        setFooterContactLocation(row.contact_location || '');
        setFooterContactDescription(row.contact_description || '');
        setFooterInstagramTitle(row.instagram_title || '');
        setFooterInstagramUrl(row.instagram_url || '');
        setFooterInstagramEnabled(row.instagram_enabled !== false);
        setFooterActive(row.active !== false);
      } else {
        loadMockFooterSettings();
      }
    } catch (error) {
      console.error('Error cargando website_footer_settings:', error);
      loadMockFooterSettings();
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: error.message,
          error_stack: error.stack || '',
          module: 'website-footer',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
      }
    }
  };

  const loadMockFooterSettings = () => {
    const saved = localStorage.getItem('somos_noveli_footer_settings_cms');
    const settings = saved ? JSON.parse(saved) : DEFAULT_FOOTER_SETTINGS;
    setFooterConfigId(settings.id || 'mock-footer-settings-id');
    setFooterContactTitle(settings.contact_title || '');
    setFooterContactEmail(settings.contact_email || '');
    setFooterContactLocation(settings.contact_location || '');
    setFooterContactDescription(settings.contact_description || '');
    setFooterInstagramTitle(settings.instagram_title || '');
    setFooterInstagramUrl(settings.instagram_url || '');
    setFooterInstagramEnabled(settings.instagram_enabled !== false);
    setFooterActive(settings.active !== false);
  };

  const fetchFooterGallery = async () => {
    try {
      if (isMock) {
        loadMockFooterGallery();
        return;
      }
      const { data, error } = await supabase
        .from('website_footer_gallery')
        .select('*')
        .eq('organization_id', organizationId)
        .order('display_order', { ascending: true });

      if (error) {
        throw error;
      } else {
        setFooterGallery(data || []);
      }
    } catch (error) {
      console.error('Error cargando website_footer_gallery:', error);
      loadMockFooterGallery();
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: error.message,
          error_stack: error.stack || '',
          module: 'website-footer',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
      }
    }
  };

  const loadMockFooterGallery = () => {
    const saved = localStorage.getItem('somos_noveli_footer_gallery_cms');
    setFooterGallery(saved ? JSON.parse(saved) : DEFAULT_FOOTER_GALLERY);
  };

  const handleSaveFooterSettings = async (e) => {
    if (e) e.preventDefault();
    if (isReadOnly) return;
    setLoading(true);
    try {
      const payload = {
        organization_id: organizationId,
        contact_title: footerContactTitle,
        contact_email: footerContactEmail,
        contact_location: footerContactLocation,
        contact_description: footerContactDescription,
        instagram_title: footerInstagramTitle,
        instagram_url: footerInstagramUrl,
        instagram_enabled: footerInstagramEnabled,
        active: footerActive,
        updated_at: new Date().toISOString()
      };

      if (isMock || usingMockDb) {
        localStorage.setItem('somos_noveli_footer_settings_cms', JSON.stringify({ id: footerConfigId, ...payload }));
      } else {
        if (footerConfigId) {
          const { error } = await supabase
            .from('website_footer_settings')
            .update(payload)
            .eq('id', footerConfigId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('website_footer_settings')
            .insert([payload])
            .select();
          if (error) throw error;
          if (data && data.length > 0) {
            setFooterConfigId(data[0].id);
          }
        }
      }
      alert("Configuración de footer guardada con éxito.");
      await fetchFooterSettings();
    } catch (error) {
      console.error('Error guardando footer settings:', error);
      alert(`Error al guardar configuración: ${error.message}`);
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: error.message,
          error_stack: error.stack || '',
          module: 'website-footer',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFooterGalleryImage = async (e) => {
    if (e) e.preventDefault();
    if (isReadOnly) return;
    if (!footerImageUrl) {
      alert("Por favor carga o introduce una URL de imagen.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        organization_id: organizationId,
        image_url: footerImageUrl,
        title: footerImageTitle,
        link_url: footerImageLinkUrl,
        active: footerImageActive
      };

      if (editingFooterImage) {
        if (isMock || usingMockDb) {
          const updated = footerGallery.map(img => img.id === editingFooterImage.id ? { ...img, ...payload } : img);
          setFooterGallery(updated);
          localStorage.setItem('somos_noveli_footer_gallery_cms', JSON.stringify(updated));
        } else {
          const { error } = await supabase
            .from('website_footer_gallery')
            .update(payload)
            .eq('id', editingFooterImage.id);
          if (error) throw error;
        }
      } else {
        const nextOrder = footerGallery.length > 0 ? Math.max(...footerGallery.map(img => img.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, display_order: nextOrder };

        if (isMock || usingMockDb) {
          const updated = [...footerGallery, { id: `fg-${Date.now()}`, ...insertPayload }];
          setFooterGallery(updated);
          localStorage.setItem('somos_noveli_footer_gallery_cms', JSON.stringify(updated));
        } else {
          const { error } = await supabase
            .from('website_footer_gallery')
            .insert([insertPayload]);
          if (error) throw error;
        }
      }
      resetFooterImageForm();
      await fetchFooterGallery();
      alert("Imagen de galería guardada con éxito.");
    } catch (error) {
      console.error('Error guardando imagen en galería:', error);
      alert(`Error al guardar imagen: ${error.message}`);
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: error.message,
          error_stack: error.stack || '',
          module: 'website-footer',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetFooterImageForm = () => {
    setEditingFooterImage(null);
    setFooterImageUrl('');
    setFooterImageTitle('');
    setFooterImageLinkUrl('');
    setFooterImageActive(true);
  };

  const startEditFooterImage = (img) => {
    setEditingFooterImage(img);
    setFooterImageUrl(img.image_url || '');
    setFooterImageTitle(img.title || '');
    setFooterImageLinkUrl(img.link_url || '');
    setFooterImageActive(img.active !== false);
  };

  const handleDeleteFooterGalleryImage = async (id) => {
    if (isReadOnly) return;
    if (!window.confirm("¿Seguro que deseas eliminar esta imagen de la galería?")) return;
    setLoading(true);
    try {
      if (isMock || usingMockDb) {
        const updated = footerGallery.filter(img => img.id !== id);
        setFooterGallery(updated);
        localStorage.setItem('somos_noveli_footer_gallery_cms', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('website_footer_gallery')
          .delete()
          .eq('id', id);
        if (error) throw error;
      }
      await fetchFooterGallery();
      alert("Imagen eliminada de la galería.");
    } catch (error) {
      console.error('Error eliminando imagen de galería:', error);
      alert(`Error al eliminar: ${error.message}`);
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: error.message,
          error_stack: error.stack || '',
          module: 'website-footer',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleFooterImageActive = async (img) => {
    if (isReadOnly) return;
    const newVal = !img.active;
    try {
      if (isMock || usingMockDb) {
        const updated = footerGallery.map(i => i.id === img.id ? { ...i, active: newVal } : i);
        setFooterGallery(updated);
        localStorage.setItem('somos_noveli_footer_gallery_cms', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('website_footer_gallery')
          .update({ active: newVal })
          .eq('id', img.id);
        if (error) throw error;
      }
      setFooterGallery(footerGallery.map(i => i.id === img.id ? { ...i, active: newVal } : i));
    } catch (error) {
      console.error('Error toggling active state on footer image:', error);
    }
  };

  const moveFooterGalleryImageOrder = async (index, direction) => {
    if (isReadOnly) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= footerGallery.length) return;

    const list = [...footerGallery];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const updated = list.map((item, idx) => ({ ...item, display_order: idx + 1 }));
    setFooterGallery(updated);

    try {
      if (isMock || usingMockDb) {
        localStorage.setItem('somos_noveli_footer_gallery_cms', JSON.stringify(updated));
      } else {
        const promises = updated.map(item => supabase
          .from('website_footer_gallery')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
        );
        await Promise.all(promises);
      }
    } catch (error) {
      console.error('Error moving footer gallery order:', error);
    }
  };

  // --- HERO DATABASE OPS ---
  const fetchHeroSettings = async () => {
    try {
      if (isMock) {
        loadMockHeroSettings();
        return;
      }
      const { data, error } = await supabase
        .from('website_hero_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .limit(1);

      if (error) {
        throw error;
      } else if (data && data.length > 0) {
        const row = data[0];
        setHeroConfigId(row.id);
        setHeroEyebrow(row.eyebrow || '');
        setHeroTitleState(row.title || '');
        setHeroHighlightedWord(row.highlighted_word || '');
        setHeroSubtitleText(row.subtitle || '');
        setHeroPrimaryBtnText(row.primary_button_text || '');
        setHeroPrimaryBtnUrl(row.primary_button_url || '');
        setHeroSecondaryBtnText(row.secondary_button_text || '');
        setHeroSecondaryBtnUrl(row.secondary_button_url || '');
        setHeroBgImageUrl(row.background_image_url || '');
        setHeroSideImageUrl(row.side_image_url || '');
        setHeroFeaturedBookId(row.featured_book_id || '');
        setHeroShowFeaturedBook(row.show_featured_book !== false);
        setHeroActive(row.active !== false);
      } else {
        loadMockHeroSettings();
      }
    } catch (error) {
      console.error('Error cargando website_hero_settings:', error);
      loadMockHeroSettings();
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: error.message,
          error_stack: error.stack || '',
          module: 'website-hero',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
      }
    }
  };

  const loadMockHeroSettings = () => {
    const saved = localStorage.getItem('somos_noveli_hero_settings_cms');
    const settings = saved ? JSON.parse(saved) : DEFAULT_HERO_SETTINGS;
    setHeroConfigId(settings.id || 'mock-hero-settings-id');
    setHeroEyebrow(settings.eyebrow || '');
    setHeroTitleState(settings.title || '');
    setHeroHighlightedWord(settings.highlighted_word || '');
    setHeroSubtitleText(settings.subtitle || '');
    setHeroPrimaryBtnText(settings.primary_button_text || '');
    setHeroPrimaryBtnUrl(settings.primary_button_url || '');
    setHeroSecondaryBtnText(settings.secondary_button_text || '');
    setHeroSecondaryBtnUrl(settings.secondary_button_url || '');
    setHeroBgImageUrl(settings.background_image_url || '');
    setHeroSideImageUrl(settings.side_image_url || '');
    setHeroFeaturedBookId(settings.featured_book_id || '');
    setHeroShowFeaturedBook(settings.show_featured_book !== false);
    setHeroActive(settings.active !== false);
  };

  const fetchHeroQuickServices = async () => {
    try {
      if (isMock) {
        loadMockHeroQuickServices();
        return;
      }
      const { data, error } = await supabase
        .from('website_hero_quick_services')
        .select('*')
        .eq('organization_id', organizationId)
        .order('display_order', { ascending: true });

      if (error) {
        throw error;
      } else {
        setHeroQuickServices(data || []);
      }
    } catch (error) {
      console.error('Error cargando website_hero_quick_services:', error);
      loadMockHeroQuickServices();
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: error.message,
          error_stack: error.stack || '',
          module: 'website-hero',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
      }
    }
  };

  const loadMockHeroQuickServices = () => {
    const saved = localStorage.getItem('somos_noveli_hero_quick_services_cms');
    setHeroQuickServices(saved ? JSON.parse(saved) : DEFAULT_HERO_QUICK_SERVICES);
  };

  const handleSaveHeroSettings = async (e) => {
    if (e) e.preventDefault();
    if (isReadOnly) return;
    setLoading(true);
    try {
      const payload = {
        organization_id: organizationId,
        eyebrow: heroEyebrow,
        title: heroTitleState,
        highlighted_word: heroHighlightedWord,
        subtitle: heroSubtitleText,
        primary_button_text: heroPrimaryBtnText,
        primary_button_url: heroPrimaryBtnUrl,
        secondary_button_text: heroSecondaryBtnText,
        secondary_button_url: heroSecondaryBtnUrl,
        background_image_url: heroBgImageUrl,
        side_image_url: heroSideImageUrl,
        featured_book_id: heroFeaturedBookId || null,
        show_featured_book: heroShowFeaturedBook,
        active: heroActive,
        updated_at: new Date().toISOString()
      };

      if (isMock || usingMockDb) {
        localStorage.setItem('somos_noveli_hero_settings_cms', JSON.stringify({ id: heroConfigId, ...payload }));
      } else {
        if (heroConfigId) {
          const { error } = await supabase
            .from('website_hero_settings')
            .update(payload)
            .eq('id', heroConfigId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('website_hero_settings')
            .insert([payload])
            .select();
          if (error) throw error;
          if (data && data.length > 0) {
            setHeroConfigId(data[0].id);
          }
        }
      }
      alert("Configuración de Hero guardada con éxito.");
      await fetchHeroSettings();
    } catch (error) {
      console.error('Error guardando hero settings:', error);
      alert(`Error al guardar configuración: ${error.message}`);
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: error.message,
          error_stack: error.stack || '',
          module: 'website-hero',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHeroQuickService = async (e) => {
    if (e) e.preventDefault();
    if (isReadOnly) return;
    if (!quickServiceLabel) {
      alert("Por favor introduce una etiqueta.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        organization_id: organizationId,
        label: quickServiceLabel,
        icon_name: quickServiceIconName,
        link_url: quickServiceLinkUrl,
        active: quickServiceActive
      };

      if (editingQuickService) {
        if (isMock || usingMockDb) {
          const updated = heroQuickServices.map(qs => qs.id === editingQuickService.id ? { ...qs, ...payload } : qs);
          setHeroQuickServices(updated);
          localStorage.setItem('somos_noveli_hero_quick_services_cms', JSON.stringify(updated));
        } else {
          const { error } = await supabase
            .from('website_hero_quick_services')
            .update(payload)
            .eq('id', editingQuickService.id);
          if (error) throw error;
        }
      } else {
        const nextOrder = heroQuickServices.length > 0 ? Math.max(...heroQuickServices.map(qs => qs.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, display_order: nextOrder };

        if (isMock || usingMockDb) {
          const updated = [...heroQuickServices, { id: `hqs-${Date.now()}`, ...insertPayload }];
          setHeroQuickServices(updated);
          localStorage.setItem('somos_noveli_hero_quick_services_cms', JSON.stringify(updated));
        } else {
          const { error } = await supabase
            .from('website_hero_quick_services')
            .insert([insertPayload]);
          if (error) throw error;
        }
      }
      resetHeroQuickServiceForm();
      await fetchHeroQuickServices();
      alert("Servicio rápido guardado con éxito.");
    } catch (error) {
      console.error('Error guardando servicio rápido de hero:', error);
      alert(`Error al guardar: ${error.message}`);
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: error.message,
          error_stack: error.stack || '',
          module: 'website-hero',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetHeroQuickServiceForm = () => {
    setEditingQuickService(null);
    setQuickServiceLabel('');
    setQuickServiceIconName('feather');
    setQuickServiceLinkUrl('');
    setQuickServiceActive(true);
  };

  const startEditHeroQuickService = (qs) => {
    setEditingQuickService(qs);
    setQuickServiceLabel(qs.label || '');
    setQuickServiceIconName(qs.icon_name || 'feather');
    setQuickServiceLinkUrl(qs.link_url || '');
    setQuickServiceActive(qs.active !== false);
  };

  const handleDeleteHeroQuickService = async (id) => {
    if (isReadOnly) return;
    if (!window.confirm("¿Seguro que deseas eliminar este servicio rápido de hero?")) return;
    setLoading(true);
    try {
      if (isMock || usingMockDb) {
        const updated = heroQuickServices.filter(qs => qs.id !== id);
        setHeroQuickServices(updated);
        localStorage.setItem('somos_noveli_hero_quick_services_cms', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('website_hero_quick_services')
          .delete()
          .eq('id', id);
        if (error) throw error;
      }
      await fetchHeroQuickServices();
      alert("Servicio rápido de hero eliminado.");
    } catch (error) {
      console.error('Error eliminando servicio rápido de hero:', error);
      alert(`Error al eliminar: ${error.message}`);
      try {
        await supabase.from('crm_error_logs').insert({
          error_message: error.message,
          error_stack: error.stack || '',
          module: 'website-hero',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleHeroQuickServiceActive = async (qs) => {
    if (isReadOnly) return;
    const newVal = !qs.active;
    try {
      if (isMock || usingMockDb) {
        const updated = heroQuickServices.map(i => i.id === qs.id ? { ...i, active: newVal } : i);
        setHeroQuickServices(updated);
        localStorage.setItem('somos_noveli_hero_quick_services_cms', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('website_hero_quick_services')
          .update({ active: newVal })
          .eq('id', qs.id);
        if (error) throw error;
      }
      setHeroQuickServices(heroQuickServices.map(i => i.id === qs.id ? { ...i, active: newVal } : i));
    } catch (error) {
      console.error('Error toggling active state on hero quick service:', error);
    }
  };

  const moveHeroQuickServiceOrder = async (index, direction) => {
    if (isReadOnly) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= heroQuickServices.length) return;

    const list = [...heroQuickServices];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const updated = list.map((item, idx) => ({ ...item, display_order: idx + 1 }));
    setHeroQuickServices(updated);

    try {
      if (isMock || usingMockDb) {
        localStorage.setItem('somos_noveli_hero_quick_services_cms', JSON.stringify(updated));
      } else {
        const promises = updated.map(item => supabase
          .from('website_hero_quick_services')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
        );
        await Promise.all(promises);
      }
    } catch (error) {
      console.error('Error moving hero quick service order:', error);
    }
  };

  const handleUploadHeroFile = async (e, field) => {
    const file = e.target.files[0];
    if (!file || isReadOnly) return;
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_hero_${field}.${fileExt}`;
      const storagePath = `${getOrgId()}/website/hero/${fileName}`;

      let finalUrl = '';
      if (isMock || usingMockDb) {
        finalUrl = `mock://hero/${storagePath}`;
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

      if (field === 'background') {
        setHeroBgImageUrl(finalUrl);
      } else if (field === 'side') {
        setHeroSideImageUrl(finalUrl);
      }
      alert("Imagen subida correctamente.");
    } catch (err) {
      alert(`Error al subir archivo: ${err.message}`);
    } finally {
      setLoading(false);
    }
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
        organization_id: getOrgId(),
        image_url: serviceImageUrl,
        background_url: serviceBackgroundUrl,
        icon_name: serviceIconName,
        color_theme: serviceColorTheme
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
        // Fetch categories and links
        const { data: catLinks } = await supabase
          .from('website_book_category_links')
          .select('*');

        const booksWithCategories = (data || []).map(b => {
          const linksForBook = (catLinks || []).filter(l => l.book_id === b.id);
          return {
            ...b,
            categories: linksForBook.map(l => l.category_id)
          };
        });
        setBooks(booksWithCategories);
      }
    } catch (_) {
      loadMockBooks();
    }
  };

  const loadMockBooks = () => {
    const saved = localStorage.getItem('somos_noveli_books_cms');
    const mockBooks = saved ? JSON.parse(saved) : DEFAULT_WEB_BOOKS;
    const savedLinks = localStorage.getItem('somos_noveli_category_links_cms');
    const mockLinks = savedLinks ? JSON.parse(savedLinks) : [];

    const mapped = mockBooks.map(b => {
      const linksForBook = mockLinks.filter(l => l.book_id === b.id);
      return {
        ...b,
        categories: linksForBook.map(l => l.category_id)
      };
    });
    setBooks(mapped);
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
        organization_id: getOrgId(),
        // New fields
        book_origin: bookOrigin,
        purchase_type: bookPurchaseType,
        author_purchase_link: bookAuthorPurchaseLink,
        noveli_purchase_link: bookNoveliPurchaseLink,
        novelty: bookNovelty,
        upcoming: bookUpcoming
      };

      let bookId = editingBook?.id;
      if (editingBook) {
        if (isMock || usingMockDb) {
          const updated = books.map(b => b.id === editingBook.id ? { ...b, ...payload } : b);
          setBooks(updated);
          localStorage.setItem('somos_noveli_books_cms', JSON.stringify(updated));
        } else {
          await supabase.from('website_books').update(payload).eq('id', bookId);
        }
      } else {
        const newOrder = books.length > 0 ? Math.max(...books.map(b => b.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, display_order: newOrder };
        if (isMock || usingMockDb) {
          bookId = `wb-${Date.now()}`;
          const updated = [...books, { ...insertPayload, id: bookId }];
          setBooks(updated);
          localStorage.setItem('somos_noveli_books_cms', JSON.stringify(updated));
        } else {
          const { data: insertedData, error: insertError } = await supabase
            .from('website_books')
            .insert([insertPayload])
            .select();
          if (insertError) throw insertError;
          bookId = insertedData[0].id;
        }
      }

      // Save category links
      if (isMock || usingMockDb) {
        const savedLinks = localStorage.getItem('somos_noveli_category_links_cms');
        let mockLinks = savedLinks ? JSON.parse(savedLinks) : [];
        // Delete existing links for this book
        mockLinks = mockLinks.filter(l => l.book_id !== bookId);
        // Insert new ones
        bookSelectedCategories.forEach(catId => {
          mockLinks.push({
            id: `bl-${Date.now()}-${catId}`,
            book_id: bookId,
            category_id: catId,
            organization_id: getOrgId()
          });
        });
        localStorage.setItem('somos_noveli_category_links_cms', JSON.stringify(mockLinks));
      } else {
        // Delete existing links for this book in Supabase
        await supabase
          .from('website_book_category_links')
          .delete()
          .eq('book_id', bookId);
        
        // Insert new links
        if (bookSelectedCategories.length > 0) {
          const linksToInsert = bookSelectedCategories.map(catId => ({
            book_id: bookId,
            category_id: catId,
            organization_id: getOrgId()
          }));
          await supabase
            .from('website_book_category_links')
            .insert(linksToInsert);
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
        
        // Also delete category links
        const savedLinks = localStorage.getItem('somos_noveli_category_links_cms');
        if (savedLinks) {
          const mockLinks = JSON.parse(savedLinks).filter(l => l.book_id !== id);
          localStorage.setItem('somos_noveli_category_links_cms', JSON.stringify(mockLinks));
        }
      } else {
        await supabase.from('website_books').delete().eq('id', id);
      }
      setBooks(books.filter(b => b.id !== id));
    } catch (_) {}
  };

  // --- CATEGORÍAS DATABASE OPS ---
  const fetchCategories = async () => {
    try {
      if (isMock) {
        loadMockCategories();
        return;
      }
      const { data, error } = await supabase
        .from('website_book_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        loadMockCategories();
      } else {
        setCategories(data || []);
      }
    } catch (_) {
      loadMockCategories();
    }
  };

  const loadMockCategories = () => {
    const saved = localStorage.getItem('somos_noveli_categories_cms');
    if (saved) {
      setCategories(JSON.parse(saved));
    } else {
      const defaultCats = [
        { id: 'cat-main-1', name: 'Publicados por Noveli', slug: 'publicados-por-noveli', type: 'main', active: true, display_order: 1, organization_id: getOrgId() },
        { id: 'cat-main-2', name: 'Compra con el autor', slug: 'compra-con-el-autor', type: 'main', active: true, display_order: 2, organization_id: getOrgId() }
      ];
      setCategories(defaultCats);
      localStorage.setItem('somos_noveli_categories_cms', JSON.stringify(defaultCats));
    }
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    setLoading(true);

    const payload = {
      name: categoryName,
      slug: categorySlug || generateSlug(categoryName),
      type: categoryType,
      parent_id: categoryParentId || null,
      description: categoryDescription,
      active: categoryActive,
      organization_id: getOrgId()
    };

    try {
      if (editingCategory) {
        if (isMock || usingMockDb) {
          const updated = categories.map(c => c.id === editingCategory.id ? { ...c, ...payload } : c);
          setCategories(updated);
          localStorage.setItem('somos_noveli_categories_cms', JSON.stringify(updated));
        } else {
          await supabase.from('website_book_categories').update(payload).eq('id', editingCategory.id);
        }
      } else {
        const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.display_order || 0)) + 1 : 1;
        const insertPayload = { ...payload, display_order: nextOrder };

        if (isMock || usingMockDb) {
          const newId = `cat-${Date.now()}`;
          const updated = [...categories, { ...insertPayload, id: newId }];
          setCategories(updated);
          localStorage.setItem('somos_noveli_categories_cms', JSON.stringify(updated));
        } else {
          await supabase.from('website_book_categories').insert([insertPayload]);
        }
      }
      resetCategoryForm();
      await fetchCategories();
      alert("Categoría guardada.");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategoryBool = async (category, field) => {
    if (isReadOnly) return;
    const newVal = !category[field];
    try {
      if (isMock || usingMockDb) {
        const updated = categories.map(c => c.id === category.id ? { ...c, [field]: newVal } : c);
        setCategories(updated);
        localStorage.setItem('somos_noveli_categories_cms', JSON.stringify(updated));
      } else {
        await supabase.from('website_book_categories').update({ [field]: newVal }).eq('id', category.id);
      }
      setCategories(categories.map(c => c.id === category.id ? { ...c, [field]: newVal } : c));
    } catch (_) {}
  };

  const moveCategoryOrder = async (index, direction) => {
    if (isReadOnly) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= categories.length) return;

    const list = [...categories];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const updated = list.map((item, idx) => ({ ...item, display_order: idx + 1 }));
    setCategories(updated);

    try {
      if (isMock || usingMockDb) {
        localStorage.setItem('somos_noveli_categories_cms', JSON.stringify(updated));
      } else {
        const promises = updated.map(item => supabase
          .from('website_book_categories')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
        );
        await Promise.all(promises);
      }
    } catch (_) {}
  };

  const handleDeleteCategory = async (cat) => {
    if (isReadOnly) return;
    if (cat.type === 'main' && (cat.slug === 'publicados-por-noveli' || cat.slug === 'compra-con-el-autor')) {
      alert("No se pueden eliminar las categorías principales por defecto.");
      return;
    }
    if (!window.confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;

    try {
      if (isMock || usingMockDb) {
        const updated = categories.filter(c => c.id !== cat.id);
        setCategories(updated);
        localStorage.setItem('somos_noveli_categories_cms', JSON.stringify(updated));
        
        // Also delete category links for this category
        const savedLinks = localStorage.getItem('somos_noveli_category_links_cms');
        if (savedLinks) {
          const mockLinks = JSON.parse(savedLinks).filter(l => l.category_id !== cat.id);
          localStorage.setItem('somos_noveli_category_links_cms', JSON.stringify(mockLinks));
        }
      } else {
        await supabase.from('website_book_categories').delete().eq('id', cat.id);
      }
      setCategories(categories.filter(c => c.id !== cat.id));
      await fetchBooks(); // Refresh book categories mapping since category was deleted
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

  const handleUploadServiceFile = async (e, field) => {
    const file = e.target.files[0];
    if (!file || isReadOnly) return;
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_service_${field}.${fileExt}`;
      const storagePath = `${getOrgId()}/website/services/${fileName}`;

      let finalUrl = '';
      if (isMock || usingMockDb) {
        finalUrl = `mock://services/${storagePath}`;
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

      if (field === 'image') {
        setServiceImageUrl(finalUrl);
      } else if (field === 'background') {
        setServiceBackgroundUrl(finalUrl);
      }
      alert("Archivo subido correctamente.");
    } catch (err) {
      alert(`Error al subir archivo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFooterImage = async (e) => {
    const file = e.target.files[0];
    if (!file || isReadOnly) return;
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_footer_${Math.round(Math.random() * 1000)}.${fileExt}`;
      const storagePath = `${getOrgId()}/website/footer/${fileName}`;

      let finalUrl = '';
      if (isMock || usingMockDb) {
        finalUrl = `mock://footer/${storagePath}`;
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

      setFooterImageUrl(finalUrl);
      alert("Imagen subida correctamente.");
    } catch (err) {
      alert(`Error al subir archivo: ${err.message}`);
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
    setServiceImageUrl('');
    setServiceBackgroundUrl('');
    setServiceIconName('feather');
    setServiceColorTheme('gold');
  };

  const startEditService = (service) => {
    setEditingService(service);
    setServiceTitle(service.title || '');
    setServiceShortDesc(service.short_description || '');
    setServiceFullDesc(service.full_description || '');
    setServicePrice(service.price_from ? String(service.price_from) : '0');
    setServiceCategory(service.category || 'Editorial');
    setServiceFeatured(!!service.featured);
    setServiceVisible(service.visible_on_website !== false);
    setServiceActive(service.active !== false);
    setServiceImageUrl(service.image_url || '');
    setServiceBackgroundUrl(service.background_url || '');
    setServiceIconName(service.icon_name || 'feather');
    setServiceColorTheme(service.color_theme || 'gold');
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
    setBookOrigin('published_by_noveli');
    setBookPurchaseType('noveli');
    setBookAuthorPurchaseLink('');
    setBookNoveliPurchaseLink('');
    setBookNovelty(false);
    setBookUpcoming(false);
    setBookSelectedCategories([]);
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategorySlug('');
    setCategoryType('genre');
    setCategoryParentId('');
    setCategoryDescription('');
    setCategoryActive(true);
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
    setBookSalePlatform(book.sale_platform || 'Amazon');
    setBookOrigin(book.book_origin || 'published_by_noveli');
    setBookPurchaseType(book.purchase_type || 'noveli');
    setBookAuthorPurchaseLink(book.author_purchase_link || '');
    setBookNoveliPurchaseLink(book.noveli_purchase_link || '');
    setBookNovelty(!!book.novelty);
    setBookUpcoming(!!book.upcoming);
    setBookSelectedCategories(book.categories || []);
  };

  const startEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryName(cat.name || '');
    setCategorySlug(cat.slug || '');
    setCategoryType(cat.type || 'genre');
    setCategoryParentId(cat.parent_id || '');
    setCategoryDescription(cat.description || '');
    setCategoryActive(cat.active !== false);
  };

  const generateSlug = (text) => {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  // --- 6. WEBSITE LEADS OPS ---

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

  const safeLeads = Array.isArray(leads) ? leads : [];
  const filteredLeads = safeLeads.filter(lead => {
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
               currentPath === 'libros' ? 'Catálogo Web' : 
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

            {/* 3. Catálogo Web */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-xl w-fit">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">3. Catálogo Web</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Carga libros destacados en el catálogo, administra sus categorías/subcategorías, sube portadas de libros y asocia enlaces de venta directa.
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
                  {safeLeads.length} solicitudes registradas ({safeLeads.filter(l => l.status === 'nuevo').length} nuevas)
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

            {/* 7. Footer Web */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl w-fit">
                  <Layout className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">7. Footer Web</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Configura el contacto, enlace de Instagram y la galería de fotos miniaturas que se muestran en el pie de página.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                  {footerGallery.length} fotos en galería ({footerGallery.filter(i => i.active).length} activas)
                </div>
              </div>
              <button
                onClick={() => navigateTo('footer')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Configurar Footer</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 8. Hero Principal */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-sky-50 dark:bg-sky-955/20 text-sky-650 dark:text-sky-400 rounded-xl w-fit">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">8. Hero Principal</h3>
                <p className="text-xs text-slate-455 dark:text-slate-400 leading-relaxed">
                  Configura la sección principal de la landing page con títulos, subtítulos, botones, imágenes y servicios rápidos.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                  {heroQuickServices.length} servicios rápidos ({heroQuickServices.filter(i => i.active).length} activos)
                </div>
              </div>
              <button
                onClick={() => navigateTo('hero')}
                className="flex items-center justify-center space-x-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-transparent"
              >
                <span>Configurar Hero</span>
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
                        <td className="py-3 font-bold text-slate-750 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              s.color_theme === 'gold' ? 'bg-amber-500' :
                              s.color_theme === 'burgundy' ? 'bg-red-700' :
                              s.color_theme === 'green' ? 'bg-emerald-600' :
                              s.color_theme === 'blue' ? 'bg-blue-600' :
                              s.color_theme === 'purple' ? 'bg-purple-600' :
                              s.color_theme === 'rose' ? 'bg-rose-500' : 'bg-amber-500'
                            }`} title={`Tema: ${s.color_theme || 'gold'}`} />
                            <div className="flex flex-col">
                              <span>{s.title}</span>
                              <span className="text-[9px] text-slate-400 font-mono font-normal">Icono: {s.icon_name || 'feather'}</span>
                            </div>
                          </div>
                        </td>
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

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Imagen Principal del Servicio (image_url)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={serviceImageUrl}
                      onChange={e => setServiceImageUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono"
                    />
                    <label className="px-3 py-2 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border cursor-pointer text-xs font-bold shrink-0 flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir</span>
                      <input type="file" accept="image/*" disabled={isReadOnly} onChange={(e) => handleUploadServiceFile(e, 'image')} className="hidden" />
                    </label>
                  </div>
                  {serviceImageUrl && (
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mt-1">
                      <img src={serviceImageUrl.startsWith('mock://') ? 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=100&auto=format&fit=crop&q=60' : serviceImageUrl} className="w-full h-full object-cover" alt="Preview" />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Fondo Decorativo (background_url)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={serviceBackgroundUrl}
                      onChange={e => setServiceBackgroundUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono"
                    />
                    <label className="px-3 py-2 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border cursor-pointer text-xs font-bold shrink-0 flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir</span>
                      <input type="file" accept="image/*" disabled={isReadOnly} onChange={(e) => handleUploadServiceFile(e, 'background')} className="hidden" />
                    </label>
                  </div>
                  {serviceBackgroundUrl && (
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mt-1">
                      <img src={serviceBackgroundUrl.startsWith('mock://') ? 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=100&auto=format&fit=crop&q=60' : serviceBackgroundUrl} className="w-full h-full object-cover" alt="Preview" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Icono</label>
                    <select
                      value={serviceIconName}
                      onChange={e => setServiceIconName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                    >
                      <option value="feather">Pluma (feather)</option>
                      <option value="book">Libro (book)</option>
                      <option value="layout">Diseño (layout)</option>
                      <option value="upload">Subir (upload)</option>
                      <option value="megaphone">Megáfono (megaphone)</option>
                      <option value="shield">Escudo (shield)</option>
                      <option value="file">Archivo (file)</option>
                      <option value="pen">Lápiz (pen)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Tema de Color</label>
                    <select
                      value={serviceColorTheme}
                      onChange={e => setServiceColorTheme(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                    >
                      <option value="gold">Dorado (gold)</option>
                      <option value="burgundy">Burdeos (burgundy)</option>
                      <option value="green">Verde (green)</option>
                      <option value="blue">Azul (blue)</option>
                      <option value="purple">Morado (purple)</option>
                      <option value="rose">Rosa (rose)</option>
                    </select>
                  </div>
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

          {/* Sub-tab selection */}
          <div className="flex border-b border-slate-150 dark:border-slate-800 gap-6">
            <button
              onClick={() => setBooksTab('libros')}
              className={`pb-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-all ${
                booksTab === 'libros'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-500'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
              }`}
            >
              Libros
            </button>
            <button
              onClick={() => setBooksTab('categorias')}
              className={`pb-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-all ${
                booksTab === 'categorias'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-500'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
              }`}
            >
              Categorías
            </button>
          </div>

          {booksTab === 'libros' && (
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
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{b.title}</h4>
                            {b.novelty && (
                              <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-md">
                                Novedad
                              </span>
                            )}
                            {b.upcoming && (
                              <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-md">
                                Próximamente
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Autor: {b.author} • Género: {b.genre} • <span className="text-purple-600 dark:text-purple-400 font-bold uppercase text-[9px] bg-purple-50 dark:bg-purple-950/20 px-1.5 py-0.5 rounded">{b.status || 'Destacado'}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Origen: <span className="font-bold">{b.book_origin === 'published_by_noveli' ? 'Publicado por Noveli' : 'Compra con el autor'}</span> • Compra: <span className="font-bold">{b.purchase_type === 'noveli' ? 'Noveli' : b.purchase_type === 'external_author' ? 'Autor Externo' : 'Sin Compra'}</span>
                          </p>
                          
                          {/* Categories Display */}
                          {b.categories && b.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {b.categories.map(catId => {
                                const cat = categories.find(c => c.id === catId);
                                if (!cat) return null;
                                return (
                                  <span key={catId} className="px-1.5 py-0.2 bg-amber-50 dark:bg-amber-950/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 rounded-full text-[9px] font-medium">
                                    {cat.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
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
                      {b.short_description && <p className="text-xs text-slate-500 italic font-sans leading-relaxed">"{b.short_description}"</p>}
                      
                      {/* Enlaces de compra */}
                      {(b.noveli_purchase_link || b.author_purchase_link || b.sale_url) && (
                        <div className="space-y-1 mt-2 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/20 p-2 rounded-xl">
                          {b.noveli_purchase_link && (
                            <p className="flex items-center gap-1.5">
                              <ShoppingBag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="font-semibold text-slate-600 dark:text-slate-300">Noveli:</span>
                              <a href={b.noveli_purchase_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-[250px] font-mono">{b.noveli_purchase_link}</a>
                            </p>
                          )}
                          {b.author_purchase_link && (
                            <p className="flex items-center gap-1.5">
                              <ShoppingBag className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              <span className="font-semibold text-slate-600 dark:text-slate-300">Autor:</span>
                              <a href={b.author_purchase_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-[250px] font-mono">{b.author_purchase_link}</a>
                            </p>
                          )}
                          {!b.noveli_purchase_link && !b.author_purchase_link && b.sale_url && (
                            <p className="flex items-center gap-1.5">
                              <ShoppingBag className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                              <span className="font-semibold text-slate-600 dark:text-slate-300">{b.sale_platform || 'Venta'}:</span>
                              <a href={b.sale_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-[250px] font-mono">{b.sale_url}</a>
                            </p>
                          )}
                        </div>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Origen del libro</label>
                      <select value={bookOrigin} onChange={e => setBookOrigin(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent">
                        <option value="published_by_noveli">Publicados por Noveli</option>
                        <option value="author_purchase">Compra con el autor</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Tipo de compra</label>
                      <select value={bookPurchaseType} onChange={e => setBookPurchaseType(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent">
                        <option value="noveli">Noveli</option>
                        <option value="external_author">Autor Externo</option>
                        <option value="no_purchase">Sin Compra</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Link Compra Noveli</label>
                    <input type="url" value={bookNoveliPurchaseLink} onChange={e => setBookNoveliPurchaseLink(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Link Compra con Autor</label>
                    <input type="url" value={bookAuthorPurchaseLink} onChange={e => setBookAuthorPurchaseLink(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono" />
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
                    <label className="text-slate-400 font-bold block">Categorías Asignadas</label>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                      {categories.filter(c => c.active).length === 0 ? (
                        <span className="text-slate-450 italic">No hay categorías activas</span>
                      ) : (
                        categories.filter(c => c.active).map(cat => (
                          <label key={cat.id} className="flex items-center space-x-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={bookSelectedCategories.includes(cat.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setBookSelectedCategories([...bookSelectedCategories, cat.id]);
                                } else {
                                  setBookSelectedCategories(bookSelectedCategories.filter(id => id !== cat.id));
                                }
                              }}
                              className="rounded text-amber-500 h-3.5 w-3.5 focus:ring-amber-500 cursor-pointer"
                            />
                            <span className="text-slate-700 dark:text-slate-300 text-[11px]">
                              {cat.name} <span className="text-[8px] font-bold uppercase px-1 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded ml-1">{cat.type === 'main' ? 'Principal' : cat.type === 'genre' ? 'Género' : 'Colección'}</span>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Reseña</label>
                    <textarea value={bookShortDesc} onChange={e => setBookShortDesc(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Plataforma de Venta (Secundario)</label>
                      <select value={bookSalePlatform} onChange={e => setBookSalePlatform(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent">
                        <option value="Amazon">Amazon</option>
                        <option value="Buscalibre">Buscalibre</option>
                        <option value="Wattpad">Wattpad</option>
                        <option value="Página del autor">Página del autor</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Enlace de Compra (Secundario)</label>
                      <input type="url" value={bookSaleUrl} onChange={e => setBookSaleUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-1">
                    <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                      <input type="checkbox" checked={bookFeatured} onChange={e => setBookFeatured(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                      <span>Destacado</span>
                    </label>
                    <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                      <input type="checkbox" checked={bookVisible} onChange={e => setBookVisible(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                      <span>Visible en Web</span>
                    </label>
                    <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                      <input type="checkbox" checked={bookNovelty} onChange={e => setBookNovelty(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                      <span>Novedad</span>
                    </label>
                    <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                      <input type="checkbox" checked={bookUpcoming} onChange={e => setBookUpcoming(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                      <span>Próximamente</span>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" disabled={isReadOnly} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 border border-transparent">
                      <Plus className="w-4 h-4" />
                      <span>Guardar Libro</span>
                    </button>
                    {editingBook && (
                      <button type="button" onClick={resetBookForm} className="px-4 py-2.5 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-250 rounded-xl font-bold">
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {booksTab === 'categorias' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Categorías List */}
              <div className="lg:col-span-2 space-y-4">
                {categories.map((c, idx) => (
                  <div key={c.id || idx} className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-5 shadow-2xs flex gap-4 relative justify-between items-center animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col justify-center items-center gap-1 border-r border-slate-50 dark:border-slate-800 pr-3 shrink-0">
                        <button type="button" disabled={idx === 0 || isReadOnly} onClick={() => moveCategoryOrder(idx, -1)} className="text-slate-350 hover:text-amber-500 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"><ArrowUp className="w-4 h-4" /></button>
                        <span className="text-[10px] font-bold text-slate-400">{c.display_order || idx + 1}</span>
                        <button type="button" disabled={idx === categories.length - 1 || isReadOnly} onClick={() => moveCategoryOrder(idx, 1)} className="text-slate-350 hover:text-amber-500 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"><ArrowDown className="w-4 h-4" /></button>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-855 dark:text-slate-100">{c.name}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            c.type === 'main' ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400' :
                            c.type === 'genre' ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400' :
                            'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {c.type === 'main' ? 'Principal' : c.type === 'genre' ? 'Género' : 'Colección'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">Slug: {c.slug}</p>
                        {c.description && <p className="text-xs text-slate-500 mt-1 italic">"{c.description}"</p>}
                        {c.parent_id && (
                          <p className="text-[10px] text-slate-455 mt-1 font-semibold">
                            Padre: {categories.find(parent => parent.id === c.parent_id)?.name || 'Desconocido'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {/* Active Toggle */}
                      <button type="button" onClick={() => toggleCategoryBool(c, 'active')} className="p-1 hover:bg-slate-100 rounded border-none bg-transparent cursor-pointer">
                        {c.active !== false ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-350" />}
                      </button>
                      <button onClick={() => startEditCategory(c)} className="p-1 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded border-none bg-transparent cursor-pointer inline-flex items-center"><Edit className="w-4 h-4" /></button>
                      <button 
                        onClick={() => handleDeleteCategory(c)} 
                        disabled={c.type === 'main' && (c.slug === 'publicados-por-noveli' || c.slug === 'compra-con-el-autor')}
                        className="p-1 hover:bg-rose-50 text-slate-400 disabled:opacity-30 rounded border-none bg-transparent cursor-pointer inline-flex items-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-550">No hay categorías registradas.</p>
                  </div>
                )}
              </div>

              {/* Categorías Form */}
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
                <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Nombre</label>
                    <input 
                      type="text" 
                      required 
                      value={categoryName} 
                      onChange={e => {
                        setCategoryName(e.target.value);
                        if (!editingCategory) {
                          setCategorySlug(generateSlug(e.target.value));
                        }
                      }} 
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Slug (automático)</label>
                    <input 
                      type="text" 
                      readOnly 
                      value={categorySlug} 
                      className="w-full px-3 py-2 border border-slate-150 dark:border-slate-855 bg-slate-50 dark:bg-slate-950/40 rounded-xl text-slate-500 font-mono" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Tipo</label>
                    <select 
                      value={categoryType} 
                      onChange={e => setCategoryType(e.target.value)} 
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                    >
                      <option value="genre">Género</option>
                      <option value="collection">Colección</option>
                      <option value="main">Principal (Main)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Categoría Padre (opcional)</label>
                    <select 
                      value={categoryParentId} 
                      onChange={e => setCategoryParentId(e.target.value)} 
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                    >
                      <option value="">Ninguna</option>
                      {categories.filter(c => c.type === 'main' && c.id !== editingCategory?.id).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Descripción</label>
                    <textarea 
                      value={categoryDescription} 
                      onChange={e => setCategoryDescription(e.target.value)} 
                      rows={3} 
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent" 
                    />
                  </div>
                  <div className="flex gap-4 py-1">
                    <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                      <input type="checkbox" checked={categoryActive} onChange={e => setCategoryActive(e.target.checked)} className="rounded text-amber-500 h-4 w-4" />
                      <span>Activa / Visible</span>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" disabled={isReadOnly} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 border border-transparent">
                      <Plus className="w-4 h-4" />
                      <span>Guardar</span>
                    </button>
                    {editingCategory && (
                      <button type="button" onClick={resetCategoryForm} className="px-4 py-2.5 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-250 rounded-xl font-bold">
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}
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
                { id: 'todos', label: 'Todos', count: safeLeads.length },
                { id: 'nuevo', label: 'Nuevos', count: safeLeads.filter(l => l.status === 'nuevo').length, color: 'bg-blue-500' },
                { id: 'revisado', label: 'Revisados', count: safeLeads.filter(l => l.status === 'revisado').length, color: 'bg-amber-500' },
                { id: 'contactado', label: 'Contactados', count: safeLeads.filter(l => l.status === 'contactado').length, color: 'bg-purple-500' },
                { id: 'propuesta', label: 'Propuesta Creada', count: safeLeads.filter(l => l.status === 'propuesta creada').length, color: 'bg-indigo-500' },
                { id: 'prospecto', label: 'Convertidos', count: safeLeads.filter(l => l.status === 'convertido a prospecto').length, color: 'bg-emerald-500' },
                { id: 'descartado', label: 'Descartados', count: safeLeads.filter(l => l.status === 'descartado').length, color: 'bg-slate-500' }
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
                {safeLeads.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-semibold flex flex-col items-center justify-center gap-3">
                    <Globe className="w-12 h-12 text-slate-300 dark:text-slate-700 animate-pulse" />
                    <p>No hay solicitudes web registradas.</p>
                  </div>
                ) : filteredLeads.length === 0 ? (
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

      {/* ------------------ SUB-VIEW: HERO PRINCIPAL ------------------ */}
      {currentPath === 'hero' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigateTo('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-855 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Sección Hero Principal</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">Administra los textos, botones, imágenes y servicios directos de la cabecera principal de la web pública.</p>
              </div>
            </div>
          </div>

          {/* Sub-tabs header */}
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-px">
            <button
              onClick={() => setHeroTab('configuracion')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 bg-transparent border-none cursor-pointer ${
                heroTab === 'configuracion'
                  ? 'border-amber-500 text-amber-500 dark:text-amber-400'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
              }`}
            >
              1. Configuración Hero
            </button>
            <button
              onClick={() => setHeroTab('servicios')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 bg-transparent border-none cursor-pointer ${
                heroTab === 'servicios'
                  ? 'border-amber-500 text-amber-500 dark:text-amber-400'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
              }`}
            >
              2. Servicios Rápidos del Hero
            </button>
          </div>

          {/* Tab 1: Configuración Hero */}
          {heroTab === 'configuracion' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4">
                <form onSubmit={handleSaveHeroSettings} className="space-y-4 text-xs">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-50 dark:border-slate-805">Textos del Hero</h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Eyebrow / Antetítulo (Texto superior)</label>
                    <input
                      type="text"
                      placeholder="Ej. EDITORIAL INDEPENDIENTE"
                      value={heroEyebrow}
                      onChange={e => setHeroEyebrow(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-slate-400 font-bold block">Título Principal</label>
                      <input
                        type="text"
                        placeholder="Ej. Tu historia merece ser contada de la manera más"
                        value={heroTitleState}
                        onChange={e => setHeroTitleState(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Palabra Resaltada (Itálica/Dorado)</label>
                      <input
                        type="text"
                        placeholder="Ej. hermosa"
                        value={heroHighlightedWord}
                        onChange={e => setHeroHighlightedWord(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-serif"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Subtítulo / Introducción</label>
                    <textarea
                      placeholder="Ej. Ayudamos a autores independientes a maquetar, corregir, diseñar..."
                      value={heroSubtitleText}
                      onChange={e => setHeroSubtitleText(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                    />
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 pt-2 pb-2 border-b border-slate-50 dark:border-slate-805">Botones de Acción</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-bold text-slate-500">Botón Principal (Relleno)</h4>
                      <div className="space-y-1.5">
                        <label className="text-slate-400">Texto del Botón</label>
                        <input
                          type="text"
                          placeholder="Ej. Ver Servicios"
                          value={heroPrimaryBtnText}
                          onChange={e => setHeroPrimaryBtnText(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-slate-400">URL del Botón</label>
                        <input
                          type="text"
                          placeholder="Ej. #servicios o /contacto"
                          value={heroPrimaryBtnUrl}
                          onChange={e => setHeroPrimaryBtnUrl(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-bold text-slate-500">Botón Secundario (Bordeado)</h4>
                      <div className="space-y-1.5">
                        <label className="text-slate-400">Texto del Botón</label>
                        <input
                          type="text"
                          placeholder="Ej. Conoce el Catálogo"
                          value={heroSecondaryBtnText}
                          onChange={e => setHeroSecondaryBtnText(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-slate-400">URL del Botón</label>
                        <input
                          type="text"
                          placeholder="Ej. #libros o /nosotros"
                          value={heroSecondaryBtnUrl}
                          onChange={e => setHeroSecondaryBtnUrl(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 pt-2 pb-2 border-b border-slate-50 dark:border-slate-805">Imágenes y Destacados</h3>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Fondo de Cabecera (background_image_url)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="https://..."
                        value={heroBgImageUrl}
                        onChange={e => setHeroBgImageUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono"
                      />
                      <label className="px-3 py-2 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border cursor-pointer text-xs font-bold shrink-0 flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir</span>
                        <input type="file" accept="image/*" disabled={isReadOnly} onChange={(e) => handleUploadHeroFile(e, 'background')} className="hidden" />
                      </label>
                    </div>
                    {heroBgImageUrl && (
                      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mt-1">
                        <img src={heroBgImageUrl.startsWith('mock://') ? 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=100&auto=format&fit=crop&q=60' : heroBgImageUrl} className="w-full h-full object-cover" alt="Preview" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Imagen Lateral Hero (side_image_url)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="https://..."
                        value={heroSideImageUrl}
                        onChange={e => setHeroSideImageUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono"
                      />
                      <label className="px-3 py-2 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border cursor-pointer text-xs font-bold shrink-0 flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir</span>
                        <input type="file" accept="image/*" disabled={isReadOnly} onChange={(e) => handleUploadHeroFile(e, 'side')} className="hidden" />
                      </label>
                    </div>
                    {heroSideImageUrl && (
                      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mt-1">
                        <img src={heroSideImageUrl.startsWith('mock://') ? 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=100&auto=format&fit=crop&q=60' : heroSideImageUrl} className="w-full h-full object-cover" alt="Preview" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Libro Destacado en Hero</label>
                      <select
                        value={heroFeaturedBookId}
                        onChange={e => setHeroFeaturedBookId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                      >
                        <option value="">-- Ninguno / Ocultar --</option>
                        {books.map(b => (
                          <option key={b.id} value={b.id}>{b.title} ({b.author})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2 pt-6">
                      <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={heroShowFeaturedBook}
                          onChange={e => setHeroShowFeaturedBook(e.target.checked)}
                          className="rounded text-amber-500 h-4 w-4"
                        />
                        <span>Mostrar Libro Destacado</span>
                      </label>
                      <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={heroActive}
                          onChange={e => setHeroActive(e.target.checked)}
                          className="rounded text-amber-500 h-4 w-4"
                        />
                        <span>Sección Hero Activa</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button type="submit" disabled={isReadOnly} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center gap-1.5 border border-transparent shadow-md cursor-pointer transition-all">
                      <Save className="w-4 h-4" />
                      <span>Guardar Configuración de Hero</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Live Preview Panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-2xs space-y-6 flex flex-col justify-between h-fit">
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-300 text-xs uppercase tracking-wider pb-2 border-b border-slate-800">Vista Previa Simple</h3>
                  
                  {heroActive ? (
                    <div className="space-y-4 text-xs">
                      <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">{heroEyebrow || 'EDITORIAL INDEPENDIENTE'}</span>
                      <h1 className="text-xl font-bold font-serif leading-tight">
                        {heroTitleState || 'Tu historia merece ser contada de la manera más'}{' '}
                        <span className="text-amber-400 italic font-normal">{heroHighlightedWord || 'hermosa'}</span>
                      </h1>
                      <p className="text-slate-400 leading-relaxed text-[11px]">{heroSubtitleText}</p>
                      
                      <div className="flex gap-2 pt-1">
                        {heroPrimaryBtnText && (
                          <span className="px-3 py-1.5 bg-amber-500 rounded-lg text-[9px] font-bold text-white tracking-wider uppercase">{heroPrimaryBtnText}</span>
                        )}
                        {heroSecondaryBtnText && (
                          <span className="px-3 py-1.5 border border-slate-700 rounded-lg text-[9px] font-bold text-slate-300 tracking-wider uppercase">{heroSecondaryBtnText}</span>
                        )}
                      </div>

                      {heroShowFeaturedBook && heroFeaturedBookId && (
                        <div className="pt-4 border-t border-slate-800 flex items-center gap-2.5">
                          <div className="w-8 h-12 bg-slate-800 rounded border border-slate-700 overflow-hidden flex-shrink-0">
                            {(() => {
                              const b = books.find(book => book.id === heroFeaturedBookId);
                              if (b && b.cover_url) {
                                return <img src={b.cover_url} className="w-full h-full object-cover" />;
                              }
                              return <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-500">No Img</div>;
                            })()}
                          </div>
                          <div className="text-[10px] truncate">
                            <span className="text-slate-500 block">Libro Destacado</span>
                            <span className="font-bold text-slate-350 truncate block">
                              {(() => {
                                const b = books.find(book => book.id === heroFeaturedBookId);
                                return b ? `${b.title} - ${b.author}` : 'Libro no encontrado';
                              })()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-500 text-xs">
                      El Hero Web principal se encuentra desactivado.
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-950/50 border border-slate-850 rounded-xl text-[10px] text-slate-500 leading-relaxed font-mono">
                  Se actualizará automáticamente en noveli-web.
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Servicios Rápidos del Hero */}
          {heroTab === 'servicios' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* List */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4">
                <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">Servicios Rápidos Activos</h3>
                
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-150 dark:border-slate-800 text-slate-400 font-bold">
                        <th className="py-2.5">Orden</th>
                        <th className="py-2.5">Etiqueta</th>
                        <th className="py-2.5">Icono</th>
                        <th className="py-2.5">Enlace Opcional</th>
                        <th className="py-2.5 text-center">Estado</th>
                        <th className="py-2.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-855">
                      {heroQuickServices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">No hay servicios rápidos registrados para el Hero.</td>
                        </tr>
                      ) : (
                        heroQuickServices.map((qs, idx) => (
                          <tr key={qs.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-955/20">
                            {/* Order arrows */}
                            <td className="py-3">
                              <div className="flex items-center space-x-1">
                                <span className="font-bold text-slate-400 w-4">{qs.display_order || idx + 1}</span>
                                <div className="flex flex-col">
                                  <button type="button" disabled={idx === 0 || isReadOnly} onClick={() => moveHeroQuickServiceOrder(idx, -1)} className="text-slate-350 hover:text-amber-500 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"><ArrowUp className="w-3 h-3" /></button>
                                  <button type="button" disabled={idx === heroQuickServices.length - 1 || isReadOnly} onClick={() => moveHeroQuickServiceOrder(idx, 1)} className="text-slate-350 hover:text-amber-500 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"><ArrowDown className="w-3 h-3" /></button>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 font-bold text-slate-755 dark:text-slate-200">{qs.label}</td>
                            <td className="py-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">{qs.icon_name}</td>
                            <td className="py-3 font-mono text-slate-455">
                              {qs.link_url ? (
                                <a href={qs.link_url} className="text-amber-550 hover:underline">{qs.link_url}</a>
                              ) : (
                                <span className="text-slate-350 italic">Ninguno</span>
                              )}
                            </td>
                            {/* Status */}
                            <td className="py-3 text-center">
                              <button type="button" onClick={() => toggleHeroQuickServiceActive(qs)} className="focus:outline-none bg-transparent border-none cursor-pointer">
                                {qs.active !== false ? (
                                  <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-650 dark:text-emerald-450 border border-emerald-100 rounded text-[9px] font-bold">activo</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-955/10 text-slate-500 border border-slate-250 rounded text-[9px] font-bold">inactivo</span>
                                )}
                              </button>
                            </td>
                            {/* Actions */}
                            <td className="py-3 text-right space-x-1">
                              <button onClick={() => startEditHeroQuickService(qs)} className="p-1 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded border-none bg-transparent cursor-pointer inline-flex items-center"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteHeroQuickService(qs.id)} className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded border-none bg-transparent cursor-pointer inline-flex items-center"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form */}
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
                <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">
                  {editingQuickService ? 'Editar Servicio Hero' : 'Agregar Servicio al Hero'}
                </h3>
                <form onSubmit={handleSaveHeroQuickService} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Etiqueta del Servicio</label>
                    <input
                      type="text"
                      placeholder="Ej. Registro de Derechos"
                      value={quickServiceLabel}
                      onChange={e => setQuickServiceLabel(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Icono</label>
                      <select
                        value={quickServiceIconName}
                        onChange={e => setQuickServiceIconName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                      >
                        <option value="feather">Pluma (feather)</option>
                        <option value="book">Libro (book)</option>
                        <option value="layout">Diseño (layout)</option>
                        <option value="upload">Subir (upload)</option>
                        <option value="pen">Lápiz (pen)</option>
                        <option value="file">Archivo (file)</option>
                        <option value="megaphone">Megáfono (megaphone)</option>
                        <option value="shield">Escudo (shield)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Enlace Opcional (link_url)</label>
                      <input
                        type="text"
                        placeholder="Ej. #servicios"
                        value={quickServiceLinkUrl}
                        onChange={e => setQuickServiceLinkUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 font-bold cursor-pointer select-none py-1">
                    <input
                      type="checkbox"
                      checked={quickServiceActive}
                      onChange={e => setQuickServiceActive(e.target.checked)}
                      className="rounded text-amber-500 h-4 w-4"
                    />
                    <span>Activo / Visible en Hero</span>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" disabled={isReadOnly} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 border border-transparent cursor-pointer">
                      <Plus className="w-4 h-4" />
                      <span>{editingQuickService ? 'Actualizar' : 'Agregar'}</span>
                    </button>
                    {editingQuickService && (
                      <button type="button" onClick={resetHeroQuickServiceForm} className="px-3.5 py-2.5 border border-slate-250 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl font-bold cursor-pointer">
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------ SUB-VIEW: FOOTER ------------------ */}
      {currentPath === 'footer' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigateTo('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-855 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-855 dark:text-slate-100 font-serif">Administración del Footer Web</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">Gestiona el contacto, enlace de Instagram y galería de imágenes de la parte inferior de la web pública.</p>
              </div>
            </div>
          </div>

          {/* Sub-tabs header */}
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-px">
            <button
              onClick={() => setFooterTab('configuracion')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 bg-transparent border-none cursor-pointer ${
                footerTab === 'configuracion'
                  ? 'border-amber-500 text-amber-500 dark:text-amber-400'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
              }`}
            >
              1. Configuración Footer
            </button>
            <button
              onClick={() => setFooterTab('galeria')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 bg-transparent border-none cursor-pointer ${
                footerTab === 'galeria'
                  ? 'border-amber-500 text-amber-500 dark:text-amber-400'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
              }`}
            >
              2. Galería Footer / Instagram
            </button>
          </div>

          {/* Tab 1: Configuración Footer */}
          {footerTab === 'configuracion' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4">
                <form onSubmit={handleSaveFooterSettings} className="space-y-4 text-xs">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-50 dark:border-slate-805">Datos de Contacto</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Título de Contacto</label>
                      <input
                        type="text"
                        placeholder="Ej. Ponte en contacto"
                        value={footerContactTitle}
                        onChange={e => setFooterContactTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Email de Contacto</label>
                      <input
                        type="email"
                        placeholder="Ej. contacto@somosnovelieditorial.com"
                        value={footerContactEmail}
                        onChange={e => setFooterContactEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Ubicación / Dirección</label>
                      <input
                        type="text"
                        placeholder="Ej. Santiago, Chile"
                        value={footerContactLocation}
                        onChange={e => setFooterContactLocation(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="flex items-center space-x-1.5 font-bold cursor-pointer select-none pt-7">
                        <input
                          type="checkbox"
                          checked={footerActive}
                          onChange={e => setFooterActive(e.target.checked)}
                          className="rounded text-amber-500 h-4 w-4"
                        />
                        <span>Sección Footer Activa</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Descripción Corta / Quiénes Somos</label>
                    <textarea
                      placeholder="Ej. Ayudamos a autores independientes a maquetar, corregir, diseñar..."
                      value={footerContactDescription}
                      onChange={e => setFooterContactDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                    />
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 pt-2 pb-2 border-b border-slate-50 dark:border-slate-805">Configuración Instagram</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Título de Instagram</label>
                      <input
                        type="text"
                        placeholder="Ej. Síguenos en Instagram"
                        value={footerInstagramTitle}
                        onChange={e => setFooterInstagramTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">URL de Instagram</label>
                      <input
                        type="url"
                        placeholder="Ej. https://instagram.com/somosnovelieditorial"
                        value={footerInstagramUrl}
                        onChange={e => setFooterInstagramUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 font-bold cursor-pointer select-none py-1">
                    <input
                      type="checkbox"
                      checked={footerInstagramEnabled}
                      onChange={e => setFooterInstagramEnabled(e.target.checked)}
                      className="rounded text-amber-500 h-4 w-4"
                    />
                    <span>Mostrar Bloque de Instagram en Footer</span>
                  </div>

                  <div className="pt-2">
                    <button type="submit" disabled={isReadOnly} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center gap-1.5 border border-transparent shadow-md cursor-pointer transition-all">
                      <Save className="w-4 h-4" />
                      <span>Guardar Configuración de Footer</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Simple Preview Panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-2xs space-y-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-300 text-xs uppercase tracking-wider mb-4 pb-2 border-b border-slate-800">Vista Previa Simple</h3>
                  
                  {footerActive ? (
                    <div className="space-y-6 text-xs text-slate-400">
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold text-white font-serif">{footerContactTitle || 'Contacto'}</h4>
                        <p className="leading-relaxed">{footerContactDescription || 'Descripción del footer.'}</p>
                        {footerContactLocation && <p className="text-[10px] text-slate-500">📍 {footerContactLocation}</p>}
                        {footerContactEmail && <p className="text-[10px] text-slate-500">✉️ {footerContactEmail}</p>}
                      </div>

                      {footerInstagramEnabled && (
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          <h4 className="text-sm font-bold text-white font-serif">{footerInstagramTitle || 'Instagram'}</h4>
                          <a href={footerInstagramUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline inline-flex items-center gap-1">
                            <span>{footerInstagramUrl || '@somosnovelieditorial'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-500">
                      El Footer Web se encuentra desactivado.
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-slate-955/50 border border-slate-850 rounded-xl text-[10px] text-slate-500 leading-relaxed font-mono">
                  Se actualizará automáticamente en noveli-web.
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Galería Footer / Instagram */}
          {footerTab === 'galeria' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Image List */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4">
                <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">Listado de Imágenes en Footer</h3>
                
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-150 dark:border-slate-800 text-slate-400 font-bold">
                        <th className="py-2.5">Orden</th>
                        <th className="py-2.5">Miniatura</th>
                        <th className="py-2.5">Título</th>
                        <th className="py-2.5">Enlace Opcional</th>
                        <th className="py-2.5 text-center">Estado</th>
                        <th className="py-2.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-855">
                      {footerGallery.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">No hay imágenes en la galería del footer.</td>
                        </tr>
                      ) : (
                        footerGallery.map((img, idx) => (
                          <tr key={img.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-955/20">
                            {/* Order arrows */}
                            <td className="py-3">
                              <div className="flex items-center space-x-1">
                                <span className="font-bold text-slate-400 w-4">{img.display_order || idx + 1}</span>
                                <div className="flex flex-col">
                                  <button type="button" disabled={idx === 0 || isReadOnly} onClick={() => moveFooterGalleryImageOrder(idx, -1)} className="text-slate-350 hover:text-amber-500 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"><ArrowUp className="w-3 h-3" /></button>
                                  <button type="button" disabled={idx === footerGallery.length - 1 || isReadOnly} onClick={() => moveFooterGalleryImageOrder(idx, 1)} className="text-slate-350 hover:text-amber-500 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"><ArrowDown className="w-3 h-3" /></button>
                                </div>
                              </div>
                            </td>
                            {/* Image Thumbnail */}
                            <td className="py-3">
                              <div className="w-10 h-10 rounded-lg border overflow-hidden bg-slate-100 dark:bg-slate-850">
                                <img
                                  src={img.image_url.startsWith('mock://') ? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100&auto=format&fit=crop&q=60' : img.image_url}
                                  className="w-full h-full object-cover"
                                  alt={img.title || "Thumbnail"}
                                />
                              </div>
                            </td>
                            <td className="py-3 font-bold text-slate-755 dark:text-slate-200">{img.title || <span className="text-slate-400 italic">Sin título</span>}</td>
                            <td className="py-3">
                              {img.link_url ? (
                                <a href={img.link_url} target="_blank" rel="noopener noreferrer" className="text-amber-550 hover:underline font-mono truncate max-w-[150px] inline-block">{img.link_url}</a>
                              ) : (
                                <span className="text-slate-400 italic">Ninguno</span>
                              )}
                            </td>
                            {/* Active Toggle */}
                            <td className="py-3 text-center">
                              <button type="button" onClick={() => toggleFooterImageActive(img)} className="focus:outline-none bg-transparent border-none cursor-pointer">
                                {img.active !== false ? (
                                  <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-650 dark:text-emerald-450 border border-emerald-100 rounded text-[9px] font-bold">activo</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-955/10 text-slate-500 border border-slate-250 rounded text-[9px] font-bold">inactivo</span>
                                )}
                              </button>
                            </td>
                            {/* Actions */}
                            <td className="py-3 text-right space-x-1">
                              <button onClick={() => startEditFooterImage(img)} className="p-1 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded border-none bg-transparent cursor-pointer inline-flex items-center"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteFooterGalleryImage(img.id)} className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded border-none bg-transparent cursor-pointer inline-flex items-center"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form */}
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xs space-y-4 h-fit">
                <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm">
                  {editingFooterImage ? 'Editar Imagen' : 'Agregar Imagen al Footer'}
                </h3>
                <form onSubmit={handleSaveFooterGalleryImage} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Título de la Imagen</label>
                    <input
                      type="text"
                      placeholder="Ej. Lectura otoñal"
                      value={footerImageTitle}
                      onChange={e => setFooterImageTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">URL de la Imagen (image_url)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="https://..."
                        value={footerImageUrl}
                        onChange={e => setFooterImageUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono"
                      />
                      <label className="px-3 py-2 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border cursor-pointer text-xs font-bold shrink-0 flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir</span>
                        <input type="file" accept="image/*" disabled={isReadOnly} onChange={handleUploadFooterImage} className="hidden" />
                      </label>
                    </div>
                    {footerImageUrl && (
                      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-955/40 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mt-1">
                        <img src={footerImageUrl.startsWith('mock://') ? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100&auto=format&fit=crop&q=60' : footerImageUrl} className="w-full h-full object-cover" alt="Preview" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-bold block">Enlace Opcional (link_url)</label>
                    <input
                      type="url"
                      placeholder="Ej. https://instagram.com/p/..."
                      value={footerImageLinkUrl}
                      onChange={e => setFooterImageLinkUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent font-mono"
                    />
                  </div>

                  <div className="flex items-center space-x-1.5 font-bold cursor-pointer select-none py-1">
                    <input
                      type="checkbox"
                      checked={footerImageActive}
                      onChange={e => setFooterImageActive(e.target.checked)}
                      className="rounded text-amber-500 h-4 w-4"
                    />
                    <span>Activa / Visible</span>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" disabled={isReadOnly} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 border border-transparent cursor-pointer">
                      <Plus className="w-4 h-4" />
                      <span>{editingFooterImage ? 'Actualizar' : 'Agregar'}</span>
                    </button>
                    {editingFooterImage && (
                      <button type="button" onClick={resetFooterImageForm} className="px-3.5 py-2.5 border border-slate-250 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl font-bold cursor-pointer">
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
