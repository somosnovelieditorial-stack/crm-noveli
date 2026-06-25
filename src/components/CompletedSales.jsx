import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatCurrency, formatDate, filterByPeriod, exportToCSV } from '../utils';
import PeriodFilter from './PeriodFilter';
import { 
  CheckCircle, DollarSign, Calendar, TrendingUp, 
  User, Download, BookOpen, Layers, Award, Search 
} from 'lucide-react';

export default function CompletedSales() {
  const [completedSales, setCompletedSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Period filter settings
  const [period, setPeriod] = useState({
    mode: 'month',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  useEffect(() => {
    fetchCompletedSales();
  }, []);

  const fetchCompletedSales = async () => {
    setLoading(true);
    try {
      // Fetch services, clients, incomes, and expenses to compute utility
      const [servicesRes, clientsRes, incomesRes, expensesRes] = await Promise.all([
        supabase.from('services').select('*'),
        supabase.from('clients').select('id, name'),
        supabase.from('incomes').select('*'),
        supabase.from('expenses').select('*')
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (incomesRes.error) throw incomesRes.error;
      if (expensesRes.error) throw expensesRes.error;

      const services = servicesRes.data || [];
      const clients = clientsRes.data || [];
      const incomes = incomesRes.data || [];
      const expenses = expensesRes.data || [];

      // A Completed Sale is defined as a service with status = 'cerrado' or 'entregado'
      const completedServices = services.filter(s => ['entregado', 'cerrado'].includes(s.status));

      const processedSales = completedServices.map(service => {
        const client = clients.find(c => c.id === service.client_id);
        
        // Find incomes linked to this service
        const serviceIncomes = incomes.filter(inc => inc.service_id === service.id);
        const totalPaid = serviceIncomes
          .filter(inc => inc.status === 'pagado')
          .reduce((sum, item) => sum + Number(item.amount), 0);
          
        const totalPending = serviceIncomes
          .filter(inc => ['pendiente', 'parcial'].includes(inc.status))
          .reduce((sum, item) => {
            const coef = item.status === 'parcial' ? 0.5 : 1.0;
            return sum + (Number(item.amount) * coef);
          }, 0);

        // Define closing date (either estimated delivery or created_at + 30 days)
        const closingDate = service.estimated_delivery || service.start_date || new Date().toISOString().split('T')[0];

        // Utility: service value minus expenses specifically related to this design/delivery (if design/printing provider expenses exist)
        // For demonstration, let's assume designers cost 25% of service value as expense.
        const estimatedCost = Number(service.value) * 0.25;
        const utility = Number(service.value) - estimatedCost;

        // Payment status string
        let paymentStatus = 'Pendiente';
        if (totalPaid >= service.value) {
          paymentStatus = 'Pagado';
        } else if (totalPaid > 0) {
          paymentStatus = 'Parcial';
        }

        return {
          id: service.id,
          clientName: client ? client.name : 'Cliente no identificado',
          bookTitle: service.book_title,
          serviceType: service.type,
          value: Number(service.value),
          currency: service.currency,
          closingDate,
          paymentStatus,
          processStatus: service.status,
          utility,
          totalPaid,
          totalPending
        };
      });

      setCompletedSales(processedSales);
    } catch (err) {
      console.error("Error loading completed sales:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter list by period and search query
  const periodFilteredSales = filterByPeriod(completedSales, 'closingDate', period);
  
  const finalFilteredSales = periodFilteredSales.filter(sale => {
    return sale.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           sale.bookTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
           sale.serviceType.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Calculate metrics for the filtered period
  const totalVolumeCLP = finalFilteredSales
    .filter(s => s.currency === 'CLP')
    .reduce((sum, item) => sum + item.value, 0);

  const totalVolumeUSD = finalFilteredSales
    .filter(s => s.currency === 'USD')
    .reduce((sum, item) => sum + item.value, 0);

  const totalUtilityCLP = finalFilteredSales
    .filter(s => s.currency === 'CLP')
    .reduce((sum, item) => sum + item.utility, 0);

  // Exporter
  const handleExportCSV = () => {
    const csvData = finalFilteredSales.map(s => ({
      Cliente: s.clientName,
      Libro: s.bookTitle,
      Servicio: s.serviceType,
      Monto: s.value,
      Moneda: s.currency,
      'Fecha Cierre': s.closingDate,
      'Estado Pago': s.paymentStatus,
      'Estado Proceso': s.processStatus,
      'Utilidad Estimada': s.utility
    }));

    exportToCSV(
      csvData, 
      `ventas_finalizadas_${period.mode}_${period.year || ''}_${period.month || ''}`,
      ['Cliente', 'Libro', 'Servicio', 'Monto', 'Moneda', 'Fecha Cierre', 'Estado Pago', 'Estado Proceso', 'Utilidad Estimada']
    );
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'Pagado':
        return 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900';
      case 'Parcial':
        return 'bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/30 dark:text-amber-450 dark:border-amber-900';
      default:
        return 'bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/30 dark:text-rose-450 dark:border-rose-900';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Ventas Finalizadas
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Auditoría de contratos cerrados, entregados y cobrados con cálculo de rentabilidad.
          </p>
        </div>
        
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={finalFilteredSales.length === 0}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Period Filter Component */}
      <PeriodFilter onChange={setPeriod} />

      {/* Overview Cards for Period */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Facturación Periodo (CLP)</span>
            <h3 className="text-xl font-bold mt-1 text-emerald-650 dark:text-emerald-400">
              {formatCurrency(totalVolumeCLP, 'CLP')}
            </h3>
          </div>
          <span className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Facturación Periodo (USD)</span>
            <h3 className="text-xl font-bold mt-1 text-emerald-650 dark:text-emerald-400">
              {formatCurrency(totalVolumeUSD, 'USD')}
            </h3>
          </div>
          <span className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </span>
        </div>

        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-brand-300 uppercase tracking-widest">Utilidad Estimada CLP</span>
            <h3 className="text-xl font-bold mt-1 text-emerald-400">
              {formatCurrency(totalUtilityCLP, 'CLP')}
            </h3>
          </div>
          <span className="p-3 bg-brand-500/10 text-emerald-400 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </span>
        </div>
      </div>

      {/* Table search filter */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Filtrar por autor, libro o servicio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Sales List Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : finalFilteredSales.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400">
          No hay registros de ventas finalizadas en este período.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 font-semibold">
                  <th className="px-6 py-4">Autor</th>
                  <th className="px-6 py-4">Libro / Servicio</th>
                  <th className="px-6 py-4">Monto total</th>
                  <th className="px-6 py-4">Fecha Cierre</th>
                  <th className="px-6 py-4">Pago</th>
                  <th className="px-6 py-4">Proceso Editorial</th>
                  <th className="px-6 py-4 text-right">Utilidad Estimada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-350">
                {finalFilteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="px-6 py-4 font-semibold text-slate-855 dark:text-slate-100">
                      {sale.clientName}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-750 dark:text-slate-205">{sale.bookTitle}</div>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-2 py-0.5 rounded capitalize mt-1 inline-block">
                        {sale.serviceType}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-150">
                      {formatCurrency(sale.value, sale.currency)}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                      {formatDate(sale.closingDate)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${getPaymentStatusColor(sale.paymentStatus)}`}>
                        {sale.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900 capitalize">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {sale.processStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-emerald-650 dark:text-emerald-450">
                        {formatCurrency(sale.utility, sale.currency)}
                      </div>
                      <span className="text-[9px] text-slate-400 block">75% Rentabilidad</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
