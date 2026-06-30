// Financial and formatting utilities for Somos Noveli CRM
import { supabase } from './supabaseClient';


/**
 * Formats a number to Chilean Pesos (CLP) or US Dollars (USD)
 * @param {number} value - The numeric value to format
 * @param {string} currency - 'CLP' or 'USD'
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, currency = 'CLP') => {
  const numValue = Number(value) || 0;
  if (currency === 'CLP') {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numValue);
  } else {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  }
};

/**
 * Formats a Date string into a readable Spanish format
 * @param {string} dateString - ISO date or date string YYYY-MM-DD
 * @returns {string} Formatted date
 */
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (dateString.length === 10) {
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    }
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  } catch (e) {
    return dateString;
  }
};

/**
 * Separates net and IVA (19%) from a total value
 * @param {number} total 
 * @param {boolean} includesVat 
 * @returns {{net: number, vat: number, total: number}}
 */
export const calculateVatSplit = (total, includesVat) => {
  const numericTotal = Number(total) || 0;
  if (includesVat) {
    const net = numericTotal / 1.19;
    const vat = numericTotal - net;
    return {
      net: Math.round(net * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      total: numericTotal
    };
  } else {
    return {
      net: numericTotal,
      vat: 0,
      total: numericTotal
    };
  }
};

/**
 * Convert a value from USD to CLP using a standard exchange rate for calculations
 * default rate: 930 CLP / 1 USD
 */
export const USD_TO_CLP_RATE = 930;

export const convertToClp = (amount, currency) => {
  const numericAmount = Number(amount) || 0;
  if (currency === 'USD') {
    return numericAmount * USD_TO_CLP_RATE;
  }
  return numericAmount;
};

/**
 * Export data array to a CSV download (with UTF-8 BOM so Excel opens accents correctly)
 * @param {Array<Object>} data 
 * @param {string} filename 
 * @param {Array<string>} headers - object keys to include
 * @param {Array<string>} headerLabels - column names corresponding to headers
 */
export const exportToCSV = (data, filename, headers, headerLabels = []) => {
  let csvContent = "\uFEFF"; // UTF-8 BOM
  
  // Headers row
  const labels = headerLabels.length > 0 ? headerLabels : headers;
  csvContent += labels.join(",") + "\n";
  
  // Data rows
  data.forEach(row => {
    const rowContent = headers.map(header => {
      const value = row[header] !== undefined && row[header] !== null ? row[header] : '';
      // Escape double quotes and wrap in quotes
      const strValue = String(value).replace(/"/g, '""');
      return `"${strValue}"`;
    }).join(",");
    csvContent += rowContent + "\n";
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * General filter helper to filter array of items by a date field and period settings
 * @param {Array} items 
 * @param {string} dateField - key of the date in the item
 * @param {Object} config - { mode: 'month'|'year'|'custom', year: 2026, month: 6, startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 */
export const filterByPeriod = (items, dateField, config) => {
  const { mode, year, month, startDate, endDate } = config;
  return items.filter(item => {
    if (!item[dateField]) return false;
    
    // Parse item date
    const d = new Date(item[dateField]);
    if (isNaN(d.getTime())) return false;
    
    // Add timezone offset correction if it's YYYY-MM-DD
    const isoDateStr = typeof item[dateField] === 'string' ? item[dateField] : '';
    if (isoDateStr.length === 10) {
      d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    }

    const itemYear = d.getFullYear();
    const itemMonth = d.getMonth() + 1;

    if (mode === 'month') {
      return itemYear === Number(year) && itemMonth === Number(month);
    } else if (mode === 'year') {
      return itemYear === Number(year);
    } else if (mode === 'custom') {
      // Clear times for exact day comparisons
      const itemTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      
      let start = -Infinity;
      if (startDate) {
        const sd = new Date(startDate);
        sd.setMinutes(sd.getMinutes() + sd.getTimezoneOffset());
        start = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate()).getTime();
      }
      
      let end = Infinity;
      if (endDate) {
        const ed = new Date(endDate);
        ed.setMinutes(ed.getMinutes() + ed.getTimezoneOffset());
        end = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate()).getTime();
      }

      return itemTime >= start && itemTime <= end;
    }
    return true;
  });
};

/**
 * Checks if a given role has write permission for a specific module
 * @param {string} role - The current user's role (e.g. administrador, editor, etc.)
 * @param {string} module - The name of the module (e.g. clients, incomes, etc.)
 * @returns {boolean} True if write permission is allowed, false otherwise
 */
export const hasPermission = (role, module) => {
  if (!role) return false;
  const userRole = role.toLowerCase();
  
  if (userRole === 'solo lectura') return false;
  return true; // All other roles can create, edit, and delete
};

/**
 * Synchronizes payment status and amounts among Client, Services, and Incomes
 * @param {string} clientId - The UUID of the client
 * @param {boolean} forcePaid - If true, forces the client and all services to be 'pagado'
 */
export const syncPaymentStatus = async (clientId, forcePaid = false) => {
  if (!clientId) return;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    // 1. Fetch client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      console.error("Error fetching client for sync:", clientErr);
      return;
    }

    // 2. Fetch all services of the client
    const { data: services, error: servicesErr } = await supabase
      .from('services')
      .select('*')
      .eq('client_id', clientId);

    if (servicesErr) {
      console.error("Error fetching services for sync:", servicesErr);
      return;
    }

    const isClientPaid = forcePaid || client.payment_status === 'pagado';

    if (isClientPaid) {
      // Force all services to be paid
      if (services && services.length > 0) {
        for (const s of services) {
          const totalAgreed = parseFloat(s.total_agreed_amount || s.value || s.amount || 0);
          await supabase
            .from('services')
            .update({
              payment_status: 'pagado',
              balance_due: 0,
              amount_paid: totalAgreed,
              paid_at: s.paid_at || todayStr
            })
            .eq('id', s.id);
        }
      }

      // Update client to pagado
      const clientTotal = parseFloat(client.total_agreed_amount || client.agreed_amount || client.amount || 0);
      await supabase
        .from('clients')
        .update({
          payment_status: 'pagado',
          balance_due: 0,
          amount_paid: clientTotal,
          paid_at: client.paid_at || todayStr
        })
        .eq('id', clientId);

      // Upsert income
      await upsertClientIncome(clientId, clientTotal, 'pagado', todayStr, client);

    } else {
      // Client is not forced to paid. Let's inspect the services to determine client status
      if (services && services.length > 0) {
        const allPaid = services.every(s => s.payment_status === 'pagado');
        const anyPaid = services.some(s => s.payment_status === 'pagado' || (parseFloat(s.amount_paid) > 0));

        let sumPaid = 0;
        let sumBalance = 0;
        let sumTotal = 0;

        services.forEach(s => {
          const val = parseFloat(s.total_agreed_amount || s.value || s.amount || 0);
          const paid = parseFloat(s.amount_paid) || 0;
          const balance = s.payment_status === 'pagado' ? 0 : (s.balance_due !== null ? parseFloat(s.balance_due) : Math.max(0, val - paid));

          sumPaid += paid;
          sumBalance += balance;
          sumTotal += val;
        });

        if (allPaid) {
          // Update client to pagado
          await supabase
            .from('clients')
            .update({
              payment_status: 'pagado',
              balance_due: 0,
              amount_paid: sumTotal,
              paid_at: todayStr
            })
            .eq('id', clientId);

          await upsertClientIncome(clientId, sumTotal, 'pagado', todayStr, client);
        } else {
          // Some are not paid
          const newStatus = anyPaid ? 'pago parcial' : 'pendiente';
          await supabase
            .from('clients')
            .update({
              payment_status: newStatus,
              balance_due: sumBalance,
              amount_paid: sumPaid
            })
            .eq('id', clientId);

          await upsertClientIncome(clientId, sumPaid, newStatus === 'pago parcial' ? 'parcial' : 'pendiente', todayStr, client);
        }
      } else {
        // No services. Sync based on client's own fields
        const clientTotal = parseFloat(client.total_agreed_amount || client.agreed_amount || client.amount || 0);
        const payStatus = client.payment_status || 'pendiente';
        
        await upsertClientIncome(clientId, parseFloat(client.amount_paid || 0), payStatus === 'pagado' ? 'pagado' : (payStatus === 'pago parcial' ? 'parcial' : 'pendiente'), todayStr, client);
      }
    }
  } catch (err) {
    console.error("Error in syncPaymentStatus:", err);
  }
};

/**
 * Internal helper to upsert income associated with a client
 */
const upsertClientIncome = async (clientId, amount, status, dateStr, client) => {
  try {
    const { data: existingIncomes } = await supabase
      .from('incomes')
      .select('*')
      .eq('client_id', clientId)
      .eq('source', 'cliente');

    const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
    
    // Attempt to get logged-in user ID
    let userId = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch (_) {}

    const incomePayload = {
      client_id: clientId,
      service_id: null,
      amount: amount,
      currency: client.preferred_currency || client.currency || 'CLP',
      date: dateStr,
      payment_method: client.payment_method || 'transferencia',
      includes_vat: client.includes_vat || false,
      status: status === 'pagado' ? 'pagado' : (status === 'parcial' ? 'parcial' : 'pendiente'),
      notes: 'Sincronización automática de estado de pago',
      source: 'cliente',
      user_id: userId,
      organization_id: orgId
    };

    if (existingIncomes && existingIncomes.length > 0) {
      await supabase
        .from('incomes')
        .update(incomePayload)
        .eq('id', existingIncomes[0].id);
    } else {
      await supabase
        .from('incomes')
        .insert([incomePayload]);
    }
  } catch (err) {
    console.error("Error upserting client income:", err);
  }
};

