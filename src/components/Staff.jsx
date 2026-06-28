import { useEffect, useState } from 'react';
import { supabase, isMock, getValidOrgId } from '../supabaseClient';
import { 
  Users, DollarSign, Wallet, Plus, Trash2, Edit2, CheckCircle2, 
  AlertTriangle, Save, Calendar, UserPlus, CreditCard, ShieldAlert,
  ArrowUpRight, ArrowDownRight, RefreshCw, BarChart2
} from 'lucide-react';

export default function Staff({ defaultSubTab = 'members' }) {
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState(defaultSubTab);

  useEffect(() => {
    if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);
  
  // Staff states
  const [staffList, setStaffList] = useState([]);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({
    name: '',
    role: '',
    type: 'colaborador',
    agreed_payment: 0,
    currency: 'CLP',
    frequency: 'mensual',
    status: 'activo',
    notes: ''
  });

  // Payroll states
  const [payrollList, setPayrollList] = useState([]);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [payrollForm, setPayrollForm] = useState({
    staff_id: '',
    amount: 0,
    currency: 'CLP',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'transferencia',
    status: 'pendiente',
    notes: '',
    is_operational_expense: true
  });

  // Reserve states
  const [reserveMovements, setReserveMovements] = useState([]);
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [reserveForm, setReserveForm] = useState({
    type: 'entrada',
    amount: 0,
    currency: 'CLP',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Financial summary states
  const [totals, setTotals] = useState({
    incomes: 0,
    expenses: 0,
    payroll: 0,
    utility: 0,
    reserved: 0
  });

  const [message, setMessage] = useState({ text: '', type: 'success' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const orgId = await getValidOrgId();
      
      // Load staff list
      const staffRes = await supabase.from('staff').select('*').eq('organization_id', orgId);
      setStaffList(staffRes.data || []);

      // Load payroll list
      const payrollRes = await supabase.from('payroll_payments').select('*').eq('organization_id', orgId);
      const rawPayroll = payrollRes.data || [];
      
      // Populate staff names manually for mock/real safety
      const enrichedPayroll = rawPayroll.map(pay => {
        const member = (staffRes.data || []).find(s => s.id === pay.staff_id);
        return {
          ...pay,
          staff_name: member ? member.name : 'Desconocido',
          staff_role: member ? member.role : ''
        };
      });
      setPayrollList(enrichedPayroll);

      // Load reserve movements
      const reserveRes = await supabase.from('operational_reserve_movements').select('*').eq('organization_id', orgId);
      setReserveMovements(reserveRes.data || []);

      // Fetch Incomes & Expenses to calculate Operational Reserve
      const [incomesRes, expensesRes] = await Promise.all([
        supabase.from('incomes').select('amount, currency').eq('organization_id', orgId).eq('status', 'pagado'),
        supabase.from('expenses').select('amount, currency').eq('organization_id', orgId).eq('status', 'pagado')
      ]);

      // Calculate totals (convert to CLP for simple representation or keep separate, let's treat standard CLP sum for Somos Noveli)
      const totalIncomes = (incomesRes.data || []).reduce((acc, curr) => acc + (Number(curr.amount) * (curr.currency === 'USD' ? 940 : 1)), 0);
      const totalExpenses = (expensesRes.data || []).reduce((acc, curr) => acc + (Number(curr.amount) * (curr.currency === 'USD' ? 940 : 1)), 0);
      const totalPayroll = (payrollRes.data || [])
        .filter(p => p.status === 'pagado')
        .reduce((acc, curr) => acc + (Number(curr.amount) * (curr.currency === 'USD' ? 940 : 1)), 0);

      // Calculate operational reserve sum
      const totalReserveIn = (reserveRes.data || [])
        .filter(m => m.type === 'entrada' || m.type === 'ajuste')
        .reduce((acc, curr) => acc + (Number(curr.amount) * (curr.currency === 'USD' ? 940 : 1)), 0);
      const totalReserveOut = (reserveRes.data || [])
        .filter(m => m.type === 'salida')
        .reduce((acc, curr) => acc + (Number(curr.amount) * (curr.currency === 'USD' ? 940 : 1)), 0);
      
      const calculatedReserve = totalReserveIn - totalReserveOut;
      const calculatedUtility = totalIncomes - totalExpenses - totalPayroll;

      setTotals({
        incomes: totalIncomes,
        expenses: totalExpenses,
        payroll: totalPayroll,
        utility: calculatedUtility,
        reserved: calculatedReserve
      });

    } catch (err) {
      console.error("Error loading staff or reserve data:", err);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: 'success' }), 5000);
  };

  // Staff Handlers
  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({
      name: '',
      role: '',
      type: 'colaborador',
      agreed_payment: 0,
      currency: 'CLP',
      frequency: 'mensual',
      status: 'activo',
      notes: ''
    });
    setIsStaffModalOpen(true);
  };

  const handleOpenEditStaff = (member) => {
    setEditingStaff(member);
    setStaffForm({
      name: member.name,
      role: member.role,
      type: member.type,
      agreed_payment: member.agreed_payment,
      currency: member.currency,
      frequency: member.frequency,
      status: member.status,
      notes: member.notes || ''
    });
    setIsStaffModalOpen(true);
  };

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const orgId = await getValidOrgId();
      const payload = {
        ...staffForm,
        organization_id: orgId,
        agreed_payment: Number(staffForm.agreed_payment)
      };

      if (editingStaff) {
        const { error } = await supabase.from('staff').update(payload).eq('id', editingStaff.id);
        if (error) throw error;
        showMessage('Miembro del personal actualizado exitosamente.');
      } else {
        const { error } = await supabase.from('staff').insert([payload]);
        if (error) throw error;
        showMessage('Nuevo miembro del personal registrado exitosamente.');
      }
      setIsStaffModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error saving staff:", err);
      showMessage('Error al guardar personal.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = async (id) => {
    if (window.confirm("¿Estás seguro de eliminar a esta persona? Se eliminará su historial de sueldos.")) {
      try {
        const { error } = await supabase.from('staff').delete().eq('id', id);
        if (error) throw error;
        showMessage('Miembro del personal eliminado.');
        fetchData();
      } catch (err) {
        console.error("Error deleting staff:", err);
      }
    }
  };

  // Payroll Handlers
  const handleOpenAddPayroll = () => {
    setIsPayrollModalOpen(true);
    setPayrollForm({
      staff_id: staffList[0]?.id || '',
      amount: staffList[0]?.agreed_payment || 0,
      currency: staffList[0]?.currency || 'CLP',
      date: new Date().toISOString().split('T')[0],
      payment_method: 'transferencia',
      status: 'pendiente',
      notes: '',
      is_operational_expense: true
    });
  };

  const handlePayrollStaffChange = (staffId) => {
    const selected = staffList.find(s => s.id === staffId);
    if (selected) {
      setPayrollForm(prev => ({
        ...prev,
        staff_id: staffId,
        amount: selected.agreed_payment,
        currency: selected.currency
      }));
    }
  };

  const handlePayrollSubmit = async (e) => {
    e.preventDefault();
    if (!payrollForm.staff_id) {
      alert("Selecciona un miembro del personal.");
      return;
    }
    setIsSubmitting(true);
    try {
      const orgId = await getValidOrgId();
      const payload = {
        ...payrollForm,
        organization_id: orgId,
        amount: Number(payrollForm.amount)
      };

      const { error } = await supabase.from('payroll_payments').insert([payload]);
      if (error) throw error;
      showMessage('Pago a personal registrado exitosamente.');
      setIsPayrollModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error saving payroll payment:", err);
      showMessage('Error al registrar pago.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePayrollStatus = async (payment) => {
    const nextStatus = payment.status === 'pagado' ? 'pendiente' : 'pagado';
    try {
      const { error } = await supabase
        .from('payroll_payments')
        .update({ status: nextStatus })
        .eq('id', payment.id);
      if (error) throw error;
      showMessage(`Pago marcado como ${nextStatus}.`);
      fetchData();
    } catch (err) {
      console.error("Error toggling payroll status:", err);
    }
  };

  const handleDeletePayroll = async (id) => {
    if (window.confirm("¿Eliminar este registro de pago?")) {
      try {
        const { error } = await supabase.from('payroll_payments').delete().eq('id', id);
        if (error) throw error;
        showMessage('Registro de pago eliminado.');
        fetchData();
      } catch (err) {
        console.error("Error deleting payroll payment:", err);
      }
    }
  };

  // Reserve Handlers
  const handleOpenAddReserve = () => {
    setIsReserveModalOpen(true);
    setReserveForm({
      type: 'entrada',
      amount: 0,
      currency: 'CLP',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
  };

  const handleReserveSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const orgId = await getValidOrgId();
      const payload = {
        ...reserveForm,
        organization_id: orgId,
        amount: Number(reserveForm.amount)
      };

      const { error } = await supabase.from('operational_reserve_movements').insert([payload]);
      if (error) throw error;
      showMessage('Movimiento de reserva operacional registrado.');
      setIsReserveModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error saving reserve movement:", err);
      showMessage('Error al registrar movimiento.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReserve = async (id) => {
    if (window.confirm("¿Eliminar este movimiento de reserva?")) {
      try {
        const { error } = await supabase.from('operational_reserve_movements').delete().eq('id', id);
        if (error) throw error;
        showMessage('Movimiento de reserva eliminado.');
        fetchData();
      } catch (err) {
        console.error("Error deleting reserve movement:", err);
      }
    }
  };

  const formatCurrency = (val, currency = 'CLP') => {
    if (currency === 'CLP') {
      return '$' + Math.round(val).toLocaleString('es-CL');
    }
    return 'US$ ' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading && staffList.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Personal y Reserva Operacional
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Gestiona fundadores, colaboradores, pagos recurrentes y la reserva operacional de Somos Noveli.
          </p>
        </div>

        <div className="flex gap-2">
          {activeSubTab === 'members' && (
            <button 
              onClick={handleOpenAddStaff}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-xs transition-all shadow-md cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Nuevo Personal
            </button>
          )}
          {activeSubTab === 'payroll' && (
            <button 
              onClick={handleOpenAddPayroll}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-xs transition-all shadow-md cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              Registrar Pago
            </button>
          )}
          {activeSubTab === 'reserve' && (
            <button 
              onClick={handleOpenAddReserve}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-xs transition-all shadow-md cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              Registrar Movimiento
            </button>
          )}
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border flex items-center gap-2.5 text-sm ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900' 
            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-450 dark:border-rose-900'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveSubTab('members')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'members' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-450' 
              : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Personal</span>
        </button>
        <button
          onClick={() => setActiveSubTab('payroll')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'payroll' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-450' 
              : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> Sueldos y Pagos</span>
        </button>
        <button
          onClick={() => setActiveSubTab('reserve')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'reserve' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-450' 
              : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          <span className="flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Reserva Operacional</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeSubTab === 'members' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-850">
                  <th className="p-4">Nombre</th>
                  <th className="p-4">Rol / Cargo</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Pago Acordado</th>
                  <th className="p-4">Frecuencia</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-400">No hay personal registrado.</td>
                  </tr>
                ) : (
                  staffList.map(member => (
                    <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{member.name}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">{member.role}</td>
                      <td className="p-4 capitalize">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          member.type === 'fundador' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30' :
                          member.type === 'colaborador' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30' :
                          'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/30'
                        }`}>
                          {member.type}
                        </span>
                      </td>
                      <td className="p-4 font-bold">{formatCurrency(member.agreed_payment, member.currency)}</td>
                      <td className="p-4 capitalize">{member.frequency}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          member.status === 'activo' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {member.status}
                        </span>
                      </td>
                      <td className="p-4 flex items-center gap-2">
                        <button 
                          onClick={() => handleOpenEditStaff(member)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-500 rounded transition-all cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteStaff(member.id)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-500 rounded transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'payroll' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-850">
                  <th className="p-4">Nombre</th>
                  <th className="p-4">Rol / Cargo</th>
                  <th className="p-4">Monto Pagado</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Método</th>
                  <th className="p-4">Gasto Operacional</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {payrollList.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-400">No hay registros de pago.</td>
                  </tr>
                ) : (
                  payrollList.map(pay => (
                    <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{pay.staff_name}</td>
                      <td className="p-4 text-slate-500">{pay.staff_role}</td>
                      <td className="p-4 font-bold">{formatCurrency(pay.amount, pay.currency)}</td>
                      <td className="p-4">{pay.date}</td>
                      <td className="p-4 capitalize">{pay.payment_method}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          pay.is_operational_expense ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-slate-50 text-slate-655 border border-slate-200'
                        }`}>
                          {pay.is_operational_expense ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleTogglePayrollStatus(pay)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                            pay.status === 'pagado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-850'
                          }`}
                        >
                          {pay.status}
                        </button>
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => handleDeletePayroll(pay.id)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-500 rounded transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'reserve' && (
        <div className="space-y-6">
          {/* Operational Reserve Metrics Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ingresos Totales (CLP Equivalent)</span>
              <p className="text-xl font-black mt-1.5 text-emerald-600">{formatCurrency(totals.incomes)}</p>
            </div>
            
            <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gastos Generales</span>
              <p className="text-xl font-black mt-1.5 text-rose-600">{formatCurrency(totals.expenses)}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sueldos Pagados</span>
              <p className="text-xl font-black mt-1.5 text-rose-500">{formatCurrency(totals.payroll)}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Utilidad Neta Estimada</span>
              <p className={`text-xl font-black mt-1.5 ${totals.utility >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formatCurrency(totals.utility)}
              </p>
            </div>

            <div className="bg-brand-600 text-white p-4.5 rounded-2xl shadow-md shadow-brand-600/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-100">Reserva Operacional Noveli</span>
              <p className="text-xl font-black mt-1.5">{formatCurrency(totals.reserved)}</p>
              <span className="text-[9px] text-brand-200 block mt-1 font-semibold">
                Sugerido (15% utilidad): {formatCurrency(totals.utility > 0 ? totals.utility * 0.15 : 0)}
              </span>
            </div>
          </div>

          {/* Reserve Movements History */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-brand-500" /> Historial de Movimientos de Reserva
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-850">
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Monto</th>
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Detalle / Notas</th>
                    <th className="p-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {reserveMovements.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-400">No hay movimientos registrados.</td>
                    </tr>
                  ) : (
                    reserveMovements.map(move => (
                      <tr key={move.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                        <td className="p-4 capitalize">
                          <span className={`flex items-center gap-1 font-bold ${
                            move.type === 'entrada' ? 'text-emerald-600' :
                            move.type === 'salida' ? 'text-rose-600' : 'text-blue-600'
                          }`}>
                            {move.type === 'entrada' ? <ArrowUpRight className="w-3.5 h-3.5" /> :
                             move.type === 'salida' ? <ArrowDownRight className="w-3.5 h-3.5" /> :
                             <RefreshCw className="w-3.5 h-3.5" />}
                            {move.type}
                          </span>
                        </td>
                        <td className="p-4 font-bold">{formatCurrency(move.amount, move.currency)}</td>
                        <td className="p-4">{move.date}</td>
                        <td className="p-4 text-slate-500">{move.notes || 'Ajuste de Reserva'}</td>
                        <td className="p-4">
                          <button 
                            onClick={() => handleDeleteReserve(move.id)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-500 rounded transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Staff Add/Edit Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Users className="w-5 h-5 text-brand-500" />
              {editingStaff ? 'Editar Ficha Personal' : 'Registrar Miembro del Personal'}
            </h3>

            <form onSubmit={handleStaffSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Rol / Cargo</label>
                <input
                  type="text"
                  required
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  placeholder="ej. Editor General, Diseñador, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Tipo de Miembro</label>
                  <select
                    value={staffForm.type}
                    onChange={(e) => setStaffForm({ ...staffForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  >
                    <option value="fundador">Fundador</option>
                    <option value="colaborador">Colaborador</option>
                    <option value="proveedor recurrente">Proveedor Recurrente</option>
                    <option value="externo">Externo</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-400 mb-1">Frecuencia de Pago</label>
                  <select
                    value={staffForm.frequency}
                    onChange={(e) => setStaffForm({ ...staffForm, frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  >
                    <option value="mensual">Mensual</option>
                    <option value="proyecto">Por Proyecto</option>
                    <option value="único">Pago Único</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-400 mb-1">Monto Acordado</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={staffForm.agreed_payment}
                    onChange={(e) => setStaffForm({ ...staffForm, agreed_payment: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Moneda</label>
                  <select
                    value={staffForm.currency}
                    onChange={(e) => setStaffForm({ ...staffForm, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  >
                    <option value="CLP">CLP ($)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Estado</label>
                  <select
                    value={staffForm.status}
                    onChange={(e) => setStaffForm({ ...staffForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Notas</label>
                <textarea
                  rows="2"
                  value={staffForm.notes}
                  onChange={(e) => setStaffForm({ ...staffForm, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  placeholder="Detalles sobre contrato o responsabilidades..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Guardando...' : 'Guardar Ficha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payroll Modal */}
      {isPayrollModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <CreditCard className="w-5 h-5 text-brand-500" />
              Registrar Pago a Personal
            </h3>

            <form onSubmit={handlePayrollSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Miembro del Personal</label>
                <select
                  value={payrollForm.staff_id}
                  onChange={(e) => handlePayrollStaffChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                >
                  <option value="" disabled>Selecciona una persona...</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-400 mb-1">Monto del Pago</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={payrollForm.amount}
                    onChange={(e) => setPayrollForm({ ...payrollForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Moneda</label>
                  <select
                    value={payrollForm.currency}
                    onChange={(e) => setPayrollForm({ ...payrollForm, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  >
                    <option value="CLP">CLP ($)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={payrollForm.date}
                    onChange={(e) => setPayrollForm({ ...payrollForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-400 mb-1">Método de Pago</label>
                  <select
                    value={payrollForm.payment_method}
                    onChange={(e) => setPayrollForm({ ...payrollForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  >
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="paypal">PayPal</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Estado</label>
                  <select
                    value={payrollForm.status}
                    onChange={(e) => setPayrollForm({ ...payrollForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="pagado">Pagado</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={payrollForm.is_operational_expense}
                      onChange={(e) => setPayrollForm({ ...payrollForm, is_operational_expense: e.target.checked })}
                      className="rounded text-brand-500 focus:ring-brand-500"
                    />
                    <span>Gasto Operacional</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Notas / Detalle</label>
                <textarea
                  rows="2"
                  value={payrollForm.notes}
                  onChange={(e) => setPayrollForm({ ...payrollForm, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  placeholder="ej. Sueldo correspondiente a Junio 2026..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPayrollModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Registrando...' : 'Registrar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reserve Movement Modal */}
      {isReserveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Wallet className="w-5 h-5 text-brand-500" />
              Registrar Movimiento de Reserva
            </h3>

            <form onSubmit={handleReserveSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Tipo de Movimiento</label>
                  <select
                    value={reserveForm.type}
                    onChange={(e) => setReserveForm({ ...reserveForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  >
                    <option value="entrada">Entrada</option>
                    <option value="salida">Salida</option>
                    <option value="ajuste">Ajuste Manual</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-400 mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={reserveForm.date}
                    onChange={(e) => setReserveForm({ ...reserveForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-400 mb-1">Monto del Movimiento</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={reserveForm.amount}
                    onChange={(e) => setReserveForm({ ...reserveForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Moneda</label>
                  <select
                    value={reserveForm.currency}
                    onChange={(e) => setReserveForm({ ...reserveForm, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  >
                    <option value="CLP">CLP ($)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Notas / Detalle del Movimiento</label>
                <textarea
                  rows="2"
                  value={reserveForm.notes}
                  onChange={(e) => setReserveForm({ ...reserveForm, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-250 text-sm focus:outline-none"
                  placeholder="ej. Provisión de reserva del 10% de utilidad de Junio..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReserveModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Registrando...' : 'Registrar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
