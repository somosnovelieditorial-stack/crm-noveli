import React from 'react';
import { AlertTriangle, Terminal, RefreshCw, Database } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.toString() || '';
      
      // Try to extract table or column names from Postgres/Supabase errors
      const tableMatch = errorMessage.match(/relation "([^"]+)"|table "([^"]+)"|relation '([^']+)'/i);
      const columnMatch = errorMessage.match(/column "([^"]+)"|column '([^']+)'|column ([a-zA-Z0-9_]+)/i);
      
      const tableName = tableMatch ? (tableMatch[1] || tableMatch[2] || tableMatch[3]) : 'Desconocida';
      const columnName = columnMatch ? (columnMatch[1] || columnMatch[2] || columnMatch[3]) : 'Desconocida';
      
      let suggestion = 'Ejecute la migración maestra "supabase_migration_schema_guard.sql" en su consola de Supabase para asegurarse de tener todas las columnas requeridas.';
      if (errorMessage.includes('RLS') || errorMessage.includes('policy')) {
        suggestion = 'Verifique las políticas de seguridad de Row Level Security (RLS) para este rol de usuario en Supabase.';
      }

      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100 font-sans">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
            
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
              <div className="p-3 bg-rose-950/40 text-rose-500 rounded-2xl border border-rose-900/50">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Auditoría del CRM: Error Detectado</h2>
                <p className="text-slate-400 text-xs mt-0.5">El CRM ha evitado una pantalla blanca capturando la falla en caliente.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 uppercase tracking-wider text-[9px] block">Módulo / Vista</span>
                  <span className="text-indigo-400 font-bold">{this.props.moduleName || 'Configuración/General'}</span>
                </div>
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 uppercase tracking-wider text-[9px] block">Tabla PostgreSQL</span>
                  <span className="text-indigo-400 font-bold font-mono">{tableName}</span>
                </div>
              </div>

              {columnName !== 'Desconocida' && (
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1 text-xs">
                  <span className="text-slate-500 uppercase tracking-wider text-[9px] block">Columna Afectada</span>
                  <span className="text-rose-455 font-bold font-mono">{columnName}</span>
                </div>
              )}

              <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                  <Terminal className="w-3.5 h-3.5 text-rose-550" />
                  <span>Error en tiempo de ejecución:</span>
                </div>
                <pre className="text-xs text-rose-400 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {errorMessage}
                </pre>
              </div>

              <div className="p-4 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl space-y-1.5 text-xs text-indigo-200">
                <div className="flex items-center gap-1.5 font-bold text-indigo-400 uppercase tracking-wider text-[9px]">
                  <Database className="w-3.5 h-3.5" />
                  <span>Sugerencia de Corrección:</span>
                </div>
                <p className="leading-relaxed">{suggestion}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md shadow-indigo-650/15"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recargar Aplicación
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
