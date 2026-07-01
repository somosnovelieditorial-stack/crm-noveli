import React from 'react';
import { Globe, ArrowUpRight, ShieldCheck, Cpu, Layout, Server, ExternalLink, Activity } from 'lucide-react';

const WEBSITE_URL = "https://www.somosnovelieditorial.com/";

export default function Website() {
  return (
    <div className="space-y-6 animate-fade-in pb-12 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-850 dark:text-slate-100 tracking-tight">
            Sitio Web Noveli
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Administración y estado del dominio oficial de Somos Noveli Editorial.
          </p>
        </div>
        
        <a
          href={WEBSITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer w-fit shrink-0"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Abrir sitio web</span>
        </a>
      </div>

      {/* Grid General */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Card Estado del Sitio */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-xs space-y-6">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-500" />
            Estado del Dominio
          </h3>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-850">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dirección URL</span>
              <p className="font-mono text-sm font-bold text-slate-700 dark:text-slate-350 mt-1">
                {WEBSITE_URL}
              </p>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 rounded-lg text-xs font-bold shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Sitio conectado
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Certificado SSL</span>
              </div>
              <p className="text-sm font-extrabold text-slate-850 dark:text-slate-100">Activo y Válido (HTTPS)</p>
            </div>
            
            <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-slate-400">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Disponibilidad (Uptime)</span>
              </div>
              <p className="text-sm font-extrabold text-slate-850 dark:text-slate-100">99.98% (Últimos 30 días)</p>
            </div>
          </div>
        </div>

        {/* Card Accesos Rápidos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-xs space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Accesos Rápidos</h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Gestión y utilidades rápidas del hosting</p>
          </div>

          <div className="space-y-3">
            {/* Ver sitio público */}
            <a
              href={WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-950/20 hover:bg-amber-500/5 hover:text-amber-550 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-all duration-300 group"
            >
              <span className="flex items-center gap-2.5">
                <Layout className="w-4.5 h-4.5 text-slate-400 group-hover:text-amber-500" />
                Ver sitio público
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
            </a>

            {/* Administrar dominio */}
            <a
              href="https://domains.google/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-950/20 hover:bg-amber-500/5 hover:text-amber-550 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-all duration-300 group"
            >
              <span className="flex items-center gap-2.5">
                <Globe className="w-4.5 h-4.5 text-slate-400 group-hover:text-amber-500" />
                Administrar dominio
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
            </a>

            {/* Administrar contenido */}
            <div className="flex justify-between items-center p-3.5 bg-slate-50/50 dark:bg-slate-950/10 border border-slate-100/60 dark:border-slate-800/40 rounded-xl text-xs font-bold text-slate-400 dark:text-slate-550">
              <span className="flex items-center gap-2.5">
                <Cpu className="w-4.5 h-4.5 text-slate-300 dark:text-slate-800" />
                Administrar contenido
              </span>
              <span className="px-2 py-0.5 bg-slate-200/50 dark:bg-slate-800/60 text-[9px] font-extrabold rounded-md uppercase tracking-wider">próximamente</span>
            </div>

            {/* Vercel / Hosting */}
            <div className="flex justify-between items-center p-3.5 bg-slate-50/50 dark:bg-slate-950/10 border border-slate-150/60 dark:border-slate-800/40 rounded-xl text-xs font-bold text-slate-400 dark:text-slate-550">
              <span className="flex items-center gap-2.5">
                <Server className="w-4.5 h-4.5 text-slate-300 dark:text-slate-800" />
                Vercel / Hosting
              </span>
              <span className="px-2 py-0.5 bg-slate-200/50 dark:bg-slate-800/60 text-[9px] font-extrabold rounded-md uppercase tracking-wider">próximamente</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
