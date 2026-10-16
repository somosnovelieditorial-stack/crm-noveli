# Seguridad 03C: finanzas y configuración sensible

Fecha: 2026-10-15. Validación exclusivamente LOCAL en `supabase_db_CRM_NOVELI`.

## Checkpoint y límites

Checkpoint de 03B: **21980d4**, `chore(noveli-2): consolidate crm editorial rls`. Incluyó los 16 archivos aprobados: migración, dos pruebas, validación y doce archivos frontend necesarios. Se confirmó git status limpio antes de iniciar 03C; no se hizo push. 03C permanece SIN COMMIT para revisión.

Migración creada con `supabase migration new harden_security_03c_finance_sensitive`:
`20261015233425_harden_security_03c_finance_sensitive.sql`.

Referencias: [audit](security-audit.md), [02](security-02-validation.md), [03A](security-03a-validation.md), [03B](security-03b-validation.md). Baseline y migraciones/pruebas anteriores intactos. SHA-256 binario del baseline: `c41d2d67c856f1d50cdff9a27a739d8655f93844a7876301795ac0aff1b42620`.

Sin consultas/cambios remotos, db push, db pull, reset --linked ni migration repair. No se creó ningún módulo/tablas de Noveli 2.0, no se modificó Storage ni activity_log. No se alteraron columnas ni índices.

## Inventario real y conteos

Se inspeccionaron columnas, defaults, FK, CHECK, políticas instaladas y consumidores frontend. Las trece tablas del alcance existen y estaban vacías en LOCAL: no se inspeccionaron datos de producción, ni se presupone que sus campos de texto estén libres de secretos. Los fixtures sintéticos se revierten.

| Métrica | Antes | Después |
|---|---:|---:|
| Tablas public | 46 | 46 |
| Funciones public | 7 | 9 |
| Políticas public | 291 | 306 |
| Permisivas | 165 | 180 |
| Restrictivas | 126 | 126 idénticas |
| Políticas en las trece tablas | 76 | 91 |
| Políticas fuera de ellas | 215 | 215 idénticas |

Se eliminan **37 permisivas** y se crean **52** (cuatro comandos por tabla). Las 254 políticas conservadas son idénticas en cmd/roles/USING/WITH CHECK/permissive, incluidos los 126 guards 02. No se depende de is_org_writer para autorizar finanzas: cada nueva permisiva financiera exige is_org_finance; los guards 02 siguen aportando el AND anterior.

No quedan políticas legacy en las trece tablas del alcance: ninguna ALL ni PUBLIC, ni autorización por user_id propietario. Fuera del alcance quedan las ALL PUBLIC de organizations y quick_replies, que no se revisan aquí. website_exchange_rates permanece idéntica a 03A; no se confunde con exchange_rates interno.

## Matriz rol × módulo financiero

Permisos siempre dentro del tenant y con membresía activa; se evalúa la organización solicitada, no una arbitraria del usuario.

| Rol | SELECT finanzas/nómina/staff | INSERT/UPDATE financieros | DELETE | settings completo | company_settings | exchange_rates |
|---|---|---|---|---|---|---|
| admin | Sí | Sí | Sí | Lee/administra | Lee/administra | Lee/administra |
| finanzas | Sí | Sí | No | Lee; no administra | Lee; no administra | Lee/inserta/actualiza |
| editor | No | No | No | No; branding limitado | Lee | Lee para conversión CRM |
| diseñador | No | No | No | No; branding limitado | Lee | Lee para conversión CRM |
| corrector | No | No | No | No; branding limitado | Lee | Lee para conversión CRM |
| visualizador | No | No | No | No; branding limitado | Lee | Lee referencia |
| desconocido con membresía activa | No | No | No | No; branding limitado | Lee datos generales | Lee referencia |
| inactivo / sin membresía | No | No | No | No | No | No |
| anon | No | No | No | No | No | No |

El rol desconocido no obtiene rutas ni escritura UI; su membresía activa solo permite los datos generales que ya se autorizan al equipo (identidad/tasas). No se crean roles nuevos ni se cambia el mapping de aliases de 02.

