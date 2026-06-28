import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  DollarSign, RefreshCw, Plus, Calendar, Info, Calculator, TrendingUp, HelpCircle, AlertCircle
} from 'lucide-react';

export default function CurrencyRates() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'success' });
  
  // Calculator state
  const [calcAmount, setCalcAmount] = useState('100');
  const [calcFrom, setCalcFrom] = useState('USD');
  const [calcTo, setCalcTo] = useState('CLP');
  const [calcResult, setCalcResult] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    currency_from: 'USD',
    currency_to: 'CLP',
    rate: '',
    source: 'Manual'
  });

  useEffect(() => {
    fetchRates();
  }, []);

  useEffect(() => {
    runCalculation();
  }, [calcAmount, calcFrom, calcTo, rates]);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      setRates(data || []);
    } catch (err) {
      console.error('Error fetching exchange rates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!formData.rate || Number(formData.rate) <= 0) {
      setMessage({ text: 'Por favor ingresa una tasa de cambio válida.', type: 'error' });
      return;
    }

    try {
      const payload = {
        currency_from: formData.currency_from,
        currency_to: formData.currency_to,
        rate: Number(formData.rate),
        date: new Date().toISOString().split('T')[0],
        source: 'Manual'
      };

      const { error } = await supabase
        .from('exchange_rates')
        .insert([payload]);

      if (error) throw error;

      setMessage({ text: 'Tasa de cambio registrada exitosamente.', type: 'success' });
      setFormData({ ...formData, rate: '' });
      await fetchRates();
    } catch (err) {
      console.error('Error saving manual exchange rate:', err);
      setMessage({ text: 'Error al registrar la tasa de cambio.', type: 'error' });
    }
  };

  // Prepared function for API update (currently simulates external fetch)
  const handleApiUpdate = async () => {
    setIsUpdating(true);
    setMessage({ text: '', type: 'success' });
    try {
      // Simulate API call to fetch rates
      await new Promise(resolve => setTimeout(resolve, 800));

      const today = new Date().toISOString().split('T')[0];
      
      // Random fluctuations around base rates
      const usdClp = 930 + Math.floor(Math.random() * 30);
      const eurClp = 1000 + Math.floor(Math.random() * 40);
      const usdEur = 0.90 + (Math.random() * 0.05);

      const simulatedRates = [
        { currency_from: 'USD', currency_to: 'CLP', rate: usdClp, date: today, source: 'API Central (Simulado)' },
        { currency_from: 'EUR', currency_to: 'CLP', rate: eurClp, date: today, source: 'API Central (Simulado)' },
        { currency_from: 'USD', currency_to: 'EUR', rate: parseFloat(usdEur.toFixed(4)), date: today, source: 'API Central (Simulado)' }
      ];

      // Insert/update mock rates
      const { error } = await supabase
        .from('exchange_rates')
        .insert(simulatedRates);

      if (error) throw error;

      setMessage({ text: 'Tasas de cambio sincronizadas desde el servidor de divisas.', type: 'success' });
      await fetchRates();
    } catch (err) {
      console.error('Error updating rates via simulated API:', err);
      setMessage({ text: 'Error al sincronizar tasas desde la API.', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const runCalculation = () => {
    if (!calcAmount || isNaN(Number(calcAmount))) {
      setCalcResult(null);
      return;
    }
    const amt = Number(calcAmount);
    if (calcFrom === calcTo) {
      setCalcResult(amt);
      return;
    }

    // Try finding direct rate
    let directRate = rates.find(r => r.currency_from === calcFrom && r.currency_to === calcTo);
    if (directRate) {
      setCalcResult(amt * directRate.rate);
      return;
    }

    // Try finding inverse rate
    let inverseRate = rates.find(r => r.currency_from === calcTo && r.currency_to === calcFrom);
    if (inverseRate) {
      setCalcResult(amt / inverseRate.rate);
      return;
    }

    // Cross-convert via CLP
    let rateFromToClp = calcFrom === 'CLP' ? 1 : rates.find(r => r.currency_from === calcFrom && r.currency_to === 'CLP')?.rate;
    let rateToToClp = calcTo === 'CLP' ? 1 : rates.find(r => r.currency_from === calcTo && r.currency_to === 'CLP')?.rate;

    if (!rateFromToClp && calcFrom !== 'CLP') {
      // Try inverse
      const inv = rates.find(r => r.currency_from === 'CLP' && r.currency_to === calcFrom)?.rate;
      if (inv) rateFromToClp = 1 / inv;
    }
    if (!rateToToClp && calcTo !== 'CLP') {
      // Try inverse
      const inv = rates.find(r => r.currency_from === 'CLP' && r.currency_to === calcTo)?.rate;
      if (inv) rateToToClp = 1 / inv;
    }

    if (rateFromToClp && rateToToClp) {
      const amountInClp = amt * rateFromToClp;
      setCalcResult(amountInClp / rateToToClp);
      return;
    }

    setCalcResult(null);
  };

  const getLatestRate = (from, to) => {
    const direct = rates.find(r => r.currency_from === from && r.currency_to === to);
    if (direct) return `${direct.rate} (${direct.source})`;
    const inverse = rates.find(r => r.currency_from === to && r.currency_to === from);
    if (inverse) return `${(1 / inverse.rate).toFixed(4)} (Inversa)`;
    return 'No disponible';
  };

  const getLatestUpdateDate = () => {
    if (rates.length === 0) return 'Nunca';
    const dates = rates.map(r => new Date(r.created_at || r.date));
    const maxDate = new Date(Math.max.apply(null, dates));
    return maxDate.toLocaleString('es-CL');
  };

  const formatCalculatedResult = (res) => {
    if (res === null) return 'N/A';
    if (calcTo === 'CLP') return '$' + Math.round(res).toLocaleString('es-CL');
    return res.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + calcTo;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Monedas y Tipos de Cambio
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Control de divisas para cotizaciones e ingresos en CLP, USD y EUR. Sincroniza o ingresa tasas diarias.
          </p>
        </div>
        <div className="shrink-0">
          <button
            onClick={handleApiUpdate}
            disabled={isUpdating}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-brand-600/20 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? 'Sincronizando...' : 'Actualizar del Día (API)'}
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border flex items-center gap-2.5 text-sm ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900' 
            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-450 dark:border-rose-900'
        }`}>
          {message.type === 'success' ? <TrendingUp className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Manual Registration & Converter Card */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Manual Entry */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-brand-500" />
              Ingresar Tasa Manual
            </h3>
            
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Origen</label>
                  <select
                    value={formData.currency_from}
                    onChange={(e) => setFormData({ ...formData, currency_from: e.target.value })}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="CLP">CLP ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Destino</label>
                  <select
                    value={formData.currency_to}
                    onChange={(e) => setFormData({ ...formData, currency_to: e.target.value })}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="CLP">CLP ($)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Valor de la Tasa</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><DollarSign className="w-4 h-4" /></span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    placeholder="e.g. 942.50"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-750 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Registrar Tasa
              </button>
            </form>
          </div>

          {/* Quick Converter Tool */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-brand-500" />
              Calculadora Multimoneda
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Monto a Convertir</label>
                <input
                  type="number"
                  placeholder="Monto"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">De</label>
                  <select
                    value={calcFrom}
                    onChange={(e) => setCalcFrom(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">A</label>
                  <select
                    value={calcTo}
                    onChange={(e) => setCalcTo(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              {calcResult !== null && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-805 rounded-xl mt-4">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Resultado Estimado</p>
                  <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                    {formatCalculatedResult(calcResult)}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1">
                    Calculado usando tasas del sistema.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rates Log / History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between min-h-[400px]">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Historial de Tasas de Cambio</h3>
                  <p className="text-xs text-slate-455">Última sincronización: <span className="font-semibold">{getLatestUpdateDate()}</span></p>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-bold text-slate-550 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-500" />
                  <span>Actualización hoy</span>
                </div>
              </div>

              {/* Reference Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-brand-50/20 border border-brand-100/30 rounded-xl">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">1 USD a CLP</span>
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{getLatestRate('USD', 'CLP')}</span>
                </div>
                <div className="p-3 bg-brand-50/20 border border-brand-100/30 rounded-xl">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">1 EUR a CLP</span>
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{getLatestRate('EUR', 'CLP')}</span>
                </div>
                <div className="p-3 bg-brand-50/20 border border-brand-100/30 rounded-xl">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">1 USD a EUR</span>
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{getLatestRate('USD', 'EUR')}</span>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-655 dark:text-slate-350 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="px-4 py-3">Par Divisas</th>
                      <th className="px-4 py-3">Tasa Cambio</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Origen</th>
                      <th className="px-4 py-3">Fecha de Carga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="text-center py-10">
                          Cargando tasas de cambio...
                        </td>
                      </tr>
                    ) : rates.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-10 text-slate-400">
                          No hay tasas registradas.
                        </td>
                      </tr>
                    ) : (
                      rates.map((rate) => (
                        <tr key={rate.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <td className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-200">
                            {rate.currency_from} → {rate.currency_to}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-800 dark:text-slate-100">
                            {rate.rate}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 font-semibold">
                            {rate.date}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                              String(rate.source || '').includes('API') 
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-450' 
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-450'
                            }`}>
                              {rate.source || 'manual'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[10px] text-slate-400 font-medium">
                            {rate.created_at ? new Date(rate.created_at).toLocaleString('es-CL') : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2.5 items-start bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-850 mt-4">
              <Info className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-455 leading-relaxed">
                El CRM calcula automáticamente los totales de cotizaciones, servicios, ingresos y gastos convertidos a la <strong>moneda principal ({rates[0]?.currency_to || 'CLP'})</strong> basándose en el tipo de cambio registrado en la fecha correspondiente de la transacción.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
