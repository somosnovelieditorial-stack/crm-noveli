import { supabase, getValidOrgId } from './supabaseClient';
import { formatCurrency } from './utils';

// Helper to record errors in crm_error_logs table
export const recordError = async (message, stack = '', moduleName = 'general') => {
  try {
    await supabase.from('crm_error_logs').insert({
      error_message: message,
      error_stack: stack,
      module: moduleName,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to write to crm_error_logs:', err);
  }
};

// Helper to log user/system activity in activity_log
export const logActivity = async ({ moduleName, action, description, entityId = null, organizationId = null }) => {
  try {
    const orgId = organizationId || await getValidOrgId();
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('activity_log').insert({
      organization_id: orgId,
      user_id: user?.id || '11111111-1111-1111-1111-111111111111',
      user_email: user?.email || 'sistema@somosnoveli.cl',
      date: new Date().toISOString(),
      module: moduleName,
      action,
      description,
      entity_id: entityId
    });
  } catch (err) {
    console.error('Failed to write to activity_log:', err);
    await recordError('Failed to write to activity_log: ' + err.message, err.stack, 'activity_log');
  }
};

// Helper to create an automatic income record
export const createAutoIncome = async ({
  client_id = null,
  prospect_id = null,
  service_id = null,
  amount,
  currency = 'CLP',
  payment_method = 'transferencia',
  concept,
  source_type, // 'client_payment' | 'prospect_payment' | 'service_payment' | 'manual_income'
  notes = '',
  includes_vat = false,
  organization_id = null
}) => {
  try {
    const orgId = organization_id || await getValidOrgId();
    const { data: { user } } = await supabase.auth.getUser();

    // Check if duplicate auto income exists to avoid duplicate entries
    let checkQuery = supabase.from('incomes').select('*').eq('source_type', source_type);
    if (client_id && source_type === 'client_payment') {
      checkQuery = checkQuery.eq('client_id', client_id);
    } else if (prospect_id && source_type === 'prospect_payment') {
      checkQuery = checkQuery.eq('prospect_id', prospect_id);
    } else if (service_id && source_type === 'service_payment') {
      checkQuery = checkQuery.eq('service_id', service_id);
    } else {
      checkQuery = checkQuery.eq('concept', concept).eq('amount', Number(amount));
    }

    const { data: existing, error: checkErr } = await checkQuery;
    if (checkErr) throw checkErr;

    if (existing && existing.length > 0) {
      console.log('Auto income already exists:', existing[0]);
      return existing[0];
    }

    const valConverted = Number(amount) * (currency === 'USD' ? 940 : 1);

    const payload = {
      organization_id: orgId,
      user_id: user?.id || '11111111-1111-1111-1111-111111111111',
      client_id: client_id || null,
      service_id: service_id || null,
      amount: Number(amount) || 0,
      currency,
      exchange_rate: currency === 'USD' ? 940 : 1,
      value_converted: valConverted,
      rate_date: new Date().toISOString().split('T')[0],
      date: new Date().toISOString().split('T')[0],
      payment_date: new Date().toISOString().split('T')[0],
      payment_method,
      includes_vat,
      status: 'pagado',
      notes: notes || `Ingreso automático por pago del ${source_type.replace('_', ' ')}.`,
      source_type
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('incomes')
      .insert([payload])
      .select();

    if (insertErr) throw insertErr;

    const newIncome = inserted?.[0];
    if (newIncome) {
      await logActivity({
        moduleName: 'finanzas',
        action: 'creación_automatica',
        description: `Se registró ingreso automático de ${formatCurrency(amount, currency)} (${concept})`,
        entityId: newIncome.id,
        organizationId: orgId
      });
    }

    return newIncome;
  } catch (err) {
    console.error('Error in createAutoIncome:', err);
    await recordError(err.message || 'Error en createAutoIncome', err.stack, 'finanzas');
    throw err;
  }
};

// Deducts an expense from a client's fund, maintaining balance and registering fund movements
export const deductExpenseFromFund = async ({
  client_id,
  fund_type, // 'publicidad' | 'impresion' | 'diseno' | 'correccion' | 'reserva' | 'otro'
  amount,
  concept,
  notes = '',
  expense_id = null,
  service_id = null
}) => {
  try {
    const orgId = await getValidOrgId();
    
    // 1. Fetch the corresponding fund
    const { data: funds, error: fetchErr } = await supabase
      .from('client_funds')
      .select('*')
      .eq('client_id', client_id)
      .eq('fund_type', fund_type)
      .eq('organization_id', orgId);

    if (fetchErr) throw fetchErr;

    if (!funds || funds.length === 0) {
      throw new Error(`No se encontró fondo de tipo "${fund_type}" para este cliente.`);
    }

    const fund = funds[0];
    const currentBalance = Number(fund.balance) || 0;
    const currentUsed = Number(fund.used_amount) || 0;

    const newBalance = currentBalance - Number(amount);
    const newUsed = currentUsed + Number(amount);

    // 2. Update fund balance
    const { error: updateErr } = await supabase
      .from('client_funds')
      .update({
        balance: newBalance,
        used_amount: newUsed,
        updated_at: new Date().toISOString()
      })
      .eq('id', fund.id);

    if (updateErr) throw updateErr;

    // 3. Register fund movement
    const { data: mv, error: mvErr } = await supabase
      .from('fund_movements')
      .insert({
        organization_id: orgId,
        fund_id: fund.id,
        expense_id: expense_id,
        movement_type: 'gasto',
        amount: Number(amount),
        concept: concept || 'Gasto descontado del fondo',
        notes: notes || `Fondo restante: ${formatCurrency(newBalance, 'CLP')}`
      })
      .select();

    if (mvErr) throw mvErr;

    await logActivity({
      moduleName: 'finanzas',
      action: 'descuento_fondo',
      description: `Se descontaron ${formatCurrency(amount, 'CLP')} del fondo ${fund_type} del cliente`,
      entityId: fund.id,
      organizationId: orgId
    });

    return { success: true, newBalance };
  } catch (err) {
    console.error('Error in deductExpenseFromFund:', err);
    await recordError(err.message || 'Error en deductExpenseFromFund', err.stack, 'finanzas');
    throw err;
  }
};