La UI permite páginas financieras (incomes, expenses, taxes, currency_rates, staff, reserve y reports) solo a admin/finanzas, incluidos accesos por URL. Finanza no obtiene configuración general, integraciones ni auditoría admin. Reports mezcla informes operativos y financieros: temporalmente se restringe el módulo entero, sin abrir las tablas financieras por su contenido operativo.

## Helpers y privilegios

`public.is_org_finance(org_uuid uuid)` es SQL STABLE **SECURITY INVOKER**, `SET search_path = ''`, y devuelve:

```sql
SELECT org_uuid IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.organization_members AS membership
 WHERE membership.organization_id = org_uuid
   AND membership.user_id = (SELECT auth.uid())
   AND membership.active = true
   AND membership.role IN ('admin','finanzas')
);
```

No requiere DEFINER: SELECT de organization_members ya usa el helper is_org_member sin recursión hacia is_org_finance. Las pruebas se ejecutan con SET ROLE authenticated real y comprueban esa decisión. EXECUTE revocado PUBLIC/anon, permitido authenticated/service_role/postgres. Los helpers anteriores no se cambian ni se revocan.

`public.get_org_branding(uuid)` devuelve únicamente editorial_name, logo_url y favicon_url de settings, para auth.uid() no nulo y miembro activo del tenant exacto. Es STABLE SECURITY DEFINER con search_path vacío y tablas public cualificadas: necesita proyectar esas tres columnas pese al RLS financiero del resto de settings. EXECUTE PUBLIC/anon revocado; authenticated/service_role/postgres permitido. No es un endpoint público web ni devuelve bank_details/IVA/notas.

Se añaden trece triggers security03c_preserve_tenant, reutilizando **sin cambiarla** la función SECURITY INVOKER security03b_preserve_tenant(). Bloquean cambios de organization_id, incluso para admin/postgres, para no invalidar después las relaciones padre/hijo. No se añadió una función duplicada de trigger. Una transferencia futura requerirá un procedimiento explícito de migración.

## Modelo final por tabla y DELETE

| Tabla | SELECT | INSERT / UPDATE | DELETE | Motivo / consumidor |
| incomes | Admin / finanzas | Admin / finanzas + referencias mismo tenant | Admin | Incomes, Taxes, Dashboard, Reports; pagos automáticos solo finanzas. |
| income_allocations | Admin / finanzas | Admin / finanzas + referencias mismo tenant | Admin | Asignación de ingresos en Incomes; actualización in situ para finanzas. |
| income_distributions | Admin / finanzas | Admin / finanzas + referencias mismo tenant | Admin | Distribución inteligente; reemplazo destructivo admin, primera distribución finanzas. |
| income_tax_reservations | Admin / finanzas | Admin / finanzas + referencias mismo tenant | Admin | Reservas IVA; mismo límite de reemplazo del modal. |
| expenses | Admin / finanzas | Admin / finanzas + referencias mismo tenant | Admin | Expenses, Taxes, Dashboard, Reports; incluye vínculos de fondos y nómina. |
| client_funds | Admin / finanzas | Admin / finanzas + referencias mismo tenant | Admin | Fondos por cliente/servicio y saldos operados desde helpers/modales financieros. |
| fund_movements | Admin / finanzas | Admin / finanzas + referencias mismo tenant | Admin | Historial de movimientos de fondos; DELETE solo mantenimiento admin. |
| operational_reserve_movements | Admin / finanzas | Admin / finanzas + referencias mismo tenant | Admin | Staff/reserva, Dashboard; DELETE admin mantiene el flujo de corrección existente. |
| payroll_payments | Admin / finanzas | Admin / finanzas + referencias mismo tenant | Admin | Nómina: ningún otro rol puede consultar ni escribir. Staff crea/actualiza pagos, admin elimina. |
| company_settings | Miembro activo | Admin + referencias mismo tenant | Admin | Datos empresariales de cotizaciones y documentos comerciales; miembro activo lee, admin edita. |
| settings | Admin / finanzas | Admin + referencias mismo tenant | Admin | Mezcla identidad y datos bancarios/tributarios; lectura completa finanzas/admin, edición admin. Branding mediante proyección limitada. |
| exchange_rates | Miembro activo | Admin / finanzas + referencias mismo tenant | Admin | Tasas internas usadas en CurrencyRates y conversiones automáticas de services/quotations; miembro activo lee referencia. |
| staff | Admin / finanzas | Admin / finanzas + referencias mismo tenant | Admin | Staff.jsx, selector de distribución de sueldos, Dashboard y centro QA admin. No se encontraron consumidores operativos fuera de finanzas. |

