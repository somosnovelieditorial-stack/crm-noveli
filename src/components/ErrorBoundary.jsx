import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-2xl mx-auto my-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-3 text-rose-500">
            <div className="p-2 bg-rose-50 dark:bg-rose-955/30 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-850 dark:text-slate-100">
                Ocurrió un error en esta sección
              </h3>
              <p className="text-xs text-slate-405">
                El componente no pudo renderizarse correctamente.
              </p>
            </div>
          </div>
          
          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850 text-xs font-mono text-slate-605 dark:text-slate-400 overflow-x-auto max-h-32">
            {this.state.error?.toString() || 'Error desconocido'}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/10 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recargar Sección</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
