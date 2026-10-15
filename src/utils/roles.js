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

const adminDeleteTables = new Set([
  'clients', 'prospects', 'quotations', 'services', 'providers',
  'service_catalog', 'service_packs', 'activity_log',
  'website_settings', 'website_sections', 'website_services', 'website_books', 'website_links',
]);
const writerDeleteTables = new Set([
  'quotation_items', 'service_pack_items', 'service_checklists', 'service_stages',
  'editorial_stages', 'documents', 'agenda_events', 'website_book_categories',
  'website_book_category_links', 'website_footer_gallery', 'website_hero_quick_services',
]);
export const canDeleteEntity = (role, table) =>
  adminDeleteTables.has(table) ? isAdminRole(role) :
    (writerDeleteTables.has(table) && isWriterRole(role));