**DELETE admin-only en las trece tablas**, sin excepción para finanzas. Se conserva DELETE admin porque el CRM ya elimina ingresos/gastos/nómina/reserva y reemplaza asignaciones/distribuciones. No se convierte todavía el modelo en un ledger inmutable ni se implementan movimientos compensatorios. UPDATE financiero sigue permitido a finanzas: no se afirma inmutabilidad contable.

Compatibilidad concreta:

- Incomes.jsx borraba/reinsertaba todas las income_allocations al guardar. Ahora finanzas actualiza IDs existentes e inserta nuevas; quitar una asignación existente se detecta antes de guardar el ingreso y requiere admin. Admin conserva reemplazo. Evita que un DELETE RLS de cero filas genere duplicados silenciosos.
- IncomeDistributionModal.jsx borra distribuciones/reservas y crea además fondos/movimientos/nómina. Finanzas puede crear la primera distribución; reemplazar una con filas previas exige admin, con preflight antes de cualquier escritura. La UI devuelve una explicación, no continúa tras un DELETE de cero filas. No se rediseña ese flujo para reconciliar todo el historial.
- Persisten límites históricos de atomicidad: las operaciones son varias llamadas cliente y no una transacción RPC. Un fallo de red/concurrencia o un reemplazo admin puede dejar efectos parciales o duplicar movimientos acumulados. Requiere rediseño contable posterior; el preflight no constituye un bloqueo transaccional.

## Configuración sensible y staff

A. Administrativa sensible: settings.bank_details, vat_rate y parametrización de monedas/legal; settings solo admin modifica. No hay columnas API-key/password en estas definiciones, pero notas/bank_details no se consideran inocuas ni se consultó producción.

B. Operativa general: company_settings contiene nombre comercial, representante, contacto, dirección, tax_id, logos y textos legales/pie usados por Quotations y QuickQuoteModal. Se mantiene SELECT de miembro activo para generar propuestas; editar identidad/representación queda admin-only, incluidos handlers y botones inline. settings conserva branding mediante RPC de tres columnas para App (antes leía esas tres columnas directamente de settings).

C. Web pública: no se encontró necesidad de abrir estas tablas a anon. website_exchange_rates y publicaciones web mantienen su modelo anterior, sin cambios.

Staff mezcla contacto/puesto con agreed_salary, salary, agreed_payment, frecuencia y notas. El frontend actual lo usa en el módulo financiero Personal, distribución de nómina y Dashboard; el resto de operación no consulta staff. Se restringe la fila completa a finanzas/admin porque las consultas actuales son SELECT * y no existe un directorio operativo separado. No se inventan restricciones por columna ni una vista nueva. Si se añade luego un directorio del equipo, necesita una proyección sin salarios y pruebas separadas.

## Relaciones cross-tenant protegidas

Todas las FK de este bloque hacia entidades con organization_id se validan al INSERT y UPDATE mediante EXISTS del padre con id y organization_id idénticos al hijo, bajo RLS del padre. Las referencias opcionales pueden seguir NULL; las restricciones NOT NULL originales se preservan. No se agregaron columnas. Los triggers impiden mover padres o hijos después a otro tenant.

- **incomes**: `client_id` → `clients`, `service_id` → `services`, `prospect_id` → `prospects`.
- **income_allocations**: `income_id` → `incomes`.
- **income_distributions**: `income_id` → `incomes`, `client_id` → `clients`, `prospect_id` → `prospects`, `service_id` → `services`.
- **income_tax_reservations**: `income_id` → `incomes`.
- **expenses**: `provider_id` → `providers`, `payroll_payment_id` → `payroll_payments`, `client_id` → `clients`, `service_id` → `services`, `fund_id` → `client_funds`, `source_income_id` → `incomes`.
- **client_funds**: `client_id` → `clients`, `service_id` → `services`.
- **fund_movements**: `fund_id` → `client_funds`, `income_id` → `incomes`, `expense_id` → `expenses`.
- **operational_reserve_movements**: `source_income_id` → `incomes`, `distribution_id` → `income_distributions`.
- **payroll_payments**: `staff_id` → `staff`, `source_income_id` → `incomes`, `distribution_id` → `income_distributions`.

