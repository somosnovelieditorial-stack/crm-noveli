import { filterByPeriod } from '../utils';

// Exclude test data helpers
export const isTestData = (item) => {
  if (!item) return false;
  if (item.is_test === true || item.is_test === 'true' || item.is_test === 1 || item.is_test === '1') return true;
  if (item.test_run_id !== undefined && item.test_run_id !== null && item.test_run_id !== '') return true;
  
  for (const key in item) {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      const val = item[key];
      if (typeof val === 'string' && val.includes('TEST_QA_')) {
        return true;
      }
    }
  }
  return false;
};

export const safeNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const formatCLP = (value) => {
  return Math.round(safeNumber(value)).toLocaleString('es-CL');
};

const USD_TO_CLP_RATE = 930;

export const convertToClp = (amount, currency, item = null) => {
  const numericAmount = safeNumber(amount);
  if (currency === 'USD') {
    const rate = item && item.exchange_rate ? safeNumber(item.exchange_rate) : USD_TO_CLP_RATE;
    return numericAmount * rate;
  }
  return numericAmount;
};

// 1. Calculate Gross Income
export const calculateGrossIncome = (income) => {
  if (!income || isTestData(income)) return 0;
  const gross = income.gross_amount !== undefined && income.gross_amount !== null && Number(income.gross_amount) > 0 
    ? Number(income.gross_amount) 
    : Number(income.amount || 0);
  return convertToClp(gross, income.currency, income);
};

// 2. Calculate Net Income
export const calculateNetIncome = (income) => {
  if (!income || isTestData(income)) return 0;
  const amt = safeNumber(income.amount);
  const includesIva = income.includes_vat === true || income.includes_vat === 'true' || income.includes_iva === true || income.includes_iva === 'true';
  let net = 0;
  if (income.net_amount !== undefined && income.net_amount !== null && Number(income.net_amount) > 0) {
    net = Number(income.net_amount);
  } else {
    if (includesIva) {
      net = amt / 1.19;
    } else {
      net = amt;
    }
  }
  return convertToClp(net, income.currency, income);
};

// 3. Calculate IVA Reserved
export const calculateIvaReserved = (income) => {
  if (!income || isTestData(income)) return 0;
  const amt = safeNumber(income.amount);
  const includesIva = income.includes_vat === true || income.includes_vat === 'true' || income.includes_iva === true || income.includes_iva === 'true';
  let iva = 0;
  if (income.tax_amount !== undefined && income.tax_amount !== null && Number(income.tax_amount) > 0) {
    iva = Number(income.tax_amount);
  } else if (includesIva) {
    iva = amt - (amt / 1.19);
  }
  return convertToClp(iva, income.currency, income);
};

// 4. Calculate Expenses
export const calculateExpensesSum = (expenses, periodConfig, useNet = false) => {
  const nonTestExpenses = (expenses || []).filter(e => !isTestData(e));
  const periodFiltered = filterByPeriod(nonTestExpenses, 'date', periodConfig);
  return periodFiltered.reduce((sum, e) => {
    let amt = 0;
    if (useNet) {
      if (e.deductible) {
        const gross = Number(e.amount || 0);
        const net = e.includes_vat ? (gross / 1.19) : gross;
        amt = net;
      } else {
        amt = Number(e.amount || 0);
      }
    } else {
      amt = Number(e.amount || 0);
    }
    return sum + convertToClp(amt, e.currency, e);
  }, 0);
};

// 5. Calculate Payroll
export const calculatePayrollSum = (payrollPayments, periodConfig) => {
  const nonTestPayments = (payrollPayments || []).filter(p => !isTestData(p));
  const periodFiltered = filterByPeriod(nonTestPayments, 'date', periodConfig);
  
  return periodFiltered.reduce((sum, p) => {
    const statusStr = p.status ? String(p.status).toLowerCase().trim() : '';
    const isPaid = ['pagado', 'paid', 'completado', 'liquidado'].includes(statusStr) || p.isPaid === true;
    if (!isPaid) return sum;
    return sum + convertToClp(p.amount, p.currency || 'CLP', p);
  }, 0);
};

// 6. Calculate Operational Reserve Movements
export const calculateOperationalReserveMovementsSum = (reserveMovements, periodConfig) => {
  const nonTestMovements = (reserveMovements || []).filter(m => !isTestData(m));
  const periodFiltered = filterByPeriod(nonTestMovements, 'date', periodConfig);
  return periodFiltered.reduce((sum, m) => {
    const amt = convertToClp(m.amount, m.currency, m);
    if (m.type === 'entrada' || m.type === 'ajuste') {
      return sum + amt;
    } else if (m.type === 'salida') {
      return sum - amt;
    }
    return sum;
  }, 0);
};

// 7. Calculate Allocated Client Funds
export const calculateAllocatedFunds = (clientFunds) => {
  const nonTestFunds = (clientFunds || []).filter(f => !isTestData(f));
  return nonTestFunds.reduce((sum, f) => sum + safeNumber(f.allocated_amount), 0);
};

// 8. Calculate Available Client Funds
export const calculateAvailableFunds = (clientFunds) => {
  const nonTestFunds = (clientFunds || []).filter(f => !isTestData(f));
  return nonTestFunds.reduce((sum, f) => sum + safeNumber(f.balance), 0);
};

// 9. Calculate Pending To Distribute (Por Distribuir)
export const calculatePendingToDistribute = (incomes, incomeDistributions, clientFunds = [], payrollPayments = [], reserveMovements = [], expenses = []) => {
  let toDistribute = 0;
  
  const validIncomes = (incomes || []).filter(i => i.status === 'pagado' && !isTestData(i));
  
  validIncomes.forEach(i => {
    const netPool = calculateNetIncome(i);
    
    const distSum = (incomeDistributions || [])
      .filter(d => d.income_id === i.id && !isTestData(d))
      .reduce((sum, d) => sum + convertToClp(d.amount, i.currency, i), 0);
    
    if (netPool > distSum) {
      toDistribute += (netPool - distSum);
    }
  });

  return Math.max(0, toDistribute);
};

// 10. Calculate Estimated Total Available (Total Disponible Estimado)
export const calculateTotalAvailableEstimated = (utility, operationalReserve, availableFunds) => {
  return safeNumber(utility) + safeNumber(operationalReserve) + safeNumber(availableFunds);
};
