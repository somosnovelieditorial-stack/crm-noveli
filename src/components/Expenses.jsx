import { useEffect, useState } from 'react';
import { supabase, isMock, getValidOrgId } from '../supabaseClient';
import { formatCurrency, formatDate, calculateVatSplit, filterByPeriod, exportToCSV } from '../utils';
import PeriodFilter from './PeriodFilter';
import { 
  Plus, Search, Edit2, Trash2, X, DollarSign, 
  Briefcase, Calendar, ShieldCheck, ShieldAlert, FileText, Download,
  UploadCloud, FileSpreadsheet, Image, File, Eye, Trash
} from 'lucide-react';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [providerFilter, setProviderFilter] = useState('todos');
  const [deductibleFilter, setDeductibleFilter] = useState('todos');
  const [period, setPeriod] = useState({
    mode: 'month',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    provider_id: '',
    category: 'otros',
    amount: 0,
    currency: 'CLP',
    exchange_rate: 1,
    date: new Date().toISOString().split('T')[0],
    includes_vat: false,
    deductible: true,
    notes: ''
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Document integration states
  const [expenseDocuments, setExpenseDocuments] = useState([]);
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
      const [expensesRes, providersRes] = await Promise.all([
        supabase.from('expenses').select('*').order('date', { ascending: false }),
        supabase.from('providers').select('id, name').order('name', { ascending: true })
      ]);

      if (expensesRes.error) throw expensesRes.error;
      if (providersRes.error) throw providersRes.error;

      setExpenses(expensesRes.data || []);
      setProviders(providersRes.data || []);
    } catch (err) {
      console.error('Error fetching expenses data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync default exchange rate when currency changes
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
    setSelectedExpense(null);
    setFormData({
      provider_id: '',
      category: 'otros',
      amount: 0,
      currency: 'CLP',
      exchange_rate: 1,
      date: new Date().toISOString().split('T')[0],
      includes_vat: false,
      deductible: true,
      notes: ''
    });
    setFormError('');
    setIsModalOpen(true);
    setNewDocFile(null);
    setNewDocTitle('');
    setNewDocNotes('');
    setNewDocType('factura');
    setExpenseDocuments([]);
  };

  const handleOpenEditModal = (expense) => {
    setSelectedExpense(expense);
    setFormData({
      provider_id: expense.provider_id || '',
      category: expense.category || 'otros',
      amount: expense.amount || 0,
      currency: expense.currency || 'CLP',
      exchange_rate: expense.exchange_rate || 1,
      date: expense.date || new Date().toISOString().split('T')[0],
      includes_vat: expense.includes_vat || false,
      deductible: expense.deductible !== undefined ? expense.deductible : true,
      notes: expense.notes || ''
    });
    setFormError('');
    setIsModalOpen(true);
    setNewDocFile(null);
    setNewDocTitle('');
    setNewDocNotes('');
    setNewDocType('factura');
    handleFetchExpenseDocuments(expense.id);
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este gasto?')) {
      try {
        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setExpenses(expenses.filter(e => e.id !== id));
      } catch (err) {
        console.error('Error deleting expense:', err);
        alert('Error al eliminar el gasto');
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
          bgClass: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/25 dark:text-rose-405 dark:border-rose-900/40',
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

  const handleFetchExpenseDocuments = async (expenseId) => {
    setLoadingDocuments(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenseDocuments(data || []);
    } catch (err) {
      console.error('Error fetching expense documents:', err);
      setExpenseDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleUploadExpenseDocument = async (file, docType, notes, docTitle, expenseId, providerId) => {
    if (!file || !docTitle || !expenseId) return;
    
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      const orgId = await getValidOrgId();

      const fileName = file.name;
      const sanitizedFileName = fileName.replace(/\s+/g, '_');
      const storagePath = `${orgId}/proveedores/${providerId || 'general'}/gastos/${expenseId}/${docType}/${sanitizedFileName}`;

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
        provider_id: providerId || null,
        expense_id: expenseId
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
      await handleFetchExpenseDocuments(expenseId);
    } catch (err) {
      console.error('Error uploading expense document:', err);
      alert(err.message || 'Error al subir el archivo.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteExpenseDocument = async (doc) => {
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

        setExpenseDocuments(prev => prev.filter(d => d.id !== doc.id));
      } catch (err) {
        console.error("Error deleting document:", err);
        alert("Error al eliminar el documento.");
      }
    }
  };

  const handleDownloadExpenseFile = (doc) => {
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

  const handleViewExpenseFile = (doc) => {
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
      provider_id: formData.provider_id || null,
      exchange_rate: Number(formData.exchange_rate) || 1,
      value_converted: Number(formData.amount) * (Number(formData.exchange_rate) || 1),
      rate_date: formData.date
    };

    try {
      if (selectedExpense) {
        // Edit Mode
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', selectedExpense.id);

        if (error) throw error;
      } else {
        // Add Mode
        const { data, error } = await supabase
          .from('expenses')
          .insert([payload])
          .select();

        if (error) throw error;
        
        const createdExpense = data?.[0];
        if (createdExpense && newDocFile) {
          await handleUploadExpenseDocument(newDocFile, newDocType, newDocNotes, newDocTitle, createdExpense.id, createdExpense.provider_id);
        }
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving expense:', err);
      setFormError(err.message || 'Error al guardar el gasto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    'software', 'diseño', 'impresión', 'publicidad', 
    'legal', 'impuestos', 'oficina virtual', 'otros'
  ];

  // Filters logic
  const mappedExpenses = expenses.map(expense => {
    const provider = providers.find(p => p.id === expense.provider_id);
    return {
      ...expense,
      providerName: provider ? provider.name : 'Sin proveedor'
    };
  });

  const periodFilteredExpenses = filterByPeriod(mappedExpenses, 'date', period);

  const filteredExpenses = periodFilteredExpenses.filter(expense => {
    const matchesSearch = 
      expense.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (expense.notes && expense.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'todos' || expense.category === categoryFilter;
    const matchesProvider = providerFilter === 'todos' || expense.provider_id === providerFilter;
    
    let matchesDeductible = true;
    if (deductibleFilter === 'si') matchesDeductible = expense.deductible;
    else if (deductibleFilter === 'no') matchesDeductible = !expense.deductible;

    return matchesSearch && matchesCategory && matchesProvider && matchesDeductible;
  });

  const handleExportCSV = () => {
    const csvData = filteredExpenses.map(exp => {
      const vatSplit = calculateVatSplit(exp.amount, exp.includes_vat);
      return {
        Fecha: exp.date,
        Categoria: exp.category,
        Proveedor: exp.providerName,
        Monto: exp.amount,
        Moneda: exp.currency,
        'Tasa Cambio': exp.exchange_rate || 1,
        'Monto CLP': exp.value_converted || exp.amount,
        Neto: exp.deductible ? (exp.includes_vat ? vatSplit.net : exp.amount) : exp.amount,
        'IVA Credito': exp.deductible && exp.includes_vat ? vatSplit.vat : 0,
        Deducible: exp.deductible ? 'Sí' : 'No',
        Notas: exp.notes || ''
      };
    });

    exportToCSV(
      csvData,
      `gastos_${period.mode}_${period.year || ''}_${period.month || ''}`,
      ['Fecha', 'Categoria', 'Proveedor', 'Monto', 'Moneda', 'Tasa Cambio', 'Monto CLP', 'Neto', 'IVA Credito', 'Deducible', 'Notas']
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Gastos (Egreso)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Control de egresos operativos, pago a proveedores de diseño, imprenta, softwares e impuestos.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={filteredExpenses.length === 0}
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
            Registrar Gasto
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
              placeholder="Buscar por proveedor, categoría, notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Categoría:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="block w-full px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
            >
              <option value="todos">Todos</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Provider Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Proveedor:</span>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="block w-full px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
            >
              <option value="todos">Todos</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Deductible Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Deducible:</span>
            <select
              value={deductibleFilter}
              onChange={(e) => setDeductibleFilter(e.target.value)}
              className="block w-full px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none animate-fade-in"
            >
              <option value="todos">Todos</option>
              <option value="si">Sí (Deducible)</option>
              <option value="no">No (No Deducible)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400">
          No se encontraron registros de gastos.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 font-semibold">
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Categoría / Proveedor</th>
                  <th className="px-6 py-4">Monto / Desglose</th>
                  <th className="px-6 py-4">Deducible</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredExpenses.map((expense) => {
                  const vatSplit = calculateVatSplit(expense.amount, expense.includes_vat);
                  const showConverted = expense.currency !== 'CLP';
                  return (
                    <tr key={expense.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="px-6 py-4 font-semibold text-xs whitespace-nowrap text-slate-500 dark:text-slate-455">
                        {formatDate(expense.date)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-100 capitalize">{expense.category}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{expense.providerName}</div>
                      </td>
                      <td className="px-6 py-4 space-y-0.5">
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                          {formatCurrency(expense.amount, expense.currency)}
                        </div>
                        {showConverted && (
                          <div className="text-[10px] text-brand-600 dark:text-brand-400 font-bold mt-0.5">
                            ≈ {formatCurrency(expense.value_converted || (expense.amount * (expense.exchange_rate || 1)), 'CLP')}
                            <span className="text-slate-400 dark:text-slate-500 font-semibold text-[9px] ml-1">
                              (tasa: {expense.exchange_rate || 1})
                            </span>
                          </div>
                        )}
                        {expense.includes_vat ? (
                          <div className="text-[10px] text-slate-400 font-medium">
                            Neto: {formatCurrency(vatSplit.net, expense.currency)} • IVA (19%): {formatCurrency(vatSplit.vat, expense.currency)}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 font-medium">Honorario / Exento</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {expense.deductible ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-450 text-xs font-semibold">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span>Sí</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-semibold">
                            <ShieldAlert className="w-4 h-4 text-slate-400" />
                            <span>No</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditModal(expense)}
                          className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-655 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
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
                <Briefcase className="w-5 h-5 text-brand-500" />
                {selectedExpense ? 'Editar Gasto' : 'Registrar Gasto'}
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
                {/* Category & Provider */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Categoría Gasto</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Provider */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Proveedor</label>
                    <select
                      value={formData.provider_id}
                      onChange={(e) => setFormData({...formData, provider_id: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    >
                      <option value="">-- Sin Proveedor Asignado --</option>
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

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
                      <option value="no">No (Exento/Sin Boleta/Honorario)</option>
                      <option value="si">Sí (Factura Compra)</option>
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

                {/* Date & Deductible */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  {/* Deductible */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">¿Es Deducible Tributariamente?</label>
                    <select
                      value={formData.deductible ? 'si' : 'no'}
                      onChange={(e) => setFormData({...formData, deductible: e.target.value === 'si'})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    >
                      <option value="si">Sí (Gasto Giro Deducible / Genera Crédito)</option>
                      <option value="no">No (Gasto Rechazado / Sin Crédito)</option>
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
                    className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-955/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Detalles de la compra, justificación de gasto..."
                  ></textarea>
                </div>

                {/* Document Attachment Integration */}
                {selectedExpense ? (
                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
                     <h4 className="text-xs font-bold text-slate-400 uppercase text-left">Documentos Adjuntos ({expenseDocuments.length})</h4>
                     {loadingDocuments ? (
                       <div className="flex justify-center py-2">
                         <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600"></div>
                       </div>
                     ) : expenseDocuments.length === 0 ? (
                       <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-955/20 p-3 rounded-xl border border-slate-100 dark:border-slate-850 text-center">
                         No hay comprobantes, boletas o facturas adjuntas.
                       </p>
                     ) : (
                       <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                         {expenseDocuments.map(doc => {
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
                                   onClick={() => handleViewExpenseFile(doc)}
                                   className="p-1 rounded border border-slate-205 dark:border-slate-800 text-slate-550 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-slate-900 cursor-pointer mr-0.5"
                                   title="Ver"
                                 >
                                   <Eye className="w-3 h-3" />
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => handleDownloadExpenseFile(doc)}
                                   className="p-1 rounded border border-slate-205 dark:border-slate-800 text-slate-550 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-slate-900 cursor-pointer mr-0.5"
                                   title="Descargar"
                                 >
                                   <Download className="w-3 h-3" />
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => handleDeleteExpenseDocument(doc)}
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
 
                     {/* Upload button/form for existing expense */}
                     <div className="space-y-3 bg-slate-50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-100 dark:border-slate-850 text-xs text-left">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                         <div>
                           <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">Archivo *</label>
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
                         onClick={() => handleUploadExpenseDocument(newDocFile, newDocType, newDocNotes, newDocTitle, selectedExpense.id, selectedExpense.provider_id)}
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
                         <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">Archivo</label>
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
