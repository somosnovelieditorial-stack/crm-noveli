import { CheckCircle, Clock, Settings, ShieldAlert, Sparkles } from 'lucide-react';

export default function Integrations() {
  const integrationList = [
    {
      name: "Google Calendar",
      description: "Sincroniza de forma automática las fechas límite de entrega estimada de servicios y fechas de seguimiento programadas para prospectos directamente en tu calendario de Google.",
      features: [
        "Recordatorios automáticos de entrega",
        "Agenda de llamadas de seguimiento de leads",
        "Bloqueo de horas para reuniones de asesoría"
      ],
      status: "coming_soon"
    },
    {
      name: "Google Drive",
      description: "Generación automática de carpetas dedicadas por autor. Sube y respalda manuscritos corregidos, portadas finales y contratos firmados en la nube de Google.",
      features: [
        "Respaldo automático de contratos",
        "Carpetas de almacenamiento organizadas por autor",
        "Sincronización en dos direcciones de documentos de clientes"
      ],
      status: "coming_soon"
    },
    {
      name: "Gmail / GSuite",
      description: "Envía cotizaciones formales y tus plantillas de Respuestas Rápidas directamente desde tu casilla de correo corporativa sin salir del CRM de Somos Noveli.",
      features: [
        "Envío directo de cotizaciones en PDF",
        "Registro de correos enviados en el historial de clientes",
        "Notificaciones de correos leídos por autores"
      ],
      status: "coming_soon"
    },
    {
      name: "Google Sheets",
      description: "Exportación y sincronización en tiempo real de tus planillas de ingresos, egresos y balances de impuestos directo a Google Sheets para compartir con tu contador.",
      features: [
        "Sincronización en la nube de balances tributarios",
        "Respaldos periódicos de base de datos de facturación",
        "Compatibilidad con macros de contabilidad externas"
      ],
      status: "coming_soon"
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
          Integraciones Externas
          <span className="text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded ml-2.5 dark:bg-brand-950/40 dark:text-brand-400 dark:border-brand-900 select-none inline-block align-middle uppercase tracking-wider">
            próximamente
          </span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Planifica y administra la conexión de Somos Noveli CRM con herramientas en la nube.
        </p>
      </div>

      <div className="bg-brand-950/20 border border-brand-500/25 p-5 rounded-2xl flex items-start gap-4 text-brand-700 dark:text-brand-350">
        <div className="p-2 bg-brand-500/10 text-brand-500 rounded-xl shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="text-xs space-y-1.5 leading-relaxed">
          <h4 className="font-extrabold text-slate-800 dark:text-slate-100">Sincronización de Procesos de Negocio</h4>
          <p>
            Estamos diseñando las integraciones nativas con la suite de Google Workspace para automatizar el flujo de trabajo de la editorial. En las próximas actualizaciones podrás vincular tu cuenta de Google para activar estos módulos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrationList.map((int, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{int.name}</h3>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 uppercase tracking-wide">
                  <Clock className="w-3.5 h-3.5" />
                  Próximamente
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">{int.description}</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-50 dark:border-slate-850">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Beneficios de la Integración</span>
              <ul className="space-y-1.5">
                {int.features.map((feat, fIdx) => (
                  <li key={fIdx} className="text-xs flex items-center gap-2 text-slate-655 dark:text-slate-350">
                    <CheckCircle className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button 
              disabled 
              className="w-full py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 text-slate-400 dark:text-slate-600 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Configurar Conexión
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
