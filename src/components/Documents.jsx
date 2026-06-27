import { useEffect, useState } from 'react';
import { supabase, isMock } from '../supabaseClient';
import { formatDate } from '../utils';
import { 
  Plus, Search, X, Trash2, FileText, Download, Eye,
  User, Link, Calendar, UploadCloud, Tag, Layers, Briefcase, BookOpen,
  Folder, FolderOpen, ChevronRight, LayoutGrid, List, ArrowLeft, HardDrive,
  FileSpreadsheet, Image, File, AlertTriangle
} from 'lucide-react';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [clients, setClients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [services, setServices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [clientFilter, setClientFilter] = useState('todos');
  const [serviceFilter, setServiceFilter] = useState('todos');
  const [providerFilter, setProviderFilter] = useState('todos');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const [currentPath, setCurrentPath] = useState({ type: 'root' });
  const [viewMode, setViewMode] = useState('grid'); // 'grid' o 'list'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    document_type: 'contrato',
    client_id: '',
    provider_id: '',
    income_id: '',
    expense_id: '',
    service_id: '',
    quotation_id: '',
    notes: ''
  });

  const [formError, setFormError] = useState('');

  // Viewer State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);
  const [signedUrl, setSignedUrl] = useState('');
  const [loadingViewer, setLoadingViewer] = useState(false);

  const getCleanPath = (pathString) => {
    if (!pathString) return '';
    let clean = pathString;
    
    // If it's a full URL
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      try {
        const url = new URL(clean);
        const match = url.pathname.match(/\/object\/(?:sign|public|authenticated)\/documents\/(.+)$/);
        if (match && match[1]) {
          clean = match[1];
        } else {
          const parts = url.pathname.split('/documents/');
          if (parts.length > 1) {
            clean = parts.slice(1).join('/documents/');
          }
        }
      } catch (e) {
        console.error("Error parsing URL in getCleanPath:", e);
      }
    }
    
    // Decode URI component (e.g. spaces as %20)
    try {
      clean = decodeURIComponent(clean);
    } catch (e) {}

    // If it starts with 'documents/' prefix, remove it
    if (clean.startsWith('documents/')) {
      clean = clean.substring('documents/'.length);
    }

    return clean;
  };

  const getMimeType = (doc) => {
    if (!doc) return 'application/octet-stream';
    if (doc.mime_type) return doc.mime_type.toLowerCase();
    
    // Fallback based on extension
    const ext = (doc.file_name || doc.file_path || '').split('.').pop().toLowerCase();
    const mimeMapping = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'txt': 'text/plain',
      'html': 'text/html',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return mimeMapping[ext] || 'application/octet-stream';
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docRes, clientsRes, providersRes, incomesRes, expensesRes, servicesRes, quotRes] = await Promise.all([
        supabase.from('documents').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name').order('name', { ascending: true }),
        supabase.from('providers').select('id, name').order('name', { ascending: true }),
        supabase.from('incomes').select('id, amount, date').order('date', { ascending: false }),
        supabase.from('expenses').select('id, category, amount, date').order('date', { ascending: false }),
        supabase.from('services').select('id, book_title').order('book_title', { ascending: true }),
        supabase.from('quotations').select('id, created_at').order('created_at', { ascending: false })
      ]);

      if (docRes.error) throw docRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (providersRes.error) throw providersRes.error;
      if (incomesRes.error) throw incomesRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (quotRes.error) throw quotRes.error;

      setDocuments(docRes.data || []);
      setClients(clientsRes.data || []);
      setProviders(providersRes.data || []);
      setIncomes(incomesRes.data || []);
      setExpenses(expensesRes.data || []);
      setServices(servicesRes.data || []);
      setQuotations(quotRes.data || []);
    } catch (err) {
      console.error("Error loading documents data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setIsUploading(false);
    setFormData({
      name: '',
      file_type: 'contrato',
      client_id: '',
      provider_id: '',
      income_id: '',
      expense_id: '',
      service_id: '',
      quotation_id: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFormData(prev => ({ ...prev, title: file.name }));
    }
  };

  const getUserId = async () => {
    if (isMock) return 'mock-user-123';
    const { data: { user } } = await supabase.auth.getUser();
    return user ? user.id : null;
  };

  const handleDeleteDocument = async (doc) => {
    const docName = doc.title || doc.name || doc.file_name || 'Documento';
    if (window.confirm(`¿Estás seguro de que deseas eliminar el documento "${docName}"?`)) {
      try {
        if (!isMock) {
          const { error: storageErr } = await supabase.storage
            .from('documents')
            .remove([doc.file_path]);

          if (storageErr) {
            console.warn("Storage warning (could be mock):", storageErr);
          }
        }

        const { error: dbErr } = await supabase
          .from('documents')
          .delete()
          .eq('id', doc.id);

        if (dbErr) throw dbErr;

        setDocuments(documents.filter(d => d.id !== doc.id));
      } catch (err) {
        console.error("Error deleting document:", err);
        alert("Error al eliminar el documento.");
      }
    }
  };

  const handleDownloadFile = async (doc) => {
    const docName = doc.title || doc.name || doc.file_name || 'Documento';
    const rawPath = doc.file_path || doc.file_url;
    const cleanPath = getCleanPath(rawPath);

    if (!cleanPath) {
      alert("Error: No se encontró la ruta del archivo.");
      return;
    }

    if (isMock) {
      alert(`Simulación de descarga en Modo Demo: descargando archivo "${docName}" desde la ruta "${cleanPath}"`);
    } else {
      try {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(cleanPath, 3600);
        
        if (error) throw error;
        if (data?.signedUrl) {
          const a = document.createElement('a');
          a.href = data.signedUrl;
          a.download = docName;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          alert('No se pudo generar la URL firmada para la descarga.');
        }
      } catch (err) {
        console.error("Error generating signed download URL:", err);
        alert("Error al generar el enlace de descarga.");
      }
    }
  };

  const handleViewFile = async (doc) => {
    const docName = doc.title || doc.name || doc.file_name || 'Documento';
    const rawPath = doc.file_path || doc.file_url;
    const cleanPath = getCleanPath(rawPath);

    if (!cleanPath) {
      alert("Error: No se encontró la ruta del archivo.");
      return;
    }
    
    setViewerDoc(doc);
    setViewerOpen(true);
    setSignedUrl('');
    
    if (isMock) {
      setSignedUrl(`mock://documents/${cleanPath}`);
    } else {
      setLoadingViewer(true);
      try {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(cleanPath, 3600);
        
        if (error) throw error;
        if (data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        } else {
          alert('No se pudo generar la URL de visualización.');
          setViewerOpen(false);
        }
      } catch (err) {
        console.error("Error generating signed view URL:", err);
        alert("Error al generar la vista previa del documento.");
        setViewerOpen(false);
      } finally {
        setLoadingViewer(false);
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setFormError('Por favor selecciona un archivo para subir.');
      return;
    }
    if (!formData.title.trim()) {
      setFormError('El título del documento es requerido.');
      return;
    }

    setIsUploading(true);
    setFormError('');
    setUploadProgress(20);

    try {
      const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
      const documentType = formData.document_type || 'otro';
      const fileName = selectedFile.name;
      const fileExt = fileName.split('.').pop().toLowerCase();
      
      // Validation of allowed formats
      const allowedExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'png', 'webp'];
      if (!allowedExts.includes(fileExt)) {
        throw new Error('Formato no permitido. Solo se aceptan: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, WEBP.');
      }

      // Organization of paths:
      // organization_id/clientes/client_id/document_type/file_name
      // organization_id/proveedores/provider_id/document_type/file_name
      // organization_id/general/document_type/file_name
      let storagePath = '';
      const sanitizedFileName = fileName.replace(/\s+/g, '_');
      if (formData.client_id) {
        storagePath = `${orgId}/clientes/${formData.client_id}/${documentType}/${sanitizedFileName}`;
      } else if (formData.provider_id) {
        storagePath = `${orgId}/proveedores/${formData.provider_id}/${documentType}/${sanitizedFileName}`;
      } else {
        storagePath = `${orgId}/general/${documentType}/${sanitizedFileName}`;
      }

      setUploadProgress(50);

      let fileUrl = '';
      if (!isMock) {
        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, selectedFile, {
            upsert: true
          });

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from('documents')
          .getPublicUrl(storagePath);
        
        fileUrl = publicUrlData?.publicUrl || '';
      } else {
        fileUrl = `mock://documents/${storagePath}`;
      }

      setUploadProgress(80);

      const userId = await getUserId();

      const dbPayload = {
        title: formData.title.trim(),
        document_type: documentType,
        file_name: fileName,
        file_path: storagePath,
        file_url: fileUrl,
        mime_type: selectedFile.type || 'application/octet-stream',
        file_size: selectedFile.size || 0,
        notes: formData.notes || '',
        organization_id: orgId,
        user_id: userId,
        client_id: formData.client_id || null,
        provider_id: formData.provider_id || null,
        service_id: formData.service_id || null,
        income_id: formData.income_id || null,
        expense_id: formData.expense_id || null,
        quotation_id: formData.quotation_id || null
      };

      const { error: dbErr } = await supabase
        .from('documents')
        .insert([dbPayload]);

      if (dbErr) throw dbErr;

      setUploadProgress(100);
      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error uploading document:", err);
      setFormError(err.message || 'Error al subir el archivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const docTypes = ['contrato', 'factura', 'boleta', 'comprobante de pago', 'manuscrito', 'portada', 'archivo final', 'documento legal', 'imagen', 'otro'];

  // Filters logic
  const filteredDocs = documents.map(doc => {
    const client = clients.find(c => c.id === doc.client_id);
    const provider = providers.find(p => p.id === doc.provider_id);
    const service = services.find(s => s.id === doc.service_id);
    const income = incomes.find(i => i.id === doc.income_id);
    const expense = expenses.find(e => e.id === doc.expense_id);
    const quotation = quotations.find(q => q.id === doc.quotation_id);

    return {
      ...doc,
      titleText: doc.title || doc.name || doc.file_name || 'Sin título',
      docType: doc.document_type || doc.file_type || 'otro',
      clientName: client ? client.name : null,
      providerName: provider ? provider.name : null,
      serviceName: service ? service.book_title : null,
      incomeDetails: income ? `Ingreso: ${formatDate(income.date)}` : null,
      expenseDetails: expense ? `Gasto: ${expense.category}` : null,
      quotationDetails: quotation ? `Cotización: ${formatDate(quotation.created_at)}` : null
    };
  }).filter(doc => {
    const matchesSearch = doc.titleText.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (doc.file_name && doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (doc.notes && doc.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (doc.clientName && doc.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (doc.providerName && doc.providerName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = typeFilter === 'todos' || doc.docType === typeFilter;
    const matchesClient = clientFilter === 'todos' || doc.client_id === clientFilter;
    const matchesProvider = providerFilter === 'todos' || doc.provider_id === providerFilter;
    const matchesService = serviceFilter === 'todos' || doc.service_id === serviceFilter;

    let matchesDate = true;
    if (fromDateFilter) {
      matchesDate = matchesDate && new Date(doc.created_at) >= new Date(fromDateFilter + 'T00:00:00');
    }
    if (toDateFilter) {
      matchesDate = matchesDate && new Date(doc.created_at) <= new Date(toDateFilter + 'T23:59:59');
    }

    return matchesSearch && matchesType && matchesClient && matchesProvider && matchesService && matchesDate;
  });

  const getDocTypeColor = (type) => {
    switch (type) {
      case 'contrato': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900';
      case 'factura': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-455 dark:border-rose-900';
      case 'boleta': return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900';
      case 'comprobante de pago': return 'bg-emerald-50 text-emerald-705 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900';
      case 'manuscrito': return 'bg-amber-50 text-amber-755 border-amber-200 dark:bg-amber-955/30 dark:text-amber-400 dark:border-amber-900';
      case 'portada': return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-900';
      case 'archivo final': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900';
      case 'documento legal': return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900';
      case 'imagen': return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900';
      default: return 'bg-slate-100 text-slate-700 border-slate-205 dark:bg-slate-800 dark:text-slate-350 dark:border-slate-700';
    }
  };

  const getFileFormatDetails = (fileName) => {
    const ext = fileName?.split('.').pop().toLowerCase() || '';
    switch (ext) {
      case 'pdf':
        return {
          icon: FileText,
          bgClass: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/25 dark:text-rose-400 dark:border-rose-900/40',
          label: 'PDF'
        };
      case 'doc':
      case 'docx':
        return {
          icon: FileText,
          bgClass: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/25 dark:text-blue-400 dark:border-blue-900/40',
          label: 'Word'
        };
      case 'xls':
      case 'xlsx':
        return {
          icon: FileSpreadsheet,
          bgClass: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/25 dark:text-emerald-400 dark:border-emerald-900/40',
          label: 'Excel'
        };
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
        return {
          icon: Image,
          bgClass: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/25 dark:text-amber-400 dark:border-amber-900/40',
          label: 'Imagen'
        };
      default:
        return {
          icon: File,
          bgClass: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-950/25 dark:text-slate-400 dark:border-slate-900/40',
          label: 'Archivo'
        };
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === undefined || bytes === null || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isFilterActive = searchQuery !== '' || typeFilter !== 'todos' || clientFilter !== 'todos' || providerFilter !== 'todos' || serviceFilter !== 'todos' || fromDateFilter !== '' || toDateFilter !== '';

  const getViewFiles = () => {
    if (currentPath.type === 'cliente_detail') {
      return filteredDocs.filter(d => d.client_id === currentPath.clientId);
    }
    if (currentPath.type === 'proveedor_detail') {
      return filteredDocs.filter(d => d.provider_id === currentPath.providerId);
    }
    if (currentPath.type === 'general') {
      return filteredDocs.filter(d => !d.client_id && !d.provider_id);
    }
    return isFilterActive ? filteredDocs : [];
  };

  const viewFiles = getViewFiles();

  const renderBreadcrumbs = () => {
    const items = [{ name: 'Inicio', path: { type: 'root' } }];
    
    if (currentPath.type === 'clientes') {
      items.push({ name: 'Clientes / Autores', path: { type: 'clientes' } });
    } else if (currentPath.type === 'cliente_detail') {
      items.push({ name: 'Clientes / Autores', path: { type: 'clientes' } });
      items.push({ name: currentPath.clientName, path: currentPath });
    } else if (currentPath.type === 'proveedores') {
      items.push({ name: 'Proveedores', path: { type: 'proveedores' } });
    } else if (currentPath.type === 'proveedor_detail') {
      items.push({ name: 'Proveedores', path: { type: 'proveedores' } });
      items.push({ name: currentPath.providerName, path: currentPath });
    } else if (currentPath.type === 'general') {
      items.push({ name: 'General', path: { type: 'general' } });
    }

    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/40 px-3 py-2 rounded-xl w-fit">
        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
        {items.map((item, idx) => (
          <span key={idx} className="flex items-center gap-1.5">
            {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-350" />}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCurrentPath(item.path);
              }}
              className={`hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer ${
                idx === items.length - 1 ? 'text-slate-800 dark:text-slate-200 font-bold' : ''
              }`}
            >
              {item.name}
            </button>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Centro Documental
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Repositorio y almacenamiento digital de contratos, manuscritos, portadas y comprobantes.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-brand-600/20 cursor-pointer w-fit"
        >
          <UploadCloud className="w-4 h-4" />
          Subir Documento
        </button>
      </div>

      {/* Filters Section */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative w-full lg:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Buscar por título, archivo, notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Document Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Tipo:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="block min-w-32 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none capitalize"
              >
                <option value="todos">Todos</option>
                {docTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Client Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Autor:</span>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="block min-w-32 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none"
              >
                <option value="todos">Todos</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Provider Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Proveedor:</span>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="block min-w-32 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none"
              >
                <option value="todos">Todos</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Service/Book Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Libro:</span>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="block min-w-32 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none"
              >
                <option value="todos">Todos</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.book_title}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Date Filter row */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 justify-end">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Desde:</span>
            <input
              type="date"
              value={fromDateFilter}
              onChange={(e) => setFromDateFilter(e.target.value)}
              className="block px-2.5 py-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-medium focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Hasta:</span>
            <input
              type="date"
              value={toDateFilter}
              onChange={(e) => setToDateFilter(e.target.value)}
              className="block px-2.5 py-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-medium focus:outline-none"
            />
          </div>
          {(fromDateFilter || toDateFilter || typeFilter !== 'todos' || clientFilter !== 'todos' || providerFilter !== 'todos' || serviceFilter !== 'todos' || searchQuery) && (
            <button
              onClick={() => {
                setFromDateFilter('');
                setToDateFilter('');
                setTypeFilter('todos');
                setClientFilter('todos');
                setProviderFilter('todos');
                setServiceFilter('todos');
                setSearchQuery('');
              }}
              className="text-xs text-brand-655 hover:text-brand-500 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* File Manager Directory View */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Breadcrumbs & View Toggle Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
            {renderBreadcrumbs()}
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Vista:</span>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-xl transition-all cursor-pointer border ${
                  viewMode === 'grid'
                    ? 'bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-950/20 dark:border-brand-900 dark:text-brand-400'
                    : 'bg-white border-slate-100 text-slate-450 hover:text-slate-655 dark:bg-slate-900 dark:border-slate-800'
                }`}
                title="Vista de cuadrícula"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-xl transition-all cursor-pointer border ${
                  viewMode === 'list'
                    ? 'bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-950/20 dark:border-brand-900 dark:text-brand-400'
                    : 'bg-white border-slate-100 text-slate-450 hover:text-slate-655 dark:bg-slate-900 dark:border-slate-800'
                }`}
                title="Vista de lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Folder & Files Content */}
          {isFilterActive && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>Búsqueda global activa: {filteredDocs.length} coincidencia(s)</span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('todos');
                  setClientFilter('todos');
                  setProviderFilter('todos');
                  setServiceFilter('todos');
                  setFromDateFilter('');
                  setToDateFilter('');
                }}
                className="text-brand-655 hover:text-brand-500 hover:underline capitalize text-[11px] font-semibold cursor-pointer"
              >
                (Volver al gestor)
              </button>
            </div>
          )}

          {/* Folders display when not filtering and in Root/Clientes/Proveedores views */}
          {!isFilterActive && currentPath.type === 'root' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
              {/* Clientes folder */}
              <div
                onClick={() => setCurrentPath({ type: 'clientes' })}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-500/40 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between h-40 hover:-translate-y-0.5"
              >
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-brand-50/60 dark:bg-brand-950/25 text-brand-650 dark:text-brand-400 rounded-2xl group-hover:scale-105 transition-all">
                    <Folder className="w-8 h-8 fill-current" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {clients.length} Autores
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors text-sm font-sans">
                    Clientes / Autores
                  </h3>
                  <p className="text-slate-450 dark:text-slate-500 text-xs mt-1">
                    Documentos organizados por autor, contratos y manuscritos recibidos.
                  </p>
                </div>
              </div>

              {/* Proveedores folder */}
              <div
                onClick={() => setCurrentPath({ type: 'proveedores' })}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-500/40 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between h-40 hover:-translate-y-0.5"
              >
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-brand-50/60 dark:bg-brand-950/25 text-brand-650 dark:text-brand-400 rounded-2xl group-hover:scale-105 transition-all">
                    <Folder className="w-8 h-8 fill-current" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {providers.length} Proveedores
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors text-sm font-sans">
                    Proveedores
                  </h3>
                  <p className="text-slate-450 dark:text-slate-500 text-xs mt-1">
                    Contratos, acuerdos y facturas emitidas por proveedores de servicios.
                  </p>
                </div>
              </div>

              {/* General folder */}
              <div
                onClick={() => setCurrentPath({ type: 'general' })}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-500/40 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between h-40 hover:-translate-y-0.5"
              >
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-brand-50/60 dark:bg-brand-950/25 text-brand-650 dark:text-brand-400 rounded-2xl group-hover:scale-105 transition-all">
                    <Folder className="w-8 h-8 fill-current" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {documents.filter(d => !d.client_id && !d.provider_id).length} Archivos
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors text-sm font-sans">
                    General / Otros
                  </h3>
                  <p className="text-slate-450 dark:text-slate-500 text-xs mt-1">
                    Documentos institucionales y archivos sueltos no asociados a clientes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Clientes folder list */}
          {!isFilterActive && currentPath.type === 'clientes' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 animate-fade-in">
              {/* Back button folder */}
              <div
                onClick={() => setCurrentPath({ type: 'root' })}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl p-4 shadow-xs transition-all cursor-pointer flex items-center gap-3 h-20"
              >
                <div className="p-2.5 bg-slate-200 dark:bg-slate-800 text-slate-655 dark:text-slate-400 rounded-xl">
                  <ArrowLeft className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs">Volver a Inicio</h4>
                  <p className="text-[10px] text-slate-450">Subir un nivel</p>
                </div>
              </div>

              {clients.map((c) => {
                const count = documents.filter(d => d.client_id === c.id).length;
                return (
                  <div
                    key={c.id}
                    onClick={() => setCurrentPath({ type: 'cliente_detail', clientId: c.id, clientName: c.name })}
                    className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-500/40 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex items-center justify-between h-20"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="p-2.5 bg-brand-50/60 dark:bg-brand-950/20 text-brand-650 dark:text-brand-400 rounded-xl group-hover:scale-105 transition-all">
                        <Folder className="w-5 h-5 fill-current" />
                      </div>
                      <div className="truncate">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate group-hover:text-brand-650 dark:group-hover:text-brand-400 transition-colors" title={c.name}>
                          {c.name}
                        </h4>
                        <p className="text-[10px] text-slate-400">Autor</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full shrink-0">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Proveedores folder list */}
          {!isFilterActive && currentPath.type === 'proveedores' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 animate-fade-in">
              {/* Back folder */}
              <div
                onClick={() => setCurrentPath({ type: 'root' })}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl p-4 shadow-xs transition-all cursor-pointer flex items-center gap-3 h-20"
              >
                <div className="p-2.5 bg-slate-200 dark:bg-slate-800 text-slate-655 dark:text-slate-400 rounded-xl">
                  <ArrowLeft className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs">Volver a Inicio</h4>
                  <p className="text-[10px] text-slate-450">Subir un nivel</p>
                </div>
              </div>

              {providers.map((p) => {
                const count = documents.filter(d => d.provider_id === p.id).length;
                return (
                  <div
                    key={p.id}
                    onClick={() => setCurrentPath({ type: 'provider_detail', providerId: p.id, providerName: p.name })}
                    className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-500/40 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex items-center justify-between h-20"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="p-2.5 bg-brand-50/60 dark:bg-brand-950/20 text-brand-650 dark:text-brand-400 rounded-xl group-hover:scale-105 transition-all">
                        <Folder className="w-5 h-5 fill-current" />
                      </div>
                      <div className="truncate">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate group-hover:text-brand-650 dark:group-hover:text-brand-400 transition-colors" title={p.name}>
                          {p.name}
                        </h4>
                        <p className="text-[10px] text-slate-400">Proveedor</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full shrink-0">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Files display: when browsing detail folder, OR when global search results exist */}
          {((!isFilterActive && (currentPath.type === 'cliente_detail' || currentPath.type === 'proveedor_detail' || currentPath.type === 'general')) || (isFilterActive && viewFiles.length > 0)) && (
            <div>
              {viewMode === 'grid' ? (
                // GRID OF CARDS VIEW
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 animate-fade-in">
                  {/* Render local Back Card if not global search */}
                  {!isFilterActive && (
                    <div
                      onClick={() => {
                        if (currentPath.type === 'cliente_detail') {
                          setCurrentPath({ type: 'clientes' });
                        } else if (currentPath.type === 'proveedor_detail') {
                          setCurrentPath({ type: 'proveedores' });
                        } else {
                          setCurrentPath({ type: 'root' });
                        }
                      }}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl p-4 shadow-xs transition-all cursor-pointer flex flex-col justify-center items-center h-48 border-dashed"
                    >
                      <ArrowLeft className="w-6 h-6 text-slate-400 mb-2" />
                      <span className="text-xs font-bold text-slate-655 dark:text-slate-400">Volver atrás</span>
                      <span className="text-[10px] text-slate-400 mt-1">Subir un nivel</span>
                    </div>
                  )}

                  {viewFiles.map((doc) => {
                    const fileFormat = getFileFormatDetails(doc.file_name);
                    const FormatIcon = fileFormat.icon;
                    return (
                      <div
                        key={doc.id}
                        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 hover:border-brand-300 dark:hover:border-brand-500/40 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between h-48 group relative hover:-translate-y-0.5"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg border ${fileFormat.bgClass}`}>
                                <FormatIcon className="w-4 h-4" />
                              </div>
                              <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase font-semibold">
                                {fileFormat.label}
                              </span>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${getDocTypeColor(doc.docType)}`}>
                              {doc.docType}
                            </span>
                          </div>

                          <div className="mt-3.5 space-y-1">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs line-clamp-1 group-hover:text-brand-650 dark:group-hover:text-brand-400 transition-colors" title={doc.titleText}>
                              {doc.titleText}
                            </h4>
                            {doc.file_name && (
                              <p className="text-[10px] font-mono text-slate-400 truncate" title={doc.file_name}>
                                {doc.file_name}
                              </p>
                            )}
                            {doc.notes && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-450 italic line-clamp-1" title={doc.notes}>
                                "{doc.notes}"
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 border-t border-slate-100 dark:border-slate-800/60 pt-2.5 flex items-center justify-between">
                          <div className="flex gap-1 text-slate-400">
                            {doc.clientName && (
                              <span title={`Autor: ${doc.clientName}`} className="hover:text-brand-650 dark:hover:text-brand-400">
                                <User className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {doc.serviceName && (
                              <span title={`Libro: ${doc.serviceName}`} className="hover:text-brand-650 dark:hover:text-brand-400">
                                <BookOpen className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {doc.providerName && (
                              <span title={`Proveedor: ${doc.providerName}`} className="hover:text-brand-650 dark:hover:text-brand-400">
                                <Briefcase className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] font-medium text-slate-400">
                            {formatFileSize(doc.file_size)}
                          </span>

                          <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleViewFile(doc)}
                              className="p-1 rounded-lg border border-slate-100 dark:border-slate-800/80 text-slate-500 hover:text-brand-655 dark:hover:text-brand-400 hover:bg-slate-55 dark:hover:bg-slate-800 cursor-pointer"
                              title="Ver"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDownloadFile(doc)}
                              className="p-1 rounded-lg border border-slate-100 dark:border-slate-800/80 text-slate-500 hover:text-brand-655 dark:hover:text-brand-400 hover:bg-slate-55 dark:hover:bg-slate-800 cursor-pointer"
                              title="Descargar"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDocument(doc)}
                              className="p-1 rounded-lg border border-slate-100 dark:border-slate-800/80 text-slate-400 hover:text-rose-650 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // TABLE LIST VIEW
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden animate-fade-in">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 font-semibold">
                          <th className="px-6 py-4">Documento</th>
                          <th className="px-6 py-4">Categoría</th>
                          <th className="px-6 py-4">Relación</th>
                          <th className="px-6 py-4">Tamaño</th>
                          <th className="px-6 py-4">F. Subida</th>
                          <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        {viewFiles.map((doc) => {
                          const fileFormat = getFileFormatDetails(doc.file_name);
                          const FormatIcon = fileFormat.icon;
                          return (
                            <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-xl border ${fileFormat.bgClass}`}>
                                    <FormatIcon className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-xs">{doc.titleText}</div>
                                    {doc.file_name && (
                                      <span className="text-[10px] text-slate-400 font-mono block truncate max-w-xs">{doc.file_name}</span>
                                    )}
                                    {doc.notes && (
                                      <span className="text-[10px] text-slate-500 italic block truncate max-w-xs">"{doc.notes}"</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wider ${getDocTypeColor(doc.docType)}`}>
                                  {doc.docType}
                                </span>
                              </td>
                              <td className="px-6 py-4 space-y-1 text-xs">
                                {doc.clientName && (
                                  <div className="flex items-center gap-1 text-slate-655 dark:text-slate-400">
                                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>Autor: <strong>{doc.clientName}</strong></span>
                                  </div>
                                )}
                                {doc.serviceName && (
                                  <div className="flex items-center gap-1 text-slate-655 dark:text-slate-400">
                                    <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>Libro: <strong>{doc.serviceName}</strong></span>
                                  </div>
                                )}
                                {doc.providerName && (
                                  <div className="flex items-center gap-1 text-slate-655 dark:text-slate-400">
                                    <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>Prov: <strong>{doc.providerName}</strong></span>
                                  </div>
                                )}
                                {doc.incomeDetails && (
                                  <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    {doc.incomeDetails}
                                  </div>
                                )}
                                {doc.expenseDetails && (
                                  <div className="text-rose-600 dark:text-rose-455 font-medium">
                                    {doc.expenseDetails}
                                  </div>
                                )}
                                {doc.quotationDetails && (
                                  <div className="text-indigo-600 dark:text-indigo-400 font-medium">
                                    {doc.quotationDetails}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                                {formatFileSize(doc.file_size)}
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-400">
                                {formatDate(doc.created_at)}
                              </td>
                              <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => handleViewFile(doc)}
                                  className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-655 dark:hover:text-brand-400 hover:bg-slate-55 dark:hover:bg-slate-800 cursor-pointer"
                                  title="Ver"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDownloadFile(doc)}
                                  className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-655 dark:hover:text-brand-400 hover:bg-slate-55 dark:hover:bg-slate-800 cursor-pointer"
                                  title="Descargar"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDocument(doc)}
                                  className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-450 hover:text-rose-655 hover:bg-rose-50 dark:hover:bg-rose-955/20 cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty directory notification */}
          {((!isFilterActive && (currentPath.type === 'cliente_detail' || currentPath.type === 'proveedor_detail' || currentPath.type === 'general')) || (isFilterActive && viewFiles.length === 0)) && viewFiles.length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400 dark:text-slate-500 flex flex-col justify-center items-center">
              <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
              <p className="font-semibold text-slate-655 dark:text-slate-400">Esta carpeta está vacía</p>
              <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">No hay documentos en esta sección.</p>
              <button
                onClick={handleOpenAddModal}
                className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-655 dark:bg-brand-955/15 dark:hover:bg-brand-950/30 dark:text-brand-400 border border-brand-200 dark:border-brand-900 rounded-xl font-bold text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Subir archivo aquí
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload Document Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-brand-500" />
                Subir Documento
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-455">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                {/* File picker */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Archivo a Subir *</label>
                  <input 
                    type="file" 
                    onChange={handleFileChange}
                    className="block w-full text-xs text-slate-500 border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 p-2.5 focus:outline-none"
                  />
                </div>

                {/* Display name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nombre Visual del Documento *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    placeholder="e.g. Contrato Firmado Obra.pdf"
                  />
                </div>

                {/* Document Category type */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Categoría / Tipo de Documento</label>
                  <select
                    value={formData.document_type}
                    onChange={(e) => setFormData({...formData, document_type: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
                  >
                    {docTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Relations selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Client association */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Asociar a Cliente (Opcional)</label>
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                    >
                      <option value="">-- Sin Cliente --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Project/Service association */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Asociar a Libro (Opcional)</label>
                    <select
                      value={formData.service_id}
                      onChange={(e) => setFormData({...formData, service_id: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                    >
                      <option value="">-- Sin Libro --</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.book_title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Provider and Quotation association */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Provider association */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Asociar a Proveedor (Opcional)</label>
                    <select
                      value={formData.provider_id}
                      onChange={(e) => setFormData({...formData, provider_id: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                    >
                      <option value="">-- Sin Proveedor --</option>
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Quotation association */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Asociar a Cotización (Opcional)</label>
                    <select
                      value={formData.quotation_id}
                      onChange={(e) => setFormData({...formData, quotation_id: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                    >
                      <option value="">-- Sin Cotización --</option>
                      {quotations.map(q => (
                        <option key={q.id} value={q.id}>
                          Cotización - {formatDate(q.created_at)} ({q.id.substring(0, 8)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Income and Expense association */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Income association */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Asociar a Ingreso (Opcional)</label>
                    <select
                      value={formData.income_id}
                      onChange={(e) => setFormData({...formData, income_id: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                    >
                      <option value="">-- Sin Ingreso --</option>
                      {incomes.map(i => (
                        <option key={i.id} value={i.id}>
                          Ingreso - ${i.amount} ({formatDate(i.date)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Expense association */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Asociar a Gasto (Opcional)</label>
                    <select
                      value={formData.expense_id}
                      onChange={(e) => setFormData({...formData, expense_id: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                    >
                      <option value="">-- Sin Gasto --</option>
                      {expenses.map(e => (
                        <option key={e.id} value={e.id}>
                          Gasto - {e.category} ${e.amount} ({formatDate(e.date)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notes binding */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notas / Observaciones (Opcional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={2}
                    placeholder="Notas adicionales..."
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none resize-none"
                  />
                </div>

                {/* Upload progression bar */}
                {isUploading && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-slate-400 font-bold">
                      <span>Subiendo archivo...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-brand-500 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-350 rounded-xl text-sm font-semibold hover:bg-slate-55 cursor-pointer animate-fade-in"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isUploading ? 'Subiendo...' : 'Subir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visualizador de documento Modal */}
      {viewerOpen && viewerDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate max-w-md">
                  {viewerDoc.title || viewerDoc.file_name || 'Visualizador de Documento'}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                  Tipo: {viewerDoc.document_type || viewerDoc.file_type || 'otro'} • {viewerDoc.mime_type || 'Desconocido'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDownloadFile(viewerDoc)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  title="Descargar archivo"
                >
                  Descargar
                </button>
                <button
                  onClick={() => {
                    setViewerOpen(false);
                    setViewerDoc(null);
                    setSignedUrl('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:text-slate-550 dark:hover:text-slate-200 hover:bg-slate-150 dark:hover:bg-slate-850 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-6 flex-1 overflow-y-auto">
              {loadingViewer ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
                  <span className="text-xs font-semibold text-slate-400">Generando acceso seguro al documento...</span>
                </div>
              ) : signedUrl ? (
                (() => {
                  const mime = getMimeType(viewerDoc);
                  if (mime === 'application/pdf') {
                    return (
                      <iframe
                        src={signedUrl}
                        className="w-full h-[65vh] rounded-xl border border-slate-200 dark:border-slate-800"
                        title={viewerDoc.title}
                      />
                    );
                  } else if (mime.startsWith('image/')) {
                    return (
                      <div className="flex justify-center items-center bg-slate-100 dark:bg-slate-950 p-4 rounded-xl max-h-[65vh] overflow-auto">
                        <img
                          src={signedUrl}
                          alt={viewerDoc.title}
                          className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md"
                        />
                      </div>
                    );
                  } else if (mime.startsWith('text/')) {
                    return (
                      <iframe
                        src={signedUrl}
                        className="w-full h-[65vh] bg-white rounded-xl border border-slate-200 dark:border-slate-850"
                        title={viewerDoc.title}
                      />
                    );
                  } else {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 px-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/20">
                        <FileText className="w-16 h-16 text-slate-400 dark:text-slate-600 mb-4 animate-pulse" />
                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">Vista previa no disponible</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
                          El formato del archivo <strong>.{viewerDoc.file_name?.split('.').pop() || 'archivo'}</strong> no se puede previsualizar directamente en el navegador. Por favor descarga el archivo para visualizarlo en tu equipo.
                        </p>
                        <button
                          onClick={() => handleDownloadFile(viewerDoc)}
                          className="mt-6 inline-flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-colors"
                        >
                          Descargar Archivo
                        </button>
                      </div>
                    );
                  }
                })()
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/20">
                  <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
                  <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">Error de carga</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
                    No se pudo cargar la vista previa de este archivo.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
