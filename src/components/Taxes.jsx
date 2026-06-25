import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatCurrency, calculateVatSplit, convertToClp, filterByPeriod, exportToCSV } from '../utils';
import PeriodFilter from './PeriodFilter';
import { 
  Percent, FileText, Info, Calendar, ArrowRight,
  TrendingUp, TrendingDown, DollarSign, Calculator, Download
} from 'lucide-react';

export default function Taxes() {
  const [loading, setLoading] = useState(true);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // Selection
  const [period, setPeriod] = useState({
    mode: 'month',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  // Computations
  const [report, setReport] = useState({
    vatSalesTotal: 0,     // Ventas con IVA
    vatSalesVat: 0,       // IVA Débito Estimado
    vatSalesNet: 0,       // Ingresos Netos con IVA
    
    vatExpensesTotal: 0,  // Gastos con IVA
    vatExpensesVat: 0,    // IVA Crédito Estimado
    vatExpensesNet: 0,    // Gastos Netos con IVA
    
    vatToPay: 0,          // IVA a pagar estimado = Débito - Crédito
    
    noVatSales: 0,        // Ingresos sin IVA (exento/honorario)
    totalExpenses: 0,     // Gastos totales (con y sin IVA)
    netExpensesTotal: 0,  // Gastos netos totales (deducibles netos + no deducibles totales)
    netIncomesTotal: 0,   // Ingresos netos totales (con IVA netos + sin IVA)
    estimatedUtility: 0   // Utilidad estimada = Ingresos Netos - Gastos Netos
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incomesRes, expensesRes] = await Promise.all([
        supabase.from('incomes').select('*'),
        supabase.from('expenses').select('*')
      ]);

      if (incomesRes.error) throw incomesRes.error;
      if (expensesRes.error) throw expensesRes.error;

      setIncomes(incomesRes.data || []);
      setExpenses(expensesRes.data || []);
    } catch (err) {
      console.error("Error loading tax data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateTaxes();
  }, [incomes, expenses, period]);

  const calculateTaxes = () => {
    if (incomes.length === 0 && expenses.length === 0) return;

    const periodIncomes = filterByPeriod(incomes, 'date', period);
    const periodExpenses = filterByPeriod(expenses, 'date', period);

    // 1. Incomes Math
    let vatSalesTotal = 0;
    let vatSalesVat = 0;
    let vatSalesNet = 0;
    let noVatSales = 0;

    periodIncomes.forEach(i => {
      const clpAmount = convertToClp(i.amount, i.currency);
      const split = calculateVatSplit(clpAmount, i.includes_vat);

      if (i.includes_vat) {
        vatSalesTotal += clpAmount;
        vatSalesNet += split.net;
        vatSalesVat += split.vat;
      } else {
        noVatSales += clpAmount;
      }
    });

    // 2. Expenses Math
    let vatExpensesTotal = 0; // Total expenses that include VAT
    let vatExpensesVat = 0;   // VAT Credit (only if includes_vat AND deductible)
    let vatExpensesNet = 0;   // Net of deductible expenses with VAT
    let totalExpenses = 0;    // Absolute sum of all expenses (CLP equivalent)
    let netExpensesTotal = 0; // Cumulative net expense cost

    periodExpenses.forEach(e => {
      const clpAmount = convertToClp(e.amount, e.currency);
      const split = calculateVatSplit(clpAmount, e.includes_vat);

      totalExpenses += clpAmount;

      if (e.includes_vat) {
        if (e.deductible) {
          vatExpensesTotal += clpAmount;
          vatExpensesNet += split.net;
          vatExpensesVat += split.vat;
          netExpensesTotal += split.net; // Net cost
        } else {
          // If it includes VAT but is not deductible:
          // Total amount acts as the net cost (cannot claim credit)
          netExpensesTotal += clpAmount;
        }
      } else {
        // No VAT expense:
        netExpensesTotal += clpAmount;
      }
    });

    const netIncomesTotal = vatSalesNet + noVatSales;
    const estimatedUtility = netIncomesTotal - netExpensesTotal;
    const vatToPay = vatSalesVat - vatExpensesVat;

    setReport({
      vatSalesTotal,
      vatSalesVat,
      vatSalesNet,
      vatExpensesTotal,
      vatExpensesVat,
      vatExpensesNet,
      vatToPay,
      noVatSales,
      totalExpenses,
      netExpensesTotal,
      netIncomesTotal,
      estimatedUtility
    });
  };

  const handleExportCSV = () => {
    const csvData = [
      {
        Concepto: 'Débito Fiscal - Ventas con IVA Facturadas',
        Monto: report.vatSalesTotal,
        Moneda: 'CLP',
        Detalle: 'Monto total bruto de ingresos facturados'
      },
      {
        Concepto: 'Débito Fiscal - Ingresos Netos con IVA',
        Monto: report.vatSalesNet,
        Moneda: 'CLP',
        Detalle: 'Monto neto sin el 19% de IVA'
      },
      {
        Concepto: 'Débito Fiscal - IVA Débito (19%)',
        Monto: report.vatSalesVat,
        Moneda: 'CLP',
        Detalle: 'IVA por pagar recaudado'
      },
      {
        Concepto: 'Crédito Fiscal - Gastos con IVA Deducibles',
        Monto: report.vatExpensesTotal,
        Moneda: 'CLP',
        Detalle: 'Monto total bruto de gastos operacionales deducibles'
      },
      {
        Concepto: 'Crédito Fiscal - Gastos Netos con IVA',
        Monto: report.vatExpensesNet,
        Moneda: 'CLP',
        Detalle: 'Monto neto deducible'
      },
      {
        Concepto: 'Crédito Fiscal - IVA Crédito (19%)',
        Monto: report.vatExpensesVat,
        Moneda: 'CLP',
        Detalle: 'IVA recuperable / crédito fiscal'
      },
      {
        Concepto: 'IVA Estimado a Pagar',
        Monto: report.vatToPay,
        Moneda: 'CLP',
        Detalle: 'IVA Débito - IVA Crédito'
      },
      {
        Concepto: 'Ingresos Exentos / Sin IVA',
        Monto: report.noVatSales,
        Moneda: 'CLP',
        Detalle: 'Ingresos sin IVA (honorarios u otros)'
      },
      {
        Concepto: 'Egresos Totales Operacionales (Con y Sin IVA)',
        Monto: report.totalExpenses,
        Moneda: 'CLP',
        Detalle: 'Suma de todos los gastos convertidos a CLP'
      },
      {
        Concepto: 'Total Gastos Netos (Costo Real)',
        Monto: report.netExpensesTotal,
        Moneda: 'CLP',
        Detalle: 'Gasto neto deducible + gasto no deducible'
      },
      {
        Concepto: 'Total Ingresos Netos (Ingreso Real)',
        Monto: report.netIncomesTotal,
        Moneda: 'CLP',
        Detalle: 'Ingreso neto facturado + ingreso exento'
      },
      {
        Concepto: 'Utilidad Estimada Comercial',
        Monto: report.estimatedUtility,
        Moneda: 'CLP',
        Detalle: 'Total Ingresos Netos - Total Gastos Netos'
      }
    ];

    exportToCSV(
      csvData,
      `impuestos_y_balances_${period.mode}_${period.year || ''}_${period.month || ''}`,
      ['Concepto', 'Monto', 'Moneda', 'Detalle']
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Impuestos y Balances
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Estimación mensual y anual de IVA y balance general de ingresos vs gastos netos.
          </p>
        </div>
        
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer w-fit"
        >
          <Download className="w-4 h-4" />
          Exportar Balance CSV
        </button>
      </div>

      {/* Period Filter Component */}
      <PeriodFilter onChange={setPeriod} />

      {/* Selectors and rules banner */}
      <div className="grid grid-cols-1 gap-6">
        {/* Rules Banner */}
        <div className="bg-slate-50 dark:bg-slate-950/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-start gap-4">
          <div className="p-2 bg-brand-500/10 text-brand-500 rounded-xl mt-1">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 w-full">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              Reglas de Cálculo Aplicadas
              <Info className="w-4 h-4 text-slate-400" />
            </h4>
            <div className="mb-2 p-3 bg-brand-50/30 dark:bg-brand-950/20 border border-brand-100/50 dark:border-brand-950/50 rounded-xl text-[11px] text-brand-700 dark:text-brand-300 font-semibold leading-relaxed">
              Reporte generado en base a CLP (Pesos Chilenos) como moneda tributaria principal. Montos en USD han sido convertidos para efectos de estimación local.
            </div>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>
                <strong>Ventas con IVA:</strong> Se separa el Neto e IVA débito usando tasa del <strong>19%</strong>. (Neto = Total / 1.19).
              </li>
              <li>
                <strong>Gastos con IVA:</strong> Solo si el gasto es <strong>Deducible</strong> se calcula el IVA Crédito. Si no es deducible, el IVA Crédito es 0 y el monto total es tratado como gasto neto.
              </li>
              <li>
                <strong>IVA Estimado a Pagar:</strong> Se resta el IVA Débito (Ventas) menos el IVA Crédito (Compras). (IVA = Débito - Crédito).
              </li>
              <li>
                <strong>Utilidad Estimada:</strong> Resta de todos los Ingresos Netos menos los Gastos Netos. (Utilidad = Ingresos Netos - Gastos Netos).
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Taxes (Debit) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-emerald-600 dark:text-emerald-400 text-sm uppercase tracking-wider flex items-center justify-between">
            <span>Débito Fiscal (Ventas)</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </h3>
          
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/60 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Ventas con IVA Facturadas</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(report.vatSalesTotal, 'CLP')}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/60 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Ingresos Netos con IVA</span>
              <span className="font-semibold text-slate-700 dark:text-slate-350">{formatCurrency(report.vatSalesNet, 'CLP')}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 text-sm">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">IVA Débito (19%)</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(report.vatSalesVat, 'CLP')}</span>
            </div>
          </div>
        </div>

        {/* Expenses Taxes (Credit) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-rose-600 dark:text-rose-400 text-sm uppercase tracking-wider flex items-center justify-between">
            <span>Crédito Fiscal (Gastos)</span>
            <TrendingDown className="w-5 h-5 text-rose-500" />
          </h3>
          
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/60 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Gastos con IVA Deducibles</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(report.vatExpensesTotal, 'CLP')}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/60 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Gastos Netos con IVA</span>
              <span className="font-semibold text-slate-700 dark:text-slate-350">{formatCurrency(report.vatExpensesNet, 'CLP')}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 text-sm">
              <span className="text-rose-600 dark:text-rose-400 font-semibold">IVA Crédito (19%)</span>
              <span className="font-extrabold text-rose-600 dark:text-rose-400">{formatCurrency(report.vatExpensesVat, 'CLP')}</span>
            </div>
          </div>
        </div>

        {/* Tax Estimate to Pay */}
        <div className="bg-slate-900 text-white rounded-2xl shadow-lg shadow-brand-950/20 p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl"></div>
          
          <div className="space-y-3">
            <h3 className="font-bold text-brand-300 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-brand-400" />
              Impuestos a Pagar
            </h3>
            
            <div className="pt-4 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-455 border-b border-slate-800 pb-2">
                <span>Débito (Débito Fiscal)</span>
                <span>{formatCurrency(report.vatSalesVat, 'CLP')}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-455 border-b border-slate-800 pb-2">
                <span>Crédito (IVA Crédito Deducible)</span>
                <span>- {formatCurrency(report.vatExpensesVat, 'CLP')}</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 mt-6 flex justify-between items-center">
            <span className="text-xs font-bold text-brand-350 uppercase">IVA Estimado a Pagar</span>
            <span className={`text-xl font-extrabold ${report.vatToPay >= 0 ? 'text-amber-455' : 'text-emerald-400'}`}>
              {formatCurrency(report.vatToPay, 'CLP')}
            </span>
          </div>
        </div>
      </div>

      {/* General Balance Sheet */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-500" />
          Balance Comercial (Ingresos Netos vs Gastos Netos)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
          
          {/* Income block */}
          <div className="space-y-3 pr-4">
            <h4 className="font-bold text-emerald-600 dark:text-emerald-400 text-xs uppercase tracking-wider">Ingresos Netos</h4>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Ingresos Netos con IVA</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(report.vatSalesNet, 'CLP')}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Ingresos sin IVA (Exento)</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(report.noVatSales, 'CLP')}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-t border-slate-100 dark:border-slate-800/80 font-bold text-slate-800 dark:text-slate-100">
              <span>Total Ingresos Netos</span>
              <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(report.netIncomesTotal, 'CLP')}</span>
            </div>
          </div>

          {/* Expenses block */}
          <div className="space-y-3 md:pl-6 pr-4 pt-4 md:pt-0">
            <h4 className="font-bold text-rose-600 dark:text-rose-400 text-xs uppercase tracking-wider">Egresos Operacionales</h4>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Gastos Netos Deducibles</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(report.vatExpensesNet, 'CLP')}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Gastos No Deducibles / Exentos</span>
              {/* Cost = Total expense CLP - Net Deducible CLP */}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(report.netExpensesTotal - report.vatExpensesNet, 'CLP')}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-t border-slate-100 dark:border-slate-800/80 font-bold text-slate-800 dark:text-slate-100">
              <span>Total Gastos Netos (Costo)</span>
              <span className="text-rose-600 dark:text-rose-400">{formatCurrency(report.netExpensesTotal, 'CLP')}</span>
            </div>
          </div>

          {/* Balance sheet summary */}
          <div className="space-y-4 md:pl-6 pt-4 lg:pt-0 col-span-1 md:col-span-2 lg:col-span-1">
            <h4 className="font-bold text-brand-600 dark:text-brand-400 text-xs uppercase tracking-wider">Balance del Período</h4>
            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex flex-col justify-between h-[100px]">
              <span className="text-xs text-slate-400 font-semibold uppercase">Utilidad Estimada</span>
              <span className={`text-xl font-extrabold ${report.estimatedUtility >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                {formatCurrency(report.estimatedUtility, 'CLP')}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              * Nota: La utilidad estimada corresponde al ingreso neto real (sin impuestos) menos el egreso real neto. Los valores presentados son proyecciones informativas.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
