import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, isMock, getValidOrgId } from '../supabaseClient';
import { formatCurrency, calculateVatSplit, convertToClp, filterByPeriod } from '../utils';
import PeriodFilter from './PeriodFilter';
import { 
  TrendingUp, TrendingDown, DollarSign, Percent, 
  Users, UserCheck, BookOpen, AlertCircle, Calendar,
  Clock, CheckCircle, Award, Landmark, PiggyBank, FileText, ArrowUpRight, ShieldCheck, ChevronRight
} from 'lucide-react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('finanzas'); // 'finanzas' | 'operativa'
  const [stats, setStats] = useState({
    financials: {
      incomesTotal: 0,
      incomesNet: 0,
      expensesTotal: 0,
      expensesDeductible: 0,
      payrollTotal: 0,
      utility: 0,
      vatToPay: 0,
      incomesVat: 0,
      expensesVat: 0,
      operationalReserve: 0,
      pendingPaymentsVal: 0,
      pendingPaymentsCount: 0,
      totalDisponible: 0,
    },
    counts: {
      activeClients: 0,
      activeProspects: 0,
      servicesInProcess: 0,
      servicesAtrasados: 0,
      servicesProximos: 0,
      servicesFinalizados: 0,
      pendingPaymentsCount: 0,
      pendingPaymentsVal: 0,
      pendingContracts: 0,
      pendingFiles: 0,
      readyToStart: 0,
      avgProgress: 0,
    },
    upcomingMilestones: [],
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
        return prev;
      }
      return newPeriod;
    });
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const orgId = await getValidOrgId();

      // Safe fetch helper to handle missing tables or RLS gracefully
      const safeQuery = async (tableName) => {
        try {
          let query = supabase.from(tableName).select('*');
          if (!isMock && orgId) {
            query = query.eq('organization_id', orgId);
          }
          const { data, error } = await query;
          if (error) {
            console.warn(`[Dashboard Debug] Error querying ${tableName}:`, error);
            return [];
          }
          return data || [];
        } catch (err) {
          console.warn(`[Dashboard Debug] Exception querying ${tableName}:`, err);
          return [];
        }
      };

      // Fetch everything in parallel safely
      const [
        clients,
        prospects,
        services,
        incomes,
        expenses,
        payroll,
        allocations,
        reserveMovements
      ] = await Promise.all([
        safeQuery('clients'),
        safeQuery('prospects'),
        safeQuery('services'),
        safeQuery('incomes'),
        safeQuery('expenses'),
        safeQuery('payroll_payments'),
        safeQuery('income_allocations'),
        safeQuery('operational_reserve_movements')
      ]);

      // Temporary development logs (will be kept discrete)
      console.log("📊 [Dashboard Debug] Loaded counts:", {
        clients: clients.length,
        prospects: prospects.length,
        services: services.length,
        incomes: incomes.length,
        expenses: expenses.length,
        payroll_payments: payroll.length
      });

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Normalized helpers to prevent null field crashes
      const getNormalizedDate = (item, dateField) => {
        if (!item) return null;
        if (dateField && item[dateField]) return item[dateField];
        return item.date || item.payment_date || item.created_at || item.start_date || null;
      };

      const getNormalizedAmount = (item) => {
        if (!item) return 0;
        const val = item.amount !== undefined && item.amount !== null ? item.amount :
                    item.value !== undefined && item.value !== null ? item.value :
                    item.total !== undefined && item.total !== null ? item.total :
                    item.calculated_amount !== undefined && item.calculated_amount !== null ? item.calculated_amount :
                    item.total_agreed_amount !== undefined && item.total_agreed_amount !== null ? item.total_agreed_amount :
                    item.agreed_amount !== undefined && item.agreed_amount !== null ? item.agreed_amount : 0;
        return parseFloat(val) || 0;
      };

      // ==========================================
      // TAB 1: FINANCIALS (respects period)
      // ==========================================
      const monthIncomes = filterByPeriod(incomes || [], 'date', period);
      const monthExpenses = filterByPeriod(expenses || [], 'date', period);
      const monthPayroll = filterByPeriod(payroll || [], 'date', period);
      
      const periodAllocations = (allocations || []).filter(alloc => {
        const parentIncome = (incomes || []).find(inc => inc.id === alloc.income_id);
        if (!parentIncome) return false;
        const filtered = filterByPeriod([parentIncome], 'date', period);
        return filtered.length > 0;
      });
      const periodMovements = filterByPeriod(reserveMovements || [], 'date', period);

      // Period Incomes (Solo contar ingresos pagados)
      let incomesTotal = 0;
      let incomesNet = 0;
      let incomesVat = 0;
      monthIncomes.forEach(i => {
        if (i.status !== 'pagado') return;
        const amt = getNormalizedAmount(i);
        const split = calculateVatSplit(amt, i.includes_vat);
        incomesTotal += convertToClp(amt, i.currency);
        incomesNet += convertToClp(split.net, i.currency);
        incomesVat += convertToClp(split.vat, i.currency);
      });

      // Period Expenses
      let expensesTotal = 0;
      let expensesDeductible = 0;
      let expensesNoDeductible = 0;
      let expensesNet = 0;
      let expensesVat = 0;
      let expensesCash = 0;
      let taxesPaidCash = 0;
      let taxesPaidTotal = 0;

      monthExpenses.forEach(e => {
        const amt = getNormalizedAmount(e);
        const split = calculateVatSplit(amt, e.includes_vat);
        const clpTotal = convertToClp(amt, e.currency);
        
        const isTax = e.tax_payment || e.category === 'impuestos';
        
        expensesTotal += clpTotal;

        if (isTax) {
          taxesPaidTotal += clpTotal;
          if (e.affects_cashflow !== false) {
            taxesPaidCash += clpTotal;
          }
        } else {
          // Normal expense
          const clpNet = e.deductible ? convertToClp(split.net, e.currency) : clpTotal;
          const clpVat = e.deductible ? convertToClp(split.vat, e.currency) : 0;
          
          expensesNet += clpNet;
          expensesVat += clpVat;

          if (e.deductible) {
            expensesDeductible += clpTotal;
          } else {
            expensesNoDeductible += clpTotal;
          }

          if (e.affects_cashflow !== false) {
            expensesCash += clpTotal;
          }
        }
      });

      // Period Payroll
      const payrollTotal = (monthPayroll || [])
        .filter(p => p.status === 'pagado')
        .reduce((sum, item) => sum + convertToClp(getNormalizedAmount(item), item.currency), 0);

      // Period Utility
      const utility = incomesNet - expensesNet - payrollTotal - taxesPaidTotal;

      // Period VAT Estimate
      const vatToPay = incomesVat - expensesVat;

      // Period Operational Reserve
      const allocationsVal = periodAllocations
        .filter(a => a.area === 'reserva operacional')
        .reduce((sum, a) => {
          const parentIncome = (incomes || []).find(inc => inc.id === a.income_id);
          const rate = parentIncome ? Number(parentIncome.exchange_rate || 1) : 1;
          return sum + (Number(a.calculated_amount) * rate);
        }, 0);

      const movementsVal = (periodMovements || []).reduce((sum, m) => {
        const amt = getNormalizedAmount(m);
        const clpAmt = convertToClp(amt, m.currency);
        if (m.type === 'entrada' || m.type === 'ajuste') return sum + clpAmt;
        if (m.type === 'salida') return sum - clpAmt;
        return sum;
      }, 0);

      const operationalReserve = allocationsVal + movementsVal;

      // Period Pending Payments (clients and services created in the period)
      let periodPendingCount = 0;
      let periodPendingVal = 0;

      const periodClients = filterByPeriod(clients || [], 'created_at', period);
      const periodServices = filterByPeriod(services || [], 'start_date', period);

      periodClients.forEach(c => {
        const payStatus = String(c.payment_status || '').toLowerCase().trim();
        if (payStatus === 'pagado') return;
        if (c.balance_due !== null && c.balance_due !== undefined && parseFloat(c.balance_due) <= 0) return;

        const notLost = !['perdido', 'perdido / rechazado'].includes(String(c.status || '').toLowerCase().trim());
        if (!notLost) return;

        let pendingAmt = 0;
        if (c.balance_due !== null && c.balance_due !== undefined) {
          pendingAmt = parseFloat(c.balance_due);
        } else {
          const totalAgreed = parseFloat(c.total_agreed_amount) || 0;
          if (totalAgreed > 0) {
            pendingAmt = totalAgreed - (parseFloat(c.amount_paid) || 0);
          } else {
            const fallbackAmount = parseFloat(c.amount || c.agreed_amount || 0);
            pendingAmt = fallbackAmount - (parseFloat(c.amount_paid) || 0);
          }
        }

        if (pendingAmt <= 0) return;

        periodPendingCount++;
        periodPendingVal += convertToClp(pendingAmt, c.currency || c.preferred_currency || 'CLP');
      });

      periodServices.forEach(s => {
        const payStatus = String(s.payment_status || '').toLowerCase().trim();
        if (payStatus === 'pagado') return;
        if (s.balance_due !== null && s.balance_due !== undefined && parseFloat(s.balance_due) <= 0) return;

        const notClosed = !['cerrado', 'entregado', 'finalizado'].includes(String(s.status || '').toLowerCase().trim());
        if (!notClosed) return;

        let pendingAmt = 0;
        if (s.balance_due !== null && s.balance_due !== undefined) {
          pendingAmt = parseFloat(s.balance_due);
        } else {
          const totalAgreed = parseFloat(s.total_agreed_amount) || 0;
          if (totalAgreed > 0) {
            pendingAmt = totalAgreed - (parseFloat(s.amount_paid) || 0);
          } else {
            const fallbackAmount = parseFloat(s.value || s.amount || 0);
            pendingAmt = fallbackAmount - (parseFloat(s.amount_paid) || 0);
          }
        }

        if (pendingAmt <= 0) return;

        periodPendingCount++;
        periodPendingVal += convertToClp(pendingAmt, s.currency || 'CLP');
      });

      // Period Total Available
      const totalDisponible = incomesTotal - expensesCash - payrollTotal - taxesPaidCash + movementsVal;

      // ==========================================
      // TAB 2: OPERATIONS & CLIENTS (overall total actual, independent of period)
      // ==========================================

      // 1. Clientes Activos
      const activeClients = (clients || []).filter(c => {
        const status = String(c.status || '').toLowerCase().trim();
        const activeStatuses = [
          'cliente', 'activo', 'pago recibido', 'listo para iniciar', 'en proceso',
          'en proceso editorial', 'esperando manuscrito/archivos',
          'esperando archivos/materiales', 'contrato firmado recibido'
        ];
        return activeStatuses.includes(status);
      }).length;

      // 2. Filter active prospects
      const activeProspects = (prospects || []).filter(p => {
        const status = String(p.status || '').toLowerCase().trim();
        return !['perdido', 'perdido / rechazado', 'finalizado'].includes(status) && !p.converted_to_client_id;
      }).length;

      // 3. Servicios en Proceso
      const servicesInProcess = (services || []).filter(s => {
        const status = String(s.status || '').toLowerCase().trim();
        return !['cerrado', 'entregado', 'finalizado'].includes(status);
      }).length;

      // 4. Servicios Atrasados (overall active ones)
      const servicesAtrasados = (services || []).filter(s => {
        const status = String(s.status || '').toLowerCase().trim();
        const isClosed = ['cerrado', 'entregado', 'finalizado'].includes(status);
        const deliveryDateStr = s.estimated_delivery_date || s.estimated_delivery;
        if (isClosed || !deliveryDateStr) return false;
        return new Date(deliveryDateStr) < new Date(todayStr);
      }).length;

      // 5. Servicios Próximos a vencer (vencen en los próximos 15 días)
      const servicesProximos = (services || []).filter(s => {
        const status = String(s.status || '').toLowerCase().trim();
        const isClosed = ['cerrado', 'entregado', 'finalizado'].includes(status);
        const deliveryDateStr = s.estimated_delivery_date || s.estimated_delivery;
        if (isClosed || !deliveryDateStr) return false;
        const diffTime = new Date(deliveryDateStr) - new Date(todayStr);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 15;
      }).length;

      // 6. Servicios Finalizados (overall)
      const servicesFinalizados = (services || []).filter(s => {
        const status = String(s.status || '').toLowerCase().trim();
        return ['cerrado', 'entregado', 'finalizado'].includes(status);
      }).length;

      // 7. Pagos Pendientes (overall)
      let pendingPaymentsCount = 0;
      let pendingPaymentsValue = 0;

      (clients || []).forEach(c => {
        const payStatus = String(c.payment_status || '').toLowerCase().trim();
        if (payStatus === 'pagado') return;
        if (c.balance_due !== null && c.balance_due !== undefined && parseFloat(c.balance_due) <= 0) return;

        const notLost = !['perdido', 'perdido / rechazado'].includes(String(c.status || '').toLowerCase().trim());
        if (!notLost) return;

        let pendingAmt = 0;
        if (c.balance_due !== null && c.balance_due !== undefined) {
          pendingAmt = parseFloat(c.balance_due);
        } else {
          const totalAgreed = parseFloat(c.total_agreed_amount) || 0;
          if (totalAgreed > 0) {
            pendingAmt = totalAgreed - (parseFloat(c.amount_paid) || 0);
          } else {
            const fallbackAmount = parseFloat(c.amount || c.agreed_amount || 0);
            pendingAmt = fallbackAmount - (parseFloat(c.amount_paid) || 0);
          }
        }

        if (pendingAmt <= 0) return;

        pendingPaymentsCount++;
        pendingPaymentsValue += convertToClp(pendingAmt, c.currency || c.preferred_currency || 'CLP');
      });

      (services || []).forEach(s => {
        const payStatus = String(s.payment_status || '').toLowerCase().trim();
        if (payStatus === 'pagado') return;
        if (s.balance_due !== null && s.balance_due !== undefined && parseFloat(s.balance_due) <= 0) return;

        const notClosed = !['cerrado', 'entregado', 'finalizado'].includes(String(s.status || '').toLowerCase().trim());
        if (!notClosed) return;

        let pendingAmt = 0;
        if (s.balance_due !== null && s.balance_due !== undefined) {
          pendingAmt = parseFloat(s.balance_due);
        } else {
          const totalAgreed = parseFloat(s.total_agreed_amount) || 0;
          if (totalAgreed > 0) {
            pendingAmt = totalAgreed - (parseFloat(s.amount_paid) || 0);
          } else {
            const fallbackAmount = parseFloat(s.value || s.amount || 0);
            pendingAmt = fallbackAmount - (parseFloat(s.amount_paid) || 0);
          }
        }

        if (pendingAmt <= 0) return;

        pendingPaymentsCount++;
        pendingPaymentsValue += convertToClp(pendingAmt, s.currency || 'CLP');
      });

      // 8. Contratos Pendientes (overall)
      const pendingContracts = (clients || []).filter(c => {
        const notLost = !['perdido', 'perdido / rechazado'].includes(String(c.status || '').toLowerCase().trim());
        return notLost && c.contract_sent && !c.contract_signed_received;
      }).length;

      // 9. Archivos / Manuscritos / Materiales Pendientes (overall)
      const pendingFiles = (clients || []).filter(c => {
        const notLost = !['perdido', 'perdido / rechazado'].includes(String(c.status || '').toLowerCase().trim());
        if (!notLost) return false;
        
        const servicesList = Array.isArray(c.selected_services) ? c.selected_services : [];
        const reqManuscript = servicesList.some(s => s && s.requires_manuscript);
        const reqMaterials = servicesList.some(s => s && s.requires_materials);
        
        return (reqManuscript && !c.files_received) || (reqMaterials && !c.materials_received);
      }).length;

      // 10. Servicios listos para iniciar (overall)
      const readyToStart = (clients || []).filter(c => {
        return String(c.status || '').toLowerCase().trim() === 'listo para iniciar';
      }).length;

      // 11. Avance Promedio (overall active services)
      const activeServicesList = (services || []).filter(s => {
        return !['cerrado', 'entregado', 'finalizado'].includes(String(s.status || '').toLowerCase().trim());
      });
      const avgProgress = activeServicesList.length > 0
        ? Math.round(activeServicesList.reduce((sum, s) => sum + (parseFloat(s.progress || s.advance_percent || 0)), 0) / activeServicesList.length)
        : 0;

      // Recent editorial services for bottom log
      const recentServices = (services || [])
        .sort((a, b) => new Date(b.created_at || b.start_date) - new Date(a.created_at || a.start_date))
        .slice(0, 5)
        .map(s => {
          const client = (clients || []).find(c => c.id === s.client_id);
          return {
            ...s,
            clientName: client ? client.name : 'Cliente Desconocido'
          };
        });

      setStats({
        financials: {
          incomesTotal,
          incomesNet,
          expensesTotal,
          expensesDeductible,
          expensesNoDeductible,
          payrollTotal,
          utility,
          vatToPay,
          incomesVat,
          expensesVat,
          operationalReserve,
          pendingPaymentsVal: periodPendingVal,
          pendingPaymentsCount: periodPendingCount,
          totalDisponible,
          taxesPaidTotal,
        },
        counts: {
          activeClients,
          activeProspects,
          servicesInProcess,
          servicesAtrasados,
          servicesProximos,
          servicesFinalizados,
          pendingPaymentsCount,
          pendingPaymentsVal: pendingPaymentsValue,
          pendingContracts,
          pendingFiles,
          readyToStart,
          avgProgress,
        },
        upcomingMilestones: [],
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

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-855 dark:text-slate-100 tracking-tight">
            Dashboard General
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Control de operaciones editoriales y métricas financieras de Somos Noveli.
          </p>
        </div>
      </div>

      {/* Selector de Pestañas y Filtro de Período en la misma fila */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Pestañas Internas */}
        <div className="flex space-x-1 p-1 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('finanzas')}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
              activeTab === 'finanzas'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs border border-amber-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Finanzas</span>
          </button>
          <button
            onClick={() => setActiveTab('operativa')}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
              activeTab === 'operativa'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs border border-amber-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Gestión Operativa</span>
          </button>
        </div>

        {/* Mostrar PeriodFilter sólo si la pestaña activa es Finanzas */}
        {activeTab === 'finanzas' && (
          <div className="w-full lg:w-auto">
            <PeriodFilter onChange={handlePeriodChange} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 dark:border-amber-400"></div>
          <p className="text-xs text-slate-400 mt-4 font-semibold">Cargando métricas en tiempo real...</p>
        </div>
      ) : (
        <>
          {activeTab === 'finanzas' ? (
            /* ==========================================
                PESTAÑA 1: FINANZAS
               ========================================== */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-l-4 border-amber-500 pl-4 py-1">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-150">Resumen Financiero</h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Rentabilidad, impuestos y flujos de caja del periodo</p>
                </div>
              </div>

              {/* Tarjetas Principales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Disponible Estimado */}
                <div className="bg-gradient-to-br from-amber-50/70 to-white dark:from-slate-900 dark:to-slate-900/40 p-6 rounded-2xl border-2 border-amber-200/60 dark:border-amber-900/50 shadow-xs flex flex-col justify-between group hover:shadow-md transition-all relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-300/10 rounded-full blur-xl pointer-events-none"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">Total Disponible Estimado</span>
                      <h3 className="text-3xl font-extrabold text-amber-950 dark:text-amber-300 mt-2 tracking-tight">
                        {formatCurrency(stats.financials.totalDisponible, 'CLP')}
                      </h3>
                    </div>
                    <span className="p-3 bg-amber-100/50 dark:bg-amber-950/40 text-amber-750 dark:text-amber-400 rounded-xl">
                      <Landmark className="w-5 h-5" />
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-4 font-medium border-t border-amber-200/40 pt-3">
                    Caja Disponible Estimada (Utilidad + Reserva)
                  </p>
                </div>

                {/* Utilidad Estimada */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Utilidad Neta Estimada</span>
                      <h3 className={`text-3xl font-extrabold mt-2 tracking-tight ${stats.financials.utility >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                        {formatCurrency(stats.financials.utility, 'CLP')}
                      </h3>
                    </div>
                    <span className={`p-3 rounded-xl ${stats.financials.utility >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      <TrendingUp className="w-5 h-5" />
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-4 font-medium border-t border-slate-100 dark:border-slate-800/60 pt-3">
                    Ingresos Netos - Gastos Netos - Sueldos Pagados
                  </p>
                </div>

                {/* Reserva Operacional */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Reserva Operacional</span>
                      <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 mt-2 tracking-tight">
                        {formatCurrency(stats.financials.operationalReserve, 'CLP')}
                      </h3>
                    </div>
                    <span className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <PiggyBank className="w-5 h-5" />
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-4 font-medium border-t border-slate-100 dark:border-slate-800/60 pt-3">
                    Movimientos y retenciones del periodo
                  </p>
                </div>
              </div>

              {/* Detalle Financiero Secundario */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* Ingresos del periodo */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Ingresos</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.incomesTotal, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold mt-2 pt-2 border-t border-slate-50 dark:border-slate-850 space-y-1">
                    <div>Neto: {formatCurrency(stats.financials.incomesNet, 'CLP')}</div>
                  </div>
                </div>

                {/* Gastos del periodo */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Gastos</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.expensesTotal, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-rose-500 font-bold mt-2 pt-2 border-t border-slate-50 dark:border-slate-850 space-y-1">
                    <div>Ded: {formatCurrency(stats.financials.expensesDeductible, 'CLP')}</div>
                    <div className="text-slate-500">No Ded: {formatCurrency(stats.financials.expensesNoDeductible, 'CLP')}</div>
                  </div>
                </div>

                {/* Sueldos */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/85 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Pagos a Personal</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.payrollTotal, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-450 dark:text-slate-400 font-medium mt-2 pt-2 border-t border-slate-50 dark:border-slate-850">
                    Honorarios liquidados
                  </div>
                </div>

                {/* IVA Estimado */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">IVA por Pagar</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.vatToPay, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-450 dark:text-slate-400 font-medium mt-2 pt-2 border-t border-slate-50 dark:border-slate-850 truncate" title={`Débito: ${stats.financials.incomesVat} - Crédito: ${stats.financials.expensesVat}`}>
                    D: {formatCurrency(stats.financials.incomesVat, 'CLP')} | C: {formatCurrency(stats.financials.expensesVat, 'CLP')}
                  </div>
                </div>

                {/* Impuestos Pagados */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Impuestos Pagados</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.taxesPaidTotal, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-450 dark:text-slate-400 font-medium mt-2 pt-2 border-t border-slate-50 dark:border-slate-850">
                    PPM, patentes y otros
                  </div>
                </div>

                {/* Por cobrar */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Por Cobrar (Per.)</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.pendingPaymentsVal, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-amber-600 font-bold mt-2 pt-2 border-t border-slate-50 dark:border-slate-850">
                    {stats.financials.pendingPaymentsCount} cuentas
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ==========================================
                PESTAÑA 2: GESTIÓN OPERATIVA
               ========================================== */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-l-4 border-slate-400 dark:border-slate-650 pl-4 py-1">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-150">Gestión Operativa</h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Estado general de clientes, proyectos editoriales e hitos activos</p>
                </div>
              </div>

              {/* Fila Principal de la Operación */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Clientes Activos */}
                <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-4 shadow-2xs">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.counts.activeClients}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Clientes Activos</p>
                  </div>
                </div>

                {/* Prospectos Activos */}
                <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-4 shadow-2xs">
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-lg">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.counts.activeProspects}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Prospectos Activos</p>
                  </div>
                </div>

                {/* Servicios en Proceso */}
                <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-4 shadow-2xs">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.counts.servicesInProcess}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Servicios en Proceso</p>
                  </div>
                </div>

                {/* Avance Promedio */}
                <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-4 rounded-xl shadow-2xs flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Avance Promedio</span>
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{stats.counts.avgProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${stats.counts.avgProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Fila Operativa Secundaria */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
                {/* Atrasados */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Atrasados</span>
                  <span className="text-xl font-extrabold text-rose-500 block mt-1">{stats.counts.servicesAtrasados}</span>
                  <span className="text-[9px] text-slate-450 dark:text-slate-400 block mt-1">Entrega vencida</span>
                </div>

                {/* Próximos */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">A Vencer (15d)</span>
                  <span className="text-xl font-extrabold text-amber-600 block mt-1">{stats.counts.servicesProximos}</span>
                  <span className="text-[9px] text-slate-450 dark:text-slate-400 block mt-1">Próximos plazos</span>
                </div>

                {/* Finalizados */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Finalizados</span>
                  <span className="text-xl font-extrabold text-slate-700 dark:text-slate-300 block mt-1">{stats.counts.servicesFinalizados}</span>
                  <span className="text-[9px] text-slate-450 dark:text-slate-400 block mt-1">Entregas totales</span>
                </div>

                {/* Pagos Pendientes */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pagos Pendientes</span>
                  <span className="text-xl font-extrabold text-amber-600 block mt-1">{stats.counts.pendingPaymentsCount}</span>
                  <span className="text-[9px] text-slate-450 dark:text-slate-400 block mt-1 truncate" title={formatCurrency(stats.counts.pendingPaymentsVal, 'CLP')}>
                    {formatCurrency(stats.counts.pendingPaymentsVal, 'CLP')}
                  </span>
                </div>

                {/* Contratos Pendientes */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contratos Pend.</span>
                  <span className="text-xl font-extrabold text-slate-700 dark:text-slate-350 block mt-1">{stats.counts.pendingContracts}</span>
                  <span className="text-[9px] text-slate-450 dark:text-slate-400 block mt-1">Por firmar</span>
                </div>

                {/* Archivos Pendientes */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Archivos Pend.</span>
                  <span className="text-xl font-extrabold text-slate-750 dark:text-slate-350 block mt-1">{stats.counts.pendingFiles}</span>
                  <span className="text-[9px] text-slate-450 dark:text-slate-400 block mt-1">Manuscrito/Briefing</span>
                </div>
              </div>

              {/* Listos para iniciar */}
              <div className="bg-emerald-50/20 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-950/40 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-450 rounded-lg">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Servicios Listos para Iniciar</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Clientes con pago y contrato completados pero sin iniciar trabajo editorial.</p>
                  </div>
                </div>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-450 bg-white dark:bg-slate-900 px-3 py-1 rounded-md border border-emerald-100 dark:border-emerald-800">
                  {stats.counts.readyToStart}
                </span>
              </div>

              {/* Últimos servicios */}
              <div className="pt-2">
                {/* Últimos Servicios Contratados */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-150 dark:border-slate-800/85 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-855 dark:text-slate-100 text-sm mb-4">Últimos Servicios Contratados</h3>
                    <div className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
                      {stats.recentServices.length === 0 ? (
                        <p className="text-slate-400 py-8 text-center text-xs">No hay servicios contratados registrados.</p>
                      ) : (
                        stats.recentServices.map((s, idx) => (
                          <div key={idx} className="py-3 flex justify-between items-center">
                            <div className="truncate pr-2">
                              <h4 className="font-semibold text-slate-750 dark:text-slate-200 truncate" title={s.book_title || s.title || 'Servicio'}>
                                {s.book_title || s.title || 'Servicio'}
                              </h4>
                              <p className="text-[10px] text-slate-450 dark:text-slate-400" title={s.clientName}>
                                {s.clientName} • {s.type || s.service_type}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 capitalize">
                                {s.status}
                              </span>
                              <p className="text-[10px] text-slate-500 font-bold mt-1">
                                {formatCurrency(s.value || s.total_agreed_amount, s.currency || 'CLP')}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
