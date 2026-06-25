import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatCurrency, formatDate, calculateVatSplit, filterByPeriod, exportToCSV } from '../utils';
import PeriodFilter from './PeriodFilter';
import { 
  Plus, Search, Edit2, Trash2, X, DollarSign, 
  User, BookOpen, Calendar, HelpCircle, FileText, CheckCircle, AlertCircle, Download
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
        const { error } = await supabase
          .from('incomes')
          .insert([payload]);

        if (error) throw error;
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