**25 relaciones**; cada una tiene prueba negativa INSERT y UPDATE con un padre real de B y una fila de A, incluso siendo admin de ambos tenants. Los fixtures válidos de CRUD incluyen esas FK del mismo tenant; no se sustituyen aquí las pruebas cross-tenant por UUID inexistentes. Nómina comprueba staff, ingreso de origen y distribución; reserva comprueba distribución e ingreso; expenses comprueba las seis referencias aplicables.

Esto valida tenant, no reglas contables adicionales (saldo, suma de distribuciones, identidad exacta de cliente entre varias relaciones del mismo tenant). incomes.source_id es polimórfico y carece de FK, por lo que no se valida genéricamente su referencia en esta migración.

## Frontend modificado

- roles.js: isFinanceRole, isFinanceModule, guard central de lectura/escritura/rutas financieras y DELETE admin-only de las trece tablas; aliases 02 conservados, desconocidos rechazados.
- App: bloqueo directo de rutas financieras para otros roles; branding mediante fetchOrgBranding/RPC sin leer settings completo.
- Dashboard: deja de consultar las diez tablas financieras/staff para otros roles; desactiva Finanzas y muestra operación; no renderiza tarjetas de cuentas por cobrar ni abre sus drilldowns para ellos. No se abren SELECT financieros para métricas.
- Reports queda reservado a finanzas/admin por mezclar información financiera con operaciones; no se separa/rediseña aquí.
- Incomes, Expenses y Staff: botones/handlers DELETE admin-only, antes de side effects; asignaciones y distribución adaptadas como arriba.
- Quotations/QuickQuoteModal: datos de empresa de lectura para cotizar; edición inline/logo solo admin.
- Clients/Agenda: acciones explícitas de marcar pagado bloqueadas/deshabilitadas para no-finanzas; checkbox y monto pagado de Clients deshabilitados.
- createAutoIncome y syncPaymentStatus: no producen efectos financieros para no-finanzas; el primer helper devuelve null para permitir que siga el guardado operativo de clientes/prospectos/servicios. La contabilización queda a cargo del módulo financiero. No se agregó una excepción RLS para que editores escriban ingresos.
- supabaseClient: wrapper estrecho fetchOrgBranding, sin cambiar Storage ni exponer un RPC genérico al mock.

La caché de rol controla presentación; RLS usa la membresía real. Los campos comerciales de importes/estado de pago en clients/prospects/services siguen siendo parte del modelo CRM 03B; no se implementó autorización por columna ni se convierten en evidencia contable. Esas filas y sus textos pueden conservar información económica comercial visible al equipo.

## Políticas retiradas: comparación exacta

NULL significa ausencia de ese predicado explícito. Se comparó cmd/roles/USING/WITH CHECK/permissive: las 37 retiradas eran PERMISSIVE. Cada ALL se sustituye por los cuatro comandos; las granulares por su comando correspondiente. Ninguna política financiera permisiva anterior queda haciendo OR para eludir el rol financiero.

