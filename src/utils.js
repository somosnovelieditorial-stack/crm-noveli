import { supabase, getCurrentOrganizationId, subscribeToOrganizationChanges } from './supabaseClient';


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

export const exportToExcel = (data, filename, headers, headerLabels = []) => {
  const content = "XML Excel Mock Content for " + filename + "\n" + (headerLabels.length ? headerLabels : headers).join("\t") + "\n" + 
    data.map(row => headers.map(h => String(row[h] !== undefined && row[h] !== null ? row[h] : '')).join("\t")).join("\n");
  const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (data, filename, headers, headerLabels = []) => {
  const content = `%PDF-1.4\n1 0 obj\n<< /Title (${filename}) /Creator (Somos Noveli CRM) >>\nendobj\n2 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj\n` +
    `3 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n4 0 obj\n<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n` +
    `5 0 obj\n<< /Length 150 >>\nstream\nBT\n/F1 12 Tf\n70 700 Td\n(SOMOS NOVELI CRM - EXPORTACION DE DATOS) Tj\n0 -20 Td\n(Reporte: ${filename}) Tj\n0 -40 Td\n` +
    `(${ (headerLabels.length ? headerLabels : headers).join(" | ") }) Tj\n` +
    data.slice(0, 15).map((row, idx) => `0 -15 Td\n(${headers.map(h => String(row[h] !== undefined && row[h] !== null ? row[h] : '').substring(0, 20)).join(" | ")}) Tj`).join("\n") +
    `\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000078 00000 n\n0000000127 00000 n\n0000000188 00000 n\n0000000288 00000 n\ntrailer\n<< /Size 6 /Root 2 0 R >>\nstartxref\n490\n%%EOF`;
  
  const blob = new Blob([content], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.pdf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToWord = (data, filename, headers, headerLabels = []) => {
  const content = `MOCK DOCX CONTENT\n==================\nSOMOS NOVELI CRM REPORT\nFile: ${filename}\n\n` +
    `Headers: ${ (headerLabels.length ? headerLabels : headers).join(" | ") }\n` +
    data.map(row => headers.map(h => String(row[h] !== undefined && row[h] !== null ? row[h] : '')).join(" | ")).join("\n");
  const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.docx`);
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
    // Resolve date with fallback options to normalize date filtering
    let rawDate = null;
    if (dateField && item[dateField]) {
      rawDate = item[dateField];
    } else {
      rawDate = item.date || item.payment_date || item.created_at || item.start_date;
    }
    if (!rawDate) return false;
    
    // Parse item date
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return false;
    
    // Add timezone offset correction if it's YYYY-MM-DD
    const isoDateStr = typeof rawDate === 'string' ? rawDate : '';
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
  return canPerformAction(module, 'write');
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

/**
 * Recalculates and updates the client status, ready_to_start, and ready_to_start_reason fields in the database
 * @param {string} clientId - The UUID of the client
 */
export const recalculateClientStartStatus = async (clientId) => {
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
      console.error("Error fetching client for status recalculation:", clientErr);
      return;
    }

    // 2. Fetch all services of the client
    const { data: services, error: servicesErr } = await supabase
      .from('services')
      .select('*')
      .eq('client_id', clientId);

    if (servicesErr) {
      console.error("Error fetching services for status recalculation:", servicesErr);
      return;
    }

    // 3. Compute requirements
    let reqManuscript = true;
    let reqMaterials = false;
    let reqSignedContract = true;
    let reqAgreementSent = false;
    let reqDuration = false;

    const servicesList = services || [];
    if (servicesList.length > 0) {
      reqManuscript = servicesList.some(s => s && s.requires_manuscript);
      reqMaterials = servicesList.some(s => s && s.requires_materials);
      reqSignedContract = servicesList.some(s => s && s.requires_signed_contract);
      reqAgreementSent = servicesList.some(s => s && s.requires_agreement_sent);
      reqDuration = servicesList.some(s => s && s.requires_duration);
    } else {
      const cat = String(client.service_category || 'editorial').toLowerCase();
      if (cat === 'publicidad' || cat === 'difusión') {
        reqManuscript = false;
        reqMaterials = false;
        reqSignedContract = false;
        reqAgreementSent = true;
        reqDuration = true;
      } else if (cat === 'diseño' || cat === 'portada') {
        reqManuscript = false;
        reqMaterials = true;
        reqSignedContract = false;
        reqAgreementSent = true;
        reqDuration = false;
      } else if (cat === 'asesoría') {
        reqManuscript = false;
        reqMaterials = false;
        reqSignedContract = false;
        reqAgreementSent = true;
        reqDuration = true;
      }
    }

    const payStatus = String(client.payment_status || 'sin pago').toLowerCase();
    const isPaymentOk = payStatus === 'pagado' || payStatus === 'pago parcial' || !!client.partial_payment_authorized;
    
    const isAgreementSentOk = !reqAgreementSent || !!client.contract_sent;
    const isSignedContractOk = !reqSignedContract || !!client.contract_signed_received;
    const isManuscriptOk = !reqManuscript || !!client.files_received;
    const isMaterialsOk = !reqMaterials || !!client.materials_received;
    const isPeriodOk = !reqDuration || (client.service_start_date && client.service_duration_value);

    const isReady = isPaymentOk && isAgreementSentOk && isSignedContractOk && isManuscriptOk && isMaterialsOk && isPeriodOk;
    
    const reasons = [];
    if (!isPaymentOk) reasons.push("Falta pago o autorización parcial");
    if (!isAgreementSentOk) reasons.push("Falta enviar acuerdo");
    if (!isSignedContractOk) reasons.push("Falta contrato firmado");
    if (!isManuscriptOk) reasons.push("Falta manuscrito");
    if (!isMaterialsOk) reasons.push("Falta briefing/materiales");
    if (!isPeriodOk) reasons.push("Falta definir periodo");
    
    const reasonText = reasons.join(', ');

    // Determine status
    let nextStatus = client.status;
    if (isSignedContractOk && isManuscriptOk && isMaterialsOk) {
      if (isReady) {
        nextStatus = 'en proceso';
      } else {
        nextStatus = 'listo para iniciar';
      }
    }

    // Update client row
    await supabase
      .from('clients')
      .update({
        ready_to_start: isReady,
        ready_to_start_reason: reasonText,
        status: nextStatus
      })
      .eq('id', clientId);

  } catch (err) {
    console.error("Error in recalculateClientStartStatus:", err);
  }
};

/**
 * Recalculates service progress and updates status & stage properties
 * @param {string} serviceId - The UUID of the service
 */
export const recalculateServiceProgress = async (serviceId) => {
  if (!serviceId) return;

  try {
    // 1. Fetch service stages
    const { data: stages, error: err1 } = await supabase
      .from('service_stages')
      .select('*')
      .eq('service_id', serviceId);

    if (err1) throw err1;

    // Calculate progress
    const totalStages = (stages || []).length;
    const completedStages = (stages || []).filter(st => st.status === 'completada').length;
    const stage_progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
    const progress = stage_progress;

    // Determine current stage
    const sortedStages = [...(stages || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.id.localeCompare(b.id));
    const firstActiveStage = sortedStages.find(st => st.status !== 'completada');
    const current_stage = firstActiveStage 
      ? (firstActiveStage.name || firstActiveStage.stage_name) 
      : (sortedStages[sortedStages.length - 1]?.name || sortedStages[sortedStages.length - 1]?.stage_name || 'cerrado');

    // Update service
    await supabase
      .from('services')
      .update({
        progress,
        advance_percent: progress,
        stage_progress,
        current_stage
      })
      .eq('id', serviceId);

    // Sync events to agenda
    await syncStageEventsToAgenda(serviceId);

  } catch (err) {
    console.error("Error in recalculateServiceProgress:", err);
  }
};

/**
 * Synchronizes stage events for a service to the agenda_events table
 */
export const syncStageEventsToAgenda = async (serviceId) => {
  return; // Desactivado
  if (!serviceId) return;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const orgId = localStorage.getItem('somos_noveli_crm_org_id') || '11111111-1111-1111-1111-111111111111';
    
    // Attempt to get user ID
    let userId = 'mock-user-123';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || 'mock-user-123';
    } catch (_) {}

    const { data: service } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single();

    if (!service) return;

    const { data: stages } = await supabase
      .from('service_stages')
      .select('*')
      .eq('service_id', serviceId);

    const { data: existingEvents } = await supabase
      .from('agenda_events')
      .select('*')
      .eq('service_id', serviceId)
      .eq('type', 'etapa_servicio');

    for (const stage of (stages || [])) {
      const eventDate = stage.completed_at || stage.end_date || stage.started_at || stage.start_date;
      const stageName = stage.name || stage.stage_name;
      
      if (!eventDate) {
        const matchingEvent = (existingEvents || []).find(evt => evt.stage_id === stage.id);
        if (matchingEvent) {
          await supabase
            .from('agenda_events')
            .delete()
            .eq('id', matchingEvent.id);
        }
        continue;
      }

      let eventStatus = stage.status || 'pendiente';
      if (eventStatus !== 'completada' && eventDate < todayStr) {
        eventStatus = 'vencida';
      }

      const title = `${stageName} - ${service.book_title}`;
      const notes = stage.notes || '';

      const eventPayload = {
        user_id: userId,
        organization_id: orgId,
        service_id: serviceId,
        client_id: service.client_id || null,
        stage_id: stage.id,
        title: title,
        type: 'etapa_servicio',
        date: eventDate,
        status: eventStatus,
        notes: notes,
        description: notes,
        category: 'entrega'
      };

      const matchingEvent = (existingEvents || []).find(evt => evt.stage_id === stage.id);

      if (matchingEvent) {
        await supabase
          .from('agenda_events')
          .update(eventPayload)
          .eq('id', matchingEvent.id);
      } else {
        await supabase
          .from('agenda_events')
          .insert([eventPayload]);
      }
    }

    // Delete removed stages' events
    for (const evt of (existingEvents || [])) {
      const stillExists = (stages || []).some(st => st.id === evt.stage_id);
      if (!stillExists) {
        await supabase
          .from('agenda_events')
          .delete()
          .eq('id', evt.id);
      }
    }
  } catch (err) {
    console.error("Error in syncStageEventsToAgenda helper:", err);
  }
};

const ROLE_PERMISSIONS = {
  administrador: {
    modules: '*',
  },
  editor: {
    modules: [
      'dashboard', 'notifications', 'quotations', 'clients', 'prospects', 'seguimientos',
      'services', 'completed_sales', 'documents', 'catalog', 'packs', 'website', 
      'website-servicios', 'website-libros', 'website-configuracion', 'website-enlaces', 'website-secciones',
      'reports'
    ]
  },
  diseñador: {
    modules: [
      'dashboard', 'notifications', 'clients', 'prospects', 'seguimientos', 'services', 
      'completed_sales', 'documents', 'website', 
      'website-servicios', 'website-libros', 'website-configuracion', 'website-enlaces', 'website-secciones',
      'reports'
    ]
  },
  corrector: {
    modules: [
      'dashboard', 'notifications', 'clients', 'prospects', 'seguimientos', 'services', 
      'completed_sales', 'documents', 'website', 
      'website-servicios', 'website-libros', 'website-configuracion', 'website-enlaces', 'website-secciones',
      'reports'
    ]
  },
  contador: {
    modules: [
      'dashboard', 'notifications', 'clients', 'prospects', 'seguimientos', 'services', 'completed_sales', 
      'incomes', 'expenses', 'taxes', 'currency_rates', 'providers', 'staff', 'reserve',
      'reports'
    ]
  },
  'solo lectura': {
    modules: [
      'dashboard', 'notifications', 'quotations', 'clients', 'prospects', 'seguimientos',
      'services', 'completed_sales', 'documents', 'catalog', 'packs', 'website', 
      'website-servicios', 'website-libros', 'website-configuracion', 'website-enlaces', 'website-secciones',
      'reports'
    ]
  }
};

export { getCurrentOrganizationId, subscribeToOrganizationChanges };

export const getCurrentUserRole = () => {
  const userJson = localStorage.getItem('somos_noveli_crm_user');
  if (userJson) {
    try {
      const user = JSON.parse(userJson);
      if (user.role) return user.role.toLowerCase();
    } catch(e) {}
  }
  return (localStorage.getItem('somos_noveli_crm_role') || 'solo lectura').toLowerCase();
};

export const canAccessModule = (moduleKey) => {
  const role = getCurrentUserRole();
  if (role === 'admin' || role === 'administrador') return true;
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['solo lectura'];
  if (permissions.modules === '*') return true;
  return permissions.modules.includes(moduleKey);
};

export const canPerformAction = (moduleKey, action) => {
  const role = getCurrentUserRole();
  if (role === 'solo lectura') return false;
  if (role === 'admin' || role === 'administrador') return true;
  
  // For other roles, block write actions if they cannot access the module
  return canAccessModule(moduleKey);
};
