import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { formatCurrency, calculateVatSplit, convertToClp, filterByPeriod } from '../utils';
import PeriodFilter from './PeriodFilter';
import { 
  TrendingUp, TrendingDown, DollarSign, Percent, 
  Users, UserCheck, BookOpen, AlertCircle, Calendar 
} from 'lucide-react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    month: {
      incomesTotal: 0,
      incomesNet: 0,
      incomesVat: 0,
      expensesTotal: 0,
      expensesNet: 0,
      expensesVat: 0,
      utility: 0,
      vatToPay: 0,
      incomesUsd: 0,
      expensesUsd: 0,
    },
    year: {
      incomesTotal: 0,
      incomesNet: 0,
      expensesTotal: 0,
      expensesNet: 0,
      utility: 0,
    },
    counts: {
      activeClients: 0,
      activeProspects: 0,
      servicesInProcess: 0,
      pendingPayments: 0,
      pendingPaymentsValue: 0
    },
    recentFollowups: [],
    recentServices: []
  });

  const [period, setPeriod] = useState({
    mode: 'month',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  const handlePeriodChange = useCallback((newPeriod) => {
    setPeriod((prev) => {
      if (
        prev.mode === newPeriod.mode &&
        prev.year === newPeriod.year &&
        prev.month === newPeriod.month &&
        prev.startDate === newPeriod.startDate &&
        prev.endDate === newPeriod.endDate
      ) {
        return prev; // Structurally identical, keep reference to break render loop
      }
      return newPeriod;
    });
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch everything
      const [
        { data: clients },
        { data: prospects },
        { data: services },
        { data: incomes },
        { data: expenses }
      ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('prospects').select('*'),
        supabase.from('services').select('*'),
        supabase.from('incomes').select('*'),
        supabase.from('expenses').select('*')
      ]);

      const now = new Date();
      
      // Filter clients
      const activeClients = (clients || []).filter(c => c.status === 'activo').length;

      // Filter prospects
      const activeProspects = (prospects || []).filter(p => !p.converted_to_client_id).length;

      // Filter services in process
      const servicesInProcess = (services || []).filter(s => 
        !['entregado', 'cerrado'].includes(s.status)
      ).length;

      // Pending payments
      const pendingIncomes = (incomes || []).filter(i => ['pendiente', 'parcial'].includes(i.status));
      const pendingPaymentsCount = pendingIncomes.length;
      const pendingPaymentsVal = pendingIncomes.reduce((sum, item) => {
        // If status is 'parcial', we count 50% as pending for simulation
        const coef = item.status === 'parcial' ? 0.5 : 1.0;
        return sum + convertToClp(item.amount * coef, item.currency);
      }, 0);

      // Financials: Period Filter
      const monthIncomes = filterByPeriod(incomes || [], 'date', period);
      const monthExpenses = filterByPeriod(expenses || [], 'date', period);

      // Monthly aggregates
      let mIncTotal = 0;
      let mIncNet = 0;
      let mIncVat = 0;
      let mIncUsd = 0;

      monthIncomes.forEach(i => {
        const split = calculateVatSplit(i.amount, i.includes_vat);
        const clpAmount = convertToClp(i.amount, i.currency);
        const clpNet = convertToClp(split.net, i.currency);
        const clpVat = convertToClp(split.vat, i.currency);

        mIncTotal += clpAmount;
        mIncNet += clpNet;
        mIncVat += clpVat;

        if (i.currency === 'USD') {
          mIncUsd += i.amount;
        }
      });

      let mExpTotal = 0;
      let mExpNet = 0;
      let mExpVat = 0;
      let mExpUsd = 0;

      monthExpenses.forEach(e => {
        const split = calculateVatSplit(e.amount, e.includes_vat);
        
        // Deductible logic: only add to vat credit if deductible is true
        const vatCredit = e.deductible ? split.vat : 0;
        
        // If it includes VAT but is NOT deductible, the net expense is the total amount (since we can't deduct the tax, it's a cost)
        const expNet = e.deductible ? split.net : e.amount;

        const clpAmount = convertToClp(e.amount, e.currency);
        const clpNet = convertToClp(expNet, e.currency);
        const clpVatCredit = convertToClp(vatCredit, e.currency);

        mExpTotal += clpAmount;
        mExpNet += clpNet;
        mExpVat += clpVatCredit;

        if (e.currency === 'USD') {
          e.currency === 'USD' && (mExpUsd += e.amount);
        }
      });

      // Financials: Year Filter
      const targetYear = period.year || new Date().getFullYear();
      const yearIncomes = (incomes || []).filter(i => {
        const d = new Date(i.date);
        return d.getFullYear() === targetYear;
      });

      const yearExpenses = (expenses || []).filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === targetYear;
      });

      let yIncTotal = 0;
      let yIncNet = 0;
      yearIncomes.forEach(i => {
        const split = calculateVatSplit(i.amount, i.includes_vat);
        yIncTotal += convertToClp(i.amount, i.currency);
        yIncNet += convertToClp(split.net, i.currency);
      });

      let yExpTotal = 0;
      let yExpNet = 0;
      yearExpenses.forEach(e => {
        const split = calculateVatSplit(e.amount, e.includes_vat);
        const expNet = e.deductible ? split.net : e.amount;
        yExpTotal += convertToClp(e.amount, e.currency);
        yExpNet += convertToClp(expNet, e.currency);
      });

      // Recent prospects with follow up date >= today
      const todayStr = now.toISOString().split('T')[0];
      const recentFollowups = (prospects || [])
        .filter(p => !p.converted_to_client_id && p.followup_date)
        .sort((a, b) => new Date(a.followup_date) - new Date(b.followup_date))
        .slice(0, 5);

      // Recent editorial services
      const recentServices = (services || [])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(s => {
          const client = (clients || []).find(c => c.id === s.client_id);
          return {
            ...s,
            clientName: client ? client.name : 'Cliente Desconocido'
          };
        });

      setStats({
        month: {
          incomesTotal: mIncTotal,
          incomesNet: mIncNet,
          incomesVat: mIncVat,
          expensesTotal: mExpTotal,
          expensesNet: mExpNet,
          expensesVat: mExpVat,
          utility: mIncNet - mExpNet,
          vatToPay: mIncVat - mExpVat,
          incomesUsd: mIncUsd,
          expensesUsd: mExpUsd,
        },
        year: {
          incomesTotal: yIncTotal,
          incomesNet: yIncNet,
          expensesTotal: yExpTotal,
          expensesNet: yExpNet,
          utility: yIncNet - yExpNet,
        },
        counts: {
          activeClients,
          activeProspects,
          servicesInProcess,
          pendingPayments: pendingPaymentsCount,
          pendingPaymentsValue: pendingPaymentsVal
        },
        recentFollowups,
        recentServices
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const monthsList = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const getPeriodLabel = () => {
    if (period.mode === 'month') {
      return `Resumen del Mes: ${monthsList[period.month - 1]} ${period.year}`;
    } else if (period.mode === 'year') {
      return `Resumen del Año: ${period.year}`;
    } else {
      return `Resumen del Período: ${period.startDate} al ${period.endDate}`;
    }
  };

  const targetYear = useMemo(() => period.year || new Date().getFullYear(), [period.year]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header and Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Dashboard Editorial
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Resumen de operaciones y finanzas para Somos Noveli.
          </p>
        </div>
      </div>

      {/* Period Filter Component */}
      <PeriodFilter onChange={handlePeriodChange} />

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            <span className="text-sm font-semibold text-slate-400">Cargando datos...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Main Month Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-500" />
          {getPeriodLabel()}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Incomes */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all animate-hover-card">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ingresos Totales (Mes)</p>
                <h3 className="text-2xl font-extrabold mt-2 text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(stats.month.incomesTotal, 'CLP')}
                </h3>
                {stats.month.incomesUsd > 0 && (
                  <p className="text-xs text-slate-600 dark:text-slate-450 mt-1 font-medium">
                    Incluye USD {formatCurrency(stats.month.incomesUsd, 'USD')}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                  Neto: {formatCurrency(stats.month.incomesNet, 'CLP')}
                </p>
              </div>
              <span className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-400 rounded-xl shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </span>
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all animate-hover-card">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gastos Totales (Mes)</p>
                <h3 className="text-2xl font-extrabold mt-2 text-rose-600 dark:text-rose-400">
                  {formatCurrency(stats.month.expensesTotal, 'CLP')}
                </h3>
                {stats.month.expensesUsd > 0 && (
                  <p className="text-xs text-slate-600 dark:text-slate-450 mt-1 font-medium">
                    Incluye USD {formatCurrency(stats.month.expensesUsd, 'USD')}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                  Neto Deducible: {formatCurrency(stats.month.expensesNet, 'CLP')}
                </p>
              </div>
              <span className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-650 dark:text-rose-400 rounded-xl shadow-xs">
                <TrendingDown className="w-5 h-5" />
              </span>
            </div>
          </div>

          {/* Utility */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all animate-hover-card">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Utilidad Estimada (Mes)</p>
                <h3 className={`text-2xl font-extrabold mt-2 ${stats.month.utility >= 0 ? 'text-brand-600 dark:text-brand-405' : 'text-rose-600'}`}>
                  {formatCurrency(stats.month.utility, 'CLP')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                  Ingresos Netos - Gastos Netos
                </p>
              </div>
              <span className="p-3 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 rounded-xl shadow-xs">
                <DollarSign className="w-5 h-5" />
              </span>
            </div>
          </div>

          {/* VAT Estimate */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all animate-hover-card">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">IVA Estimado por Pagar</p>
                <h3 className={`text-2xl font-extrabold mt-2 ${stats.month.vatToPay >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-500'}`}>
                  {formatCurrency(stats.month.vatToPay, 'CLP')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                  Débito {formatCurrency(stats.month.incomesVat, 'CLP')} - Crédito {formatCurrency(stats.month.expensesVat, 'CLP')}
                </p>
              </div>
              <span className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl shadow-xs">
                <Percent className="w-5 h-5" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Operations Counts Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active Clients */}
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-xs">
          <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-805 dark:text-slate-200">{stats.counts.activeClients}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Clientes Activos</p>
          </div>
        </div>

        {/* Active Prospects */}
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-xs">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 rounded-lg">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-850 dark:text-slate-200">{stats.counts.activeProspects}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Prospectos Activos</p>
          </div>
        </div>

        {/* Services in Process */}
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-xs">
          <div className="p-2.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-lg">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-850 dark:text-slate-200">{stats.counts.servicesInProcess}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Servicios en Proceso</p>
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-xs">
          <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-850 dark:text-slate-200">{stats.counts.pendingPayments}</h4>
            <p className="text-xs text-slate-550 dark:text-slate-400 font-semibold">
              Pagos Pendientes: <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(stats.counts.pendingPaymentsValue, 'CLP')}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Mid Section: SVG Analytics Chart & Annual Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simple Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">Ingresos vs Gastos del Mes</h3>
            <div className="flex gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-500 rounded"></span>Ingresos</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-rose-500 rounded"></span>Gastos</span>
            </div>
          </div>

          {stats.month.incomesTotal === 0 && stats.month.expensesTotal === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <AlertCircle className="w-8 h-8 text-brand-500/60 mb-2 animate-pulse" />
              <p className="text-sm font-bold text-slate-750 dark:text-slate-300">Aún no hay datos para este periodo</p>
              <p className="text-xs text-slate-400 mt-1">Registra transacciones en Ingresos o Gastos para poblar el gráfico.</p>
            </div>
          ) : (
            <div className="h-64 flex items-end justify-center gap-12 pt-6 relative border-b border-slate-150 dark:border-slate-800 pb-2">
              {/* Background Grid Lines */}
              <div className="absolute inset-x-0 top-1/4 border-t border-slate-100 dark:border-slate-800/40 border-dashed"></div>
              <div className="absolute inset-x-0 top-2/4 border-t border-slate-100 dark:border-slate-800/40 border-dashed"></div>
              <div className="absolute inset-x-0 top-3/4 border-t border-slate-100 dark:border-slate-800/40 border-dashed"></div>

              {/* Income Bar */}
              <div className="w-20 flex flex-col items-center gap-2 group z-10">
                <div 
                  className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-xl hover:brightness-105 transition-all duration-500 shadow-lg shadow-emerald-500/20"
                  style={{ 
                    height: `${Math.max(20, Math.min(200, (stats.month.incomesTotal / (Math.max(stats.month.incomesTotal, stats.month.expensesTotal) || 1)) * 200))}px` 
                  }}
                ></div>
                <span className="text-xs text-slate-700 dark:text-slate-350 font-bold">{formatCurrency(stats.month.incomesTotal, 'CLP')}</span>
              </div>

              {/* Expense Bar */}
              <div className="w-20 flex flex-col items-center gap-2 group z-10">
                <div 
                  className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-xl hover:brightness-105 transition-all duration-500 shadow-lg shadow-rose-500/20"
                  style={{ 
                    height: `${Math.max(20, Math.min(200, (stats.month.expensesTotal / (Math.max(stats.month.incomesTotal, stats.month.expensesTotal) || 1)) * 200))}px` 
                  }}
                ></div>
                <span className="text-xs text-slate-700 dark:text-slate-350 font-bold">{formatCurrency(stats.month.expensesTotal, 'CLP')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Year Summary Card */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden border border-brand-500/20 shadow-xl shadow-brand-950/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/20 rounded-full blur-2xl"></div>
          <div>
            <span className="text-[10px] font-bold tracking-widest text-brand-300 uppercase px-2.5 py-1 bg-brand-950/80 rounded-full border border-brand-500/20 inline-block mb-3">
              Resumen Anual {targetYear}
            </span>
            <h3 className="text-xl font-bold tracking-tight mb-6">Desempeño Acumulado</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-xs text-slate-400 font-medium">Ingresos Anuales</span>
                <span className="text-sm font-bold text-emerald-400">{formatCurrency(stats.year.incomesTotal, 'CLP')}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-xs text-slate-400 font-medium">Ingresos Netos</span>
                <span className="text-sm font-bold text-emerald-500">{formatCurrency(stats.year.incomesNet, 'CLP')}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-xs text-slate-400 font-medium">Gastos Anuales</span>
                <span className="text-sm font-bold text-rose-400">{formatCurrency(stats.year.expensesTotal, 'CLP')}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-xs text-slate-400 font-medium">Gastos Netos Deducibles</span>
                <span className="text-sm font-bold text-rose-500">{formatCurrency(stats.year.expensesNet, 'CLP')}</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 mt-6 flex justify-between items-center">
            <span className="text-xs text-brand-300 font-semibold uppercase">Utilidad Estimada Anual</span>
            <span className="text-lg font-extrabold text-white">
              {formatCurrency(stats.year.utility, 'CLP')}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Services & Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Services */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-4">Últimos Servicios Editoriales</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {stats.recentServices.length === 0 ? (
              <p className="text-slate-400 py-4 text-center">No hay servicios registrados recientemente.</p>
            ) : (
              stats.recentServices.map((s, idx) => (
                <div key={idx} className="py-3 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-200">{s.book_title}</h4>
                    <p className="text-xs text-slate-400">{s.clientName} • {s.type}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400 border border-brand-100 dark:border-brand-900 capitalize">
                      {s.status}
                    </span>
                    <p className="text-xs text-slate-500 font-semibold mt-1">
                      {formatCurrency(s.value, s.currency)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Prospect follow ups */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-4">Seguimientos de Prospectos</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {stats.recentFollowups.length === 0 ? (
              <p className="text-slate-400 py-4 text-center">No hay seguimientos pendientes.</p>
            ) : (
              stats.recentFollowups.map((p, idx) => (
                <div key={idx} className="py-3 flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-700 dark:text-slate-200">{p.name}</h4>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded capitalize`}>
                        Probabilidad {p.probability}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Siguiente acción: <span className="font-medium text-slate-600 dark:text-slate-300">{p.next_action || 'Ninguna'}</span></p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {p.followup_date}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
