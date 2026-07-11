import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, isMock, getValidOrgId } from '../supabaseClient';
import { formatCurrency, calculateVatSplit, convertToClp, filterByPeriod } from '../utils';
import PeriodFilter from './PeriodFilter';
import DashboardDetailDrawer from './DashboardDetailDrawer';
import { 
  TrendingUp, TrendingDown, DollarSign, Percent, X,
  Users, UserCheck, BookOpen, AlertCircle, Calendar,
  Clock, CheckCircle, Award, Landmark, PiggyBank, FileText, ArrowUpRight, ShieldCheck, ChevronRight
} from 'lucide-react';

export default function Dashboard({ organizationId, realtimeTrigger }) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('finanzas'); // 'finanzas' | 'operativa'
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const openDetail = (detail) => {
    setSelectedDetail(detail || null);
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setSelectedDetail(null);
  };

  const handleCardClick = (cardId) => {
    const detail = getDetailItems(cardId);
    openDetail(detail);
  };

  const [rawData, setRawData] = useState({
    incomes: [],
    expenses: [],
    payroll: [],
    clients: [],
    prospects: [],
    services: [],
    reserveMovements: [],
    allocations: []
  });
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

      // Fetch helper to capture missing tables or RLS errors
      const fetchWithErrors = async (tableName) => {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('organization_id', orgId);
          return { data: data || [], error };
        } catch (err) {
          return { data: [], error: err };
        }
      };

      // Fetch everything in parallel
      const [
        clientsRes,
        prospectsRes,
        servicesRes,
        incomesRes,
        expensesRes,
        payrollRes,
        allocationsRes,
        reserveMovementsRes,
        staffRes,
        distributionsRes,
        clientFundsRes,
        fundMovementsRes,
        taxReservationsRes
      ] = await Promise.all([
        fetchWithErrors('clients'),
        fetchWithErrors('prospects'),
        fetchWithErrors('services'),
        fetchWithErrors('incomes'),
        fetchWithErrors('expenses'),
        fetchWithErrors('payroll_payments'),
        fetchWithErrors('income_allocations'),
        fetchWithErrors('operational_reserve_movements'),
        fetchWithErrors('staff'),
        fetchWithErrors('income_distributions'),
        fetchWithErrors('client_funds'),
        fetchWithErrors('fund_movements'),
        fetchWithErrors('income_tax_reservations')
      ]);

      const clients = clientsRes.data;
      const clientsError = clientsRes.error;
      const prospects = prospectsRes.data;
      const services = servicesRes.data;
      const servicesError = servicesRes.error;
      const incomes = incomesRes.data;
      const incomesError = incomesRes.error;
      const expenses = expensesRes.data;
      const expensesError = expensesRes.error;
      const rawPayroll = payrollRes.data;
      const allocations = allocationsRes.data;
      const reserveMovements = reserveMovementsRes.data;
      const staff = staffRes.data || [];
      const incomeDistributions = distributionsRes.data || [];
      const clientFunds = clientFundsRes.data || [];
      const fundMovements = fundMovementsRes.data || [];
      const taxReservations = taxReservationsRes.data || [];
      const payroll = (rawPayroll || []).map(p => {
        const member = (staff || []).find(s => s.id === p.staff_id);
        const name = member ? member.name : 'Colaborador';
        const role = member ? member.role : '';
        
        const amt = p.amount !== undefined && p.amount !== null ? p.amount :
                    p.total !== undefined && p.total !== null ? p.total :
                    p.salary_amount !== undefined && p.salary_amount !== null ? p.salary_amount :
                    p.payment_amount || 0;
                    
        const pDate = p.date || p.payment_date || p.paid_at || p.created_at;
        
        const statusStr = p.status ? String(p.status).toLowerCase().trim() : '';
        const isPaid = ['pagado', 'paid', 'completado', 'liquidado'].includes(statusStr) || (!p.status && Number(amt) > 0);

        return {
          ...p,
          staff_name: name,
          staff_role: role,
          amount: Number(amt) || 0,
          date: pDate,
          isPaid,
          status: p.status || (isPaid ? 'pagado' : 'pendiente')
        };
      });

      console.error('clientsError', clientsError);
      console.error('incomesError', incomesError);
      console.error('expensesError', expensesError);
      console.error('servicesError', servicesError);

      console.log('clients data', clients);
      console.log('incomes data', incomes);
      console.log('expenses data', expenses);
      console.log('services data', services);

      // Temporary development logs
      let currentUserEmail = 'unknown';
      try {
        const userRes = await supabase.auth.getUser();
        if (userRes.data?.user) {
          currentUserEmail = userRes.data.user.email;
        } else {
          const userJson = localStorage.getItem('somos_noveli_crm_user');
          if (userJson) {
            currentUserEmail = JSON.parse(userJson).email;
          }
        }
      } catch (e) {}
      const organizationId = orgId;
      console.log("usuario actual", currentUserEmail);
      console.log("organizationId usado", organizationId);
      console.log("clientes cargados", clients.length);
      console.log("ingresos cargados", incomes.length);
      console.log("gastos cargados", expenses.length);
      console.log("servicios cargados", services.length);

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
        .filter(p => p.isPaid)
        .reduce((sum, item) => sum + convertToClp(item.amount, item.currency || 'CLP'), 0);

      const payrollPayments = monthPayroll;
      const totalPayrollPayments = payrollTotal;
      console.log("payrollPayments dashboard", payrollPayments);
      console.log("totalPayrollPayments dashboard", totalPayrollPayments);

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

      // Client funds calculations
      const fundsAllocated = (clientFunds || []).reduce((sum, f) => sum + (parseFloat(f.allocated_amount) || 0), 0);
      const fundsAvailable = (clientFunds || []).reduce((sum, f) => sum + (parseFloat(f.balance) || 0), 0);

      // Incomes to distribute
      let toDistribute = 0;
      const validIncomes = (incomes || []).filter(i => i.status === 'pagado');
      validIncomes.forEach(i => {
        const amt = parseFloat(i.amount) || 0;
        const vat = i.includes_vat ? (amt - (amt / 1.19)) : 0;
        const netPool = amt - vat;
        
        const distSum = (incomeDistributions || [])
          .filter(d => d.income_id === i.id)
          .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
        
        if (netPool > distSum) {
          toDistribute += (netPool - distSum);
        }
      });

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
        const isConvertedOrExcluded = 
          p.converted_to_client_id || 
          p.converted_client_id || 
          p.converted_to_client === true || 
          ['convertido', 'cliente', 'finalizado', 'perdido', 'perdido / rechazado'].includes(status);
        return !isConvertedOrExcluded;
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
          fundsAllocated,
          fundsAvailable,
          toDistribute,
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

      setRawData({
        incomes,
        expenses,
        payroll,
        clients,
        prospects,
        services,
        reserveMovements,
        allocations
      });

    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [period, realtimeTrigger]);

  const navigateToModule = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const exportToCSV = (filename, headers, rows) => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + [headers.join(","), ...rows.map(r => r.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDetailItemsRaw = (cardId) => {
    const { incomes, expenses, payroll, clients, prospects, services, reserveMovements, allocations } = rawData;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

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

    const monthIncomes = filterByPeriod(incomes || [], 'date', period);
    const monthExpenses = filterByPeriod(expenses || [], 'date', period);
    const monthPayroll = filterByPeriod(payroll || [], 'date', period);
    const periodMovements = filterByPeriod(reserveMovements || [], 'date', period);

    const periodAllocations = (allocations || []).filter(alloc => {
      const parentIncome = (incomes || []).find(inc => inc.id === alloc.income_id);
      if (!parentIncome) return false;
      const filtered = filterByPeriod([parentIncome], 'date', period);
      return filtered.length > 0;
    });

    switch (cardId) {
      case 'total_disponible': {
        const list = [];
        monthIncomes.forEach(i => {
          if (i.status !== 'pagado') return;
          const amt = getNormalizedAmount(i);
          list.push({
            date: i.date,
            concept: i.concept,
            type: 'Ingreso (+)',
            amount: convertToClp(amt, i.currency)
          });
        });
        monthExpenses.forEach(e => {
          const isTax = e.tax_payment || e.category === 'impuestos';
          if (e.affects_cashflow === false) return;
          list.push({
            date: e.date,
            concept: `${isTax ? 'Impuesto: ' : ''}${e.concept || ''}`,
            type: 'Gasto (-)',
            amount: -convertToClp(getNormalizedAmount(e), e.currency)
          });
        });
        monthPayroll.forEach(p => {
          if (p.status !== 'pagado') return;
          list.push({
            date: p.date,
            concept: `Pago Personal: ${p.concept || ''}`,
            type: 'Sueldo (-)',
            amount: -convertToClp(getNormalizedAmount(p), p.currency)
          });
        });
        periodMovements.forEach(m => {
          const amt = convertToClp(getNormalizedAmount(m), m.currency);
          list.push({
            date: m.date,
            concept: `Retención Reserva: ${m.concept || ''}`,
            type: m.type === 'entrada' || m.type === 'ajuste' ? 'Reserva (+)' : 'Reserva (-)',
            amount: m.type === 'entrada' || m.type === 'ajuste' ? amt : -amt
          });
        });
        return {
          title: 'Total Disponible Estimado',
          description: 'Desglose del saldo líquido en caja disponible para operaciones en el periodo.',
          formula: 'Ingresos netos pagados - Gastos afectos a caja - Sueldos pagados - Impuestos pagados + Movimientos de reserva',
          headers: ['Fecha', 'Concepto', 'Clasificación', 'Monto (CLP)'],
          rows: list.sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => [
            item.date || '-',
            item.concept || 'Sin concepto',
            item.type,
            formatCurrency(item.amount, 'CLP')
          ]),
          rawRows: list,
          modulePath: '/ingresos'
        };
      }

      case 'utility': {
        const list = [];
        monthIncomes.forEach(i => {
          if (i.status !== 'pagado') return;
          const split = calculateVatSplit(getNormalizedAmount(i), i.includes_vat);
          list.push({
            date: i.date,
            concept: i.concept,
            type: 'Ingreso Neto (+)',
            amount: convertToClp(split.net, i.currency)
          });
        });
        monthExpenses.forEach(e => {
          const isTax = e.tax_payment || e.category === 'impuestos';
          if (isTax) return;
          const split = calculateVatSplit(getNormalizedAmount(e), e.includes_vat);
          const amt = e.deductible ? convertToClp(split.net, e.currency) : convertToClp(getNormalizedAmount(e), e.currency);
          list.push({
            date: e.date,
            concept: e.concept,
            type: e.deductible ? 'Gasto Neto Deducible (-)' : 'Gasto Neto No Deducible (-)',
            amount: -amt
          });
        });
        monthPayroll.forEach(p => {
          if (p.status !== 'pagado') return;
          list.push({
            date: p.date,
            concept: `Honorarios: ${p.concept || ''}`,
            type: 'Sueldo (-)',
            amount: -convertToClp(getNormalizedAmount(p), p.currency)
          });
        });
        monthExpenses.forEach(e => {
          const isTax = e.tax_payment || e.category === 'impuestos';
          if (!isTax) return;
          list.push({
            date: e.date,
            concept: `Impuestos: ${e.concept || ''}`,
            type: 'Impuestos (-)',
            amount: -convertToClp(getNormalizedAmount(e), e.currency)
          });
        });

        return {
          title: 'Utilidad Neta Estimada',
          description: 'Resultado neto antes del cierre financiero en el periodo.',
          formula: 'Ingresos netos - Gastos netos - Pagos personal - Impuestos pagados',
          headers: ['Fecha', 'Concepto', 'Clasificación', 'Monto (CLP)'],
          rows: list.sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => [
            item.date || '-',
            item.concept || 'Sin concepto',
            item.type,
            formatCurrency(item.amount, 'CLP')
          ]),
          rawRows: list,
          modulePath: '/gastos'
        };
      }

      case 'reserve': {
        const list = [];
        periodAllocations.forEach(a => {
          const parentIncome = (incomes || []).find(inc => inc.id === a.income_id);
          const rate = parentIncome ? Number(parentIncome.exchange_rate || 1) : 1;
          list.push({
            date: parentIncome?.date || '-',
            concept: `Retención sobre Ingreso: ${parentIncome?.concept || ''}`,
            type: 'Retención de Venta',
            amount: Number(a.calculated_amount) * rate
          });
        });
        periodMovements.forEach(m => {
          const amt = convertToClp(getNormalizedAmount(m), m.currency);
          list.push({
            date: m.date,
            concept: m.concept,
            type: m.type === 'entrada' || m.type === 'ajuste' ? 'Ajuste Entrada' : 'Salida de Reserva',
            amount: m.type === 'entrada' || m.type === 'ajuste' ? amt : -amt
          });
        });
        return {
          title: 'Reserva Operacional',
          description: 'Movimientos y retenciones destinadas a la reserva de contingencia.',
          formula: 'Retenciones del periodo + Entradas/Ajustes manuales - Salidas manuales',
          headers: ['Fecha', 'Concepto', 'Tipo Movimiento', 'Monto (CLP)'],
          rows: list.sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => [
            item.date || '-',
            item.concept || 'Sin concepto',
            item.type,
            formatCurrency(item.amount, 'CLP')
          ]),
          rawRows: list,
          modulePath: '/reserva'
        };
      }

      case 'funds_allocated': {
        const rows = (clientFunds || []).map(f => {
          const client = (clients || []).find(c => c.id === f.client_id);
          return [
            client ? client.name : 'Cliente desconocido',
            f.fund_type || '-',
            formatCurrency(f.allocated_amount, 'CLP'),
            formatCurrency(f.balance, 'CLP'),
            f.updated_at ? new Date(f.updated_at).toLocaleDateString() : '-'
          ];
        });
        return {
          title: 'Fondos de Clientes (Asignado)',
          description: 'Historial de fondos asignados a los clientes para gastos específicos.',
          headers: ['Cliente', 'Tipo de Fondo', 'Total Asignado', 'Saldo Disponible', 'Última Actualización'],
          rows: rows,
          rawRows: clientFunds,
          modulePath: '/clientes'
        };
      }

      case 'funds_available': {
        const rows = (clientFunds || []).map(f => {
          const client = (clients || []).find(c => c.id === f.client_id);
          return [
            client ? client.name : 'Cliente desconocido',
            f.fund_type || '-',
            formatCurrency(f.balance, 'CLP'),
            formatCurrency(f.allocated_amount, 'CLP'),
            f.updated_at ? new Date(f.updated_at).toLocaleDateString() : '-'
          ];
        });
        return {
          title: 'Fondos de Clientes (Saldo Disponible)',
          description: 'Saldos líquidos disponibles en los fondos de los clientes.',
          headers: ['Cliente', 'Tipo de Fondo', 'Saldo Disponible', 'Monto Asignado Inicial', 'Última Actualización'],
          rows: rows,
          rawRows: clientFunds,
          modulePath: '/clientes'
        };
      }

      case 'to_distribute': {
        const list = [];
        const validIncomes = (incomes || []).filter(i => i.status === 'pagado');
        validIncomes.forEach(i => {
          const amt = parseFloat(i.amount) || 0;
          const vat = i.includes_vat ? (amt - (amt / 1.19)) : 0;
          const netPool = amt - vat;
          
          const distSum = (incomeDistributions || [])
            .filter(d => d.income_id === i.id)
            .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
          
          if (netPool > distSum) {
            const clientObj = (clients || []).find(c => c.id === i.client_id);
            list.push({
              date: i.date || '-',
              concept: i.concept || 'Pago recibido',
              clientName: clientObj ? clientObj.name : 'Cliente general',
              netPool: netPool,
              allocated: distSum,
              pending: netPool - distSum
            });
          }
        });

        const rows = list.map(item => [
          item.date,
          item.clientName,
          item.concept,
          formatCurrency(item.netPool, 'CLP'),
          formatCurrency(item.allocated, 'CLP'),
          formatCurrency(item.pending, 'CLP')
        ]);

        return {
          title: 'Ingresos Pendientes de Distribución',
          description: 'Lista de ingresos recibidos netos que aún no se han distribuido al 100% en las áreas correspondientes.',
          headers: ['Fecha', 'Cliente', 'Concepto', 'Pozo Neto Real', 'Distribuido', 'Pendiente'],
          rows: rows,
          rawRows: list,
          modulePath: '/ingresos'
        };
      }

      case 'incomes': {
        return {
          title: 'Detalle de Ingresos',
          description: 'Listado de ingresos recibidos durante el periodo.',
          headers: ['Fecha', 'Cliente / Prospecto', 'Concepto', 'Monto Bruto', 'Monto Neto', 'IVA', 'Método'],
          rows: monthIncomes.map(i => {
            const client = (clients || []).find(c => c.id === i.client_id) || (prospects || []).find(p => p.id === i.client_id);
            const amt = getNormalizedAmount(i);
            const split = calculateVatSplit(amt, i.includes_vat);
            return [
              i.date || '-',
              client ? client.name : 'Venta externa',
              i.concept || 'Sin concepto',
              formatCurrency(amt, i.currency),
              formatCurrency(split.net, i.currency),
              formatCurrency(split.vat, i.currency),
              i.payment_method || '-'
            ];
          }),
          rawRows: monthIncomes,
          modulePath: '/ingresos'
        };
      }

      case 'expenses': {
        return {
          title: 'Detalle de Gastos',
          description: 'Gastos generales y operacionales registrados en el periodo.',
          headers: ['Fecha', 'Categoría', 'Proveedor', 'Concepto', 'Monto', 'Deducible', 'Afecta Caja'],
          rows: monthExpenses.map(e => [
            e.date || '-',
            e.category || '-',
            e.provider || '-',
            e.concept || '-',
            formatCurrency(getNormalizedAmount(e), e.currency),
            e.deductible ? 'Sí' : 'No',
            e.affects_cashflow !== false ? 'Sí' : 'No'
          ]),
          rawRows: monthExpenses,
          modulePath: '/gastos'
        };
      }

      case 'payroll': {
        const paidPayroll = monthPayroll.filter(p => p.isPaid);
        return {
          title: 'Pagos a Personal',
          description: 'Liquidaciones de sueldo y honorarios pagados en el periodo.',
          headers: ['Nombre Colaborador', 'Rol / Cargo', 'Monto Pagado', 'Fecha', 'Método', 'Estado'],
          rows: paidPayroll.map(p => [
            p.staff_name || 'Colaborador',
            p.staff_role || p.role || '-',
            formatCurrency(p.amount, p.currency || 'CLP'),
            p.date || '-',
            p.method || p.payment_method || '-',
            p.status || 'pagado'
          ]),
          rawRows: paidPayroll,
          modulePath: '/personal'
        };
      }

      case 'vat': {
        const list = [];
        monthIncomes.forEach(i => {
          if (i.status !== 'pagado') return;
          const amt = getNormalizedAmount(i);
          const split = calculateVatSplit(amt, i.includes_vat);
          if (split.vat > 0) {
            list.push({
              date: i.date,
              concept: `Débito: ${i.concept || ''}`,
              type: 'Débito Fiscal (Venta)',
              amount: convertToClp(split.vat, i.currency)
            });
          }
        });
        monthExpenses.forEach(e => {
          if (!e.deductible) return;
          const amt = getNormalizedAmount(e);
          const split = calculateVatSplit(amt, e.includes_vat);
          if (split.vat > 0) {
            list.push({
              date: e.date,
              concept: `Crédito: ${e.concept || ''}`,
              type: 'Crédito Fiscal (Compra)',
              amount: -convertToClp(split.vat, e.currency)
            });
          }
        });

        return {
          title: 'IVA por Pagar Estimado',
          description: 'Balance estimado entre IVA devengado en ventas y compras en el periodo.',
          formula: 'IVA Débito (Ventas) - IVA Crédito (Compras Deducibles) = IVA por Pagar',
          headers: ['Fecha', 'Concepto', 'Clasificación', 'Monto (CLP)'],
          rows: list.sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => [
            item.date || '-',
            item.concept || 'Sin concepto',
            item.type,
            formatCurrency(item.amount, 'CLP')
          ]),
          rawRows: list,
          modulePath: '/gastos'
        };
      }

      case 'taxes': {
        const taxExpenses = monthExpenses.filter(e => e.tax_payment || e.category === 'impuestos');
        return {
          title: 'Impuestos Pagados',
          description: 'Gastos clasificados como obligaciones tributarias en el periodo.',
          headers: ['Fecha', 'Tipo Impuesto', 'Concepto', 'Monto (CLP)', 'Categoría'],
          rows: taxExpenses.map(t => [
            t.date || '-',
            t.concept || 'Pago Impuesto',
            t.concept || '-',
            formatCurrency(getNormalizedAmount(t), t.currency),
            t.category || '-'
          ]),
          rawRows: taxExpenses,
          modulePath: '/gastos'
        };
      }

      case 'receivables': {
        const list = [];
        const periodClients = filterByPeriod(clients || [], 'created_at', period);
        periodClients.forEach(c => {
          const payStatus = String(c.payment_status || '').toLowerCase().trim();
          if (payStatus === 'pagado') return;
          if (c.balance_due !== null && c.balance_due !== undefined && parseFloat(c.balance_due) <= 0) return;
          const notLost = !['perdido', 'perdido / rechazado'].includes(String(c.status || '').toLowerCase().trim());
          if (!notLost) return;

          let pendingAmt = 0;
          let totalAgreed = 0;
          if (c.balance_due !== null && c.balance_due !== undefined) {
            pendingAmt = parseFloat(c.balance_due);
            totalAgreed = parseFloat(c.total_agreed_amount || c.amount || c.agreed_amount || 0);
          } else {
            totalAgreed = parseFloat(c.total_agreed_amount || c.amount || c.agreed_amount || 0);
            pendingAmt = totalAgreed - (parseFloat(c.amount_paid) || 0);
          }
          if (pendingAmt > 0) {
            list.push({
              name: c.name,
              type: 'Cliente / Venta',
              agreed: totalAgreed,
              paid: totalAgreed - pendingAmt,
              due: pendingAmt,
              currency: c.currency || c.preferred_currency || 'CLP'
            });
          }
        });
        const periodServices = filterByPeriod(services || [], 'start_date', period);
        periodServices.forEach(s => {
          const payStatus = String(s.payment_status || '').toLowerCase().trim();
          if (payStatus === 'pagado') return;
          if (s.balance_due !== null && s.balance_due !== undefined && parseFloat(s.balance_due) <= 0) return;
          const notClosed = !['cerrado', 'entregado', 'finalizado'].includes(String(s.status || '').toLowerCase().trim());
          if (!notClosed) return;

          let pendingAmt = 0;
          let totalAgreed = 0;
          if (s.balance_due !== null && s.balance_due !== undefined) {
            pendingAmt = parseFloat(s.balance_due);
            totalAgreed = parseFloat(s.total_agreed_amount || s.value || s.amount || 0);
          } else {
            totalAgreed = parseFloat(s.total_agreed_amount || s.value || s.amount || 0);
            pendingAmt = totalAgreed - (parseFloat(s.amount_paid) || 0);
          }
          if (pendingAmt > 0) {
            list.push({
              name: s.book_title || s.title || 'Servicio Editorial',
              type: 'Proyecto Contratado',
              agreed: totalAgreed,
              paid: totalAgreed - pendingAmt,
              due: pendingAmt,
              currency: s.currency || 'CLP'
            });
          }
        });

        return {
          title: 'Detalle de Cuentas por Cobrar',
          description: 'Saldos pendientes de clientes y proyectos iniciados en el periodo.',
          headers: ['Nombre / Concepto', 'Tipo', 'Total Acordado', 'Monto Pagado', 'Saldo Pendiente'],
          rows: list.map(item => [
            item.name || '-',
            item.type,
            formatCurrency(item.agreed, item.currency),
            formatCurrency(item.paid, item.currency),
            formatCurrency(item.due, item.currency)
          ]),
          rawRows: list,
          modulePath: '/ingresos'
        };
      }

      case 'active_clients': {
        const activeList = (clients || []).filter(c => {
          const status = String(c.status || '').toLowerCase().trim();
          const activeStatuses = [
            'cliente', 'activo', 'pago recibido', 'listo para iniciar', 'en proceso',
            'en proceso editorial', 'esperando manuscrito/archivos',
            'esperando archivos/materiales', 'contrato firmado recibido'
          ];
          return activeStatuses.includes(status);
        });

        return {
          title: 'Clientes Activos',
          description: 'Listado completo de clientes activos en producción o con contrato vigente.',
          headers: ['Nombre', 'Estado', 'País / Región', 'Fecha de Creación'],
          rows: activeList.map(c => [
            c.name || '-',
            c.status || '-',
            c.country || c.city || '-',
            c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'
          ]),
          rawRows: activeList,
          modulePath: '/clientes'
        };
      }

      case 'active_prospects': {
        const activePros = (prospects || []).filter(p => {
          const status = String(p.status || '').toLowerCase().trim();
          const isConvertedOrExcluded = 
            p.converted_to_client_id || 
            p.converted_client_id || 
            p.converted_to_client === true || 
            ['convertido', 'cliente', 'finalizado', 'perdido', 'perdido / rechazado'].includes(status);
          return !isConvertedOrExcluded;
        });

        return {
          title: 'Prospectos Activos',
          description: 'Oportunidades comerciales abiertas y cotizaciones en seguimiento.',
          headers: ['Nombre Prospecto', 'Etapa / Estado', 'Contacto', 'Fecha de Registro'],
          rows: activePros.map(p => [
            p.name || '-',
            p.status || '-',
            p.email || p.phone || '-',
            p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'
          ]),
          rawRows: activePros,
          modulePath: '/prospects'
        };
      }

      case 'services_process': {
        const processList = (services || []).filter(s => {
          const status = String(s.status || '').toLowerCase().trim();
          return !['cerrado', 'entregado', 'finalizado'].includes(status);
        });

        return {
          title: 'Servicios en Proceso',
          description: 'Proyectos editoriales en producción activa actualmente.',
          headers: ['Título del Libro', 'Tipo Servicio', 'Avance %', 'Etapa Actual', 'Entrega Estimada'],
          rows: processList.map(s => [
            s.book_title || s.title || '-',
            s.type || s.service_type || '-',
            `${s.progress || s.advance_percent || 0}%`,
            s.status || '-',
            s.estimated_delivery_date || s.estimated_delivery || '-'
          ]),
          rawRows: processList,
          modulePath: '/services'
        };
      }

      case 'avg_progress': {
        const activeServicesList = (services || []).filter(s => {
          return !['cerrado', 'entregado', 'finalizado'].includes(String(s.status || '').toLowerCase().trim());
        });

        return {
          title: 'Avance Promedio de Servicios',
          description: 'Proyectos editoriales activos considerados para promediar el progreso general.',
          headers: ['Título del Libro', 'Tipo', 'Progreso Individual', 'Etapa Actual'],
          rows: activeServicesList.map(s => [
            s.book_title || s.title || '-',
            s.type || s.service_type || '-',
            `${s.progress || s.advance_percent || 0}%`,
            s.status || '-'
          ]),
          rawRows: activeServicesList,
          modulePath: '/services'
        };
      }

      case 'atrasados': {
        const overdueList = (services || []).filter(s => {
          const status = String(s.status || '').toLowerCase().trim();
          const isClosed = ['cerrado', 'entregado', 'finalizado'].includes(status);
          const deliveryDateStr = s.estimated_delivery_date || s.estimated_delivery;
          if (isClosed || !deliveryDateStr) return false;
          return new Date(deliveryDateStr) < new Date(todayStr);
        });

        return {
          title: 'Servicios Atrasados',
          description: 'Proyectos en proceso que han superado su fecha de entrega estimada.',
          headers: ['Título del Libro', 'Etapa Actual', 'Fecha de Entrega Estimada', 'Avance %'],
          rows: overdueList.map(s => [
            s.book_title || s.title || '-',
            s.status || '-',
            s.estimated_delivery_date || s.estimated_delivery || '-',
            `${s.progress || s.advance_percent || 0}%`
          ]),
          rawRows: overdueList,
          modulePath: '/services'
        };
      }

      case 'proximos': {
        const upcomingList = (services || []).filter(s => {
          const status = String(s.status || '').toLowerCase().trim();
          const isClosed = ['cerrado', 'entregado', 'finalizado'].includes(status);
          const deliveryDateStr = s.estimated_delivery_date || s.estimated_delivery;
          if (isClosed || !deliveryDateStr) return false;
          const diffTime = new Date(deliveryDateStr) - new Date(todayStr);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 15;
        });

        return {
          title: 'Servicios Próximos a Vencer (15 días)',
          description: 'Servicios en proceso cuyos plazos vencen en los siguientes 15 días.',
          headers: ['Título del Libro', 'Etapa Actual', 'Entrega Estimada', 'Días Restantes'],
          rows: upcomingList.map(s => {
            const diffTime = new Date(s.estimated_delivery_date || s.estimated_delivery) - new Date(todayStr);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return [
              s.book_title || s.title || '-',
              s.status || '-',
              s.estimated_delivery_date || s.estimated_delivery || '-',
              `${diffDays} días`
            ];
          }),
          rawRows: upcomingList,
          modulePath: '/services'
        };
      }

      case 'finalizados': {
        const closedList = (services || []).filter(s => {
          const status = String(s.status || '').toLowerCase().trim();
          return ['cerrado', 'entregado', 'finalizado'].includes(status);
        });

        return {
          title: 'Servicios Finalizados',
          description: 'Proyectos editoriales concluidos y entregados satisfactoriamente.',
          headers: ['Título del Libro', 'Tipo', 'Etapa de Cierre', 'Fecha Cierre / Modificación'],
          rows: closedList.map(s => [
            s.book_title || s.title || '-',
            s.type || s.service_type || '-',
            s.status || '-',
            s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '-'
          ]),
          rawRows: closedList,
          modulePath: '/services'
        };
      }

      case 'pending_contracts': {
        const pendingContractsList = (clients || []).filter(c => {
          const notLost = !['perdido', 'perdido / rechazado'].includes(String(c.status || '').toLowerCase().trim());
          return notLost && c.contract_sent && !c.contract_signed_received;
        });

        return {
          title: 'Contratos Pendientes de Firma',
          description: 'Clientes con propuesta aceptada y contrato enviado pero aún no firmado.',
          headers: ['Cliente', 'Estado', 'País / Ciudad', 'Fecha Creación'],
          rows: pendingContractsList.map(c => [
            c.name || '-',
            c.status || '-',
            c.country || c.city || '-',
            c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'
          ]),
          rawRows: pendingContractsList,
          modulePath: '/clientes'
        };
      }

      case 'pending_files': {
        const pendingFilesList = (clients || []).filter(c => {
          const notLost = !['perdido', 'perdido / rechazado'].includes(String(c.status || '').toLowerCase().trim());
          if (!notLost) return false;
          const servicesList = Array.isArray(c.selected_services) ? c.selected_services : [];
          const reqManuscript = servicesList.some(s => s && s.requires_manuscript);
          const reqMaterials = servicesList.some(s => s && s.requires_materials);
          return (reqManuscript && !c.files_received) || (reqMaterials && !c.materials_received);
        });

        return {
          title: 'Manuscritos o Archivos Pendientes',
          description: 'Clientes que no han entregado sus archivos de manuscrito o materiales requeridos para iniciar la producción.',
          headers: ['Cliente', 'Estado de Recepción', 'País / Ciudad', 'Fecha Creación'],
          rows: pendingFilesList.map(c => {
            const servicesList = Array.isArray(c.selected_services) ? c.selected_services : [];
            const reqManuscript = servicesList.some(s => s && s.requires_manuscript);
            const reqMaterials = servicesList.some(s => s && s.requires_materials);
            const statusStr = [
              reqManuscript && !c.files_received ? 'Falta Manuscrito' : '',
              reqMaterials && !c.materials_received ? 'Falta Materiales' : ''
            ].filter(Boolean).join(' y ');
            return [
              c.name || '-',
              statusStr || 'Pendiente de entrega',
              c.country || c.city || '-',
              c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'
            ];
          }),
          rawRows: pendingFilesList,
          modulePath: '/clientes'
        };
      }

      default:
        return null;
    }
  };

  const getDetailItems = (cardId) => {
    const result = getDetailItemsRaw(cardId);
    if (!result) return null;
    return {
      ...result,
      subtitle: result.description,
      columns: result.headers,
      moduleLink: result.modulePath,
      value: getMetricValue(cardId)
    };
  };

  const getMetricValue = (cardId) => {
    switch (cardId) {
      case 'total_disponible': return formatCurrency(stats.financials.totalDisponible, 'CLP');
      case 'utility': return formatCurrency(stats.financials.utility, 'CLP');
      case 'reserve': return formatCurrency(stats.financials.operationalReserve, 'CLP');
      case 'incomes': return formatCurrency(stats.financials.incomesTotal, 'CLP');
      case 'expenses': return formatCurrency(stats.financials.expensesTotal, 'CLP');
      case 'payroll': return formatCurrency(stats.financials.payrollTotal, 'CLP');
      case 'vat': return formatCurrency(stats.financials.vatToPay, 'CLP');
      case 'taxes': return formatCurrency(stats.financials.taxesPaidTotal, 'CLP');
      case 'receivables': return formatCurrency(stats.financials.pendingPaymentsVal, 'CLP');
      case 'funds_allocated': return formatCurrency(stats.financials.fundsAllocated, 'CLP');
      case 'funds_available': return formatCurrency(stats.financials.fundsAvailable, 'CLP');
      case 'to_distribute': return formatCurrency(stats.financials.toDistribute, 'CLP');
      case 'active_clients': return stats.counts.activeClients;
      case 'active_prospects': return stats.counts.activeProspects;
      case 'services_process': return stats.counts.servicesInProcess;
      case 'avg_progress': return `${stats.counts.avgProgress}%`;
      case 'atrasados': return stats.counts.servicesAtrasados;
      case 'proximos': return stats.counts.servicesProximos;
      case 'finalizados': return stats.counts.servicesFinalizados;
      case 'pending_contracts': return stats.counts.pendingContracts;
      case 'pending_files': return stats.counts.pendingFiles;
      default: return null;
    }
  };

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
                <div 
                  onClick={() => handleCardClick('total_disponible')}
                  className="bg-gradient-to-br from-amber-50/70 to-white dark:from-slate-900 dark:to-slate-900/40 p-6 rounded-2xl border-2 border-amber-200/60 dark:border-amber-900/50 shadow-xs flex flex-col justify-between group hover:shadow-lg hover:-translate-y-0.5 cursor-pointer transition-all duration-300 relative overflow-hidden"
                >
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
                  <div className="flex justify-between items-center mt-4 border-t border-amber-200/40 pt-3">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Caja Disponible Estimada
                    </p>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-all">
                      Ver detalle
                      <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </span>
                  </div>
                </div>

                {/* Utilidad Estimada */}
                <div 
                  onClick={() => handleCardClick('utility')}
                  className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between group hover:shadow-lg hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
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
                  <div className="flex justify-between items-center mt-4 border-t border-slate-100 dark:border-slate-800/60 pt-3">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Ingresos - Gastos - Sueldos
                    </p>
                    <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-all">
                      Ver detalle
                      <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </span>
                  </div>
                </div>

                {/* Reserva Operacional */}
                <div 
                  onClick={() => handleCardClick('reserve')}
                  className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between group hover:shadow-lg hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
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
                  <div className="flex justify-between items-center mt-4 border-t border-slate-100 dark:border-slate-800/60 pt-3">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Retenciones y movimientos
                    </p>
                    <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-all">
                      Ver detalle
                      <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Detalle Financiero Secundario */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Ingresos del periodo */}
                <div 
                  onClick={() => handleCardClick('incomes')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Ingresos</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.incomesTotal, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold mt-2 pt-2 border-t border-slate-50 dark:border-slate-850 flex justify-between items-center">
                    <span>Neto: {formatCurrency(stats.financials.incomesNet, 'CLP')}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Gastos del periodo */}
                <div 
                  onClick={() => handleCardClick('expenses')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Gastos</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.expensesTotal, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-rose-500 font-bold mt-2 pt-2 border-t border-slate-50 dark:border-slate-850 flex justify-between items-center">
                    <span>Ded: {formatCurrency(stats.financials.expensesDeductible, 'CLP')}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Sueldos */}
                <div 
                  onClick={() => handleCardClick('payroll')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/85 shadow-2xs flex flex-col justify-between group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Pagos a Personal</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.payrollTotal, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-450 dark:text-slate-400 font-medium mt-2 pt-2 border-t border-slate-50 dark:border-slate-850 flex justify-between items-center">
                    <span>Honorarios liquidados</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* IVA Estimado */}
                <div 
                  onClick={() => handleCardClick('vat')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">IVA por Pagar</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.vatToPay, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-450 dark:text-slate-400 font-medium mt-2 pt-2 border-t border-slate-50 dark:border-slate-850 flex justify-between items-center truncate" title={`Débito: ${stats.financials.incomesVat} - Crédito: ${stats.financials.expensesVat}`}>
                    <span>D: {formatCurrency(stats.financials.incomesVat, 'CLP')} | C: {formatCurrency(stats.financials.expensesVat, 'CLP')}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </div>

                {/* Impuestos Pagados */}
                <div 
                  onClick={() => handleCardClick('taxes')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Impuestos Pagados</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.taxesPaidTotal, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-450 dark:text-slate-400 font-medium mt-2 pt-2 border-t border-slate-50 dark:border-slate-850 flex justify-between items-center">
                    <span>PPM y patentes</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Por cobrar */}
                <div 
                  onClick={() => handleCardClick('receivables')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Por Cobrar (Per.)</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.pendingPaymentsVal, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-amber-600 font-bold mt-2 pt-2 border-t border-slate-50 dark:border-slate-850 flex justify-between items-center">
                    <span>{stats.financials.pendingPaymentsCount} cuentas</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Fondos Asignados */}
                <div 
                  onClick={() => handleCardClick('funds_allocated')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Fondos Asignados</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.fundsAllocated, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-450 dark:text-slate-400 font-medium mt-2 pt-2 border-t border-slate-50 dark:border-slate-850 flex justify-between items-center">
                    <span>Fondos totales clientes</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Fondos Disponibles */}
                <div 
                  onClick={() => handleCardClick('funds_available')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Fondos Disponibles</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.fundsAvailable, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-650 dark:text-emerald-500 font-bold mt-2 pt-2 border-t border-slate-50 dark:border-slate-850 flex justify-between items-center">
                    <span>Saldo neto restante</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Por Distribuir */}
                <div 
                  onClick={() => handleCardClick('to_distribute')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-850 shadow-2xs flex flex-col justify-between group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-12 h-12 bg-amber-400/5 rounded-full blur-md pointer-events-none"></div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Por Distribuir</span>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {formatCurrency(stats.financials.toDistribute, 'CLP')}
                    </div>
                  </div>
                  <div className="text-[10px] text-amber-600 font-bold mt-2 pt-2 border-t border-slate-50 dark:border-slate-850 flex justify-between items-center">
                    <span>Ingresos sin asignar</span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
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
                <div 
                  onClick={() => handleCardClick('active_clients')}
                  className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-4 rounded-xl flex items-center justify-between shadow-2xs group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.counts.activeClients}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Clientes Activos</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-350 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Prospectos Activos */}
                <div 
                  onClick={() => handleCardClick('active_prospects')}
                  className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-4 rounded-xl flex items-center justify-between shadow-2xs group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-lg">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.counts.activeProspects}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Prospectos Activos</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-350 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Servicios en Proceso */}
                <div 
                  onClick={() => handleCardClick('services_process')}
                  className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-4 rounded-xl flex items-center justify-between shadow-2xs group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.counts.servicesInProcess}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Servicios en Proceso</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-350 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Avance Promedio */}
                <div 
                  onClick={() => handleCardClick('avg_progress')}
                  className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-4 rounded-xl shadow-2xs flex flex-col justify-center group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                      Avance Promedio
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-350 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
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
                <div 
                  onClick={() => handleCardClick('atrasados')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Atrasados</span>
                    <span className="text-xl font-extrabold text-rose-500 block mt-1">{stats.counts.servicesAtrasados}</span>
                  </div>
                  <div className="text-[9px] text-slate-450 dark:text-slate-400 mt-2 border-t border-slate-50 dark:border-slate-850 pt-1.5 flex justify-between items-center">
                    <span>Entrega vencida</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-350 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Próximos */}
                <div 
                  onClick={() => handleCardClick('proximos')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">A Vencer (15d)</span>
                    <span className="text-xl font-extrabold text-amber-600 block mt-1">{stats.counts.servicesProximos}</span>
                  </div>
                  <div className="text-[9px] text-slate-450 dark:text-slate-400 mt-2 border-t border-slate-50 dark:border-slate-850 pt-1.5 flex justify-between items-center">
                    <span>Próximos plazos</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-350 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Finalizados */}
                <div 
                  onClick={() => handleCardClick('finalizados')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Finalizados</span>
                    <span className="text-xl font-extrabold text-slate-700 dark:text-slate-300 block mt-1">{stats.counts.servicesFinalizados}</span>
                  </div>
                  <div className="text-[9px] text-slate-450 dark:text-slate-400 mt-2 border-t border-slate-50 dark:border-slate-850 pt-1.5 flex justify-between items-center">
                    <span>Entregas totales</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-350 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Pagos Pendientes */}
                <div 
                  onClick={() => handleCardClick('receivables')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pagos Pendientes</span>
                    <span className="text-xl font-extrabold text-amber-600 block mt-1">{stats.counts.pendingPaymentsCount}</span>
                  </div>
                  <div className="text-[9px] text-slate-450 dark:text-slate-400 mt-2 border-t border-slate-50 dark:border-slate-850 pt-1.5 flex justify-between items-center truncate" title={formatCurrency(stats.counts.pendingPaymentsVal, 'CLP')}>
                    <span className="truncate">{formatCurrency(stats.counts.pendingPaymentsVal, 'CLP')}</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-350 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </div>

                {/* Contratos Pendientes */}
                <div 
                  onClick={() => handleCardClick('pending_contracts')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contratos Pend.</span>
                    <span className="text-xl font-extrabold text-slate-700 dark:text-slate-355 block mt-1">{stats.counts.pendingContracts}</span>
                  </div>
                  <div className="text-[9px] text-slate-450 dark:text-slate-400 mt-2 border-t border-slate-50 dark:border-slate-850 pt-1.5 flex justify-between items-center">
                    <span>Por firmar</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-350 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Archivos Pendientes */}
                <div 
                  onClick={() => handleCardClick('pending_files')}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 shadow-2xs group hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Archivos Pend.</span>
                    <span className="text-xl font-extrabold text-slate-750 dark:text-slate-350 block mt-1">{stats.counts.pendingFiles}</span>
                  </div>
                  <div className="text-[9px] text-slate-450 dark:text-slate-400 mt-2 border-t border-slate-50 dark:border-slate-850 pt-1.5 flex justify-between items-center">
                    <span>Manuscrito/Briefing</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-350 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
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

      <DashboardDetailDrawer
        isOpen={isDetailOpen}
        onClose={closeDetail}
        detail={selectedDetail}
      />
    </div>
  );
}
