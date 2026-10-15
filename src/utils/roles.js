// Single role vocabulary for UI compatibility. Database membership/RLS remains
// the authority; cached roles can only control presentation.
export const ROLE_OPTIONS = Object.freeze([
  { id: 'admin', label: 'Administrador' },
  { id: 'editor', label: 'Editor' },
  { id: 'diseñador', label: 'Diseñador' },
  { id: 'corrector', label: 'Corrector' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'visualizador', label: 'Visualizador' },
]);

const canonicalRoles = new Set(ROLE_OPTIONS.map(({ id }) => id));
const aliases = new Map([
  ['administrador', 'admin'], ['direccion', 'admin'],
  ['maquetador', 'diseñador'], ['asistente', 'editor'],
  ['contador', 'finanzas'], ['solo lectura', 'visualizador'],
]);

export const normalizeRole = (value) => {
  if (typeof value !== 'string') return null;
  const role = value.trim().toLowerCase().normalize('NFC');
  return canonicalRoles.has(role) ? role : (aliases.get(role) ?? null);
};

export const isAdminRole = (value) => normalizeRole(value) === 'admin';
export const isWriterRole = (value) => {
  const role = normalizeRole(value);
  return role !== null && role !== 'visualizador';
};

const editorialModules = [
  'dashboard', 'notifications', 'quotations', 'clients', 'prospects', 'seguimientos',
  'services', 'completed_sales', 'documents', 'catalog', 'packs', 'website',
  'website-servicios', 'website-libros', 'website-configuracion', 'website-enlaces',
  'website-secciones', 'website-solicitudes', 'website-footer', 'website-hero',
  'website-identidad', 'reports',
];
const productionModules = editorialModules.filter(
  (module) => !['quotations', 'catalog', 'packs'].includes(module),
);
const modulesByRole = {
  editor: editorialModules,
  diseñador: productionModules,
  corrector: productionModules,
  finanzas: [
    'dashboard', 'notifications', 'clients', 'prospects', 'seguimientos', 'services',
    'completed_sales', 'incomes', 'expenses', 'taxes', 'currency_rates', 'providers',
    'staff', 'reserve', 'reports',
  ],
  visualizador: editorialModules,
};

export const canRoleAccessModule = (value, module) => {
  const role = normalizeRole(value);
  return role === 'admin' || (modulesByRole[role]?.includes(module) ?? false);
};

export const canRolePerformAction = (value, module, action = 'write') => {
  if (!canRoleAccessModule(value, module)) return false;
  if (['read', 'view', 'ver', 'select'].includes(action)) return true;
  return isWriterRole(value);
};
