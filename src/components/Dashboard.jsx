import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { formatCurrency, calculateVatSplit, convertToClp, filterByPeriod } from '../utils';
import PeriodFilter from './PeriodFilter';
import { 
  TrendingUp, TrendingDown, DollarSign, Percent, 
  Users, UserCheck, BookOpen, AlertCircle, Calendar,
  Clock, CheckCircle, Award, Landmark, PiggyBank, FileText, ArrowUpRight, ShieldCheck, ChevronRight
} from 'lucide-react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
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
      // Fetch everything
      const [
        clientsRes,
        prospectsRes,
        servicesRes,
        incomesRes,
        expensesRes,
        payrollRes,
        allocationsRes,
        reserveMovementsRes,
        agendaRes
      ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('prospects').select('*'),
        supabase.from('services').select('*'),
        supabase.from('incomes').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('payroll_payments').select('*'),
        supabase.from('income_allocations').select('*'),
        supabase.from('operational_reserve_movements').select('*'),
        supabase.from('agenda_events').select('*')
      ]);

      const clients = clientsRes.data || [];
      const prospects = prospectsRes.data || [];
      const services = servicesRes.data || [];
      const incomes = incomesRes.data || [];
      const expenses = expensesRes.data || [];
      const payroll = payrollRes.data || [];
      const allocations = allocationsRes?.data || [];
      const reserveMovements = reserveMovementsRes?.data || [];
      const agendaEvents = agendaRes?.data || [];

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // ==========================================
      // SECTION 1: FINANCIALS (respects period)
      // ==========================================
      const monthIncomes = filterByPeriod(incomes || [], 'date', period);
      const monthExpenses = filterByPeriod(expenses || [], 'date', period);
      const monthPayroll = filterByPeriod(payroll || [], 'date', period);
      
      // Filter allocations by linking to parent income date
      const periodAllocations = (allocations || []).filter(alloc => {
        const parentIncome = (incomes || []).find(inc => inc.id === alloc.income_id);
        if (!parentIncome) return false;
        const filtered = filterByPeriod([parentIncome], 'date', period);
        return filtered.length > 0;
      });
      const periodMovements = filterByPeriod(reserveMovements || [], 'date', period);

      // Period Incomes
      let incomesTotal = 0;
      let incomesNet = 0;
      let incomesVat = 0;
      monthIncomes.forEach(i => {
        const split = calculateVatSplit(i.amount, i.includes_vat);
        incomesTotal += convertToClp(i.amount, i.currency);
        incomesNet += convertToClp(split.net, i.currency);
        incomesVat += convertToClp(split.vat, i.currency);
      });

      // Period Expenses
      let expensesTotal = 0;
      let expensesNet = 0;
      let expensesVat = 0;
      let expensesDeductible = 0;
      monthExpenses.forEach(e => {
        const split = calculateVatSplit(e.amount, e.includes_vat);
        const clpTotal = convertToClp(e.amount, e.currency);
        const clpNet = convertToClp(e.deductible ? split.net : e.amount, e.currency);
        const clpVat = convertToClp(e.deductible ? split.vat : 0, e.currency);

        expensesTotal += clpTotal;
        expensesNet += clpNet;
        expensesVat += clpVat;
        if (e.deductible) {
          expensesDeductible += clpTotal;
        }
      });

      // Period Payroll
      const payrollTotal = (monthPayroll || [])
        .filter(p => p.status === 'pagado')
        .reduce((sum, item) => sum + convertToClp(item.amount, item.currency), 0);

      // Period Utility
      const utility = incomesNet - expensesNet - payrollTotal;

      // Period VAT Estimate
      const vatToPay = incomesVat - expensesVat;

      // Period Operational Reserve
      const allocationsVal = periodAllocations
        .filter(a => a.area === 'reserva operacional')
        .reduce((sum, a) => sum + parseFloat(a.calculated_amount || 0), 0);

      const movementsVal = (periodMovements || []).reduce((sum, m) => {
        const clpAmt = convertToClp(m.amount, m.currency);
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
        const balDue = parseFloat(c.balance_due) || 0;
        const totalAgreed = parseFloat(c.total_agreed_amount) || 0;
        const amtPaid = parseFloat(c.amount_paid) || 0;

        const matchesPayment = ['sin pago', 'pendiente', 'pago parcial'].includes(payStatus) || balDue > 0;
        const notLost = !['perdido', 'perdido / rechazado'].includes(String(c.status || '').toLowerCase().trim());

        if (matchesPayment && notLost) {
          let pendingAmt = 0;
          if (balDue > 0) {
            pendingAmt = balDue;
          } else if (totalAgreed > 0) {
            pendingAmt = Math.max(0, totalAgreed - amtPaid);
          } else {
            const fallbackAmount = parseFloat(c.amount || c.agreed_amount || 0);
            pendingAmt = Math.max(0, fallbackAmount - amtPaid);
          }

          if (pendingAmt > 0) {
            periodPendingCount++;
            periodPendingVal += convertToClp(pendingAmt, c.currency || c.preferred_currency || 'CLP');
          }
        }
      });

      periodServices.forEach(s => {
        const payStatus = String(s.payment_status || '').toLowerCase().trim();
        const balDue = parseFloat(s.balance_due) || 0;
        const totalAgreed = parseFloat(s.total_agreed_amount) || 0;
        const amtPaid = parseFloat(s.amount_paid) || 0;

        const matchesPayment = ['sin pago', 'pendiente', 'pago parcial'].includes(payStatus) || balDue > 0;
        const notClosed = !['cerrado', 'entregado', 'finalizado'].includes(String(s.status || '').toLowerCase().trim());

        if (matchesPayment && notClosed) {
          let pendingAmt = 0;
          if (balDue > 0) {
            pendingAmt = balDue;
          } else if (totalAgreed > 0) {
            pendingAmt = Math.max(0, totalAgreed - amtPaid);
          } else {
            const fallbackAmount = parseFloat(s.value || s.amount || 0);
            pendingAmt = Math.max(0, fallbackAmount - amtPaid);
          }

          if (pendingAmt > 0) {
            periodPendingCount++;
            periodPendingVal += convertToClp(pendingAmt, s.currency || 'CLP');
          }
        }
      });

      // Period Total Available
      const totalDisponible = utility + operationalReserve;

      // ==========================================
      // SECTION 2: OPERATIONS & CLIENTS (overall total actual)
      // ==========================================

      // 1. Clientes Activos
      const activeClients = (clients || []).filter(c => {
        const status = String(c.status || '').toLowerCase().trim();
        const activeStatuses = [
          'cliente', 'activo', 'en proceso', 'en proceso editorial',
          'listo para iniciar', 'esperando manuscrito/archivos',
          'esperando archivos/materiales', 'pago recibido', 'contrato firmado recibido'
        ];
        return activeStatuses.includes(status);
      }).length;

      // 2. Filter active prospects
      const activeProspects = (prospects || []).filter(p => {
        const status = String(p.status || '').toLowerCase().trim();
        const activeStatuses = [
          'prospecto', 'interesado', 'acuerdo enviado', 'link de pago enviado',
          'esperando pago', 'esperando contrato firmado', 'esperando manuscrito/archivos',
          'esperando archivos/materiales'
        ];
        return activeStatuses.includes(status) && !p.converted_to_client_id;
      }).length;

      // 3. Filter services in process
      const servicesInProcess = (services || []).filter(s => {
        const status = String(s.status || '').toLowerCase().trim();
        const stage = String(s.stage || s.current_stage || '').toLowerCase().trim();
        const processValues = [
          'recibido', 'contrato pendiente', 'pago pendiente', 'en revisión',
          'en corrección', 'en diseño', 'en maquetación', 'en proceso',
          'en proceso editorial'
        ];
        return processValues.includes(status) || processValues.includes(stage);
      }).length;

      // 4. Servicios Atrasados (estimated_delivery in past)
      const servicesAtrasados = (services || []).filter(s => {
        const status = String(s.status || '').toLowerCase().trim();
        const isNotClosed = !['cerrado', 'entregado', 'finalizado'].includes(status);
        if (!isNotClosed || !s.estimated_delivery) return false;
        const estDelivery = new Date(s.estimated_delivery + 'T00:00:00');
        const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return estDelivery < todayZero;
      }).length;

      // 5. Servicios Próximos a Vencer (estimated_delivery within 7 days)
      const servicesProximos = (services || []).filter(s => {
        const status = String(s.status || '').toLowerCase().trim();
        const isNotClosed = !['cerrado', 'entregado', 'finalizado'].includes(status);
        if (!isNotClosed || !s.estimated_delivery) return false;
        const estDelivery = new Date(s.estimated_delivery + 'T00:00:00');
        const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sevenDaysLater = new Date(todayZero.getTime() + 7 * 24 * 60 * 60 * 1000);
        return estDelivery >= todayZero && estDelivery <= sevenDaysLater;
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
        const balDue = parseFloat(c.balance_due) || 0;
        const totalAgreed = parseFloat(c.total_agreed_amount) || 0;
        const amtPaid = parseFloat(c.amount_paid) || 0;

        const matchesPayment = ['sin pago', 'pendiente', 'pago parcial'].includes(payStatus) || balDue > 0;
        const notLost = !['perdido', 'perdido / rechazado'].includes(String(c.status || '').toLowerCase().trim());

        if (matchesPayment && notLost) {
          let pendingAmt = 0;
          if (balDue > 0) {
            pendingAmt = balDue;
          } else if (totalAgreed > 0) {
            pendingAmt = Math.max(0, totalAgreed - amtPaid);
          } else {
            const fallbackAmount = parseFloat(c.amount || c.agreed_amount || 0);
            pendingAmt = Math.max(0, fallbackAmount - amtPaid);
          }

          if (pendingAmt > 0) {
            pendingPaymentsCount++;
            pendingPaymentsValue += convertToClp(pendingAmt, c.currency || c.preferred_currency || 'CLP');
          }
        }
      });

      (services || []).forEach(s => {
        const payStatus = String(s.payment_status || '').toLowerCase().trim();
        const balDue = parseFloat(s.balance_due) || 0;
        const totalAgreed = parseFloat(s.total_agreed_amount) || 0;
        const amtPaid = parseFloat(s.amount_paid) || 0;

        const matchesPayment = ['sin pago', 'pendiente', 'pago parcial'].includes(payStatus) || balDue > 0;
        const notClosed = !['cerrado', 'entregado', 'finalizado'].includes(String(s.status || '').toLowerCase().trim());

        if (matchesPayment && notClosed) {
          let pendingAmt = 0;
          if (balDue > 0) {
            pendingAmt = balDue;
          } else if (totalAgreed > 0) {
            pendingAmt = Math.max(0, totalAgreed - amtPaid);
          } else {
            const fallbackAmount = parseFloat(s.value || s.amount || 0);
            pendingAmt = Math.max(0, fallbackAmount - amtPaid);
          }

          if (pendingAmt > 0) {
            pendingPaymentsCount++;
            pendingPaymentsValue += convertToClp(pendingAmt, s.currency || 'CLP');
          }
        }
      });

      // 8. Contratos Pendientes (overall)
      const pendingContracts = (clients || []).filter(c => {
        const notLost = !['perdido', 'perdido / rechazado'].includes(String(c.status || '').toLowerCase().trim());
        return notLost && c.contract_sent && !c.contract_signed_received;
      }).length;

      // 9. Manuscritos / archivos pendientes (overall)
      const pendingFiles = (clients || []).filter(c => {
        const notLost = !['perdido', 'perdido / rechazado'].includes(String(c.status || '').toLowerCase().trim());
        if (!notLost) return false;
        
        const servicesList = Array.isArray(c.selected_services) ? c.selected_services : [];
        let reqManuscript = servicesList.length > 0 ? servicesList.some(s => s && s.requires_manuscript) : true;
        let reqMaterials = servicesList.length > 0 ? servicesList.some(s => s && s.requires_materials) : false;

        const missingManuscript = reqManuscript && !c.files_received;
        const missingMaterials = reqMaterials && !c.materials_received;
        
        return missingManuscript || missingMaterials;
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

      // 12. Próximos hitos de Agenda Editorial
      const upcomingMilestones = (agendaEvents || [])
        .filter(evt => evt.date >= todayStr && evt.status !== 'completada')
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5)
        .map(evt => {
          const clientObj = (clients || []).find(c => c.id === evt.client_id);
          return {
            ...evt,
            clientName: clientObj ? clientObj.name : null
          };
        });

      // Recent editorial services for bottom log
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
        financials: {
          incomesTotal,
          incomesNet,
          expensesTotal,
          expensesDeductible,
          payrollTotal,
          utility,
          vatToPay,
          incomesVat,
          expensesVat,
          operationalReserve,
          pendingPaymentsVal: periodPendingVal,
          pendingPaymentsCount: periodPendingCount,
          totalDisponible,
        },
        counts: {
          activeClients,
          activeProspects,
          servicesInProcess,
          servicesAtrasados,
          servicesProximos,
          servicesFinalizados,
          pendingPaymentsCount,
          pendingPaymentsVal,
          pendingContracts,
          pendingFiles,
          readyToStart,
          avgProgress,
        },
        upcomingMilestones,
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
    <div className="space-y-10 animate-fade-in pb-12">
      {/* Header and Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-850 dark:text-slate-100 tracking-tight">
            Dashboard General
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Control de operaciones editoriales y métricas financieras de Somos Noveli.
          </p>
        </div>
      </div>

      {/* Period Filter Component */}
      <PeriodFilter onChange={handlePeriodChange} />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 dark:border-amber-400"></div>
          <p className="text-xs text-slate-400 mt-4 font-semibold">Cargando métricas en tiempo real...</p>
        </div>
      ) : (
        <>
          {/* ==========================================
              SECCIÓN 1: RESUMEN FINANCIERO
             ========================================== */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-l-4 border-amber-500 pl-4 py-1">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-150">Resumen Financiero</h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Métricas de rentabilidad y flujo de caja en el periodo seleccionado</p>
              </div>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-900 mt-2 sm:mt-0">
                Finanzas según periodo seleccionado
              </span>
            </div>

            {/* Principal Financial Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Disponible Estimado */}
              <div className="bg-gradient-to-br from-amber-50/70 to-white dark:from-slate-900 dark:to-slate-900/40 p-6 rounded-2xl border-2 border-amber-200/60 dark:border-amber-900/50 shadow-md flex flex-col justify-between group hover:shadow-lg transition-all relative overflow-hidden">
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
                  Caja Estimada (Utilidad Neta + Reserva Operacional)
                </p>
              </div>

              {/* Utilidad Estimada */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
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
                  Ingreso Neto - Gasto Neto - Sueldos Pagados
                </p>
              </div>

              {/* Reserva Operacional */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
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
                  Fondos asignados y movimientos del periodo
                </p>
              </div>
            </div>

            {/* Financial Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {/* Ingresos */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Ingresos</span>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {formatCurrency(stats.financials.incomesTotal, 'CLP')}
                  </div>
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold mt-2">
                  Neto: {formatCurrency(stats.financials.incomesNet, 'CLP')}
                </div>
              </div>

              {/* Gastos */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Gastos Totales</span>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {formatCurrency(stats.financials.expensesTotal, 'CLP')}
                  </div>
                </div>
                <div className="text-[10px] text-rose-500 font-bold mt-2">
                  Deducible: {formatCurrency(stats.financials.expensesDeductible, 'CLP')}
                </div>
              </div>

              {/* Sueldos */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Pagos Personal</span>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {formatCurrency(stats.financials.payrollTotal, 'CLP')}
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-medium mt-2">
                  Honorarios liquidados
                </div>
              </div>

              {/* IVA Estimado */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">IVA Estimado</span>
                  <div className="text-lg font-bold text-slate-850 dark:text-slate-100 mt-1">
                    {formatCurrency(stats.financials.vatToPay, 'CLP')}
                  </div>
                </div>
                <div className="text-[10px] text-slate-450 dark:text-slate-400 font-medium mt-2 truncate" title={`Débito: ${stats.financials.incomesVat} - Crédito: ${stats.financials.expensesVat}`}>
                  D: {formatCurrency(stats.financials.incomesVat, 'CLP')} | C: {formatCurrency(stats.financials.expensesVat, 'CLP')}
                </div>
              </div>

              {/* Pagos Pendientes (Periodo) */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Por Cobrar (Per.)</span>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {formatCurrency(stats.financials.pendingPaymentsVal, 'CLP')}
                  </div>
                </div>
                <div className="text-[10px] text-amber-600 font-bold mt-2">
                  {stats.financials.pendingPaymentsCount} registros pendientes
                </div>
              </div>
            </div>
          </div>

          {/* ==========================================
              SECCIÓN 2: GESTIÓN OPERATIVA
             ========================================== */}
          <div className="space-y-6 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-l-4 border-slate-400 dark:border-slate-600 pl-4 py-1">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-150">Gestión Operativa</h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Indicadores generales de clientes, flujos de trabajo y entregas vigentes</p>
              </div>
              <span className="text-[11px] font-bold text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-750 mt-2 sm:mt-0">
                Operación según estado actual
              </span>
            </div>

            {/* Core Operation Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Clientes Activos */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-xs hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.counts.activeClients}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Clientes Activos</p>
                </div>
              </div>

              {/* Prospectos Activos */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-xs hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.counts.activeProspects}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Prospectos Activos</p>
                </div>
              </div>

              {/* Servicios en Proceso */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-xs hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.counts.servicesInProcess}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Servicios en Proceso</p>
                </div>
              </div>

              {/* Avance Promedio */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-xs flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Avance Promedio</span>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{stats.counts.avgProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-850 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${stats.counts.avgProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Sub-Operations Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
              {/* Servicios Atrasados */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Atrasados</span>
                <span className="text-xl font-extrabold text-rose-500 block mt-1">{stats.counts.servicesAtrasados}</span>
                <span className="text-[9px] text-slate-400 block mt-1">Con entrega vencida</span>
              </div>

              {/* Servicios Próximos */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Próximos a vencer</span>
                <span className="text-xl font-extrabold text-amber-600 block mt-1">{stats.counts.servicesProximos}</span>
                <span className="text-[9px] text-slate-400 block mt-1">En los siguientes 7 días</span>
              </div>

              {/* Servicios Finalizados */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Finalizados</span>
                <span className="text-xl font-extrabold text-slate-700 dark:text-slate-300 block mt-1">{stats.counts.servicesFinalizados}</span>
                <span className="text-[9px] text-slate-400 block mt-1">Histórico total</span>
              </div>

              {/* Pagos Pendientes (Total) */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pagos Pendientes</span>
                <span className="text-xl font-extrabold text-amber-600 block mt-1">{stats.counts.pendingPaymentsCount}</span>
                <span className="text-[9px] text-slate-400 block mt-1 truncate" title={formatCurrency(stats.counts.pendingPaymentsVal, 'CLP')}>
                  {formatCurrency(stats.counts.pendingPaymentsVal, 'CLP')}
                </span>
              </div>

              {/* Contratos Pendientes */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contratos Pend.</span>
                <span className="text-xl font-extrabold text-slate-700 dark:text-slate-350 block mt-1">{stats.counts.pendingContracts}</span>
                <span className="text-[9px] text-slate-400 block mt-1">Esperando firma</span>
              </div>

              {/* Manuscritos / Materiales Pendientes */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Archivos Pend.</span>
                <span className="text-xl font-extrabold text-slate-750 dark:text-slate-350 block mt-1">{stats.counts.pendingFiles}</span>
                <span className="text-[9px] text-slate-400 block mt-1">Por recibir</span>
              </div>
            </div>

            {/* Listos para iniciar */}
            <div className="bg-emerald-50/20 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-950/40 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-lg">
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
          </div>

          {/* ==========================================
              BOTTOM GRID: MILESTONES & RECENT
             ========================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
            {/* Próximos hitos de la Agenda */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Hitos Próximos (Agenda Editorial)</h3>
                  <span className="text-[10px] text-slate-450 dark:text-slate-400 font-semibold uppercase">Próximas entregas</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {stats.upcomingMilestones.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-800" />
                      <p className="text-xs font-semibold">No hay entregas pendientes registradas en la agenda.</p>
                    </div>
                  ) : (
                    stats.upcomingMilestones.map((evt, idx) => (
                      <div key={idx} className="py-3 flex justify-between items-center group">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 p-1 bg-amber-50 dark:bg-amber-950/20 text-amber-600 rounded">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-700 dark:text-slate-205">{evt.title}</h4>
                            <p className="text-[11px] text-slate-450 dark:text-slate-400">
                              {evt.clientName ? `Cliente: ${evt.clientName}` : 'Hito de Agenda'}
                              {evt.notes && ` • ${evt.notes}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900 whitespace-nowrap">
                            {evt.date}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Últimos Servicios Editoriales */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-4">Últimos Servicios Contratados</h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {stats.recentServices.length === 0 ? (
                    <p className="text-slate-400 py-8 text-center text-xs">No hay servicios contratados registrados.</p>
                  ) : (
                    stats.recentServices.map((s, idx) => (
                      <div key={idx} className="py-3 flex justify-between items-center">
                        <div className="truncate pr-2">
                          <h4 className="font-semibold text-slate-750 dark:text-slate-200 truncate max-w-[170px]" title={s.book_title || s.title || 'Servicio'}>
                            {s.book_title || s.title || 'Servicio'}
                          </h4>
                          <p className="text-[11px] text-slate-450 dark:text-slate-400 truncate max-w-[170px]" title={s.clientName}>
                            {s.clientName} • {s.type || s.service_type}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-655 dark:text-slate-350 capitalize">
                            {s.status}
                          </span>
                          <p className="text-[11px] text-slate-500 font-bold mt-1">
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
        </>
      )}
    </div>
  );
}
