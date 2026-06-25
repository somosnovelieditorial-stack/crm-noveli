import { useEffect, useState } from 'react';
import { Calendar, Filter } from 'lucide-react';

export default function PeriodFilter({ onChange }) {
  const [mode, setMode] = useState('month'); // month, year, custom
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    triggerChange();
  }, [mode, selectedMonth, selectedYear, startDate, endDate]);

  const triggerChange = () => {
    onChange({
      mode,
      year: Number(selectedYear),
      month: Number(selectedMonth),
      startDate,
      endDate
    });
  };

  const monthsList = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const yearsList = [selectedYear - 2, selectedYear - 1, selectedYear, selectedYear + 1];

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between animate-fade-in shrink-0">
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
        <Filter className="w-4 h-4 text-brand-500" />
        <span className="text-xs font-bold uppercase tracking-wider">Período de Consulta</span>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
        {/* Mode Selector */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-850/50 text-xs w-full md:w-auto justify-center">
          <button
            type="button"
            onClick={() => setMode('month')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-all cursor-pointer ${mode === 'month' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xs' : 'text-slate-500 hover:text-slate-750'}`}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => setMode('year')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-all cursor-pointer ${mode === 'year' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xs' : 'text-slate-500 hover:text-slate-750'}`}
          >
            Anual
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-all cursor-pointer ${mode === 'custom' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xs' : 'text-slate-500 hover:text-slate-750'}`}
          >
            Personalizado
          </button>
        </div>

        {/* Dynamic Inputs */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {mode === 'month' && (
            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {monthsList.map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {yearsList.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {mode === 'year' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 w-full md:w-28"
            >
              {yearsList.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}

          {mode === 'custom' && (
            <div className="flex items-center gap-2 text-xs w-full md:w-auto justify-end">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-750 dark:text-slate-200 text-xs focus:outline-none"
              />
              <span className="text-slate-400">a</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-755 dark:text-slate-200 text-xs focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
