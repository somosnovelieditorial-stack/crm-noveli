import { useEffect, useState } from 'react';
import { supabase, isMock } from '../supabaseClient';
import { formatCurrency, calculateVatSplit, filterByPeriod, exportToCSV } from '../utils';
import PeriodFilter from './PeriodFilter';
import { 
  Plus, Search, Edit2, Trash2, X, FileText, Check, AlertTriangle,
  User, ClipboardCheck, Sparkles, Receipt, RefreshCw, Layers, Download, DollarSign,
  UploadCloud, FileSpreadsheet, Image, File, Eye, Trash
} from 'lucide-react';

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [clients, setClients] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [packs, setPacks] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [period, setPeriod] = useState({
    mode: 'month',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  // Form State
  const [formHeader, setFormHeader] = useState({
    client_id: '',
    prospect_id: '',
    discount: 0,
    currency: 'CLP',
    exchange_rate: 1,
    status: 'borrador',
    notes: '',
    includes_vat: false
  });
  
  // Selected items in form
  const [formItems, setFormItems] = useState([]);

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Document integration states
  const [quotationDocuments, setQuotationDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [newDocFile, setNewDocFile] = useState(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState('contrato');
  const [newDocNotes, setNewDocNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [quotRes, clientsRes, prospectsRes, catalogRes, packsRes] = await Promise.all([
        supabase.from('quotations').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name').order('name', { ascending: true }),
        supabase.from('prospects').select('id, name, converted_to_client_id').order('name', { ascending: true }),
        supabase.from('service_catalog').select('*').eq('active', true).order('name', { ascending: true }),
        supabase.from('service_packs').select('*').eq('active', true).order('name', { ascending: true })
      ]);

      if (quotRes.error) throw quotRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (prospectsRes.error) throw prospectsRes.error;
      if (catalogRes.error) throw catalogRes.error;
      if (packsRes.error) throw packsRes.error;

      setQuotations(quotRes.data || []);
      setClients(clientsRes.data || []);
      setProspects((prospectsRes.data || []).filter(p => !p.converted_to_client_id));
      setCatalog(catalogRes.data || []);
      setPacks(packsRes.data || []);
    } catch (err) {
      console.error("Error loading quotation data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Sync exchange rate when currency changes
  useEffect(() => {
    if (formHeader.currency === 'CLP') {
      setFormHeader(prev => ({ ...prev, exchange_rate: 1 }));
    } else if (formHeader.currency === 'USD') {
      setFormHeader(prev => ({ ...prev, exchange_rate: 940 }));
    } else if (formHeader.currency === 'EUR') {
      setFormHeader(prev => ({ ...prev, exchange_rate: 1010 }));
    }
  }, [formHeader.currency]);

  const handleOpenAddModal = () => {
    setSelectedQuotation(null);
    setFormHeader({
      client_id: '',
      prospect_id: '',
      discount: 0,
      currency: 'CLP',
      exchange_rate: 1,
      status: 'borrador',
      notes: '',
      includes_vat: false
    });
    setFormItems([]);
    setFormError('');
    setIsModalOpen(true);
    setNewDocFile(null);
    setNewDocTitle('');
    setNewDocNotes('');
    setNewDocType('contrato');
    setQuotationDocuments([]);
  };

  const handleOpenEditModal = (quot) => {
    setSelectedQuotation(quot);
    setFormHeader({
      client_id: quot.client_id || '',
      prospect_id: quot.prospect_id || '',
      discount: quot.discount || 0,
      currency: quot.currency || 'CLP',
      exchange_rate: quot.exchange_rate || 1,
      status: quot.status || 'borrador',
      notes: quot.notes || '',
      includes_vat: quot.includes_vat || false
    });

    const itemsMapped = (quot.items || []).map(item => ({
      id: item.id,
      service_id: item.service_id || '',
      pack_id: item.pack_id || '',
      custom_name: item.custom_name || (item.service ? item.service.name : item.pack ? item.pack.name : 'Ítem'),
      price: item.price || 0,
      quantity: item.quantity || 1,
      type: item.service_id ? 'catalog' : 'pack'
    }));

    setFormItems(itemsMapped);
    setFormError('');
    setIsModalOpen(true);
    setNewDocFile(null);
    setNewDocTitle('');
    setNewDocNotes('');
    setNewDocType('contrato');
    handleFetchQuotationDocuments(quot.id);
  };

  // Document integration handlers and helper functions
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
      case 'imagen': return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-955/30 dark:text-teal-400 dark:border-teal-900';
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
          bgClass: 'bg-slate-50 text-slate-600 border-slate-105 dark:bg-slate-950/25 dark:text-slate-400 dark:border-slate-900/40',
          label: 'Archivo'
        };
    }
  };

  const handleFetchQuotationDocuments = async (quotationId) => {
    setLoadingDocuments(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('quotation_id', quotationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotationDocuments(data || []);
    } catch (err) {
      console.error('Error fetching quotation documents:', err);
      setQuotationDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleUploadQuotationDocument = async (file, docType, notes, docTitle, quotationId, clientId, prospectId) => {
    if (!file || !docTitle || !quotationId) return;
    
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      const { data: profile } = await supabase.from('profiles').select('organization_id').single();
      const orgId = profile?.organization_id || 'default-org';

      const fileName = file.name;
      const sanitizedFileName = fileName.replace(/\s+/g, '_');
      
      const folderName = clientId ? `clientes/${clientId}` : prospectId ? `prospectos/${prospectId}` : 'general';
      const storagePath = `${orgId}/${folderName}/cotizaciones/${quotationId}/${docType}/${sanitizedFileName}`;

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
        quotation_id: quotationId
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
      await handleFetchQuotationDocuments(quotationId);
    } catch (err) {
      console.error('Error uploading quotation document:', err);
      alert(err.message || 'Error al subir el archivo.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteQuotationDocument = async (doc) => {
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

        setQuotationDocuments(prev => prev.filter(d => d.id !== doc.id));
      } catch (err) {
        console.error("Error deleting document:", err);
        alert("Error al eliminar el documento.");
      }
    }
  };

  const handleDownloadQuotationFile = (doc) => {
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

  const handleViewQuotationFile = (doc) => {
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

  const handleDeleteQuotation = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta cotización?')) {
      try {
        const { error } = await supabase
          .from('quotations')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setQuotations(quotations.filter(q => q.id !== id));
      } catch (err) {
        console.error('Error deleting quotation:', err);
        alert('Error al eliminar la cotización');
      }
    }
  };

  const handleAddCatalogItem = (serviceId) => {
    const service = catalog.find(c => c.id === serviceId);
    if (!service) return;

    const newItems = [...formItems, {
      id: `new-${Date.now()}`,
      service_id: service.id,
      pack_id: '',
      custom_name: service.name,
      price: Number(service.base_price),
      quantity: 1,
      type: 'catalog'
    }];
    setFormItems(newItems);
  };

  const handleAddPackItem = (packId) => {
    const pack = packs.find(p => p.id === packId);
    if (!pack) return;

    const newItems = [...formItems, {
      id: `new-${Date.now()}`,
      service_id: '',
      pack_id: pack.id,
      custom_name: pack.name,
      price: Number(pack.price_special),
      quantity: 1,
      type: 'pack'
    }];
    setFormItems(newItems);
  };

  const handleUpdateItemField = (itemId, field, value) => {
    setFormItems(formItems.map(item => {
      if (item.id === itemId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleRemoveItem = (itemId) => {
    setFormItems(formItems.filter(item => item.id !== itemId));
  };

  const getSubtotal = (items) => {
    return items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  };

  const getTotals = () => {
    const subtotal = getSubtotal(formItems);
    const discount = Number(formHeader.discount) || 0;
    const total = Math.max(0, subtotal - discount);
    
    const split = calculateVatSplit(total, formHeader.includes_vat);
    return {
      subtotal,
      discount,
      net: split.net,
      vat: split.vat,
      total
    };
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formHeader.client_id && !formHeader.prospect_id) {
      setFormError('Debe seleccionar un Cliente o un Prospecto.');
      return;
    }
    if (formItems.length === 0) {
      setFormError('Debe agregar al menos un ítem a la cotización.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      let quotId = selectedQuotation?.id;
      const { discount, total } = getTotals();

      const quotPayload = {
        client_id: formHeader.client_id || null,
        prospect_id: formHeader.prospect_id || null,
        discount,
        currency: formHeader.currency,
        exchange_rate: Number(formHeader.exchange_rate) || 1,
        amount: total,
        value_converted: total * (Number(formHeader.exchange_rate) || 1),
        rate_date: new Date().toISOString().split('T')[0],
        status: formHeader.status,
        notes: formHeader.notes,
        includes_vat: formHeader.includes_vat
      };

      if (selectedQuotation) {
        // Edit mode
        const { error } = await supabase
          .from('quotations')
          .update(quotPayload)
          .eq('id', quotId);

        if (error) throw error;

        // Delete items
        const { error: delErr } = await supabase
          .from('quotation_items')
          .delete()
          .eq('quotation_id', quotId);

        if (delErr) throw delErr;
      } else {
        // Add mode
        const { data, error } = await supabase
          .from('quotations')
          .insert([quotPayload])
          .select()
          .single();

        if (error) throw error;
        quotId = data.id;
      }

      // Add items
      const itemsPayload = formItems.map(item => ({
        quotation_id: quotId,
        service_id: item.service_id || null,
        pack_id: item.pack_id || null,
        custom_name: item.custom_name,
        price: item.price,
        quantity: item.quantity
      }));

      const { error: insErr } = await supabase
        .from('quotation_items')
        .insert(itemsPayload);

      if (insErr) throw insErr;

      if (!selectedQuotation && newDocFile) {
        await handleUploadQuotationDocument(newDocFile, newDocType, newDocNotes, newDocTitle, quotId, formHeader.client_id, formHeader.prospect_id);
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving quotation:", err);
      setFormError(err.message || 'Error al guardar la cotización.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertToContract = async (quot) => {
    if (!quot.client_id) {
      alert('Esta cotización está asociada a un Prospecto. Por favor, primero convierte el prospecto en Cliente en la sección de Prospectos.');
      return;
    }

    const bookTitlePrompt = window.prompt('Introduce el Título del Libro para los nuevos servicios contratados:', 'Título Tentativo del Libro');
    if (!bookTitlePrompt || !bookTitlePrompt.trim()) {
      alert('Operación cancelada. El título del libro es obligatorio.');
      return;
    }

    setLoading(true);
    try {
      const items = quot.items || [];
      const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
      const discount = quot.discount || 0;
      const totalAmount = Math.max(0, subtotal - discount);

      // Loop through each quotation item and insert a contracted service
      for (const item of items) {
        let serviceType = 'otro';
        if (item.service) {
          serviceType = item.service.category;
        } else if (item.pack) {
          serviceType = 'maquetación';
        }

        const { error: serviceErr } = await supabase
          .from('services')
          .insert([{
            client_id: quot.client_id,
            type: serviceType,
            book_title: bookTitlePrompt,
            status: 'recibido',
            value: item.price * item.quantity,
            currency: quot.currency,
            exchange_rate: quot.exchange_rate || 1,
            value_converted: (item.price * item.quantity) * (quot.exchange_rate || 1),
            rate_date: new Date().toISOString().split('T')[0],
            notes: `Creado desde cotización aceptada. Descripción del ítem: ${item.custom_name || ''}`
          }]);
        
        if (serviceErr) throw serviceErr;
      }

      // Create a pending Income (Invoice record) for the total amount of the quotation
      const { error: incomeErr } = await supabase
        .from('incomes')
        .insert([{
          client_id: quot.client_id,
          amount: totalAmount,
          currency: quot.currency,
          exchange_rate: quot.exchange_rate || 1,
          value_converted: totalAmount * (quot.exchange_rate || 1),
          rate_date: new Date().toISOString().split('T')[0],
          date: new Date().toISOString().split('T')[0],
          payment_method: 'transferencia',
          includes_vat: quot.includes_vat,
          status: 'pendiente',
          notes: `Generado automáticamente por aceptación de cotización.`
        }]);

      if (incomeErr) throw incomeErr;

      // Update quotation status to accepted
      const { error: quotErr } = await supabase
        .from('quotations')
        .update({ status: 'aceptada' })
        .eq('id', quot.id);

      if (quotErr) throw quotErr;

      alert('¡Excelente! La cotización ha sido aprobada. Se crearon los servicios contratados y una cuenta por cobrar (ingreso pendiente) de forma exitosa.');
      await fetchData();
    } catch (err) {
      console.error("Error converting quotation:", err);
      alert('Ocurrió un error al procesar la conversión: ' + err.message);
      await fetchData();
    }
  };

  // Filters logic
  const mappedQuotations = quotations.map(quot => {
    const client = clients.find(c => c.id === quot.client_id);
    const prospect = prospects.find(p => p.id === quot.prospect_id);
    return {
      ...quot,
      contactName: client ? client.name : prospect ? `${prospect.name} (Prospecto)` : 'Contacto no definido'
    };
  });

  const periodFilteredQuotations = filterByPeriod(mappedQuotations, 'created_at', period);

  const filteredQuotations = periodFilteredQuotations.filter(q => {
    const matchesSearch = q.contactName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    const csvData = filteredQuotations.map(q => {
      const items = q.items || [];
      const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
      const discount = q.discount || 0;
      const total = Math.max(0, subtotal - discount);
      const split = calculateVatSplit(total, q.includes_vat);
      
      const itemsStr = items.map(item => `${item.custom_name} (x${item.quantity})`).join('; ');

      return {
        Fecha: q.created_at ? q.created_at.split('T')[0] : '',
        Destinatario: q.contactName,
        'Conceptos Cotizados': itemsStr,
        Moneda: q.currency,
        'Tasa Cambio': q.exchange_rate || 1,
        Subtotal: subtotal,
        Descuento: discount,
        Neto: q.includes_vat ? split.net : total,
        IVA: q.includes_vat ? split.vat : 0,
        Total: total,
        'Total CLP': q.value_converted || total,
        Estado: q.status,
        Notas: q.notes || ''
      };
    });

    exportToCSV(
      csvData,
      `cotizaciones_${period.mode}_${period.year || ''}_${period.month || ''}`,
      ['Fecha', 'Destinatario', 'Conceptos Cotizados', 'Moneda', 'Tasa Cambio', 'Subtotal', 'Descuento', 'Neto', 'IVA', 'Total', 'Total CLP', 'Estado', 'Notas']
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'borrador': return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-350 dark:border-slate-700';
      case 'enviada': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900';
      case 'aceptada': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900';
      case 'rechazada': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-455 dark:border-rose-900';
      case 'vencida': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Cotizaciones
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Estructura presupuestos para clientes o prospectos, aplica descuentos y genera órdenes automáticas.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={filteredQuotations.length === 0}
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
            Nueva Cotización
          </button>
        </div>
      </div>

      {/* Period Filter Component */}
      <PeriodFilter onChange={setPeriod} />

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por cliente o prospecto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full md:w-44 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
          >
            <option value="todos">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="enviada">Enviada</option>
            <option value="aceptada">Aceptada</option>
            <option value="rechazada">Rechazada</option>
            <option value="vencida">Vencida</option>
          </select>
        </div>
      </div>

      {/* Quotations List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : filteredQuotations.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400">
          No se encontraron cotizaciones registradas.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 font-semibold">
                  <th className="px-6 py-4">Destinatario</th>
                  <th className="px-6 py-4">Ítems Cotizados</th>
                  <th className="px-6 py-4">Descuento</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredQuotations.map((quot) => {
                  const items = quot.items || [];
                  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
                  const discount = quot.discount || 0;
                  const total = Math.max(0, subtotal - discount);
                  const showConverted = quot.currency !== 'CLP';

                  return (
                    <tr key={quot.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <User className="w-4 h-4 text-slate-400" />
                          {quot.contactName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {items.map((item, idx) => (
                            <div key={idx} className="text-xs text-slate-550 dark:text-slate-400 font-medium">
                              • {item.custom_name || (item.service ? item.service.name : item.pack ? item.pack.name : 'Ítem')} (x{item.quantity})
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-405 font-medium">
                        {discount > 0 ? formatCurrency(discount, quot.currency) : '-'}
                      </td>
                      <td className="px-6 py-4 space-y-0.5">
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                          {formatCurrency(total, quot.currency)}
                        </div>
                        {showConverted && (
                          <div className="text-[10px] text-brand-600 dark:text-brand-400 font-bold">
                            ≈ {formatCurrency(quot.value_converted || (total * (quot.exchange_rate || 1)), 'CLP')}
                            <span className="text-slate-400 dark:text-slate-500 font-semibold text-[9px] ml-1">
                              (tasa: {quot.exchange_rate || 1})
                            </span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400">
                          {quot.includes_vat ? 'Impuesto IVA incluido' : 'Exento de IVA'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wider ${getStatusColor(quot.status)}`}>
                          {quot.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                        {/* Convert to services flow */}
                        {quot.status !== 'aceptada' && (
                          <button
                            onClick={() => handleConvertToContract(quot)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-sm shadow-emerald-600/10 cursor-pointer"
                            title="Aprobar y Generar Servicios + Factura"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            <span>Contratar</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditModal(quot)}
                          className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuotation(quot.id)}
                          className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-brand-500" />
                {selectedQuotation ? 'Editar Cotización' : 'Nueva Cotización'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400">
                  {formError}
                </div>
              )}

              {/* Selection row (Client OR Prospect) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client Link */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Enviar a Cliente Registrado</label>
                  <select
                    value={formHeader.client_id}
                    disabled={!!formHeader.prospect_id}
                    onChange={(e) => setFormHeader({...formHeader, client_id: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                  >
                    <option value="">-- Seleccionar Cliente --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Prospect Link */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Enviar a Prospecto (Lead)</label>
                  <select
                    value={formHeader.prospect_id}
                    disabled={!!formHeader.client_id}
                    onChange={(e) => setFormHeader({...formHeader, prospect_id: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                  >
                    <option value="">-- Seleccionar Prospecto --</option>
                    {prospects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add item triggers */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Construcción de Ítems</span>
                <div className="flex flex-wrap gap-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddCatalogItem(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                  >
                    <option value="">+ Agregar del Catálogo...</option>
                    {catalog.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({formatCurrency(c.base_price, c.currency)})</option>
                    ))}
                  </select>

                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddPackItem(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs focus:outline-none"
                  >
                    <option value="">+ Agregar Pack Editorial...</option>
                    {packs.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.price_special, p.currency)})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List Table */}
              <div className="border border-slate-100 dark:border-slate-850 rounded-xl overflow-hidden bg-slate-50/30 dark:bg-slate-950/30">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="px-4 py-2.5">Concepto</th>
                      <th className="px-4 py-2.5 w-28">Precio Unitario</th>
                      <th className="px-4 py-2.5 w-16 text-center">Cant</th>
                      <th className="px-4 py-2.5 w-24 text-right">Total</th>
                      <th className="px-4 py-2.5 w-12 text-center">Eliminar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-slate-700 dark:text-slate-350">
                    {formItems.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                          No has agregado ítems a esta cotización. Usa los selectores superiores.
                        </td>
                      </tr>
                    ) : (
                      formItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-855/10">
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={item.custom_name}
                              onChange={(e) => handleUpdateItemField(item.id, 'custom_name', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent focus:border-brand-500 focus:outline-none py-1 font-semibold"
                            />
                            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mt-0.5">
                              {item.type === 'catalog' ? 'catálogo' : 'pack editorial'}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="0"
                              value={item.price}
                              onChange={(e) => handleUpdateItemField(item.id, 'price', Number(e.target.value))}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItemField(item.id, 'quantity', Number(e.target.value))}
                              className="w-12 px-1.5 py-1 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 text-center focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-slate-800 dark:text-slate-200">
                            {formatCurrency(item.price * item.quantity, formHeader.currency)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-1 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Currency & Tax configs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Currency */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Moneda Cotización</label>
                  <select
                    value={formHeader.currency}
                    onChange={(e) => setFormHeader({...formHeader, currency: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                  >
                    <option value="CLP">CLP ($)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                {/* VAT includes toggle */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">¿Aplica Cobro IVA (19%)?</label>
                  <select
                    value={formHeader.includes_vat ? 'si' : 'no'}
                    onChange={(e) => setFormHeader({...formHeader, includes_vat: e.target.value === 'si'})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                  >
                    <option value="no">No (Exento de Impuestos)</option>
                    <option value="si">Sí (Impuestos IVA Incluidos)</option>
                  </select>
                </div>

                {/* Status selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Estado Cotización</label>
                  <select
                    value={formHeader.status}
                    onChange={(e) => setFormHeader({...formHeader, status: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
                  >
                    <option value="borrador">Borrador</option>
                    <option value="enviada">Enviada</option>
                    <option value="aceptada">Aceptada</option>
                    <option value="rechazada">Rechazada</option>
                    <option value="vencida">Vencida</option>
                  </select>
                </div>
              </div>

              {/* Multicurrency Exchange Rate Input (Conditional) */}
              {formHeader.currency !== 'CLP' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-brand-100 dark:border-brand-900 bg-brand-50/10">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-1.5">Tasa de Cambio Estimada</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      value={formHeader.exchange_rate}
                      onChange={(e) => setFormHeader({...formHeader, exchange_rate: Number(e.target.value)})}
                      className="block w-full px-3 py-2 border border-brand-200 dark:border-brand-800 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Total CLP Estimado</span>
                    <span className="text-base font-extrabold text-slate-850 dark:text-slate-100 mt-1">
                      {formatCurrency(getTotals().total * formHeader.exchange_rate, 'CLP')}
                    </span>
                  </div>
                </div>
              )}

              {/* Discount & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Descuento Especial</label>
                  <input
                    type="number"
                    min="0"
                    value={formHeader.discount}
                    onChange={(e) => setFormHeader({...formHeader, discount: Number(e.target.value)})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notas Internas</label>
                  <input
                    type="text"
                    value={formHeader.notes}
                    onChange={(e) => setFormHeader({...formHeader, notes: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Validez, referencias de cobro, notas adicionales..."
                  />
                </div>
              </div>

              {/* Totals Summary */}
              <div className="pt-4 border-t border-slate-150 dark:border-slate-800 flex justify-end">
                <div className="w-64 space-y-2 text-right">
                  <div className="flex justify-between text-xs text-slate-400 font-bold uppercase">
                    <span>Subtotal:</span>
                    <span className="font-mono text-slate-750 dark:text-slate-200">
                      {formatCurrency(getTotals().subtotal, formHeader.currency)}
                    </span>
                  </div>
                  {getTotals().discount > 0 && (
                    <div className="flex justify-between text-xs text-rose-500 font-bold uppercase">
                      <span>Descuento:</span>
                      <span className="font-mono">
                        -{formatCurrency(getTotals().discount, formHeader.currency)}
                      </span>
                    </div>
                  )}
                  {formHeader.includes_vat && (
                    <>
                      <div className="flex justify-between text-[11px] text-slate-455">
                        <span>Neto (Base):</span>
                        <span className="font-mono">
                          {formatCurrency(getTotals().net, formHeader.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-455">
                        <span>IVA (19%):</span>
                        <span className="font-mono">
                          {formatCurrency(getTotals().vat, formHeader.currency)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-slate-800 dark:text-slate-100 border-t border-dashed border-slate-200 dark:border-slate-800 pt-2">
                    <span>Total:</span>
                    <span className="font-mono text-brand-600 dark:text-brand-450">
                      {formatCurrency(getTotals().total, formHeader.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Document Attachment Integration */}
              {selectedQuotation ? (
                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase text-left">Contrato / Documentos Adjuntos ({quotationDocuments.length})</h4>
                  {loadingDocuments ? (
                    <div className="flex justify-center py-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600"></div>
                    </div>
                  ) : quotationDocuments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-100 dark:border-slate-850 text-center">
                      No hay contratos o documentos adjuntos a esta cotización.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {quotationDocuments.map(doc => {
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
                                <span className="text-[9px] font-mono text-slate-455 truncate block">{doc.file_name}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-right">
                              <span className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[8px] font-bold border uppercase tracking-wider mr-1 ${getDocTypeColor(docTypeVal)}`}>
                                {docTypeVal}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleViewQuotationFile(doc)}
                                className="p-1 rounded border border-slate-205 dark:border-slate-800 text-slate-550 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-slate-900 cursor-pointer mr-0.5"
                                title="Ver"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadQuotationFile(doc)}
                                className="p-1 rounded border border-slate-205 dark:border-slate-800 text-slate-550 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-slate-900 cursor-pointer mr-0.5"
                                title="Descargar"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQuotationDocument(doc)}
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

                  {/* Upload button/form for existing quotation */}
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
                          {['contrato', 'portada', 'manuscrito', 'otro'].map(t => (
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
                      onClick={() => handleUploadQuotationDocument(newDocFile, newDocType, newDocNotes, newDocTitle, selectedQuotation.id, formHeader.client_id, formHeader.prospect_id)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold text-[11px] cursor-pointer transition-all disabled:opacity-50"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      Subir Documento
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase text-left">Adjuntar Contrato o Archivo Relacionado</h4>
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
                        {['contrato', 'portada', 'manuscrito', 'otro'].map(t => (
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
                  {isSubmitting ? 'Guardando...' : 'Guardar Cotización'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
