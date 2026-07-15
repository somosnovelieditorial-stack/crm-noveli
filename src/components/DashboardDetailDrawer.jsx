import React, { useEffect } from 'react';
import { X, ArrowUpRight, AlertCircle, FileText } from 'lucide-react';

export default function DashboardDetailDrawer({
  isOpen,
  onClose,
  detail
}) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (!detail) return null;

  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  const columns = Array.isArray(detail.columns) ? detail.columns || detail.headers : [];
  const title = detail.title || '';
  const subtitle = detail.subtitle || detail.description || '';
  const metricValue = detail.value !== undefined ? detail.value : detail.metricValue;
  const formula = detail.formula || null;
  const emptyMessage = detail.emptyMessage || 'No hay registros para este periodo';
  const moduleLink = detail.moduleLink || detail.modulePath || null;

  const navigateToModule = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    if (onClose) onClose();
  };

  const handleCSVExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    if (detail.sections) {
      const parts = [];
      detail.sections.forEach(sec => {
        parts.push(`"${sec.title}"`);
        parts.push(sec.headers.join(","));
        sec.rows.forEach(r => {
          parts.push(r.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(","));
        });
        parts.push("");
      });
      csvContent += parts.join("\n");
    } else {
      if (!rows.length) return;
      csvContent += [columns.join(","), ...rows.map(r => r.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(","))].join("\n");
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.toLowerCase().replace(/\s+/g, '_')}_detalle.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-350 ease-out text-xs">
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
              {title}
            </h3>
            <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-1">{subtitle}</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Metric Accent Card */}
          {metricValue !== undefined && metricValue !== null && (
            <div className="p-5 bg-gradient-to-br from-indigo-50/40 to-slate-50/50 dark:from-slate-850/40 dark:to-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Valor Actual de la Métrica</span>
              <div className="text-3xl font-extrabold text-slate-850 dark:text-indigo-400 mt-1.5 tracking-tight">
                {metricValue}
              </div>
            </div>
          )}

          {/* Formula panel (if any) */}
          {formula && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Fórmula de Cálculo</span>
              <p className="font-mono text-[11px] text-indigo-700 dark:text-indigo-400 font-bold bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-150/60 dark:border-slate-850">
                {formula}
              </p>
            </div>
          )}

          {/* Records Table or Grouped Sections */}
          {detail.sections ? (
            <div className="space-y-6">
              {detail.sections.map((section, sIdx) => {
                const sRows = Array.isArray(section.rows) ? section.rows : [];
                const sHeaders = Array.isArray(section.headers) ? section.headers : [];
                return (
                  <div key={sIdx} className="space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-1.5">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{section.title}</span>
                      <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                        {sRows.length}
                      </span>
                    </div>
                    {sRows.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px] py-1 pl-1">No hay ingresos en esta categoría.</p>
                    ) : (
                      <div className="border border-slate-150 dark:border-slate-850 rounded-xl overflow-hidden shadow-2xs">
                        <div className="overflow-x-auto max-h-[30vh]">
                          <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-850 sticky top-0 z-10">
                                {sHeaders.map((col, idx) => (
                                  <th key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-950">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                              {sRows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-colors">
                                  {row.map((val, cIdx) => (
                                    <td key={cIdx} className="p-2.5 font-medium text-slate-700 dark:text-slate-300">{val}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Registros Detallados</span>
                <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                  {rows.length} {rows.length === 1 ? 'registro' : 'registros'}
                </span>
              </div>
              
              {rows.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-semibold bg-slate-50 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center gap-2">
                  <AlertCircle className="w-7 h-7 text-slate-350" />
                  <span>{emptyMessage}</span>
                </div>
              ) : (
                <div className="border border-slate-150 dark:border-slate-850 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto max-h-[45vh]">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-850 sticky top-0 z-10">
                          {columns.map((col, idx) => (
                            <th key={idx} className="p-3 bg-slate-50 dark:bg-slate-950">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                        {rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-colors">
                            {row.map((val, cIdx) => (
                              <td key={cIdx} className="p-3 font-medium text-slate-700 dark:text-slate-300">{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/30 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-3">
          <div className="flex gap-2">
            {moduleLink && (
              <button
                onClick={() => navigateToModule(moduleLink)}
                className="px-4 py-2 border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-650 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1.5"
              >
                Ver módulo completo
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
            {(rows.length > 0 || (detail.sections && detail.sections.some(s => s.rows && s.rows.length > 0))) && (
              <button
                onClick={handleCSVExport}
                className="px-4 py-2 border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-655 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1"
              >
                Exportar detalle CSV
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[11px] font-bold cursor-pointer transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
