import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatCurrency } from '../utils';
import { X, Plus, Trash, Check, AlertCircle, Info } from 'lucide-react';

export default function IncomeDistributionModal({ isOpen, onClose, income, onSave }) {
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  
  // Tax & VAT states
  const [taxMode, setTaxMode] = useState('iva'); // 'iva' | 'exento' | 'extranjero'
  const [ivaAmount, setIvaAmount] = useState(0);
  const [netPool, setNetPool] = useState(0);
  
  // Distribution rows
  const [distributions, setDistributions] = useState([]);
  
  // Available categories
  const categories = [
    { value: 'sueldos', label: 'Sueldos / Pagos a Personal' },
    { value: 'reserva', label: 'Reserva Operacional' },
    { value: 'publicidad', label: 'Publicidad Cliente' },
    { value: 'gastos_proyecto', label: 'Gastos del Proyecto' },
    { value: 'proveedores', label: 'Proveedores' },
    { value: 'impresion', label: 'Impresión' },
    { value: 'diseno', label: 'Diseño' },
    { value: 'maquetacion', label: 'Maquetación' },
    { value: 'correccion', label: 'Corrección' },
    { value: 'utilidad', label: 'Utilidad Disponible' },
    { value: 'otro', label: 'Otro Fondo' }
  ];

  // Fetch metadata
  useEffect(() => {
    if (isOpen && income) {
      fetchStaff();
      initializeDistribution();
    }
  }, [isOpen, income]);

  const fetchStaff = async () => {
    try {
      const { data } = await supabase.from('staff').select('*').eq('status', 'activo');
      setStaff(data || []);
    } catch (err) {
      console.error('Error fetching staff list:', err);
    }
  };

  const initializeDistribution = async () => {
    if (!income) return;
    
    // 1. Determine tax mode based on includes_vat and notes
    let initialTaxMode = 'exento';
    if (income.includes_vat) {
      initialTaxMode = 'iva';
    } else if (String(income.notes || '').toLowerCase().includes('extranjero') || String(income.notes || '').toLowerCase().includes('internacional')) {
      initialTaxMode = 'extranjero';
    }
    setTaxMode(initialTaxMode);

    // Calculate initial values
    const amt = Number(income.amount) || 0;
    let computedIva = 0;
    if (initialTaxMode === 'iva') {
      computedIva = amt - (amt / 1.19);
    }
    setIvaAmount(Math.round(computedIva));
    setNetPool(Math.round(amt - computedIva));

    // Fetch existing distributions
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('income_distributions')
        .select('*')
        .eq('income_id', income.id);

      if (!fetchErr && data && data.length > 0) {
        // Map saved rows
        setDistributions(data.map(d => ({
          id: d.id,
          category: d.distribution_type,
          amount: Number(d.amount) || 0,
          percentage: Number(d.percentage) || 0,
          type: d.percentage > 0 ? 'porcentaje' : 'monto',
          staff_id: d.category === 'sueldos' ? d.notes?.split(':')?.[1] || '' : '',
          payroll_status: d.status || 'pendiente',
          notes: d.notes || ''
        })));
      } else {
        // Default empty distribution row
        setDistributions([]);
      }
    } catch (err) {
      console.error('Error fetching existing distributions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Recalculate VAT when tax mode changes
  const handleTaxModeChange = (mode) => {
    setTaxMode(mode);
    const amt = Number(income.amount) || 0;
    let computedIva = 0;
    if (mode === 'iva') {
      computedIva = amt - (amt / 1.19);
    }
    const computedIvaRounded = Math.round(computedIva);
    const computedNet = Math.round(amt - computedIvaRounded);
    setIvaAmount(computedIvaRounded);
    setNetPool(computedNet);
  };

  // Distribution calculations
  const calculatedRows = distributions.map(d => {
    let computedAmt = 0;
    if (d.type === 'porcentaje') {
      computedAmt = netPool * (Number(d.percentage) / 100);
    } else {
      computedAmt = Number(d.amount);
    }
    return {
      ...d,
      computedAmount: Math.round(computedAmt)
    };
  });

  const totalDistributed = calculatedRows.reduce((sum, r) => sum + r.computedAmount, 0);
  const remainingAmount = netPool - totalDistributed;

  const handleAddRow = () => {
    setDistributions(prev => [
      ...prev,
      {
        id: 'new-' + Date.now() + Math.random(),
        category: 'utilidad',
        amount: 0,
        percentage: 0,
        type: 'porcentaje',
        staff_id: '',
        payroll_status: 'pendiente',
        notes: ''
      }
    ]);
  };

  const handleRemoveRow = (id) => {
    setDistributions(prev => prev.filter(r => r.id !== id));
  };

  const handleRowChange = (id, field, val) => {
    setDistributions(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: val };
      
      // Auto-clear staff selection if category changes away from sueldos
      if (field === 'category' && val !== 'sueldos') {
        updated.staff_id = '';
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    if (remainingAmount < -1) {
      setError('El monto total distribuido excede el Disponible real neto.');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const orgId = income.organization_id || await getValidOrgId();

      // 1. Clear pre-existing distributions and tax reservations
      await supabase.from('income_distributions').delete().eq('income_id', income.id);
      await supabase.from('income_tax_reservations').delete().eq('income_id', income.id);

      // 2. Insert tax reservation if mode is iva
      if (taxMode === 'iva' && ivaAmount > 0) {
        await supabase.from('income_tax_reservations').insert({
          organization_id: orgId,
          income_id: income.id,
          tax_type: 'iva',
          tax_rate: 19,
          taxable_amount: Math.round(income.amount / 1.19),
          tax_amount: ivaAmount,
          status: 'reservado',
          notes: 'IVA débito reservado automáticamente desde distribución inteligente.'
        });
      }

      // 3. Process distributions
      for (const row of calculatedRows) {
        // Create distribution record
        const { data: distData, error: distErr } = await supabase
          .from('income_distributions')
          .insert({
            organization_id: orgId,
            income_id: income.id,
            client_id: income.client_id || null,
            prospect_id: income.prospect_id || null,
            service_id: income.service_id || null,
            distribution_type: row.category,
            category: row.category,
            amount: row.computedAmount,
            percentage: row.type === 'porcentaje' ? row.percentage : null,
            status: row.category === 'sueldos' ? row.payroll_status : 'completado',
            notes: row.category === 'sueldos' ? `staff_id:${row.staff_id}` : row.notes,
            created_by: user?.id || null
          })
          .select();

        if (distErr) throw distErr;

        // 4. Handle client funds allocation (publicidad, impresion, diseno, correccion, etc.)
        const fundCategories = ['publicidad', 'impresion', 'diseno', 'correccion', 'reserva'];
        if (fundCategories.includes(row.category) && income.client_id) {
          // Fetch existing fund for client
          const { data: existingFunds } = await supabase
            .from('client_funds')
            .select('*')
            .eq('client_id', income.client_id)
            .eq('fund_type', row.category)
            .eq('organization_id', orgId);

          const fundName = `Fondo ${row.category} - ${income.clientName || 'Cliente'}`;
          
          if (existingFunds && existingFunds.length > 0) {
            const fund = existingFunds[0];
            const newAllocated = (Number(fund.allocated_amount) || 0) + row.computedAmount;
            const newBalance = (Number(fund.balance) || 0) + row.computedAmount;
            
            await supabase
              .from('client_funds')
              .update({
                allocated_amount: newAllocated,
                balance: newBalance,
                updated_at: new Date().toISOString()
              })
              .eq('id', fund.id);

            // Record fund movement
            await supabase.from('fund_movements').insert({
              organization_id: orgId,
              fund_id: fund.id,
              income_id: income.id,
              movement_type: 'ingreso',
              amount: row.computedAmount,
              concept: `Distribución de ingreso: ${income.concept || 'Pago Cliente'}`
            });
          } else {
            // Create new client fund
            const { data: newFund } = await supabase
              .from('client_funds')
              .insert({
                organization_id: orgId,
                client_id: income.client_id,
                service_id: income.service_id || null,
                fund_type: row.category,
                fund_name: fundName,
                initial_amount: 0,
                allocated_amount: row.computedAmount,
                used_amount: 0,
                balance: row.computedAmount,
                status: 'activo'
              })
              .select();

            if (newFund && newFund.length > 0) {
              await supabase.from('fund_movements').insert({
                organization_id: orgId,
                fund_id: newFund[0].id,
                income_id: income.id,
                movement_type: 'ingreso',
                amount: row.computedAmount,
                concept: `Distribución inicial de ingreso: ${income.concept || 'Pago Cliente'}`
              });
            }
          }
        }

        // 5. Handle staff payroll allocations
        if (row.category === 'sueldos' && row.staff_id) {
          // Create payroll payment record
          await supabase.from('payroll_payments').insert({
            organization_id: orgId,
            user_id: user?.id || null,
            staff_id: row.staff_id,
            amount: row.computedAmount,
            status: row.payroll_status, // 'pendiente' | 'parcial' | 'pagado'
            payment_date: new Date().toISOString().split('T')[0],
            notes: `Asignado desde ingreso #${income.id}. ${row.notes || ''}`
          });
        }
      }

      // 6. Log Activity
      await supabase.from('activity_log').insert({
        organization_id: orgId,
        user_id: user?.id || null,
        user_email: user?.email || 'sistema@somosnoveli.cl',
        module: 'finanzas',
        action: 'distribución',
        description: `Se distribuyó el ingreso de ${income.clientName || 'Cliente'} por ${formatCurrency(income.amount, income.currency)}`,
        entity_id: income.id
      });

      if (onSave) onSave();
      onClose();
    } catch (err) {
      console.error('Error saving income distributions:', err);
      setError('Error al guardar la distribución: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl p-6 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
              Distribución Inteligente de Ingreso
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cliente: <span className="font-semibold text-slate-700 dark:text-slate-350">{income?.clientName || 'Sin asignar'}</span> |
              Concepto: <span className="font-semibold text-slate-700 dark:text-slate-350">{income?.concept || 'Pago general'}</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-150 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
          
          {/* Summary Financial Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-850">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ingreso Bruto</span>
              <p className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(income?.amount || 0, income?.currency)}</p>
            </div>
            
            {/* VAT config selector inside Summary */}
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Impuesto / Afectación</span>
              <select
                value={taxMode}
                onChange={(e) => handleTaxModeChange(e.target.value)}
                className="block w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-1 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              >
                <option value="iva">Afecto a IVA (19%)</option>
                <option value="exento">Exento / Sin IVA</option>
                <option value="extranjero">Extranjero / Internacional</option>
              </select>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">IVA Reservado</span>
              <p className="text-lg font-bold text-rose-500">{formatCurrency(ivaAmount, income?.currency)}</p>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Disponible Real (Neto)</span>
              <p className="text-lg font-bold text-emerald-500">{formatCurrency(netPool, income?.currency)}</p>
            </div>
          </div>

          {/* Alert if mismatch */}
          {error && (
            <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs p-3 rounded-lg border border-rose-100 dark:border-rose-900">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Distribution list */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Distribución del Disponible</h4>
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:text-brand-500 border border-brand-200 dark:border-brand-900 px-2.5 py-1 rounded-lg hover:bg-brand-50/50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Destino
              </button>
            </div>

            {distributions.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                No se ha agregado ningún destino. Haz clic en "Agregar Destino" para distribuir los fondos.
              </div>
            ) : (
              <div className="space-y-3">
                {calculatedRows.map((row, idx) => (
                  <div 
                    key={row.id} 
                    className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-3 rounded-xl hover:shadow-sm transition-all"
                  >
                    {/* Area Select */}
                    <div className="flex-1 min-w-[150px]">
                      <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase">Destino / Fondo</span>
                      <select
                        value={row.category}
                        onChange={(e) => handleRowChange(row.id, 'category', e.target.value)}
                        className="block w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                      >
                        {categories.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Type select */}
                    <div className="w-[100px]">
                      <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase">Tipo</span>
                      <select
                        value={row.type}
                        onChange={(e) => handleRowChange(row.id, 'type', e.target.value)}
                        className="block w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                      >
                        <option value="porcentaje">Porcentaje</option>
                        <option value="monto">Monto Fijo</option>
                      </select>
                    </div>

                    {/* Value Input */}
                    <div className="w-[120px]">
                      <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase">
                        {row.type === 'porcentaje' ? 'Porcentaje (%)' : 'Valor'}
                      </span>
                      <input
                        type="number"
                        value={row.type === 'porcentaje' ? (row.percentage || '') : (row.amount || '')}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          if (row.type === 'porcentaje') {
                            handleRowChange(row.id, 'percentage', val);
                          } else {
                            handleRowChange(row.id, 'amount', val);
                          }
                        }}
                        className="block w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono text-right"
                      />
                    </div>

                    {/* Render helper fields if area is SUELDOS */}
                    {row.category === 'sueldos' && (
                      <>
                        <div className="flex-1 min-w-[150px]">
                          <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase">Colaborador</span>
                          <select
                            value={row.staff_id}
                            onChange={(e) => handleRowChange(row.id, 'staff_id', e.target.value)}
                            className="block w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                          >
                            <option value="">Seleccionar...</option>
                            {staff.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-[110px]">
                          <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase">Estado Pago</span>
                          <select
                            value={row.payroll_status}
                            onChange={(e) => handleRowChange(row.id, 'payroll_status', e.target.value)}
                            className="block w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="parcial">Parcial</option>
                            <option value="pagado">Pagado</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Calculated Amount */}
                    <div className="w-[120px] text-right pr-2">
                      <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase">Equivalente</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 font-mono">
                        {formatCurrency(row.computedAmount, income?.currency)}
                      </span>
                    </div>

                    {/* Delete button */}
                    <div className="flex items-end justify-end pb-0.5">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer info panel & Action buttons */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-xs flex gap-4 text-slate-600 dark:text-slate-400">
            <div>
              <span>Distribuido: </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totalDistributed, income?.currency)}</span>
            </div>
            <div>
              <span>Restante: </span>
              <span className={`font-mono font-bold ${remainingAmount < 0 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-100'}`}>
                {formatCurrency(remainingAmount, income?.currency)}
              </span>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-350 rounded-xl text-sm font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || remainingAmount < -1}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? 'Guardando...' : (
                <>
                  <Check className="w-4 h-4" /> Guardar Distribución
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