| Tabla | Política | cmd | roles | USING | WITH CHECK | Reemplazo | Motivo |
|---|---|---|---|---|---|---|---|
| client_funds | client_funds_org_all | ALL | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03c_select/insert/update/delete | ALL solapado: cualquier miembro podía consultar/escribir; sustituido por comandos y roles explícitos. |
| company_settings | company_settings_org_access | ALL | authenticated | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | security03c_select/insert/update/delete | Identidad empresarial: lectura del equipo, administración solo admin; eliminar ALL y escrituras de cualquier miembro. |
| company_settings | company_settings_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03c_delete | Identidad empresarial: lectura del equipo, administración solo admin; eliminar ALL y escrituras de cualquier miembro. |
| company_settings | company_settings_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03c_insert | Identidad empresarial: lectura del equipo, administración solo admin; eliminar ALL y escrituras de cualquier miembro. |
| company_settings | company_settings_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03c_select | Identidad empresarial: lectura del equipo, administración solo admin; eliminar ALL y escrituras de cualquier miembro. |
| company_settings | company_settings_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03c_update | Identidad empresarial: lectura del equipo, administración solo admin; eliminar ALL y escrituras de cualquier miembro. |
| exchange_rates | Users can manage their own exchange_rates | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03c_select/insert/update/delete | Eliminar autorización por propietario/PUBLIC: no valida rol financiero ni tenant activo. |
| expenses | Users can manage their own expenses | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03c_select/insert/update/delete | Eliminar autorización por propietario/PUBLIC: no valida rol financiero ni tenant activo. |
| expenses | expenses_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03c_delete | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| expenses | expenses_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03c_insert | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| expenses | expenses_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03c_select | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| expenses | expenses_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03c_update | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| fund_movements | fund_movements_org_all | ALL | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03c_select/insert/update/delete | ALL solapado: cualquier miembro podía consultar/escribir; sustituido por comandos y roles explícitos. |
| income_allocations | Income allocations org access | ALL | authenticated | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | security03c_select/insert/update/delete | ALL solapado: cualquier miembro podía consultar/escribir; sustituido por comandos y roles explícitos. |
| income_distributions | income_distributions_org_all | ALL | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03c_select/insert/update/delete | ALL solapado: cualquier miembro podía consultar/escribir; sustituido por comandos y roles explícitos. |
| income_tax_reservations | income_tax_reservations_org_all | ALL | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03c_select/insert/update/delete | ALL solapado: cualquier miembro podía consultar/escribir; sustituido por comandos y roles explícitos. |
| incomes | Users can manage their own incomes | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03c_select/insert/update/delete | Eliminar autorización por propietario/PUBLIC: no valida rol financiero ni tenant activo. |
| incomes | incomes_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03c_delete | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| incomes | incomes_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03c_insert | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| incomes | incomes_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03c_select | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| incomes | incomes_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03c_update | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| operational_reserve_movements | Reserve org access | ALL | authenticated | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | security03c_select/insert/update/delete | ALL solapado: cualquier miembro podía consultar/escribir; sustituido por comandos y roles explícitos. |
| operational_reserve_movements | operational_reserve_movements_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03c_delete | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| operational_reserve_movements | operational_reserve_movements_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03c_insert | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| operational_reserve_movements | operational_reserve_movements_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03c_select | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| operational_reserve_movements | operational_reserve_movements_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03c_update | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| payroll_payments | Payroll org access | ALL | authenticated | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | security03c_select/insert/update/delete | ALL solapado: cualquier miembro podía consultar/escribir; sustituido por comandos y roles explícitos. |
| payroll_payments | payroll_payments_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03c_delete | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| payroll_payments | payroll_payments_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03c_insert | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| payroll_payments | payroll_payments_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03c_select | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| payroll_payments | payroll_payments_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03c_update | Reemplazo por autorización financiera/admin y consistencia tenant; conservar intención admin de DELETE sin bypass ALL. |
| settings | Users can manage their own settings | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03c_select/insert/update/delete | Eliminar autorización por propietario/PUBLIC: no valida rol financiero ni tenant activo. |
| staff | Staff org access | ALL | authenticated | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | security03c_select/insert/update/delete | Salarios mezclados con directorio; consumidores actuales financieros, sin lectura operativa indispensable. |
| staff | staff_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03c_delete | Salarios mezclados con directorio; consumidores actuales financieros, sin lectura operativa indispensable. |
| staff | staff_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03c_insert | Salarios mezclados con directorio; consumidores actuales financieros, sin lectura operativa indispensable. |
| staff | staff_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03c_select | Salarios mezclados con directorio; consumidores actuales financieros, sin lectura operativa indispensable. |
| staff | staff_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03c_update | Salarios mezclados con directorio; consumidores actuales financieros, sin lectura operativa indispensable. |

## Pruebas y evidencia

```text
supabase db reset --local
python supabase/tests/security_03c_regressions.py
node --test src/utils/roles.test.js
npm run build
node node_modules/eslint/bin/eslint.js . --format json --output-file <temporal>
```

