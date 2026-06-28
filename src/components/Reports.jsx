import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatCurrency, convertToClp, filterByPeriod, exportToCSV, calculateVatSplit, formatDate } from '../utils';
import PeriodFilter from './PeriodFilter';
import { 
  BarChart3, PieChart, Users, DollarSign, ArrowUpRight, 
  TrendingUp, Award, Layers, CreditCard, AlertTriangle, 
  Clock, Download, CheckCircle2, Percent, UserCheck, Globe2, Coins, Briefcase
} from 'lucide-react';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('finanzas'); // finanzas, ventas, autores
  const [period, setPeriod] = useState({
    mode: 'month',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  const [dbData, setDbData] = useState({
    clients: [],
    prospects: [],
    services: [],
    incomes: [],
    expenses: [],
    quotations: [],
    payroll: [],
    allocations: []
  });

  const [report, setReport] = useState({
    incomesTotal: 0,
    incomesNet: 0,
    incomesVat: 0,
    expensesTotal: 0,
    expensesNet: 0,
    expensesVat: 0,
    utility: 0,
    vatToPay: 0,
    
    activeClients: 0,
    prospectsCount: { baja: 0, media: 0, alta: 0, total: 0 },
    servicesCount: { total: 0, inProcess: 0 },
    
    serviceSales: [],
    expenseCategories: [],
    delayedServices: [],
    nearExpiryServices: [],

    // Advanced reports additions
    authorCountries: [],
    nationalClients: 0,
    internationalClients: 0,
    incomesByCurrency: [],
    mostSoldPacks: [],
    avgDeliveryTime: 0,
    conversionRate: 0,
    salesByPeriodList: [],
    monthlyUtilityList: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: clients },
        { data: prospects },
        { data: services },
        { data: incomes },
        { data: expenses },
        { data: quotations },
        { data: payroll },
        { data: allocations }
      ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('prospects').select('*'),
        supabase.from('services').select('*'),
        supabase.from('incomes').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('quotations').select('*'),
        supabase.from('payroll_payments').select('*'),
        supabase.from('income_allocations').select('*')
      ]);

      setDbData({
        clients: clients || [],
        prospects: prospects || [],
        services: services || [],
        incomes: incomes || [],
        expenses: expenses || [],
        quotations: quotations || [],
        payroll: payroll || [],
        allocations: allocations || []
      });
    } catch (err) {
      console.error("Error loading db data for reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateReport();
  }, [dbData, period]);

  const calculateReport = () => {
    const { clients, prospects, services, incomes, expenses, quotations, payroll } = dbData;
    if (loading && clients.length === 0) return;

    // Filter datasets by period
    const filteredIncomes = filterByPeriod(incomes, 'date', period);
    const filteredExpenses = filterByPeriod(expenses, 'date', period);
    const filteredServices = filterByPeriod(services, 'start_date', period);
    const filteredClients = filterByPeriod(clients, 'created_at', period);
    const filteredProspects = filterByPeriod(prospects, 'created_at', period);
    const filteredQuotations = filterByPeriod(quotations, 'created_at', period);
    const filteredPayroll = filterByPeriod(payroll || [], 'date', period);

    // 1. Incomes Math (CLP Equivalent)
    let incomesTotal = 0;
    let incomesNet = 0;
    let incomesVat = 0;
    filteredIncomes.forEach(i => {
      const clpAmount = Number(i.value_converted || i.amount || 0);
      const split = calculateVatSplit(clpAmount, i.includes_vat);
      incomesTotal += clpAmount;
      incomesNet += split.net;
      incomesVat += split.vat;
    });

    // 2. Expenses Math (CLP Equivalent)
    let expensesTotal = 0;
    let expensesNet = 0;
    let expensesVat = 0;
    filteredExpenses.forEach(e => {
      const clpAmount = Number(e.value_converted || e.amount || 0);
      const split = calculateVatSplit(clpAmount, e.includes_vat);
      expensesTotal += clpAmount;
      if (e.includes_vat) {
        if (e.deductible) {
          expensesNet += split.net;
          expensesVat += split.vat;
        } else {
          expensesNet += clpAmount; 
        }
      } else {
        expensesNet += clpAmount;
      }
    });

    // Payroll payments math
    let payrollTotal = 0;
    filteredPayroll.forEach(p => {
      if (p.status === 'pagado') {
        payrollTotal += Number(p.value_converted || p.amount || 0);
      }
    });

    const utility = incomesNet - expensesNet - payrollTotal;
    const vatToPay = incomesVat - expensesVat;

    // 3. Active clients in period
    const activeClients = filteredClients.filter(c => c.status === 'activo').length;

    // 4. Prospects Count by State (probability)
    const prospectsCount = { baja: 0, media: 0, alta: 0, total: filteredProspects.length };
    filteredProspects.forEach(p => {
      if (p.probability === 'baja') prospectsCount.baja += 1;
      else if (p.probability === 'media') prospectsCount.media += 1;
      else if (p.probability === 'alta') prospectsCount.alta += 1;
    });

    // 5. Sales by service type (filteredServices)
    const salesGroup = {};
    filteredServices.forEach(s => {
      const clpVal = Number(s.value_converted || s.value || 0);
      if (!salesGroup[s.type]) {
        salesGroup[s.type] = { type: s.type, count: 0, total: 0 };
      }
      salesGroup[s.type].count += 1;
      salesGroup[s.type].total += clpVal;
    });
    const serviceSales = Object.values(salesGroup).sort((a, b) => b.total - a.total);

    // 6. Expenses by Category
    const expGroup = {};
    filteredExpenses.forEach(e => {
      const clpVal = Number(e.value_converted || e.amount || 0);
      expGroup[e.category] = (expGroup[e.category] || 0) + clpVal;
    });
    const totalExpSum = Object.values(expGroup).reduce((sum, v) => sum + v, 0) || 1;
    const expenseCategories = Object.keys(expGroup).map(category => ({
      category,
      total: expGroup[category],
      percentage: Math.round((expGroup[category] / totalExpSum) * 100)
    })).sort((a, b) => b.total - a.total);

    // 7. Services Status tracking (delayed & near expiration)
    const delayedServices = [];
    const nearExpiryServices = [];
    const today = new Date();

    filteredServices.forEach(s => {
      const client = clients.find(c => c.id === s.client_id);
      const clientName = client ? client.name : 'Cliente no identificado';

      if (s.estimated_delivery && !['entregado', 'cerrado'].includes(String(s.status || '').toLowerCase())) {
        const estDeliveryDate = new Date(s.estimated_delivery);
        const timeDiff = estDeliveryDate - today;
        const remainingDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        const extendedService = {
          ...s,
          clientName,
          remainingDays
        };

        if (remainingDays < 0) {
          delayedServices.push(extendedService);
        } else if (remainingDays <= 15) {
          nearExpiryServices.push(extendedService);
        }
      }
    });

    // --- NEW ADVANCED METRICS ---

    // A. País de autores
    const countryCounts = {};
    filteredClients.forEach(c => {
      const country = c.country || 'Chile'; // fallback standard
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });
    const authorCountries = Object.keys(countryCounts).map(country => ({
      country,
      count: countryCounts[country],
      percentage: Math.round((countryCounts[country] / (filteredClients.length || 1)) * 100)
    })).sort((a, b) => b.count - a.count);

    // B. Clientes Nacionales vs Internacionales
    let nationalClients = 0;
    let internationalClients = 0;
    filteredClients.forEach(c => {
      if (c.client_type === 'internacional') {
        internationalClients++;
      } else {
        nationalClients++;
      }
    });

    // C. Ingresos por Moneda
    const currencySum = {};
    filteredIncomes.forEach(i => {
      const curr = i.currency || 'CLP';
      currencySum[curr] = (currencySum[curr] || 0) + Number(i.amount || 0);
    });
    const incomesByCurrency = Object.keys(currencySum).map(curr => ({
      currency: curr,
      total: currencySum[curr]
    }));

    // D. Packs más vendidos (from accepted quotes)
    const packCounts = {};
    filteredQuotations.forEach(q => {
      if (q.status === 'aceptada' && q.items) {
        q.items.forEach(item => {
          if (item.pack) {
            const name = item.pack.name;
            packCounts[name] = (packCounts[name] || 0) + Number(item.quantity || 1);
          }
        });
      }
    });
    const mostSoldPacks = Object.keys(packCounts).map(name => ({
      name,
      count: packCounts[name]
    })).sort((a, b) => b.count - a.count);

    // E. Tiempo promedio de entrega (días de duración de servicios ya entregados/cerrados)
    const completedServices = filteredServices.filter(s => ['entregado', 'cerrado'].includes(String(s?.status || '').toLowerCase()) && s.start_date && s.estimated_delivery);
    let totalDays = 0;
    completedServices.forEach(s => {
      const start = new Date(s.start_date);
      const end = new Date(s.estimated_delivery);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      totalDays += diffDays;
    });
    const avgDeliveryTime = completedServices.length > 0 ? Math.round(totalDays / completedServices.length) : 0;

    // F. Conversión de prospectos a clientes (leads convertidos / total leads)
    const totalProspectsPeriod = filteredProspects.length;
    const convertedProspectsPeriod = filteredProspects.filter(p => p.converted_to_client_id).length;
    const conversionRate = totalProspectsPeriod > 0 ? Math.round((convertedProspectsPeriod / totalProspectsPeriod) * 100) : 0;

    // G. Ventas finalizadas por mes y año (grouped incomes)
    const salesByPeriod = {};
    filteredIncomes.forEach(i => {
      if (i.date) {
        const d = new Date(i.date);
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        salesByPeriod[key] = (salesByPeriod[key] || 0) + Number(i.value_converted || i.amount || 0);
      }
    });
    const salesByPeriodList = Object.keys(salesByPeriod).map(key => ({
      period: key,
      total: salesByPeriod[key]
    })).sort((a, b) => a.period.localeCompare(b.period));

    // H. Utilidad estimada mensual y anual
    const monthlyFinancials = {};
    
    // Process all incomes for monthly financials
    incomes.forEach(i => {
      if (i.date) {
        const d = new Date(i.date);
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!monthlyFinancials[key]) monthlyFinancials[key] = { incomes: 0, expenses: 0 };
        monthlyFinancials[key].incomes += Number(i.value_converted || i.amount || 0);
      }
    });

    // Process all expenses for monthly financials
    expenses.forEach(e => {
      if (e.date) {
        const d = new Date(e.date);
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!monthlyFinancials[key]) monthlyFinancials[key] = { incomes: 0, expenses: 0 };
        monthlyFinancials[key].expenses += Number(e.value_converted || e.amount || 0);
      }
    });

    const monthlyUtilityList = Object.keys(monthlyFinancials).map(key => ({
      month: key,
      incomes: monthlyFinancials[key].incomes,
      expenses: monthlyFinancials[key].expenses,
      utility: monthlyFinancials[key].incomes - monthlyFinancials[key].expenses
    })).sort((a, b) => a.month.localeCompare(b.month));

    // --- Treasury allocations math ---
    const filteredIncomeIds = new Set(filteredIncomes.map(i => i.id));
    const periodAllocations = (dbData.allocations || []).filter(alloc => filteredIncomeIds.has(alloc.income_id));
    
    const treasurySummary = {};
    const areas = ['sueldos', 'reserva operacional', 'gastos del autor', 'publicidad', 'proveedores', 'impuestos', 'utilidad Noveli', 'otro'];
    areas.forEach(a => {
      treasurySummary[a] = 0;
    });

    periodAllocations.forEach(alloc => {
      const inc = filteredIncomes.find(i => i.id === alloc.income_id);
      const rate = inc ? Number(inc.exchange_rate || 1) : 1;
      const clpAllocAmount = Number(alloc.calculated_amount) * rate;
      treasurySummary[alloc.area] = (treasurySummary[alloc.area] || 0) + clpAllocAmount;
    });

    setReport({
      treasurySummary,
      incomesTotal,
      incomesNet,
      incomesVat,
      expensesTotal,
      expensesNet,
      expensesVat,
      utility,
      vatToPay,
      activeClients,
      prospectsCount,
      servicesCount: {
        total: filteredServices.length,
        inProcess: filteredServices.filter(s => !['entregado', 'cerrado'].includes(String(s?.status || '').toLowerCase())).length
      },
      serviceSales,
      expenseCategories,
      delayedServices,
      nearExpiryServices,

      // Advanced metrics
      authorCountries,
      nationalClients,
      internationalClients,
      incomesByCurrency,
      mostSoldPacks,
      avgDeliveryTime,
      conversionRate,
      salesByPeriodList,
      monthlyUtilityList
    });
  };

  const handleExportCSV = () => {
    const csvData = [
      { Seccion: 'Resumen Financiero', Indicador: 'Ingresos Totales Brutos (CLP Eq)', Valor: report.incomesTotal },
      { Seccion: 'Resumen Financiero', Indicador: 'Ingresos Netos (CLP Eq)', Valor: report.incomesNet },
      { Seccion: 'Resumen Financiero', Indicador: 'IVA Débito Recaudado (CLP Eq)', Valor: report.incomesVat },
      { Seccion: 'Resumen Financiero', Indicador: 'Gastos Totales Brutos (CLP Eq)', Valor: report.expensesTotal },
      { Seccion: 'Resumen Financiero', Indicador: 'Gastos Netos (CLP Eq)', Valor: report.expensesNet },
      { Seccion: 'Resumen Financiero', Indicador: 'IVA Crédito Deducido (CLP Eq)', Valor: report.expensesVat },
      { Seccion: 'Resumen Financiero', Indicador: 'Utilidad Estimada Real (CLP Eq)', Valor: report.utility },
      { Seccion: 'Resumen Financiero', Indicador: 'Impuesto IVA por Pagar (CLP Eq)', Valor: report.vatToPay },
      { Seccion: 'Operaciones', Indicador: 'Clientes Activos Creados', Valor: report.activeClients },
      { Seccion: 'Operaciones', Indicador: 'Prospectos Nuevos', Valor: report.prospectsCount.total },
      { Seccion: 'Operaciones', Indicador: 'Tasa Conversión Leads (%)', Valor: report.conversionRate },
      { Seccion: 'Operaciones', Indicador: 'Tiempo Entrega Promedio (Días)', Valor: report.avgDeliveryTime },
      { Seccion: 'Operaciones', Indicador: 'Servicios Editorial Contratados', Valor: report.servicesCount.total }
    ];

    // Append service sales
    report.serviceSales.forEach(s => {
      csvData.push({
        Seccion: 'Ventas por Servicio',
        Indicador: `Servicio: ${s.type} (${s.count} contratos)`,
        Valor: s.total
      });
    });

    exportToCSV(
      csvData,
      `informe_gestion_avanzado_${period.mode}_${period.year || ''}_${period.month || ''}`,
      ['Seccion', 'Indicador', 'Valor']
    );
  };

  const monthsList = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 dark:text-slate-100">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Reportes y Análisis Comercial
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Auditoría de rentabilidad, ventas por servicio, impuestos y alertas de plazos por período.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer w-fit shadow-sm transition-all"
        >
          <Download className="w-4 h-4" />
          Exportar Informe CSV
        </button>
      </div>

      {/* Period Selector */}
      <PeriodFilter onChange={setPeriod} />

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Facturación Bruta (CLP Eq)</span>
            <h3 className="text-xl font-bold mt-1 text-emerald-650 dark:text-emerald-400">
              {formatCurrency(report.incomesTotal, 'CLP')}
            </h3>
            <span className="text-[10px] text-slate-400 block mt-1">Neto: {formatCurrency(report.incomesNet, 'CLP')}</span>
          </div>
          <span className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gastos Totales (CLP Eq)</span>
            <h3 className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">
              {formatCurrency(report.expensesTotal, 'CLP')}
            </h3>
            <span className="text-[10px] text-slate-400 block mt-1">Neto: {formatCurrency(report.expensesNet, 'CLP')}</span>
          </div>
          <span className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl">
            <CreditCard className="w-5 h-5" />
          </span>
        </div>

        <div className="bg-slate-905 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between bg-slate-900 dark:bg-slate-950">
          <div>
            <span className="text-[10px] font-bold text-brand-300 uppercase tracking-widest">Utilidad Estimada</span>
            <h3 className="text-xl font-bold mt-1 text-emerald-400">
              {formatCurrency(report.utility, 'CLP')}
            </h3>
            <span className="text-[10px] text-slate-400 block mt-1">Ingresos netos - Gastos netos</span>
          </div>
          <span className="p-3 bg-brand-500/10 text-emerald-400 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IVA Neto Estimado</span>
            <h3 className={`text-xl font-bold mt-1 ${report.vatToPay >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-500'}`}>
              {formatCurrency(report.vatToPay, 'CLP')}
            </h3>
            <span className="text-[10px] text-slate-400 block mt-1">Débito: {formatCurrency(report.incomesVat, 'CLP')} • Crédito: {formatCurrency(report.expensesVat, 'CLP')}</span>
          </div>
          <span className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl">
            <Percent className="w-5 h-5" />
          </span>
        </div>
      </div>

      {/* Advanced reports sub-tabs navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('finanzas')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'finanzas' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-355'
          }`}
        >
          <Coins className="w-4 h-4" />
          Resumen Financiero y Monedas
        </button>
        <button
          onClick={() => setActiveSubTab('ventas')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'ventas' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-355'
          }`}
        >
          <Award className="w-4 h-4" />
          Servicios y Packs Vendidos
        </button>
        <button
          onClick={() => setActiveSubTab('autores')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'autores' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-355'
          }`}
        >
          <Users className="w-4 h-4" />
          Demografía de Autores y Conversión
        </button>
        <button
          onClick={() => setActiveSubTab('tesoreria')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'tesoreria' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-355'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Tesorería y Distribución
        </button>
      </div>

      {/* Dynamic Tab Render */}
      <div className="space-y-6">
        {activeSubTab === 'finanzas' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Incomes by currency */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                  <Coins className="w-5 h-5 text-emerald-500" />
                  Facturación por Moneda (Monto Original)
                </h3>
                <div className="divide-y divide-slate-150 dark:divide-slate-800 text-sm">
                  {report.incomesByCurrency.length === 0 ? (
                    <p className="text-slate-400 py-6 text-center">No hay ingresos registrados en el período.</p>
                  ) : (
                    report.incomesByCurrency.map((item, idx) => (
                      <div key={idx} className="py-3 flex justify-between items-center">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{item.currency}</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.total, item.currency)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[11px] text-slate-400">
                    * Todos los montos se convierten a la moneda principal (CLP) usando la tasa de cambio histórica registrada.
                  </p>
                </div>
              </div>

              {/* Expenses by Category */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-rose-500" />
                  Egresos Operacionales por Categoría (CLP Eq)
                </h3>
                <div className="space-y-4">
                  {report.expenseCategories.length === 0 ? (
                    <p className="text-slate-400 py-6 text-center">No hay egresos registrados.</p>
                  ) : (
                    report.expenseCategories.map((cat, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-600 dark:text-slate-300 capitalize">{cat.category}</span>
                          <span className="font-semibold text-slate-500">{formatCurrency(cat.total, 'CLP')} ({cat.percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-brand-500 h-full rounded-full" 
                            style={{ width: `${cat.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Utility and Income History Table */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-brand-500" />
                Historial de Utilidad Estimada (Mensual y Anual)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase">
                      <th className="py-3 px-4">Periodo (Mes/Año)</th>
                      <th className="py-3 px-4 text-right">Ingresos Brutos (CLP Eq)</th>
                      <th className="py-3 px-4 text-right">Gastos Operativos (CLP Eq)</th>
                      <th className="py-3 px-4 text-right">Utilidad Neta Estimada</th>
                      <th className="py-3 px-4 text-right">Rentabilidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {report.monthlyUtilityList.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-400">No hay información financiera suficiente para agrupar.</td>
                      </tr>
                    ) : (
                      report.monthlyUtilityList.map((item, idx) => {
                        const rentability = item.incomes > 0 ? Math.round((item.utility / item.incomes) * 100) : 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                            <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-200">{item.month}</td>
                            <td className="py-3.5 px-4 text-right text-emerald-650 dark:text-emerald-405 font-medium">{formatCurrency(item.incomes, 'CLP')}</td>
                            <td className="py-3.5 px-4 text-right text-rose-600 dark:text-rose-455">{formatCurrency(item.expenses, 'CLP')}</td>
                            <td className={`py-3.5 px-4 text-right font-bold ${item.utility >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {formatCurrency(item.utility, 'CLP')}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                rentability >= 25 
                                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' 
                                  : rentability >= 0 
                                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' 
                                    : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
                              }`}>
                                {rentability}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'ventas' && (
          <div className="space-y-6">
            {/* Operational stats KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-850 flex items-center gap-3.5">
                <div className="p-2.5 bg-violet-500/10 text-violet-500 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-700 dark:text-slate-200">{report.servicesCount.total}</h4>
                  <p className="text-xs text-slate-400 font-medium">Contratos iniciados en el período</p>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-850 flex items-center gap-3.5">
                <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-700 dark:text-slate-200">
                    {report.avgDeliveryTime > 0 ? `${report.avgDeliveryTime} Días` : 'N/D'}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">Tiempo promedio de entrega</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-850 flex items-center gap-3.5">
                <div className="p-2.5 bg-brand-500/10 text-brand-500 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-700 dark:text-slate-200">
                    {Array.isArray(dbData?.services) ? dbData.services.filter(s => ['entregado', 'cerrado'].includes(String(s?.status || '').toLowerCase())).length : 0}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">Total de obras entregadas históricas</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Most sold services */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                  <Award className="w-5 h-5 text-brand-500" />
                  Servicios Más Vendidos (Frecuencia)
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {report.serviceSales.length === 0 ? (
                    <p className="text-slate-400 py-6 text-center">No hay registros de ventas de servicios.</p>
                  ) : (
                    report.serviceSales.map((item, idx) => (
                      <div key={idx} className="py-3 flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{item.type}</span>
                          <p className="text-[10px] text-slate-400 font-medium">{item.count} servicios contratados</p>
                        </div>
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-sans">
                          {formatCurrency(item.total, 'CLP')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Most sold packs */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-500" />
                  Packs Editoriales Más Vendidos (Cotizaciones Aceptadas)
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {report.mostSoldPacks.length === 0 ? (
                    <p className="text-slate-400 py-6 text-center">No se registran packs en cotizaciones aceptadas en este período.</p>
                  ) : (
                    report.mostSoldPacks.map((item, idx) => (
                      <div key={idx} className="py-3 flex justify-between items-center">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{item.name}</span>
                        <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 px-2 py-0.5 rounded text-xs font-bold">
                          {item.count} vendidos
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Sales performance per month */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-brand-500" />
                Ventas Finalizadas por Mes y Año (Ingresos Recaudados CLP Eq)
              </h3>
              <div className="space-y-4">
                {report.salesByPeriodList.length === 0 ? (
                  <p className="text-slate-400 py-6 text-center">No hay registros financieros.</p>
                ) : (
                  report.salesByPeriodList.map((item, idx) => {
                    const maxVal = Math.max(...report.salesByPeriodList.map(s => s.total)) || 1;
                    const percent = Math.round((item.total / maxVal) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-200">{item.period}</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(item.total, 'CLP')}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full" 
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'autores' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* National vs International */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2 mb-4">
                    <Globe2 className="w-5 h-5 text-blue-500" />
                    Clientes Nacionales vs Internacionales
                  </h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-350">
                        <span>Autores Nacionales (Chile)</span>
                        <span>{report.nationalClients} ({Math.round((report.nationalClients / (report.activeClients || 1)) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-full overflow-hidden">
                        <div 
                          className="bg-brand-500 h-full rounded-full" 
                          style={{ width: `${(report.nationalClients / (report.activeClients || 1)) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-355">
                        <span>Autores Internacionales</span>
                        <span>{report.internationalClients} ({Math.round((report.internationalClients / (report.activeClients || 1)) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-full overflow-hidden">
                        <div 
                          className="bg-violet-500 h-full rounded-full" 
                          style={{ width: `${(report.internationalClients / (report.activeClients || 1)) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-4">
                  <p className="text-[11px] text-slate-400">
                    * Esta segmentación ayuda a clasificar el cobro de IVA y las pasarelas de pago necesarias (Paypal vs Transferencia Directa).
                  </p>
                </div>
              </div>

              {/* Conversion rate */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2 mb-4">
                    <UserCheck className="w-5 h-5 text-indigo-500" />
                    Conversión de Prospectos a Clientes
                  </h3>
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center p-6 bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 rounded-full text-3xl font-black mb-3">
                      {report.conversionRate}%
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                      Tasa de conversión histórica en este período
                    </p>
                  </div>
                  <div className="space-y-2.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Total Prospectos Creados:</span>
                      <span className="font-bold">{report.prospectsCount.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prospectos Convertidos:</span>
                      <span className="font-bold text-emerald-500">
                        {dbData.prospects.filter(p => p.converted_to_client_id).length}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand-500 h-full rounded-full" 
                      style={{ width: `${report.conversionRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Author countries breakdown list */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                <Globe2 className="w-5 h-5 text-brand-500" />
                Desglose Geográfico de Autores (Por País)
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-850 text-sm">
                {report.authorCountries.length === 0 ? (
                  <p className="text-slate-400 py-6 text-center">No hay clientes registrados en este período.</p>
                ) : (
                  report.authorCountries.map((c, idx) => (
                    <div key={idx} className="py-3.5 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{c.country}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{c.count} autores</span>
                        <span className="text-[10px] text-slate-400 block">{c.percentage}% del total</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delayed / Near Expiry items listed at the bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6">
        {/* Delayed Services */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-rose-600 dark:text-rose-455 text-sm uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500 animate-bounce" />
            Servicios Atrasados ({report.delayedServices.length})
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {report.delayedServices.length === 0 ? (
              <p className="text-slate-400 py-6 text-center">¡Excelente! No hay servicios atrasados.</p>
            ) : (
              report.delayedServices.map((s, idx) => (
                <div key={idx} className="py-3 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-200">{s.book_title}</h4>
                    <p className="text-xs text-slate-400">{s.clientName} • {s.type}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-450 border border-rose-100 dark:border-rose-900">
                      Atrasado {Math.abs(s.remainingDays)} días
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">Plazo: {formatDate(s.estimated_delivery)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Near Expiry */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-amber-600 dark:text-amber-455 text-sm uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
            Próximos a Vencer (&lt;= 15 días) ({report.nearExpiryServices.length})
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {report.nearExpiryServices.length === 0 ? (
              <p className="text-slate-400 py-6 text-center">No hay servicios próximos a vencer.</p>
            ) : (
              report.nearExpiryServices.map((s, idx) => (
                <div key={idx} className="py-3 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-200">{s.book_title}</h4>
                    <p className="text-xs text-slate-400">{s.clientName} • {s.type}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100 dark:border-amber-900">
                      Quedan {s.remainingDays} días
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">Plazo: {formatDate(s.estimated_delivery)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {activeSubTab === 'tesoreria' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-brand-500" />
            Distribución de Fondos de Tesorería (Periodo Consultado)
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs">
            Resumen acumulado del reparto de los ingresos netos ingresados durante el periodo seleccionado.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <div className="divide-y divide-slate-150 dark:divide-slate-800 text-xs">
                {Object.keys(report.treasurySummary || {}).map((area) => (
                  <div key={area} className="py-3 flex justify-between items-center border-b border-slate-100 dark:border-slate-850">
                    <span className="font-bold capitalize text-slate-700 dark:text-slate-300">{area}</span>
                    <span className="font-mono font-bold text-slate-850 dark:text-slate-100">
                      {formatCurrency(report.treasurySummary[area], 'CLP')}
                    </span>
                  </div>
                ))}
                <div className="py-3 flex justify-between items-center font-black border-t border-slate-205 dark:border-slate-800 text-slate-850 dark:text-slate-100 text-sm mt-2 pt-2">
                  <span>Total Asignado:</span>
                  <span>
                    {formatCurrency(
                      Object.values(report.treasurySummary || {}).reduce((acc, v) => acc + v, 0),
                      'CLP'
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col justify-center space-y-4 text-xs text-slate-600 dark:text-slate-400">
              <h4 className="font-bold text-slate-800 dark:text-slate-200">¿Cómo funciona la distribución de ingresos?</h4>
              <p>
                En Somos Noveli, cada pago u honorario registrado en la sección de <strong>Ingresos</strong> puede dividirse en diferentes cuentas de destino (ej. Sueldos, Publicidad, Impuestos, Utilidad Noveli, Proveedores o Reserva Operacional).
              </p>
              <p>
                Este panel consolida la suma total de dinero CLP equivalente repartido a cada área correspondiente para todos los cobros recibidos que coinciden con los filtros del periodo activo.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
