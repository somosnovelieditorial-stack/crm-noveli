import { useEffect, useState } from 'react';
import { supabase, isMock, getValidOrgId } from '../supabaseClient';
import { formatCurrency, formatDate, calculateVatSplit, filterByPeriod, exportToCSV } from '../utils';
import PeriodFilter from './PeriodFilter';
import { 
  Plus, Search, Edit2, Trash2, X, DollarSign, 
  User, BookOpen, Calendar, HelpCircle, FileText, CheckCircle, AlertCircle, Download,
  UploadCloud, FileSpreadsheet, Image, File, Eye, Trash
} from 'lucide-react';

export default function Incomes() {
  const [incomes, setIncomes] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [clientFilter, setClientFilter] = useState('todos');
  const [vatFilter, setVatFilter] = useState('todos');
  const [period, setPeriod] = useState({
    mode: 'month',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    client_id: '',
    service_id: '',
    amount: 0,
    currency: 'CLP',
    exchange_rate: 1,
    date: new Date().toISOString().split('T')[0],
    payment_method: 'transferencia',
    includes_vat: false,
    status: 'pagado',
    notes: ''
  });

  // Services list filtered for current selected client in form
  const [formServices, setFormServices] = useState([]);

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Document integration states
  const [incomeDocuments, setIncomeDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [newDocFile, setNewDocFile] = useState(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState('factura');
  const [newDocNotes, setNewDocNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incomesRes, clientsRes, servicesRes] = await Promise.all([
        supabase.from('incomes').select('*').order('date', { ascending: false }),
        supabase.from('clients').select('id, name').order('name', { ascending: true }),
        supabase.from('services').select('id, client_id, book_title').order('book_title', { ascending: true })
      ]);

      if (incomesRes.error) throw incomesRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (servicesRes.error) throw servicesRes.error;

      setIncomes(incomesRes.data || []);
      setClients(clientsRes.data || []);
      setServices(servicesRes.data || []);
    } catch (err) {
      console.error('Error fetching incomes data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync services when selected client changes in form
  useEffect(() => {
    if (formData.client_id) {
      const filtered = services.filter(s => s.client_id === formData.client_id);
      setFormServices(filtered);
      if (selectedIncome) {
        if (selectedIncome.client_id !== formData.client_id) {
          setFormData(prev => ({ ...prev, service_id: '' }));
        }
      } else {
        setFormData(prev => ({ ...prev, service_id: filtered[0]?.id || '' }));
      }
    } else {
      setFormServices([]);
      setFormData(prev => ({ ...prev, service_id: '' }));
    }
  }, [formData.client_id, services]);

  // Handle default exchange rate when currency changes
  useEffect(() => {
    if (formData.currency === 'CLP') {
      setFormData(prev => ({ ...prev, exchange_rate: 1 }));
    } else if (formData.currency === 'USD') {
      setFormData(prev => ({ ...prev, exchange_rate: 940 }));
    } else if (formData.currency === 'EUR') {
      setFormData(prev => ({ ...prev, exchange_rate: 1010 }));
    }
  }, [formData.currency]);

  const handleOpenAddModal = () => {
    setSelectedIncome(null);
    setFormData({
      client_id: clients[0]?.id || '',
      service_id: '',
      amount: 0,
      currency: 'CLP',
      exchange_rate: 1,
      date: new Date().toISOString().split('T')[0],
      payment_method: 'transferencia',
      includes_vat: false,
      status: 'pagado',
      notes: ''
    });
    setFormError('');
    setIsModalOpen(true);
    setNewDocFile(null);
    setNewDocTitle('');
    setNewDocNotes('');
    setNewDocType('factura');
    setIncomeDocuments([]);
  };

  const handleOpenEditModal = (income) => {
    setSelectedIncome(income);
    setFormData({
      client_id: income.client_id || '',
      service_id: income.service_id || '',
      amount: income.amount || 0,
      currency: income.currency || 'CLP',
      exchange_rate: income.exchange_rate || 1,
      date: income.date || new Date().toISOString().split('T')[0],
      payment_method: income.payment_method || 'transferencia',
      includes_vat: income.includes_vat || false,
      status: income.status || 'pagado',
      notes: income.notes || ''
    });
    setFormError('');
    setIsModalOpen(true);
    setNewDocFile(null);
    setNewDocTitle('');
    setNewDocNotes('');
    setNewDocType('factura');
    handleFetchIncomeDocuments(income.id);
  };

  const handleDeleteIncome = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este ingreso?')) {
      try {
        const { error } = await supabase
          .from('incomes')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setIncomes(incomes.filter(i => i.id !== id));
      } catch (err) {
        console.error('Error deleting income:', err);
        alert('Error al eliminar el ingreso');
      }
    }
  };

  // Document integration handlers and helper functions
  const getDocTypeColor = (type) => {
    switch (type) {
      case 'factura': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-455 dark:border-rose-900';
      case 'boleta': return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900';
      case 'comprobante de pago': return 'bg-emerald-50 text-emerald-705 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900';
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
          bgClass: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/25 dark:text-emerald-450 dark:border-emerald-900/40',
          label: 'Excel'
        };
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
        return {
          icon: Image,
          bgClass: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-955/25 dark:text-amber-400 dark:border-amber-900/40',
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

  const handleFetchIncomeDocuments = async (incomeId) => {
    setLoadingDocuments(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('income_id', incomeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIncomeDocuments(data || []);
    } catch (err) {
      console.error('Error fetching income documents:', err);
      setIncomeDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleUploadIncomeDocument = async (file, docType, notes, docTitle, incomeId, clientId) => {
    if (!file || !docTitle || !incomeId) return;
    
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      const orgId = await getValidOrgId();

      const fileName = file.name;
      const sanitizedFileName = fileName.replace(/\s+/g, '_');
      const storagePath = `${orgId}/clientes/${clientId || 'general'}/ingresos/${incomeId}/${docType}/${sanitizedFileName}`;

      setUploadProgress(50);

      const isMockVal = typeof isMock !== 'undefined' ? isMock : (supabase.isMock || false);

      let fileUrl = '';
      if (!isMockVal) {
        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, file, { upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from('documents')
          .getPublicUrl(storagePath);
        
        fileUrl = publicUrlData?.publicUrl || '';
      } else {
        fileUrl = `mock://documents/${storagePath}`;
      }

      setUploadProgress(80);

      let userId = 'mock-user-123';
      if (!isMockVal) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) userId = user.id;
      }

      const dbPayload = {
        title: docTitle.trim(),
        document_type: docType,
        file_name: fileName,
        file_path: storagePath,
        file_url: fileUrl,
        mime_type: file.type || 'application/octet-stream',
        file_size: file.size || 0,
        notes: notes || '',
        organization_id: orgId,
        user_id: userId,
        client_id: clientId || null,
        income_id: incomeId
      };

      const { error: dbErr } = await supabase
        .from('documents')
        .insert([dbPayload]);

      if (dbErr) throw dbErr;

      setUploadProgress(100);
      setNewDocFile(null);
      setNewDocTitle('');
      setNewDocNotes('');
      
      // Refresh documents
      await handleFetchIncomeDocuments(incomeId);
    } catch (err) {
      console.error('Error uploading income document:', err);
      alert(err.message || 'Error al subir el archivo.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteIncomeDocument = async (doc) => {
    const docName = doc.title || doc.name || doc.file_name || 'Documento';
    if (window.confirm(`¿Estás seguro de que deseas eliminar el documento "${docName}"?`)) {
      try {
        const isMockVal = typeof isMock !== 'undefined' ? isMock : (supabase.isMock || false);
        if (!isMockVal) {
          const { error: storageErr } = await supabase.storage
            .from('documents')
            .remove([doc.file_path]);
          if (storageErr) {
            console.warn("Storage warning:", storageErr);
          }
        }

        const { error: dbErr } = await supabase
          .from('documents')
          .delete()
          .eq('id', doc.id);

        if (dbErr) throw dbErr;

        setIncomeDocuments(prev => prev.filter(d => d.id !== doc.id));
      } catch (err) {
        console.error("Error deleting document:", err);
        alert("Error al eliminar el documento.");
      }
    }
  };

  const handleDownloadIncomeFile = (doc) => {
    const docName = doc.title || doc.name || doc.file_name || 'Documento';
    const isMockVal = typeof isMock !== 'undefined' ? isMock : (supabase.isMock || false);
    if (isMockVal) {
      alert(`Simulación de descarga en Modo Demo: descargando archivo "${docName}"`);
    } else {
      if (doc.file_url) {
        window.open(doc.file_url, '_blank');
      } else {
        const { data } = supabase.storage
          .from('documents')
          .getPublicUrl(doc.file_path);
        if (data?.publicUrl) {
          window.open(data.publicUrl, '_blank');
        } else {
          alert('No se pudo generar el enlace de descarga');
        }
      }
    }
  };

  const handleViewIncomeFile = (doc) => {
    const docName = doc.title || doc.name || doc.file_name || 'Documento';
    const isMockVal = typeof isMock !== 'undefined' ? isMock : (supabase.isMock || false);
    if (isMockVal) {
      alert(`Simulación de visualización en Modo Demo: viendo archivo "${docName}"`);
    } else {
      if (doc.file_url) {
        window.open(doc.file_url, '_blank');
      } else {
        const { data } = supabase.storage
          .from('documents')
          .getPublicUrl(doc.file_path);
        if (data?.publicUrl) {
          window.open(data.publicUrl, '_blank');
        } else {
          alert('No se pudo generar el enlace de visualización');
        }
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (formData.amount <= 0) {
      setFormError('El monto debe ser mayor a 0.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const payload = {
      ...formData,
      client_id: formData.client_id || null,
      service_id: formData.service_id || null,
      exchange_rate: Number(formData.exchange_rate) || 1,
      value_converted: Number(formData.amount) * (Number(formData.exchange_rate) || 1),
      rate_date: formData.date
    };

    try {
      if (selectedIncome) {
        // Edit Mode
        const { error } = await supabase
          .from('incomes')
          .update(payload)
          .eq('id', selectedIncome.id);

        if (error) throw error;
      } else {
        // Add Mode
        const { data, error } = await supabase
          .from('incomes')
          .insert([payload])
          .select();

        if (error) throw error;
        
        const createdIncome = data?.[0];
        if (createdIncome && newDocFile) {
          await handleUploadIncomeDocument(newDocFile, newDocType, newDocNotes, newDocTitle, createdIncome.id, createdIncome.client_id);
        }
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving income:', err);
      setFormError(err.message || 'Error al guardar el ingreso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filters logic
  const mappedIncomes = incomes.map(income => {
    const client = clients.find(c => c.id === income.client_id);
    const service = services.find(s => s.id === income.service_id);
    return {
      ...income,
      clientName: client ? client.name : 'Sin cliente asignado',
      serviceTitle: service ? service.book_title : 'Sin servicio asignado'
    };
  });

  const periodFilteredIncomes = filterByPeriod(mappedIncomes, 'date', period);

  const filteredIncomes = periodFilteredIncomes.filter(income => {
    const matchesSearch = 
      income.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      income.serviceTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (income.notes && income.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'todos' || income.status === statusFilter;
    const matchesClient = clientFilter === 'todos' || income.client_id === clientFilter;
    
    let matchesVat = true;
    if (vatFilter === 'si') matchesVat = income.includes_vat;
    else if (vatFilter === 'no') matchesVat = !income.includes_vat;

    return matchesSearch && matchesStatus && matchesClient && matchesVat;
  });

  const handleExportCSV = () => {
    const csvData = filteredIncomes.map(inc => {
      const vatSplit = calculateVatSplit(inc.amount, inc.includes_vat);
      return {
        Fecha: inc.date,
        Cliente: inc.clientName,
        Servicio: inc.serviceTitle,
        Monto: inc.amount,
        Moneda: inc.currency,
        'Tasa Cambio': inc.exchange_rate || 1,
        'Monto CLP': inc.value_converted || inc.amount,
        Neto: inc.includes_vat ? vatSplit.net : inc.amount,
        IVA: inc.includes_vat ? vatSplit.vat : 0,
        'Medio de Pago': inc.payment_method,
        Estado: inc.status,
        Notas: inc.notes || ''
      };
    });

    exportToCSV(
      csvData,
      `ingresos_${period.mode}_${period.year || ''}_${period.month || ''}`,
      ['Fecha', 'Cliente', 'Servicio', 'Monto', 'Moneda', 'Tasa Cambio', 'Monto CLP', 'Neto', 'IVA', 'Medio de Pago', 'Estado', 'Notas']
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pagado':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900';
      case 'pendiente':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-450 dark:border-rose-900';
      case 'parcial':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pagado': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'pendiente': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'parcial': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Ingresos (Facturación)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Control de cobros a autores, abonos por servicios y registro de impuestos por ventas.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={filteredIncomes.length === 0}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-brand-600/20 cursor-pointer w-fit"
          >
            <Plus className="w-4 h-4" />
            Registrar Ingreso
          </button>
        </div>
      </div>

      {/* Period Filter Component */}
      <PeriodFilter onChange={setPeriod} />

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Buscar por cliente, servicio, notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Client Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Cliente:</span>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="block w-full px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
            >
              <option value="todos">Todos</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
            >
              <option value="todos">Todos</option>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
            </select>
          </div>

          {/* VAT Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Incluye IVA:</span>
            <select
              value={vatFilter}
              onChange={(e) => setVatFilter(e.target.value)}
              className="block w-full px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
            >
              <option value="todos">Todos</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incomes Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : filteredIncomes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400">
          No se encontraron registros de ingresos.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 font-semibold">
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Cliente / Servicio</th>
                  <th className="px-6 py-4">Monto / Desglose</th>
                  <th className="px-6 py-4">M. Pago</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredIncomes.map((income) => {
                  const vatSplit = calculateVatSplit(income.amount, income.includes_vat);
                  const showConverted = income.currency !== 'CLP';
                  return (
                    <tr key={income.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="px-6 py-4 font-semibold text-xs whitespace-nowrap text-slate-500 dark:text-slate-455">
                        {formatDate(income.date)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{income.clientName}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{income.serviceTitle}</div>
                      </td>
                      <td className="px-6 py-4 space-y-0.5">
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                          {formatCurrency(income.amount, income.currency)}
                        </div>
                        {showConverted && (
                          <div className="text-[10px] text-brand-600 dark:text-brand-400 font-bold mt-0.5">
                            ≈ {formatCurrency(income.value_converted || (income.amount * (income.exchange_rate || 1)), 'CLP')}
                            <span className="text-slate-400 dark:text-slate-500 font-semibold text-[9px] ml-1">
                              (tasa: {income.exchange_rate || 1})
                            </span>
                          </div>
                        )}
                        {income.includes_vat ? (
                          <div className="text-[10px] text-slate-400 font-medium">
                            Neto: {formatCurrency(vatSplit.net, income.currency)} • IVA (19%): {formatCurrency(vatSplit.vat, income.currency)}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 font-medium">Exento (Sin IVA)</div>
                        )}
                      </td>
                      <td className="px-6 py-4 capitalize text-xs font-semibold text-slate-500">
                        {income.payment_method}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wider ${getStatusColor(income.status)}`}>
                          {getStatusIcon(income.status)}
                          <span>{income.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditModal(income)}
                          className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteIncome(income.id)}
                          className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-brand-500" />
                {selectedIncome ? 'Editar Ingreso' : 'Registrar Ingreso'}
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
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                {/* Client Select */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Cliente (Autor)</label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                  >
                    <option value="">-- Sin Cliente Asignado --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Service Select (depends on client) */}
                {formData.client_id && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Servicio Asociado (Libro)</label>
                    <select
                      value={formData.service_id}
                      onChange={(e) => setFormData({...formData, service_id: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    >
                      <option value="">-- Sin Servicio Asignado --</option>
                      {formServices.map(s => (
                        <option key={s.id} value={s.id}>{s.book_title}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Amount, Currency & VAT */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Monto</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Moneda</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    >
                      <option value="CLP">CLP ($)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>

                  {/* VAT toggle */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">¿Incluye IVA (19%)?</label>
                    <select
                      value={formData.includes_vat ? 'si' : 'no'}
                      onChange={(e) => setFormData({...formData, includes_vat: e.target.value === 'si'})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    >
                      <option value="no">No (Exento/Honorario)</option>
                      <option value="si">Sí (Factura)</option>
                    </select>
                  </div>
                </div>

                {/* Multicurrency Exchange Rate Input (Conditional) */}
                {formData.currency !== 'CLP' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-brand-100 dark:border-brand-900 bg-brand-50/10">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-1.5">Tasa de Cambio del Día</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0.01"
                        value={formData.exchange_rate}
                        onChange={(e) => setFormData({...formData, exchange_rate: Number(e.target.value)})}
                        className="block w-full px-3 py-2 border border-brand-200 dark:border-brand-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                      />
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Total CLP Equivalente</span>
                      <span className="text-base font-extrabold text-slate-850 dark:text-slate-100 mt-1">
                        {formatCurrency(formData.amount * formData.exchange_rate, 'CLP')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Date, Payment Method & Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Date */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Payment method */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Medio Pago</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
                    >
                      <option value="transferencia">transferencia bancaria</option>
                      <option value="paypal">PayPal</option>
                      <option value="tarjeta">tarjeta crédito/débito</option>
                      <option value="efectivo">efectivo</option>
                      <option value="otro">otro</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Estado Pago</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
                    >
                      <option value="pagado">Pagado</option>
                      <option value="parcial">Parcial</option>
                      <option value="pendiente">Pendiente</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notas</label>
                  <textarea
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Referencia de factura, código de operación, detalles de cuota..."
                  ></textarea>
                </div>

                {/* Document Attachment Integration */}
                {selectedIncome ? (
                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase text-left">Documentos Adjuntos ({incomeDocuments.length})</h4>
                    {loadingDocuments ? (
                      <div className="flex justify-center py-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600"></div>
                      </div>
                    ) : incomeDocuments.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-955/20 p-3 rounded-xl border border-slate-100 dark:border-slate-850 text-center">
                        No hay comprobantes, boletas o facturas adjuntas.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {incomeDocuments.map(doc => {
                          const fileFormat = getFileFormatDetails(doc.file_name);
                          const FormatIcon = fileFormat.icon;
                          const docName = doc.title || doc.name || doc.file_name || 'Sin título';
                          const docTypeVal = doc.document_type || doc.file_type || 'otro';
                          return (
                            <div key={doc.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`p-1.5 rounded-lg border shrink-0 ${fileFormat.bgClass}`}>
                                  <FormatIcon className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0 text-left">
                                  <h6 className="font-bold text-[11px] text-slate-800 dark:text-slate-100 truncate" title={docName}>{docName}</h6>
                                  <span className="text-[9px] font-mono text-slate-450 truncate block">{doc.file_name}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 text-right">
                                <span className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[8px] font-bold border uppercase tracking-wider mr-1 ${getDocTypeColor(docTypeVal)}`}>
                                  {docTypeVal}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleViewIncomeFile(doc)}
                                  className="p-1 rounded border border-slate-205 dark:border-slate-800 text-slate-550 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-slate-900 cursor-pointer mr-0.5"
                                  title="Ver"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadIncomeFile(doc)}
                                  className="p-1 rounded border border-slate-205 dark:border-slate-800 text-slate-550 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-slate-900 cursor-pointer mr-0.5"
                                  title="Descargar"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteIncomeDocument(doc)}
                                  className="p-1 rounded border border-slate-205 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-900 cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Upload button/form for existing income */}
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-100 dark:border-slate-850 text-xs text-left">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Archivo *</label>
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                setNewDocFile(file);
                                setNewDocTitle(file.name);
                              }
                            }}
                            className="block w-full text-[10px] text-slate-505 border border-slate-200 dark:border-slate-850 rounded-lg p-1.5 bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">Nombre Visual *</label>
                          <input
                            type="text"
                            value={newDocTitle}
                            onChange={(e) => setNewDocTitle(e.target.value)}
                            placeholder="Título del documento"
                            className="block w-full text-[10px] border border-slate-200 dark:border-slate-850 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">Categoría</label>
                          <select
                            value={newDocType}
                            onChange={(e) => setNewDocType(e.target.value)}
                            className="block w-full text-[10px] border border-slate-205 dark:border-slate-850 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                          >
                            {['factura', 'boleta', 'comprobante de pago', 'otro'].map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">Notas</label>
                          <input
                            type="text"
                            value={newDocNotes}
                            onChange={(e) => setNewDocNotes(e.target.value)}
                            placeholder="Observaciones..."
                            className="block w-full text-[10px] border border-slate-205 dark:border-slate-850 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      {isUploading && (
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-[10px] text-slate-455 font-bold">
                            <span>Subiendo archivo...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-850 h-1 rounded-full overflow-hidden">
                            <div className="bg-brand-500 h-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={isUploading || !newDocFile || !newDocTitle}
                        onClick={() => handleUploadIncomeDocument(newDocFile, newDocType, newDocNotes, newDocTitle, selectedIncome.id, selectedIncome.client_id)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold text-[11px] cursor-pointer transition-all disabled:opacity-50"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        Subir Documento
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase text-left">Adjuntar Boleta, Factura o Comprobante</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 dark:bg-slate-955/20 p-3 rounded-xl border border-slate-100 dark:border-slate-850 text-left">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Archivo</label>
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setNewDocFile(file);
                              setNewDocTitle(file.name);
                            }
                          }}
                          className="block w-full text-[10px] text-slate-550 border border-slate-200 dark:border-slate-850 rounded-lg p-1.5 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">Nombre Visual</label>
                        <input
                          type="text"
                          value={newDocTitle}
                          onChange={(e) => setNewDocTitle(e.target.value)}
                          placeholder="Título del documento"
                          className="block w-full text-[10px] border border-slate-200 dark:border-slate-850 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">Categoría</label>
                        <select
                          value={newDocType}
                          onChange={(e) => setNewDocType(e.target.value)}
                          className="block w-full text-[10px] border border-slate-205 dark:border-slate-850 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                        >
                          {['factura', 'boleta', 'comprobante de pago', 'otro'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">Notas</label>
                        <input
                          type="text"
                          value={newDocNotes}
                          onChange={(e) => setNewDocNotes(e.target.value)}
                          placeholder="Observaciones..."
                          className="block w-full text-[10px] border border-slate-205 dark:border-slate-850 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-350 rounded-xl text-sm font-semibold hover:bg-slate-55 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
