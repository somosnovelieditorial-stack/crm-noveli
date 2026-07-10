import AuditTestingCenter from './AuditTestingCenter';

export default function CRMAudit({ organizationId, userRole }) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Auditoría del CRM</h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 mb-6">
          Verificación de conexión, estructura de Supabase, permisos y flujos internos.
        </p>
        <AuditTestingCenter organizationId={organizationId} userRole={userRole} />
      </div>
    </div>
  );
}