| Comprobación | Resultado |
|---|---|
| Reset completo baseline → 03C | PASS, exit 0, LOCAL explícito |
| Seguridad 01 | PASS, 49 avisos PASS |
| Seguridad 02 | PASS, 274 avisos PASS |
| Seguridad 03A | PASS, 316 avisos PASS |
| Seguridad 03B | PASS, 989 avisos PASS |
| Seguridad 03C | PASS, 1.041 avisos PASS |
| Tests frontend | 6/6 PASS |
| Build | PASS, 421 módulos; warnings de sourcemap Tailwind/tamaño de chunk |
| Lint diagnóstico | 404 errores / 22 warnings antes y después; cero diagnósticos nuevos |
| Baseline / 01 / 02 / 03A / 03B | SHA baseline y comparación Git de todas las migraciones protegidas correctos |
| RLS / tablas / funciones | RLS habilitado, 46 tablas, 9 funciones |
| Catálogo de políticas | 37 retiradas, 52 creadas, 254 idénticas; 126 guards idénticos |
| Anomalías FK cruzadas locales | 0 en las 25 relaciones; local vacío, no inferir producción |

El runner conserva los SQL históricos intactos; adapta conteos/inventario y la sustitución intencional de nómina (su ALL histórica se reemplaza por cuatro políticas). La normalización de aliases de 02 sigue probándose sin reinstalar sus políticas antiguas. No se relajan expectativas de acceso CRM/WEB. La suite 03C prueba CRUD para los seis roles canónicos, desconocido, inactivo y anon, además de un finanzas en A que solo es visualizador en B; comprueba que finanzas no pueda promover su membresía ni administrar settings/company_settings. Incluye branding limitado, helper con null y permisos EXECUTE mínimos.

Los fixtures tienen propietarios editor para demostrar que el antiguo user_id no concede lectura financiera. Los cross-tenant usan padres reales. Todo termina con marcador ALL_CHECKS_PASSED_AND_ROLLED_BACK. La primera ejecución 03C detectó una expectativa de test incorrecta: el CRUD admin crea otra fila sintética settings, por lo que branding puede devolver más de una fila. Se corrigió el test para exigir existencia para miembros y cero para no-miembros, sin cambiar la migración. No hubo fallo del reset ni SQL de migración.

Lint se compara por archivo/regla/severidad/mensaje sin code frames desplazados por los imports. No hay npm test en package.json; se ejecuta el único archivo frontend existente con node --test. No se ejecutó E2E de navegador ni se afirma cobertura del circuito contable completo.

## Riesgos pendientes

1. **Confidencialidad más allá de estas tablas:** activity_log puede contener importes en textos de eventos financieros y sigue legible por miembros según 03B. public.documents conserva el modelo de 03B; metadata/archivos vinculados a ingresos/gastos pueden contener datos financieros. No se modificó activity_log ni Storage conforme al alcance. Esta fase protege acceso directo a las tablas financieras, NO garantiza que no existan copias de importes en textos/archivos/CRM. Requiere una fase específica de auditoría de logs/documentos/Storage antes de afirmar confidencialidad financiera integral.
2. Distribución de ingresos sigue siendo un flujo de varias llamadas, no atómico/idempotente. Finanzas no reemplaza distribuciones existentes; admin puede hacerlo con riesgos históricos de acumulación. Reconciliación y movimientos compensatorios pendientes.
3. Campos comerciales de pagos/importes en CRM no son un ledger; escritores todavía pueden modificarlos mediante el modelo 03B. No confundirlos con registros financieros autorizados de incomes/expenses.
4. No se consultó producción: pueden existir organization_id NULL, referencias cruzadas, textos sensibles o integraciones que dependan de los permisos antiguos. La migración no mueve/sanea esos datos; filas inválidas no podrán editarse sin corregir referencias y las sin tenant quedarán invisibles por RLS.
5. Transferir organization_id queda bloqueado incluso para admin. source_id polimórfico y consistencia contable de relaciones del mismo tenant requieren reglas futuras.
6. Reports operativo queda temporalmente restringido junto al financiero; un directorio staff sin salarios y reportes operativos separados corresponden a una fase posterior.
7. settings puede tener varias filas por organización; el RPC mantiene la forma de respuesta existente (array, App toma la primera). No se añade unicidad ni se migra contenido entre settings/company_settings.

No se crearon orders/order_items/payment_schedules/payments/refunds/contracts/projects/collaborators/collaborator_payables ni nuevos módulos. Los temporales de comparación/lint no se versionan; 03C queda pendiente de revisión, sin commit ni push.
