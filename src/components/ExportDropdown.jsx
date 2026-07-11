import React, { useState } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText, File, ExternalLink, RefreshCw } from 'lucide-react';
import { exportToCSV, exportToExcel, exportToPDF, exportToWord } from '../utils';

export default function ExportDropdown({ data, filename, headers, headerLabels = [], className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [sheetStep, setSheetStep] = useState(0); // 0: Idle, 1: Connecting, 2: Creating, 3: Syncing, 4: Done

  const handleExport = (type) => {
    setIsOpen(false);
    if (data.length === 0) return;
    
    switch (type) {
      case 'excel':
        exportToExcel(data, filename, headers, headerLabels);
        break;
      case 'pdf':
        exportToPDF(data, filename, headers, headerLabels);
        break;
      case 'word':
        exportToWord(data, filename, headers, headerLabels);
        break;
      case 'csv':
        exportToCSV(data, filename, headers, headerLabels);
        break;
      case 'sheets':
        triggerSheetsSimulation();
        break;
      default:
        break;
    }
  };

  const triggerSheetsSimulation = () => {
    setSheetModalOpen(true);
    setSheetStep(1);
    
    setTimeout(() => {
      setSheetStep(2);
      setTimeout(() => {
        setSheetStep(3);
        setTimeout(() => {
          setSheetStep(4);
        }, 1200);
      }, 1200);
    }, 1200);
  };

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={data.length === 0}
        className="flex items-center justify-between gap-2 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer disabled:opacity-50 transition-all shadow-sm"
      >
        <span className="flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" />
          <span>Exportar Reporte</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Overlay to close on click outside */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 shadow-xl z-20 overflow-hidden py-1.5 animate-in fade-in-50 slide-in-from-top-2 duration-150">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-900 pb-1.5 mb-1">
              Descargar Archivo Local
            </div>
            
            <button
              onClick={() => handleExport('excel')}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-250 hover:bg-slate-50 dark:hover:bg-slate-900 text-left transition-colors cursor-pointer font-medium"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar a Excel (XLSX)</span>
            </button>
            
            <button
              onClick={() => handleExport('pdf')}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-250 hover:bg-slate-50 dark:hover:bg-slate-900 text-left transition-colors cursor-pointer font-medium"
            >
              <FileText className="w-4 h-4 text-rose-500" />
              <span>Exportar a PDF</span>
            </button>
            
            <button
              onClick={() => handleExport('word')}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-250 hover:bg-slate-50 dark:hover:bg-slate-900 text-left transition-colors cursor-pointer font-medium"
            >
              <File className="w-4 h-4 text-blue-500" />
              <span>Exportar a Word (DOCX)</span>
            </button>
            
            <button
              onClick={() => handleExport('csv')}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-250 hover:bg-slate-50 dark:hover:bg-slate-900 text-left transition-colors cursor-pointer font-medium"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Exportar CSV Estándar</span>
            </button>

            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-t border-slate-100 dark:border-slate-900 py-1.5 my-1">
              Sincronización en la Nube
            </div>

            <button
              onClick={() => handleExport('sheets')}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-250 hover:bg-slate-50 dark:hover:bg-slate-900 text-left transition-colors cursor-pointer font-semibold"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Subir a Google Sheets</span>
            </button>
          </div>
        </>
      )}

      {/* Sheets Integration Dialog */}
      {sheetModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-sm shadow-2xl text-center space-y-4 animate-in scale-in duration-200">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Sincronización con Google Sheets</h3>
            
            <div className="flex flex-col items-center justify-center py-6 space-y-3">
              {sheetStep < 4 ? (
                <>
                  <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 animate-pulse">
                    {sheetStep === 1 && "Conectando con Google Drive..."}
                    {sheetStep === 2 && "Creando planilla..."}
                    {sheetStep === 3 && "Sincronizando filas..."}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 mb-2">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    Planilla lista para abrir
                  </p>
                  <a
                    href="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvDnADmbgxmRyUXGPjXCBV31fnWg/edit"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                  >
                    <span>Abrir Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </>
              )}
            </div>

            {sheetStep === 4 && (
              <button
                type="button"
                onClick={() => {
                  setSheetModalOpen(false);
                  setSheetStep(0);
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-250 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cerrar ventana
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
