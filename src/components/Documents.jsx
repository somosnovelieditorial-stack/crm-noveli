import { useEffect, useState } from 'react';
import { supabase, isMock } from '../supabaseClient';
import { formatDate } from '../utils';
import { 
  Plus, Search, X, Trash2, FileText, Download, Eye,
  User, Link, Calendar, UploadCloud, Tag, Layers, Briefcase, BookOpen
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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    file_type: 'contrato',
    client_id: '',
    provider_id: '',
    income_id: '',
    expense_id: '',
    service_id: '',
    quotation_id: ''
  });

  const [formError, setFormError] = useState('');

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
      setFormData(prev => ({ ...prev, name: file.name }));
    }
  };

  const handleDeleteDocument = async (doc) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar el documento "${doc.name}"?`)) {
      try {
        const { error: storageErr } = await supabase.storage
          .from('crm_documents')
          .remove([doc.file_path]);

        if (storageErr) {
          console.warn("Storage warning (could be mock):", storageErr);
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

  const handleDownloadFile = (doc) => {
    if (isMock) {
      alert(`Simulación de descarga en Modo Demo: descargando archivo "${doc.name}" desde la ruta "${doc.file_path}"`);
    } else {
      const { data } = supabase.storage
        .from('crm_documents')
        .getPublicUrl(doc.file_path);
      
      if (data?.publicUrl) {
        window.open(data.publicUrl, '_blank');
      } else {
        alert('No se pudo generar el enlace de descarga');
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setFormError('Por favor selecciona un archivo para subir.');
      return;
    }
    if (!formData.name.trim()) {
      setFormError('El nombre del documento es requerido.');
      return;
    }

    setIsUploading(true);
    setFormError('');
    setUploadProgress(20);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const storagePath = `user_docs/${uniqueName}`;

      setUploadProgress(50);

      const { error: uploadErr } = await supabase.storage
        .from('crm_documents')
        .upload(storagePath, selectedFile);

      if (uploadErr) throw uploadErr;

      setUploadProgress(80);

      const dbPayload = {
        name: formData.name,
        file_path: storagePath,
        file_type: formData.file_type,
        client_id: formData.client_id || null,
        provider_id: formData.provider_id || null,
        income_id: formData.income_id || null,
        expense_id: formData.expense_id || null,
        service_id: formData.service_id || null,
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

  const docTypes = ['contrato', 'manuscrito', 'portada', 'boleta', 'factura', 'comprobante', 'archivo final', 'otro'];

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
      clientName: client ? client.name : null,
      providerName: provider ? provider.name : null,
      serviceName: service ? service.book_title : null,
      incomeDetails: income ? `Ingreso: ${formatDate(income.date)}` : null,
      expenseDetails: expense ? `Gasto: ${expense.category}` : null,
      quotationDetails: quotation ? `Cotización: ${formatDate(quotation.created_at)}` : null
    };
  }).filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (doc.clientName && doc.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (doc.providerName && doc.providerName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = typeFilter === 'todos' || doc.file_type === typeFilter;
    const matchesClient = clientFilter === 'todos' || doc.client_id === clientFilter;
    const matchesService = serviceFilter === 'todos' || doc.service_id === serviceFilter;

    return matchesSearch && matchesType && matchesClient && matchesService;
  });

  const getDocTypeColor = (type) => {
    switch (type) {
      case 'contrato': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900';
      case 'manuscrito': return 'bg-amber-50 text-amber-755 border-amber-200 dark:bg-amber-955/30 dark:text-amber-400 dark:border-amber-900';
      case 'portada': return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-900';
      case 'boleta': return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900';
      case 'factura': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-455 dark:border-rose-900';
      case 'comprobante': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900';
      case 'archivo final': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900';
      default: return 'bg-slate-100 text-slate-700 border-slate-205 dark:bg-slate-800 dark:text-slate-350 dark:border-slate-700';
    }
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
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
          {/* Document Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Tipo:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none capitalize"
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
              className="block w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none"
            >
              <option value="todos">Todos</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Service/Book Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Proyecto:</span>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="block w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none"
            >
              <option value="todos">Todos</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.book_title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Documents Grid / Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400">
          No hay documentos que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 font-semibold">
                  <th className="px-6 py-4">Documento</th>
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4">Relación</th>
                  <th className="px-6 py-4">F. Subida</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-xs">{doc.name}</div>
                          <span className="text-[10px] text-slate-400 font-mono block truncate max-w-xs">{doc.file_path}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wider ${getDocTypeColor(doc.file_type)}`}>
                        {doc.file_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 space-y-1 text-xs">
                      {doc.clientName && (
                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
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
                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Prov: <strong>{doc.providerName}</strong></span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleDownloadFile(doc)}
                        className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc)}
                        className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    placeholder="e.g. Contrato Firmado Obra.pdf"
                  />
                </div>

                {/* Document Category type */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Categoría / Tipo de Documento</label>
                  <select
                    value={formData.file_type}
                    onChange={(e) => setFormData({...formData, file_type: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
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
    </div>
  );
}
