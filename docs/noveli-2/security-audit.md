# Auditoría de seguridad de Noveli 2.0

Fecha: 2026-10-14. Estado: **análisis previo; no es una migración ni autorización de despliegue**.

## 1. Alcance y situación actual

Se revisaron código fuente, SQL y archivos de proyecto, sin consultar ni modificar ninguna base. No se ejecutaron comandos Supabase ni scripts de la aplicación. Se excluyeron dependencias, compilados y Git al determinar uso productivo. Los catálogos `supabase/.temp/pgdelta` contienen copias de las cinco funciones: son cachés generadas, no consumidores frontend. No se abrió `.env`.

Fuente examinada: `supabase/migrations/20261014031607_noveli_baseline.sql`. Los scripts `schema.sql` y `supabase_migration*.sql` de la raíz son historia o alternativas, no prueba del estado instalado. El baseline contiene **46 tablas públicas, 5 funciones SECURITY DEFINER y 165 políticas**. Las 46 tablas habilitan RLS. Hay **46 políticas PUBLIC**, **109 exclusivamente authenticated** y **10 compartidas authenticated/anon**. Ninguna es AS RESTRICTIVE.

Resultados:

- **41 políticas posiblemente redundantes/solapadas**: 11 ownership que conviven con reglas org, 20 históricas web, 7 ALL con subconsulta de membresía, 2 ALL de libros/servicios web y 1 SELECT histórica de miembros. No son 41 equivalencias completas: algunas amplían autorizaciones de forma insegura y requieren reemplazo probado.
- **Un duplicado exacto** dentro de ese conjunto: `Payroll org access` y `Payroll payments org access`. Mismos roles, comando y expresiones; ambas se proponen retirar si se conserva el juego granular.
- **128 FK**, **42 índices explícitos**, **84 FK sin cobertura por prefijo B-tree**, contando también PK/UNIQUE. Prioridad basada en código, sin estadísticas de producción.
- Las cinco funciones necesitan revisar ACL/exposición; dos helpers antiguos además tienen search_path mutable y selección de tenant no determinista.

PUBLIC es el pseudo-rol PostgreSQL que incluye todos los roles, no el schema `public` ni solo anon. Sin TO, la política aplica a PUBLIC. Las políticas permisivas aplicables se combinan con **OR**: DELETE admin no restringe otra ALL que permite borrar. GRANT y RLS son capas diferentes. [Fundamento PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

## 2. Funciones y uso real

**Ninguna de las cinco se llama directamente desde React/JavaScript.** Las cuatro de autorización sí son dependencias indirectas por RLS/defaults: no se pueden eliminar solo por no aparecer en React.

| Función | Dependencia actual del baseline | Decisión propuesta |
|---|---|---|
| get_user_org_id | 24 políticas; DEFAULT organization_id en 25 tablas | Retener hasta reemplazar políticas y defaults; endurecer. |
| get_user_role | 17 políticas: 15 escrituras web y Manage members/organization | Dependencia histórica vigente; retirar permiso authenticated solo después de sustituir todas. |
| is_org_member | 76 políticas | Helper actual; conservar y endurecer. |
| is_org_admin | 24 políticas | Helper actual; conservar y reconciliar admin/administrador. |
| get_public_schema_columns | Solo definición, OWNER y GRANT; ninguna política/default/llamada fuente | No utilizada por frontend encontrado. Candidata a retirar del API o reservar a diagnóstico administrativo. |

Los conteos son políticas distintas, no ocurrencias de texto. La lista completa de archivos aparece en el anexo de referencias.

### RPC administrativa distinta de estas cinco

[UsersPermissions.jsx:133](../../src/components/UsersPermissions.jsx#L133) intenta `supabase.rpc('get_user_id_by_email', ...)`. No se encontró definición de esa función y no figura en el baseline. Además, el objeto exportado en [supabaseClient.js:2312](../../src/supabaseClient.js#L2312) solo expone auth/storage/from/removeChannel, no rpc. Dos bloqueos estáticos del alta de miembros; no se probó ejecutándola. Diseñar operación administrativa autorizada por organización, sin exponer un directorio global de emails a anon.

## 3. Roles actuales e inconsistencias

Los siete valores solicitados aparecen en frontend actual: **ninguno es exclusivamente SQL antiguo**. Diseñador/contador como tipo de proveedor se distinguen de roles de autorización.

| Valor | Frontend actual | Baseline e historia | Problema |
|---|---|---|---|
| admin | ID asignable en UsersPermissions; excepción admin en App/utils | is_org_admin exige exactamente admin | No pasa las reglas antiguas que exigen administrador. |
| administrador | Estado inicial/fallback App, mocks, Configuration, excepción utils | Manage organization/members exige administrador; CHECK histórico | No pasa is_org_admin, pese a ser admin en UI. |
| editor | ID asignable y ROLE_PERMISSIONS | CHECK histórico schema.sql | RLS moderna no limita acciones por rol. |
| diseñador | ID asignable y ROLE_PERMISSIONS; también proveedor | CHECK histórico; baseline lo usa como tipo de proveedor | RLS no impone restricciones de módulo. |
| corrector | ID asignable y ROLE_PERMISSIONS | CHECK histórico | Mismo problema de permisos efectivos. |
| contador | ROLE_PERMISSIONS y descripción Configuration; también proveedor | CHECK histórico; baseline lo usa como proveedor | El selector actual guarda finanzas, sin entrada propia en ROLE_PERMISSIONS. |
| solo lectura | Fallback App y bloqueo explícito de escritura utils | 15 políticas web comparan ese literal | Selector ofrece visualizador; RLS moderna permite escrituras por membresía. |

Otros IDs asignables: `direccion`, `maquetador`, `finanzas`, `asistente`, `visualizador`. No tienen entrada propia en ROLE_PERMISSIONS. `canAccessModule` cae al listado de solo lectura, pero `canPerformAction` solo deniega cuando el string es exactamente `solo lectura`: **visualizador y IDs desconocidos pueden obtener escritura en módulos del fallback**. El parámetro action se ignora; acceso al módulo habilita cualquier acción en esa función.

`hasPermission(role,module)` ignora role y consulta localStorage. `getCurrentUserRole` prioriza el role del usuario cacheado sobre la clave de membresía. UI/localStorage son manipulables y no autorizan en servidor.

`organization_members.permissions` se guarda/edita en UsersPermissions, pero no autoriza en utils ni en RLS. AuditTestingCenter trata permissions.all como señal visual de admin, no como autoridad del servidor.

Evidencia: [UsersPermissions.jsx](../../src/components/UsersPermissions.jsx#L8), [utils.js:235](../../src/utils.js#L235), [utils.js:683](../../src/utils.js#L683), [App.jsx:560](../../src/App.jsx#L560), [App.jsx:1152](../../src/App.jsx#L1152), [Configuration.jsx:376](../../src/components/Configuration.jsx#L376), [AuditTestingCenter.jsx:845](../../src/components/AuditTestingCenter.jsx#L845).

El baseline tiene `role TEXT NOT NULL`, **sin CHECK/ENUM**. El CHECK de seis valores está solo en [schema.sql:21](../../schema.sql#L21). No se conocen valores almacenados ni distribución de usuarios: requerirá inventario de datos autorizado en otra etapa.

### Normalización propuesta, no aplicada

IDs canónicos separados de etiquetas: `admin`, `direccion`, `editor`, `maquetador`, `disenador`, `corrector`, `finanzas`, `asistente`, `visualizador`. Aliases propuestos: administrador→admin, contador→finanzas, solo lectura→visualizador, diseñador→disenador. Aprobar alcance de contador/finanzas; no convertir direccion ni roles desconocidos automáticamente a admin.

Un catálogo y matriz módulo/acción compartidos por UI y servidor. Rol desconocido/membresía ausente o inactiva: denegar escritura. Visualizador: SELECT permitido, sin escrituras. Mantener aliases transitorios hasta corregir datos y consumidores; constrainir role después. No usar user_metadata/localStorage como autoridad.

## 4. Riesgos encontrados

### Riesgos críticos o de alta prioridad

1. **Perfiles globalmente legibles**: `Select profile`, [L2593](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2593), es SELECT PUBLIC USING true. Con GRANT ALL anon, expone id/full_name/avatar_url/updated_at de todos los perfiles si la tabla está expuesta al Data API. Manage profile limita escritura propia, pero no esa lectura. No se halló una necesidad frontend de directorio anónimo.
2. **DELETE admin anulado por ALL**: ownership en 11 tablas CRM, 7 ALL antiguas en 6 tablas y ALL miembro en website_books/services permiten rutas de borrado que no exigen admin. Las reglas granulares no las restringen porque se combinan con OR.
3. **Inactivos conservan acceso por ownership**: las 20 reglas ownership no consultan membresía/active. El usuario autenticado puede operar sus filas aunque pierda membresía. Las 7 ALL antiguas y la única regla de income_allocations omiten active explícito, pero su subconsulta está sujeta a RLS de organization_members: **no se afirma un bypass independiente e incondicional de active por esas subconsultas**. Eliminar esa dependencia implícita y exigir active al diseñar reemplazos.
4. **Solo lectura no se impone en RLS**: is_org_member habilita INSERT/UPDATE por membresía activa, sin role/permissions. Algunas ALL permiten DELETE. Arreglar botones no soluciona esto.
5. **Cambio de tenant**: las cinco Update books/links/sections/services/settings históricas verifican organización en USING, pero WITH CHECK solo evalúa rol no solo lectura o NULL. Pueden reasignar una fila visible a otra organization_id existente. Ownership ALL también permite organización arbitraria si user_id sigue siendo propio. Las reglas nuevas permiten trasladar entre dos organizaciones propias: decidir inmutabilidad del tenant, más allá de membresía.
6. **Tasas web globalmente editables**: website_exchange_rates_auth_manage es ALL authenticated USING true WITH CHECK true. Tabla sin organization_id: cualquier cuenta autenticada puede cambiar/borrar tasas globales.
7. **Leads públicos sin controles de campos/destino**: website_leads_public_insert admite anon/authenticated WITH CHECK true. organization_id tiene default, pero se puede sobrescribir; status/notes/converted_*/is_test/accepted_terms tampoco se restringen. La FK valida existencia, no pertenencia. Diseñar destino validado, lista de campos y protección de abuso. No hay SELECT público de leads y no debe añadirse.
8. **Funciones elevadas expuestas**: las cinco SECURITY DEFINER owned by postgres tienen EXECUTE para anon/authenticated/service_role y no REVOKE PUBLIC. get_public_schema_columns revela metadatos globales. get_user_org_id/get_user_role leen tabla sin cualificar y no fijan search_path. No hay SQL dinámico ni DML en esas funciones; no se afirma una explotación remota demostrada.

### Otros riesgos y residuos

- organizations solo usa helpers antiguos: administrador puede gestionarla; admin no pasa su literal. Necesita reemplazo y bootstrap, no eliminación aislada.
- get_user_org_id/get_user_role tienen LIMIT 1 sin ORDER BY/contexto de tenant. App también elige data[0] sin orden. No garantizan concordancia organización/rol/selección multi-org. Checks parametrizados y defaults explícitos son preferibles.
- website_book_category_links_public_read usa true: expone relaciones de padres ocultos. Su regla administrativa solo comprueba organización del libro, no coherencia de categoría. Las FK de negocio tampoco garantizan mismo tenant entre padre e hijo; un UUID ajeno puede pasar integridad sin ser visible. Validar referencias de propuestas/items/servicios/documentos/finanzas.
- Lecturas web usan active/visible IS DISTINCT FROM false: NULL también publica. website_services tiene visible y visible_on_website: verificar consumidor externo. Las lecturas no restringen tenant publicado ni excluyen is_test donde existe; GRANT de tabla completa exige revisar columnas privadas.
- GRANT ALL a roles API en las 46 tablas incluye TRUNCATE, no sometido a RLS. No se encontró ruta REST para ejecutarlo ni credenciales SQL de anon: **exceso de privilegios, no prueba de truncado por visitante vía PostgREST**. Proponer privilegios de tabla limitados a operaciones necesarias, sin TRUNCATE para roles API. [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
- Nueve tablas solo tienen ownership ALL: activity_log, agenda_events, editorial_stages, exchange_rates, providers, quick_replies, service_checklists, service_pack_items, settings. Crear reemplazos antes de retirar; activity_log permite editar/borrar evidencia propia y settings no exige admin.
- Baseline sin triggers/views de negocio ni REVOKE. No se inspeccionaron Auth signup, ACL vivos, Storage/Edge Functions. Si existe anonymous sign-in de Supabase Auth, sus usuarios operan como authenticated: debe probarse aparte.

## 5. Tablas solicitadas

| Tabla | Políticas | Revisión propuesta |
|---|---:|---|
| organizations | 2 | Solo PUBLIC antigua; diseñar SELECT por membresía, gestión admin y bootstrap. |
| organization_members | 6 | Manage/Select antiguas + 4 nuevas. Normalizar admin, preservar lookup propio y evitar autoelevación/último admin. |
| user_profiles | 2 | Reemplazar lectura global; mantener perfil propio, limitar columnas y decidir DELETE propio. |
| clients | 5 | Retirar ownership tras validar 4 org; añadir permisos y tenant inmutable. |
| prospects | 5 | Igual que clients; revisar dos referencias de conversión a clientes. |
| quotations | 5 | Igual; validar client/prospect/service del mismo tenant. |
| quotation_items | 5 | Validar quotation/catalog/pack; quotation_id ya indexada. |
| services | 5 | Validar client del mismo tenant y permisos editoriales. |
| service_catalog | 6 | Ownership + ALL org_access + 4 org. Dos rutas amplias anulan DELETE admin. |
| service_packs | 6 | Igual; service_pack_items solo ownership requiere diseño conjunto. |
| website_settings | 8 | 4 antiguas + 4 org; sin SELECT anon útil. Confirmar publicación externa antes de ampliar acceso. |
| website_sections | 8 | Igual; UNIQUE section_key global es deuda multi-tenant. |
| website_services | 10 | 4 antiguas + ALL miembro + 4 org + pública. Retirar 5 solapadas; validar bandera/tenant/columnas. |
| website_books | 10 | Mismo patrón; revisar categorías y publicación de NULL. |
| website_links | 8 | 4 antiguas + 4 org; sin SELECT anon, confirmar consumidor externo. |
| payroll_payments | 6 | 2 ALL idénticas + 4 org; retirar ALL y aplicar permisos financieros también en SELECT/INSERT/UPDATE. |

## 6. Finalidades que deben mantenerse

- Membresías propias/autorizadas, administración de miembros y perfil propio.
- CRM bajo membresía activa y permisos por módulo/acción; las *_org_* son una base a endurecer, no autorización final suficiente.
- Acceso legítimo de las nueve tablas ownership únicas, antes de sustituir sus reglas.
- Gestión org de fondos/distribuciones/impuestos/notificaciones/contenido web; limitar ALL según permisos.

Las nueve lecturas explícitas anon son candidatas a conservar por finalidad, **no necesidad externa comprobada**: el repositorio contiene el CRM de administración, no el consumidor público desplegado completo.

| Política | Condición actual | Revisión |
|---|---|---|
| website_book_categories_public_read | active=true | Tenant/columnas públicas. |
| website_book_category_links_public_read | true | Padres publicados/activos y tenant coherente. |
| website_books_public_read | active/visible IS DISTINCT FROM false | NULL publica; excluir pruebas y revisar columnas. |
| website_exchange_rates_public_read | active=true | Lectura global legítima a confirmar; edición admin separada. |
| website_footer_gallery_public_read | active=true | Tenant publicado. |
| website_footer_settings_public_read | active=true | Tenant/columnas públicas. |
| website_hero_quick_services_public_read | active=true | Tenant publicado. |
| website_hero_settings_public_read | active=true | Tenant y libro destacado publicado. |
| website_services_public_read | active/visible_on_website IS DISTINCT FROM false | NULL publica; verificar bandera/excluir pruebas. |

website_leads_public_insert es la **única escritura anon explícitamente abierta**: preservar ingreso de solicitudes mediante una vía restringida. No hay UPDATE/DELETE anon abiertos en otras reglas: ownership exige auth.uid=user_id (NULL no pasa), las históricas web exigen get_user_org_id que requiere auth.uid/active, Manage profile exige auth.uid=id. Anonymous sign-in se analiza como authenticated.

Select profile no debe conservarse para la web. website_settings/sections/links no tienen SELECT anon útil: no añadir acceso amplio por intuición.

## 7. Funciones: ACL mínimas y endurecimiento

Las cinco son owned by postgres, con GRANT ALL ON FUNCTION a anon/authenticated/service_role (equivale a EXECUTE). No hay REVOKE. PostgreSQL concede EXECUTE a PUBLIC por defecto: quitar anon sin quitar PUBLIC no basta. El final del baseline concede también funciones nuevas por ALTER DEFAULT PRIVILEGES a los tres roles; revisar defaults con alcance preciso. [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html), [Supabase Functions](https://supabase.com/docs/guides/database/functions).

| Función | anon | authenticated | service_role | postgres |
|---|---|---|---|---|
| get_user_org_id | Sin EXECUTE | EXECUTE mientras haya defaults/RLS | Sin grant explícito salvo uso backend demostrado | Mantener owner/administración |
| get_user_role | Sin EXECUTE | EXECUTE transitorio; retirar tras sustituir 17 políticas | Sin grant explícito salvo necesidad demostrada | Mantener owner/administración |
| is_org_member(uuid) | Sin EXECUTE | EXECUTE para RLS | Sin grant explícito para operaciones que ya bypass RLS; solo si backend lo llama | Mantener owner/administración |
| is_org_admin(uuid) | Sin EXECUTE | EXECUTE para RLS | Igual que is_org_member | Mantener owner/administración |
| get_public_schema_columns | Sin EXECUTE | Sin EXECUTE según uso encontrado | Sin EXECUTE por defecto; diagnóstico autorizado si es necesario | Uso administrativo si se conserva |

Revocar PUBLIC es parte del diseño para las cinco, junto con grants específicos/defaults; **no realizado**. service_role no debe ir al frontend y bypass RLS no concede automáticamente EXECUTE revocado. Owner postgres no necesita grant adicional.

- **get_user_org_id/get_user_role**: search_path vacío/seguro, public.organization_members y auth.uid cualificados; resolver LIMIT 1/tenant explícito. No pasar automáticamente a SECURITY INVOKER: puede provocar recursión de RLS sobre membership. Conservar compatibilidad de defaults hasta sustituirlos.
- **is_org_admin/is_org_member**: ya cualifican la tabla y fijan search_path=public; reducirlo a mínimo seguro, denegar auth.uid NULL, preservar active=true, unificar literal admin. SECURITY DEFINER puede ser legítimo para romper recursión, con propietario/ACL justificados.
- **get_public_schema_columns**: search_path public,information_schema; lee metadatos. Retirar exposición API o reservar a diagnóstico; si se mantiene, evaluar SECURITY INVOKER para respetar visibilidad del llamante. No proponer DROP sin confirmar dependencias externas.

Mover helpers a schema privado es una opción posterior: implica actualizar RLS/defaults y permisos USAGE/EXECUTE, no cambiar nombres aisladamente.

## 8. FK e índices: metodología

Inventario estático: FK cubierta si sus columnas son prefijo de índice B-tree no parcial o PK/UNIQUE. (organization_id,user_id) cubre org, no user como prefijo; membership tiene además índice user propio. UNIQUE(book_id,category_id) cubre book_id, no category_id. Los 42 índices explícitos son B-tree no parciales.

Alta: filtros centrales/aislamiento org de módulos CRM y finanzas. Media: módulos secundarios/relaciones conocidas sin filtro frecuente demostrado. Baja: autoría/conversión histórica/trazabilidad sin filtros frecuentes. Son prioridades inferidas del código, sin cardinalidades/EXPLAIN. Joins en JavaScript no se aceleran directamente con índices SQL; estos sí ayudan filtros/cascadas.

No crear los 84 a la vez. Medir costo de escritura y planes en otra etapa autorizada. Considerar organization_id+FK según consultas reales; no sustituir índices por compuestos que dejen de servir a búsquedas por FK sola.

Evidencia de filtros:

- [utils.js:260](../../src/utils.js#L260), [Clients.jsx:530](../../src/components/Clients.jsx#L530): relaciones por client_id.
- [ClientQuotesModal.jsx:38](../../src/components/ClientQuotesModal.jsx#L38): quotations por client/prospect; items por quotation (ya indexada).
- [financeHelper.js:59](../../src/financeHelper.js#L59), [financeHelper.js:140](../../src/financeHelper.js#L140): ingresos por client/prospect/service; fondos por client/org.
- [Incomes.jsx:172](../../src/components/Incomes.jsx#L172), [Incomes.jsx:214](../../src/components/Incomes.jsx#L214): allocations/distributions por income y documentos por income.
- [Expenses.jsx:284](../../src/components/Expenses.jsx#L284), [Staff.jsx:319](../../src/components/Staff.jsx#L319): documentos por expense; expenses por payroll_payment_id.
- [Staff.jsx:104](../../src/components/Staff.jsx#L104): organization_id de staff/payroll/reserve/allocations/distributions.
- [Packs.jsx:64](../../src/components/Packs.jsx#L64): pack_id de items YA indexada; service_id no cubierta.
- [supabaseClient.js:2054](../../src/supabaseClient.js#L2054): filtro org automático; service_stages/service_checklists por service_id YA indexadas.

La lista completa de las 84 FK figura en el anexo. No duplicar organization_members.org/user, quotation_items.quotation_id, service_stages/checklists.service_id, service_pack_items.pack_id, website_book_category_links.book_id, user_profiles.id ni las restantes FK ya cubiertas.

## 9. Plan previo a harden_noveli_security

1. Congelar evidencia/baseline. No crear migración definitiva en esta etapa.
2. En otra etapa autorizada, inventariar roles almacenados, multi-org/inactivos, consumidores externos, exposición API y anonymous sign-in. No ejecutar SQL histórico: contiene DML y definiciones diferentes.
3. Aprobar matriz rol/módulo/acción, tenant inmutable, bootstrap/primer y último admin, edición de tasas e ingreso de leads. Diseñar invitación administrativa segura.
4. Reemplazar completamente acceso de las nueve tablas ownership únicas y organizations/profiles/members antes de retirar sus rutas. Corregir UI/permissions en fase coordinada; RLS sigue siendo la barrera real.
5. Diseñar helpers/ACL, recursión y defaults de 25 tablas. get_user_role podría quedar sin uso tras depurar; get_user_org_id no hasta resolver defaults.
6. Preparar después migración transaccional: aliases/datos de rol, funciones/ACL, políticas nuevas, retirada explícita de candidatas revisadas y grants mínimos. No prometer 165−41 como conteo final: se reemplazarán/agregarán políticas.
7. Probar en entorno local/desarrollo autorizado JWT/contextos anon, authenticated sin membership, visualizador, editor, diseñador/corrector, finanzas, admin/administrador transitorio, inactivo, multi-org y service_role. SELECT/INSERT/UPDATE/DELETE, autoelevación, cambio tenant, referencias ajenas, funciones, leads y borradores. postgres no valida RLS.
8. Índices altos después de planes/cardinalidades; separar optimización si facilita rollback. CREATE INDEX CONCURRENTLY, si se elige, requiere manejo fuera de transacción ordinaria.
9. Revisar diff/grants efectivos/PUBLIC/defaults, criterios de aceptación y rollback. Solicitar autorización explícita antes de aplicar al remoto. Ningún push/pull/reset/repair/up forma parte de esta auditoría.

Criterios futuros: visualizador no escribe aunque altere UI; inactivo no conserva ownership; DELETE respeta matriz por todas las rutas; tenant no cambia sin operación autorizada; publicaciones no filtran perfiles/pruebas/borradores; leads no inyectan datos de gestión; helpers cumplen mínimo privilegio.

## 10. Anexos de evidencia

Los inventarios siguientes se generan exclusivamente leyendo archivos. SQL mostrado corresponde a definiciones actuales copiadas para análisis, no SQL propuesto para ejecutar.

### 10.1 Clasificación por tabla

| Tabla | Total | PUBLIC | authenticated | Compartida anon | Helpers históricos | Helpers actuales | Solapadas candidatas |
|---|---:|---:|---:|---:|---|---|---:|
| `activity_log` | 1 | 1 | 0 | 0 | - | - | 0 |
| `agenda_events` | 1 | 1 | 0 | 0 | - | - | 0 |
| `client_funds` | 1 | 0 | 1 | 0 | - | is_org_member | 0 |
| `clients` | 5 | 1 | 4 | 0 | - | is_org_member, is_org_admin | 1 |
| `company_settings` | 5 | 0 | 5 | 0 | - | is_org_member, is_org_admin | 1 |
| `documents` | 5 | 1 | 4 | 0 | - | is_org_member, is_org_admin | 1 |
| `editorial_stages` | 1 | 1 | 0 | 0 | - | - | 0 |
| `exchange_rates` | 1 | 1 | 0 | 0 | - | - | 0 |
| `expenses` | 5 | 1 | 4 | 0 | - | is_org_member, is_org_admin | 1 |
| `fund_movements` | 1 | 0 | 1 | 0 | - | is_org_member | 0 |
| `income_allocations` | 1 | 0 | 1 | 0 | - | - | 0 |
| `income_distributions` | 1 | 0 | 1 | 0 | - | is_org_member | 0 |
| `income_tax_reservations` | 1 | 0 | 1 | 0 | - | is_org_member | 0 |
| `incomes` | 5 | 1 | 4 | 0 | - | is_org_member, is_org_admin | 1 |
| `notifications` | 1 | 0 | 1 | 0 | - | is_org_member | 0 |
| `operational_reserve_movements` | 5 | 0 | 5 | 0 | - | is_org_member, is_org_admin | 1 |
| `organization_members` | 6 | 2 | 4 | 0 | get_user_org_id, get_user_role | is_org_member, is_org_admin | 1 |
| `organizations` | 2 | 2 | 0 | 0 | get_user_org_id, get_user_role | - | 0 |
| `payroll_payments` | 6 | 0 | 6 | 0 | - | is_org_member, is_org_admin | 2 |
| `prospects` | 5 | 1 | 4 | 0 | - | is_org_member, is_org_admin | 1 |
| `providers` | 1 | 1 | 0 | 0 | - | - | 0 |
| `quick_replies` | 1 | 1 | 0 | 0 | - | - | 0 |
| `quotation_items` | 5 | 1 | 4 | 0 | - | is_org_member, is_org_admin | 1 |
| `quotations` | 5 | 1 | 4 | 0 | - | is_org_member, is_org_admin | 1 |
| `service_catalog` | 6 | 1 | 5 | 0 | - | is_org_member, is_org_admin | 2 |
| `service_checklists` | 1 | 1 | 0 | 0 | - | - | 0 |
| `service_pack_items` | 1 | 1 | 0 | 0 | - | - | 0 |
| `service_packs` | 6 | 1 | 5 | 0 | - | is_org_member, is_org_admin | 2 |
| `service_stages` | 5 | 1 | 4 | 0 | - | is_org_member, is_org_admin | 1 |
| `services` | 5 | 1 | 4 | 0 | - | is_org_member, is_org_admin | 1 |
| `settings` | 1 | 1 | 0 | 0 | - | - | 0 |
| `staff` | 5 | 0 | 5 | 0 | - | is_org_member, is_org_admin | 1 |
| `user_profiles` | 2 | 2 | 0 | 0 | - | - | 0 |
| `website_book_categories` | 2 | 0 | 1 | 1 | - | is_org_member | 0 |
| `website_book_category_links` | 2 | 0 | 1 | 1 | - | is_org_member | 0 |
| `website_books` | 10 | 4 | 5 | 1 | get_user_org_id, get_user_role | is_org_member, is_org_admin | 5 |
| `website_exchange_rates` | 2 | 0 | 1 | 1 | - | - | 0 |
| `website_footer_gallery` | 2 | 0 | 1 | 1 | - | is_org_member | 0 |
| `website_footer_settings` | 2 | 0 | 1 | 1 | - | is_org_member | 0 |
| `website_hero_quick_services` | 2 | 0 | 1 | 1 | - | is_org_member | 0 |
| `website_hero_settings` | 2 | 0 | 1 | 1 | - | is_org_member | 0 |
| `website_leads` | 4 | 0 | 3 | 1 | - | is_org_member, is_org_admin | 0 |
| `website_links` | 8 | 4 | 4 | 0 | get_user_org_id, get_user_role | is_org_member, is_org_admin | 4 |
| `website_sections` | 8 | 4 | 4 | 0 | get_user_org_id, get_user_role | is_org_member, is_org_admin | 4 |
| `website_services` | 10 | 4 | 5 | 1 | get_user_org_id, get_user_role | is_org_member, is_org_admin | 5 |
| `website_settings` | 8 | 4 | 4 | 0 | get_user_org_id, get_user_role | is_org_member, is_org_admin | 4 |

### 10.2 Las 41 candidatas identificadas

| Tabla | Nombre exacto | Motivo | Evidencia |
|---|---|---|---|
| `website_books` | `Delete books` | Candidata solapada: histórica web | [L2493](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2493) |
| `website_links` | `Delete links` | Candidata solapada: histórica web | [L2497](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2497) |
| `website_sections` | `Delete sections` | Candidata solapada: histórica web | [L2501](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2501) |
| `website_services` | `Delete services` | Candidata solapada: histórica web | [L2505](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2505) |
| `website_settings` | `Delete settings` | Candidata solapada: histórica web | [L2509](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2509) |
| `website_books` | `Insert books` | Candidata solapada: histórica web | [L2521](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2521) |
| `website_links` | `Insert links` | Candidata solapada: histórica web | [L2525](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2525) |
| `website_sections` | `Insert sections` | Candidata solapada: histórica web | [L2529](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2529) |
| `website_services` | `Insert services` | Candidata solapada: histórica web | [L2533](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2533) |
| `website_settings` | `Insert settings` | Candidata solapada: histórica web | [L2537](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2537) |
| `payroll_payments` | `Payroll org access` | Candidata solapada: ALL antigua | [L2553](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2553) |
| `payroll_payments` | `Payroll payments org access` | Candidata solapada: ALL antigua | [L2561](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2561) |
| `operational_reserve_movements` | `Reserve org access` | Candidata solapada: ALL antigua | [L2569](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2569) |
| `website_books` | `Select books` | Candidata solapada: histórica web | [L2577](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2577) |
| `website_links` | `Select links` | Candidata solapada: histórica web | [L2581](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2581) |
| `organization_members` | `Select members` | Candidata solapada: SELECT histórico; preservar lookup | [L2585](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2585) |
| `website_sections` | `Select sections` | Candidata solapada: histórica web | [L2597](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2597) |
| `website_services` | `Select services` | Candidata solapada: histórica web | [L2601](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2601) |
| `website_settings` | `Select settings` | Candidata solapada: histórica web | [L2605](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2605) |
| `staff` | `Staff org access` | Candidata solapada: ALL antigua | [L2609](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2609) |
| `website_books` | `Update books` | Candidata solapada: histórica web | [L2617](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2617) |
| `website_links` | `Update links` | Candidata solapada: histórica web | [L2621](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2621) |
| `website_sections` | `Update sections` | Candidata solapada: histórica web | [L2625](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2625) |
| `website_services` | `Update services` | Candidata solapada: histórica web | [L2629](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2629) |
| `website_settings` | `Update settings` | Candidata solapada: histórica web | [L2633](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2633) |
| `clients` | `Users can manage their own clients` | Candidata solapada: ownership vs org | [L2645](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2645) |
| `documents` | `Users can manage their own documents` | Candidata solapada: ownership vs org | [L2649](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2649) |
| `expenses` | `Users can manage their own expenses` | Candidata solapada: ownership vs org | [L2661](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2661) |
| `incomes` | `Users can manage their own incomes` | Candidata solapada: ownership vs org | [L2665](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2665) |
| `prospects` | `Users can manage their own prospects` | Candidata solapada: ownership vs org | [L2669](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2669) |
| `quotation_items` | `Users can manage their own quotation_items` | Candidata solapada: ownership vs org | [L2681](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2681) |
| `quotations` | `Users can manage their own quotations` | Candidata solapada: ownership vs org | [L2685](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2685) |
| `service_catalog` | `Users can manage their own service_catalog` | Candidata solapada: ownership vs org | [L2689](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2689) |
| `service_packs` | `Users can manage their own service_packs` | Candidata solapada: ownership vs org | [L2701](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2701) |
| `service_stages` | `Users can manage their own service_stages` | Candidata solapada: ownership vs org | [L2705](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2705) |
| `services` | `Users can manage their own services` | Candidata solapada: ownership vs org | [L2709](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2709) |
| `company_settings` | `company_settings_org_access` | Candidata solapada: ALL antigua | [L2764](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2764) |
| `service_catalog` | `service_catalog_org_access` | Candidata solapada: ALL antigua | [L2996](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2996) |
| `service_packs` | `service_packs_org_access` | Candidata solapada: ALL antigua | [L3029](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3029) |
| `website_books` | `website_books_org_all` | Candidata solapada: ALL anula DELETE admin | [L3145](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3145) |
| `website_services` | `website_services_org_all` | Candidata solapada: ALL anula DELETE admin | [L3284](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3284) |

Manage members/organization NO se cuentan entre las 41: administrador y admin no equivalen hoy, y organizations no tiene reemplazo moderno. Select profile no es redundante: expone más y requiere reemplazo. Select members se cuenta como solapada, no equivalente completa por selección multi-org.

### 10.3 Detalle completo de las 165 políticas

#### public.activity_log

- **Users can manage their own activity_log** — ALL; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2637](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2637).

<details>
<summary>Definiciones actuales de activity_log</summary>

```sql
CREATE POLICY "Users can manage their own activity_log" ON "public"."activity_log" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
```

</details>

#### public.agenda_events

- **Users can manage their own agenda_events** — ALL; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2641](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2641).

<details>
<summary>Definiciones actuales de agenda_events</summary>

```sql
CREATE POLICY "Users can manage their own agenda_events" ON "public"."agenda_events" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
```

</details>

#### public.client_funds

- **client_funds_org_all** — ALL; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2738](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2738).

<details>
<summary>Definiciones actuales de client_funds</summary>

```sql
CREATE POLICY "client_funds_org_all" ON "public"."client_funds" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.clients

- **Users can manage their own clients** — ALL; PUBLIC; Candidata solapada: ownership vs org. [L2645](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2645).
- **clients_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2745](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2745).
- **clients_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2749](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2749).
- **clients_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2753](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2753).
- **clients_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2757](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2757).

<details>
<summary>Definiciones actuales de clients</summary>

```sql
CREATE POLICY "Users can manage their own clients" ON "public"."clients" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "clients_org_delete" ON "public"."clients" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "clients_org_insert" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "clients_org_select" ON "public"."clients" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "clients_org_update" ON "public"."clients" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.company_settings

- **company_settings_org_access** — ALL; authenticated; Candidata solapada: ALL antigua. [L2764](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2764).
- **company_settings_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2772](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2772).
- **company_settings_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2776](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2776).
- **company_settings_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2780](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2780).
- **company_settings_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2784](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2784).

<details>
<summary>Definiciones actuales de company_settings</summary>

```sql
CREATE POLICY "company_settings_org_access" ON "public"."company_settings" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "company_settings_org_delete" ON "public"."company_settings" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "company_settings_org_insert" ON "public"."company_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "company_settings_org_select" ON "public"."company_settings" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "company_settings_org_update" ON "public"."company_settings" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.documents

- **Users can manage their own documents** — ALL; PUBLIC; Candidata solapada: ownership vs org. [L2649](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2649).
- **documents_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2791](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2791).
- **documents_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2795](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2795).
- **documents_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2799](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2799).
- **documents_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2803](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2803).

<details>
<summary>Definiciones actuales de documents</summary>

```sql
CREATE POLICY "Users can manage their own documents" ON "public"."documents" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "documents_org_delete" ON "public"."documents" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "documents_org_insert" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "documents_org_select" ON "public"."documents" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "documents_org_update" ON "public"."documents" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.editorial_stages

- **Users can manage their own editorial_stages** — ALL; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2653](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2653).

<details>
<summary>Definiciones actuales de editorial_stages</summary>

```sql
CREATE POLICY "Users can manage their own editorial_stages" ON "public"."editorial_stages" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
```

</details>

#### public.exchange_rates

- **Users can manage their own exchange_rates** — ALL; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2657](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2657).

<details>
<summary>Definiciones actuales de exchange_rates</summary>

```sql
CREATE POLICY "Users can manage their own exchange_rates" ON "public"."exchange_rates" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
```

</details>

#### public.expenses

- **Users can manage their own expenses** — ALL; PUBLIC; Candidata solapada: ownership vs org. [L2661](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2661).
- **expenses_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2816](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2816).
- **expenses_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2820](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2820).
- **expenses_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2824](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2824).
- **expenses_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2828](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2828).

<details>
<summary>Definiciones actuales de expenses</summary>

```sql
CREATE POLICY "Users can manage their own expenses" ON "public"."expenses" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "expenses_org_delete" ON "public"."expenses" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "expenses_org_insert" ON "public"."expenses" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "expenses_org_select" ON "public"."expenses" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "expenses_org_update" ON "public"."expenses" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.fund_movements

- **fund_movements_org_all** — ALL; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2835](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2835).

<details>
<summary>Definiciones actuales de fund_movements</summary>

```sql
CREATE POLICY "fund_movements_org_all" ON "public"."fund_movements" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.income_allocations

- **Income allocations org access** — ALL; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2513](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2513).

<details>
<summary>Definiciones actuales de income_allocations</summary>

```sql
CREATE POLICY "Income allocations org access" ON "public"."income_allocations" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));
```

</details>

#### public.income_distributions

- **income_distributions_org_all** — ALL; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2845](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2845).

<details>
<summary>Definiciones actuales de income_distributions</summary>

```sql
CREATE POLICY "income_distributions_org_all" ON "public"."income_distributions" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.income_tax_reservations

- **income_tax_reservations_org_all** — ALL; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2852](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2852).

<details>
<summary>Definiciones actuales de income_tax_reservations</summary>

```sql
CREATE POLICY "income_tax_reservations_org_all" ON "public"."income_tax_reservations" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.incomes

- **Users can manage their own incomes** — ALL; PUBLIC; Candidata solapada: ownership vs org. [L2665](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2665).
- **incomes_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2859](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2859).
- **incomes_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2863](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2863).
- **incomes_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2867](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2867).
- **incomes_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2871](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2871).

<details>
<summary>Definiciones actuales de incomes</summary>

```sql
CREATE POLICY "Users can manage their own incomes" ON "public"."incomes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "incomes_org_delete" ON "public"."incomes" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "incomes_org_insert" ON "public"."incomes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "incomes_org_select" ON "public"."incomes" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "incomes_org_update" ON "public"."incomes" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.notifications

- **notifications_org_all** — ALL; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2882](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2882).

<details>
<summary>Definiciones actuales de notifications</summary>

```sql
CREATE POLICY "notifications_org_all" ON "public"."notifications" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.operational_reserve_movements

- **Reserve org access** — ALL; authenticated; Candidata solapada: ALL antigua. [L2569](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2569).
- **operational_reserve_movements_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2889](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2889).
- **operational_reserve_movements_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2893](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2893).
- **operational_reserve_movements_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2897](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2897).
- **operational_reserve_movements_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2901](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2901).

<details>
<summary>Definiciones actuales de operational_reserve_movements</summary>

```sql
CREATE POLICY "Reserve org access" ON "public"."operational_reserve_movements" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "operational_reserve_movements_org_delete" ON "public"."operational_reserve_movements" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "operational_reserve_movements_org_insert" ON "public"."operational_reserve_movements" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "operational_reserve_movements_org_select" ON "public"."operational_reserve_movements" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "operational_reserve_movements_org_update" ON "public"."operational_reserve_movements" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.organization_members

- **Manage members** — ALL; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2541](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2541).
- **Select members** — SELECT; PUBLIC; Candidata solapada: SELECT histórico; preservar lookup. [L2585](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2585).
- **admins_can_delete_members** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2720](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2720).
- **admins_can_insert_members** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2724](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2724).
- **admins_can_update_members** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2728](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2728).
- **members_can_read_same_org** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2875](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2875).

<details>
<summary>Definiciones actuales de organization_members</summary>

```sql
CREATE POLICY "Manage members" ON "public"."organization_members" USING ((("organization_id" = "public"."get_user_org_id"()) AND ("public"."get_user_role"() = 'administrador'::"text"))) WITH CHECK ((("organization_id" = "public"."get_user_org_id"()) AND ("public"."get_user_role"() = 'administrador'::"text")));

CREATE POLICY "Select members" ON "public"."organization_members" FOR SELECT USING (("organization_id" = "public"."get_user_org_id"()));

CREATE POLICY "admins_can_delete_members" ON "public"."organization_members" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "admins_can_insert_members" ON "public"."organization_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_admin"("organization_id"));

CREATE POLICY "admins_can_update_members" ON "public"."organization_members" FOR UPDATE TO "authenticated" USING ("public"."is_org_admin"("organization_id")) WITH CHECK ("public"."is_org_admin"("organization_id"));

CREATE POLICY "members_can_read_same_org" ON "public"."organization_members" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));
```

</details>

#### public.organizations

- **Manage organization** — ALL; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2545](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2545).
- **Select organization** — SELECT; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2589](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2589).

<details>
<summary>Definiciones actuales de organizations</summary>

```sql
CREATE POLICY "Manage organization" ON "public"."organizations" USING ((("id" = "public"."get_user_org_id"()) AND ("public"."get_user_role"() = 'administrador'::"text"))) WITH CHECK ((("id" = "public"."get_user_org_id"()) AND ("public"."get_user_role"() = 'administrador'::"text")));

CREATE POLICY "Select organization" ON "public"."organizations" FOR SELECT USING (("id" = "public"."get_user_org_id"()));
```

</details>

#### public.payroll_payments

- **Payroll org access** — ALL; authenticated; Candidata solapada: ALL antigua. [L2553](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2553).
- **Payroll payments org access** — ALL; authenticated; Candidata solapada: ALL antigua. [L2561](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2561).
- **payroll_payments_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2914](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2914).
- **payroll_payments_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2918](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2918).
- **payroll_payments_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2922](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2922).
- **payroll_payments_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2926](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2926).

<details>
<summary>Definiciones actuales de payroll_payments</summary>

```sql
CREATE POLICY "Payroll org access" ON "public"."payroll_payments" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "Payroll payments org access" ON "public"."payroll_payments" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "payroll_payments_org_delete" ON "public"."payroll_payments" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "payroll_payments_org_insert" ON "public"."payroll_payments" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "payroll_payments_org_select" ON "public"."payroll_payments" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "payroll_payments_org_update" ON "public"."payroll_payments" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.prospects

- **Users can manage their own prospects** — ALL; PUBLIC; Candidata solapada: ownership vs org. [L2669](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2669).
- **prospects_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2933](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2933).
- **prospects_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2937](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2937).
- **prospects_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2941](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2941).
- **prospects_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2945](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2945).

<details>
<summary>Definiciones actuales de prospects</summary>

```sql
CREATE POLICY "Users can manage their own prospects" ON "public"."prospects" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "prospects_org_delete" ON "public"."prospects" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "prospects_org_insert" ON "public"."prospects" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "prospects_org_select" ON "public"."prospects" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "prospects_org_update" ON "public"."prospects" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.providers

- **Users can manage their own providers** — ALL; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2673](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2673).

<details>
<summary>Definiciones actuales de providers</summary>

```sql
CREATE POLICY "Users can manage their own providers" ON "public"."providers" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
```

</details>

#### public.quick_replies

- **Users can manage their own quick_replies** — ALL; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2677](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2677).

<details>
<summary>Definiciones actuales de quick_replies</summary>

```sql
CREATE POLICY "Users can manage their own quick_replies" ON "public"."quick_replies" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
```

</details>

#### public.quotation_items

- **Users can manage their own quotation_items** — ALL; PUBLIC; Candidata solapada: ownership vs org. [L2681](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2681).
- **quotation_items_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2958](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2958).
- **quotation_items_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2962](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2962).
- **quotation_items_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2966](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2966).
- **quotation_items_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2970](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2970).

<details>
<summary>Definiciones actuales de quotation_items</summary>

```sql
CREATE POLICY "Users can manage their own quotation_items" ON "public"."quotation_items" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "quotation_items_org_delete" ON "public"."quotation_items" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "quotation_items_org_insert" ON "public"."quotation_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "quotation_items_org_select" ON "public"."quotation_items" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "quotation_items_org_update" ON "public"."quotation_items" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.quotations

- **Users can manage their own quotations** — ALL; PUBLIC; Candidata solapada: ownership vs org. [L2685](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2685).
- **quotations_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2977](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2977).
- **quotations_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2981](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2981).
- **quotations_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2985](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2985).
- **quotations_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L2989](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2989).

<details>
<summary>Definiciones actuales de quotations</summary>

```sql
CREATE POLICY "Users can manage their own quotations" ON "public"."quotations" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "quotations_org_delete" ON "public"."quotations" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "quotations_org_insert" ON "public"."quotations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "quotations_org_select" ON "public"."quotations" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "quotations_org_update" ON "public"."quotations" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.service_catalog

- **Users can manage their own service_catalog** — ALL; PUBLIC; Candidata solapada: ownership vs org. [L2689](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2689).
- **service_catalog_org_access** — ALL; authenticated; Candidata solapada: ALL antigua. [L2996](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2996).
- **service_catalog_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3004](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3004).
- **service_catalog_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3008](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3008).
- **service_catalog_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3012](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3012).
- **service_catalog_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3016](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3016).

<details>
<summary>Definiciones actuales de service_catalog</summary>

```sql
CREATE POLICY "Users can manage their own service_catalog" ON "public"."service_catalog" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "service_catalog_org_access" ON "public"."service_catalog" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "service_catalog_org_delete" ON "public"."service_catalog" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "service_catalog_org_insert" ON "public"."service_catalog" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "service_catalog_org_select" ON "public"."service_catalog" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "service_catalog_org_update" ON "public"."service_catalog" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.service_checklists

- **Users can manage their own service_checklists** — ALL; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2693](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2693).

<details>
<summary>Definiciones actuales de service_checklists</summary>

```sql
CREATE POLICY "Users can manage their own service_checklists" ON "public"."service_checklists" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
```

</details>

#### public.service_pack_items

- **Users can manage their own service_pack_items** — ALL; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2697](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2697).

<details>
<summary>Definiciones actuales de service_pack_items</summary>

```sql
CREATE POLICY "Users can manage their own service_pack_items" ON "public"."service_pack_items" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
```

</details>

#### public.service_packs

- **Users can manage their own service_packs** — ALL; PUBLIC; Candidata solapada: ownership vs org. [L2701](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2701).
- **service_packs_org_access** — ALL; authenticated; Candidata solapada: ALL antigua. [L3029](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3029).
- **service_packs_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3037](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3037).
- **service_packs_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3041](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3041).
- **service_packs_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3045](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3045).
- **service_packs_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3049](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3049).

<details>
<summary>Definiciones actuales de service_packs</summary>

```sql
CREATE POLICY "Users can manage their own service_packs" ON "public"."service_packs" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "service_packs_org_access" ON "public"."service_packs" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "service_packs_org_delete" ON "public"."service_packs" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "service_packs_org_insert" ON "public"."service_packs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "service_packs_org_select" ON "public"."service_packs" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "service_packs_org_update" ON "public"."service_packs" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.service_stages

- **Users can manage their own service_stages** — ALL; PUBLIC; Candidata solapada: ownership vs org. [L2705](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2705).
- **service_stages_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3056](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3056).
- **service_stages_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3060](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3060).
- **service_stages_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3064](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3064).
- **service_stages_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3068](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3068).

<details>
<summary>Definiciones actuales de service_stages</summary>

```sql
CREATE POLICY "Users can manage their own service_stages" ON "public"."service_stages" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "service_stages_org_delete" ON "public"."service_stages" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "service_stages_org_insert" ON "public"."service_stages" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "service_stages_org_select" ON "public"."service_stages" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "service_stages_org_update" ON "public"."service_stages" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.services

- **Users can manage their own services** — ALL; PUBLIC; Candidata solapada: ownership vs org. [L2709](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2709).
- **services_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3075](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3075).
- **services_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3079](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3079).
- **services_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3083](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3083).
- **services_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3087](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3087).

<details>
<summary>Definiciones actuales de services</summary>

```sql
CREATE POLICY "Users can manage their own services" ON "public"."services" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "services_org_delete" ON "public"."services" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "services_org_insert" ON "public"."services" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "services_org_select" ON "public"."services" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "services_org_update" ON "public"."services" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.settings

- **Users can manage their own settings** — ALL; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2713](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2713).

<details>
<summary>Definiciones actuales de settings</summary>

```sql
CREATE POLICY "Users can manage their own settings" ON "public"."settings" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
```

</details>

#### public.staff

- **Staff org access** — ALL; authenticated; Candidata solapada: ALL antigua. [L2609](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2609).
- **staff_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3097](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3097).
- **staff_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3101](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3101).
- **staff_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3105](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3105).
- **staff_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3109](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3109).

<details>
<summary>Definiciones actuales de staff</summary>

```sql
CREATE POLICY "Staff org access" ON "public"."staff" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "staff_org_delete" ON "public"."staff" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "staff_org_insert" ON "public"."staff" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "staff_org_select" ON "public"."staff" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "staff_org_update" ON "public"."staff" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.user_profiles

- **Manage profile** — ALL; PUBLIC; Única ruta/compatibilidad: crear reemplazo antes de retirar. [L2549](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2549).
- **Select profile** — SELECT; PUBLIC; Reemplazar lectura global. [L2593](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2593).

<details>
<summary>Definiciones actuales de user_profiles</summary>

```sql
CREATE POLICY "Manage profile" ON "public"."user_profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Select profile" ON "public"."user_profiles" FOR SELECT USING (true);
```

</details>

#### public.website_book_categories

- **website_book_categories_org_all** — ALL; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3119](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3119).
- **website_book_categories_public_read** — SELECT; authenticated, anon; Preservar finalidad pública; validar publicación. [L3123](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3123).

<details>
<summary>Definiciones actuales de website_book_categories</summary>

```sql
CREATE POLICY "website_book_categories_org_all" ON "public"."website_book_categories" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_book_categories_public_read" ON "public"."website_book_categories" FOR SELECT TO "authenticated", "anon" USING (("active" = true));
```

</details>

#### public.website_book_category_links

- **website_book_category_links_org_all** — ALL; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3130](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3130).
- **website_book_category_links_public_read** — SELECT; authenticated, anon; Preservar lectura, restringir padres publicados. [L3138](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3138).

<details>
<summary>Definiciones actuales de website_book_category_links</summary>

```sql
CREATE POLICY "website_book_category_links_org_all" ON "public"."website_book_category_links" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."website_books" "b"
  WHERE (("b"."id" = "website_book_category_links"."book_id") AND "public"."is_org_member"("b"."organization_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."website_books" "b"
  WHERE (("b"."id" = "website_book_category_links"."book_id") AND "public"."is_org_member"("b"."organization_id")))));

CREATE POLICY "website_book_category_links_public_read" ON "public"."website_book_category_links" FOR SELECT TO "authenticated", "anon" USING (true);
```

</details>

#### public.website_books

- **Delete books** — DELETE; PUBLIC; Candidata solapada: histórica web. [L2493](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2493).
- **Insert books** — INSERT; PUBLIC; Candidata solapada: histórica web. [L2521](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2521).
- **Select books** — SELECT; PUBLIC; Candidata solapada: histórica web. [L2577](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2577).
- **Update books** — UPDATE; PUBLIC; Candidata solapada: histórica web. [L2617](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2617).
- **website_books_org_all** — ALL; authenticated; Candidata solapada: ALL anula DELETE admin. [L3145](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3145).
- **website_books_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3149](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3149).
- **website_books_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3153](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3153).
- **website_books_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3157](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3157).
- **website_books_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3161](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3161).
- **website_books_public_read** — SELECT; authenticated, anon; Preservar finalidad pública; validar publicación. [L3165](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3165).

<details>
<summary>Definiciones actuales de website_books</summary>

```sql
CREATE POLICY "Delete books" ON "public"."website_books" FOR DELETE USING ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));

CREATE POLICY "Insert books" ON "public"."website_books" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));

CREATE POLICY "Select books" ON "public"."website_books" FOR SELECT USING (("organization_id" = "public"."get_user_org_id"()));

CREATE POLICY "Update books" ON "public"."website_books" FOR UPDATE USING (("organization_id" = "public"."get_user_org_id"())) WITH CHECK ((("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text")));

CREATE POLICY "website_books_org_all" ON "public"."website_books" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_books_org_delete" ON "public"."website_books" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "website_books_org_insert" ON "public"."website_books" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_books_org_select" ON "public"."website_books" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_books_org_update" ON "public"."website_books" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_books_public_read" ON "public"."website_books" FOR SELECT TO "authenticated", "anon" USING ((("active" IS DISTINCT FROM false) AND ("visible" IS DISTINCT FROM false)));
```

</details>

#### public.website_exchange_rates

- **website_exchange_rates_auth_manage** — ALL; authenticated; Reemplazar escritura global. [L3172](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3172).
- **website_exchange_rates_public_read** — SELECT; authenticated, anon; Preservar finalidad pública; validar publicación. [L3176](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3176).

<details>
<summary>Definiciones actuales de website_exchange_rates</summary>

```sql
CREATE POLICY "website_exchange_rates_auth_manage" ON "public"."website_exchange_rates" TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "website_exchange_rates_public_read" ON "public"."website_exchange_rates" FOR SELECT TO "authenticated", "anon" USING (("active" = true));
```

</details>

#### public.website_footer_gallery

- **website_footer_gallery_org_all** — ALL; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3183](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3183).
- **website_footer_gallery_public_read** — SELECT; authenticated, anon; Preservar finalidad pública; validar publicación. [L3187](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3187).

<details>
<summary>Definiciones actuales de website_footer_gallery</summary>

```sql
CREATE POLICY "website_footer_gallery_org_all" ON "public"."website_footer_gallery" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_footer_gallery_public_read" ON "public"."website_footer_gallery" FOR SELECT TO "authenticated", "anon" USING (("active" = true));
```

</details>

#### public.website_footer_settings

- **website_footer_settings_org_all** — ALL; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3194](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3194).
- **website_footer_settings_public_read** — SELECT; authenticated, anon; Preservar finalidad pública; validar publicación. [L3198](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3198).

<details>
<summary>Definiciones actuales de website_footer_settings</summary>

```sql
CREATE POLICY "website_footer_settings_org_all" ON "public"."website_footer_settings" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_footer_settings_public_read" ON "public"."website_footer_settings" FOR SELECT TO "authenticated", "anon" USING (("active" = true));
```

</details>

#### public.website_hero_quick_services

- **website_hero_quick_services_org_all** — ALL; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3205](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3205).
- **website_hero_quick_services_public_read** — SELECT; authenticated, anon; Preservar finalidad pública; validar publicación. [L3209](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3209).

<details>
<summary>Definiciones actuales de website_hero_quick_services</summary>

```sql
CREATE POLICY "website_hero_quick_services_org_all" ON "public"."website_hero_quick_services" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_hero_quick_services_public_read" ON "public"."website_hero_quick_services" FOR SELECT TO "authenticated", "anon" USING (("active" = true));
```

</details>

#### public.website_hero_settings

- **website_hero_settings_org_all** — ALL; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3216](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3216).
- **website_hero_settings_public_read** — SELECT; authenticated, anon; Preservar finalidad pública; validar publicación. [L3220](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3220).

<details>
<summary>Definiciones actuales de website_hero_settings</summary>

```sql
CREATE POLICY "website_hero_settings_org_all" ON "public"."website_hero_settings" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_hero_settings_public_read" ON "public"."website_hero_settings" FOR SELECT TO "authenticated", "anon" USING (("active" = true));
```

</details>

#### public.website_leads

- **website_leads_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3227](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3227).
- **website_leads_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3231](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3231).
- **website_leads_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3235](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3235).
- **website_leads_public_insert** — INSERT; authenticated, anon; Preservar ingreso, restringir campos/tenant/abuso. [L3239](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3239).

<details>
<summary>Definiciones actuales de website_leads</summary>

```sql
CREATE POLICY "website_leads_org_delete" ON "public"."website_leads" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "website_leads_org_select" ON "public"."website_leads" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_leads_org_update" ON "public"."website_leads" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_leads_public_insert" ON "public"."website_leads" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);
```

</details>

#### public.website_links

- **Delete links** — DELETE; PUBLIC; Candidata solapada: histórica web. [L2497](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2497).
- **Insert links** — INSERT; PUBLIC; Candidata solapada: histórica web. [L2525](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2525).
- **Select links** — SELECT; PUBLIC; Candidata solapada: histórica web. [L2581](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2581).
- **Update links** — UPDATE; PUBLIC; Candidata solapada: histórica web. [L2621](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2621).
- **website_links_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3246](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3246).
- **website_links_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3250](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3250).
- **website_links_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3254](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3254).
- **website_links_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3258](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3258).

<details>
<summary>Definiciones actuales de website_links</summary>

```sql
CREATE POLICY "Delete links" ON "public"."website_links" FOR DELETE USING ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));

CREATE POLICY "Insert links" ON "public"."website_links" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));

CREATE POLICY "Select links" ON "public"."website_links" FOR SELECT USING (("organization_id" = "public"."get_user_org_id"()));

CREATE POLICY "Update links" ON "public"."website_links" FOR UPDATE USING (("organization_id" = "public"."get_user_org_id"())) WITH CHECK ((("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text")));

CREATE POLICY "website_links_org_delete" ON "public"."website_links" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "website_links_org_insert" ON "public"."website_links" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_links_org_select" ON "public"."website_links" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_links_org_update" ON "public"."website_links" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.website_sections

- **Delete sections** — DELETE; PUBLIC; Candidata solapada: histórica web. [L2501](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2501).
- **Insert sections** — INSERT; PUBLIC; Candidata solapada: histórica web. [L2529](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2529).
- **Select sections** — SELECT; PUBLIC; Candidata solapada: histórica web. [L2597](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2597).
- **Update sections** — UPDATE; PUBLIC; Candidata solapada: histórica web. [L2625](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2625).
- **website_sections_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3265](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3265).
- **website_sections_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3269](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3269).
- **website_sections_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3273](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3273).
- **website_sections_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3277](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3277).

<details>
<summary>Definiciones actuales de website_sections</summary>

```sql
CREATE POLICY "Delete sections" ON "public"."website_sections" FOR DELETE USING ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));

CREATE POLICY "Insert sections" ON "public"."website_sections" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));

CREATE POLICY "Select sections" ON "public"."website_sections" FOR SELECT USING (("organization_id" = "public"."get_user_org_id"()));

CREATE POLICY "Update sections" ON "public"."website_sections" FOR UPDATE USING (("organization_id" = "public"."get_user_org_id"())) WITH CHECK ((("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text")));

CREATE POLICY "website_sections_org_delete" ON "public"."website_sections" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "website_sections_org_insert" ON "public"."website_sections" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_sections_org_select" ON "public"."website_sections" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_sections_org_update" ON "public"."website_sections" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

#### public.website_services

- **Delete services** — DELETE; PUBLIC; Candidata solapada: histórica web. [L2505](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2505).
- **Insert services** — INSERT; PUBLIC; Candidata solapada: histórica web. [L2533](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2533).
- **Select services** — SELECT; PUBLIC; Candidata solapada: histórica web. [L2601](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2601).
- **Update services** — UPDATE; PUBLIC; Candidata solapada: histórica web. [L2629](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2629).
- **website_services_org_all** — ALL; authenticated; Candidata solapada: ALL anula DELETE admin. [L3284](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3284).
- **website_services_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3288](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3288).
- **website_services_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3292](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3292).
- **website_services_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3296](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3296).
- **website_services_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3300](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3300).
- **website_services_public_read** — SELECT; authenticated, anon; Preservar finalidad pública; validar publicación. [L3304](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3304).

<details>
<summary>Definiciones actuales de website_services</summary>

```sql
CREATE POLICY "Delete services" ON "public"."website_services" FOR DELETE USING ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));

CREATE POLICY "Insert services" ON "public"."website_services" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));

CREATE POLICY "Select services" ON "public"."website_services" FOR SELECT USING (("organization_id" = "public"."get_user_org_id"()));

CREATE POLICY "Update services" ON "public"."website_services" FOR UPDATE USING (("organization_id" = "public"."get_user_org_id"())) WITH CHECK ((("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text")));

CREATE POLICY "website_services_org_all" ON "public"."website_services" TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_services_org_delete" ON "public"."website_services" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "website_services_org_insert" ON "public"."website_services" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_services_org_select" ON "public"."website_services" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_services_org_update" ON "public"."website_services" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_services_public_read" ON "public"."website_services" FOR SELECT TO "authenticated", "anon" USING ((("active" IS DISTINCT FROM false) AND ("visible_on_website" IS DISTINCT FROM false)));
```

</details>

#### public.website_settings

- **Delete settings** — DELETE; PUBLIC; Candidata solapada: histórica web. [L2509](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2509).
- **Insert settings** — INSERT; PUBLIC; Candidata solapada: histórica web. [L2537](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2537).
- **Select settings** — SELECT; PUBLIC; Candidata solapada: histórica web. [L2605](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2605).
- **Update settings** — UPDATE; PUBLIC; Candidata solapada: histórica web. [L2633](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2633).
- **website_settings_org_delete** — DELETE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3311](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3311).
- **website_settings_org_insert** — INSERT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3315](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3315).
- **website_settings_org_select** — SELECT; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3319](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3319).
- **website_settings_org_update** — UPDATE; authenticated; Preservar finalidad; endurecer matriz rol/acción. [L3323](../../supabase/migrations/20261014031607_noveli_baseline.sql#L3323).

<details>
<summary>Definiciones actuales de website_settings</summary>

```sql
CREATE POLICY "Delete settings" ON "public"."website_settings" FOR DELETE USING ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));

CREATE POLICY "Insert settings" ON "public"."website_settings" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_org_id"()) AND (("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text"))));

CREATE POLICY "Select settings" ON "public"."website_settings" FOR SELECT USING (("organization_id" = "public"."get_user_org_id"()));

CREATE POLICY "Update settings" ON "public"."website_settings" FOR UPDATE USING (("organization_id" = "public"."get_user_org_id"())) WITH CHECK ((("public"."get_user_role"() IS NULL) OR ("public"."get_user_role"() <> 'solo lectura'::"text")));

CREATE POLICY "website_settings_org_delete" ON "public"."website_settings" FOR DELETE TO "authenticated" USING ("public"."is_org_admin"("organization_id"));

CREATE POLICY "website_settings_org_insert" ON "public"."website_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_settings_org_select" ON "public"."website_settings" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));

CREATE POLICY "website_settings_org_update" ON "public"."website_settings" FOR UPDATE TO "authenticated" USING ("public"."is_org_member"("organization_id")) WITH CHECK ("public"."is_org_member"("organization_id"));
```

</details>

### 10.4 Lista priorizada de las 84 FK sin índice

27 alta, 34 media, 23 baja. Índice candidato expresado solo como tabla(columnas); no se creó ningún índice.

#### Prioridad alta

| Tabla(columnas) | FK exacta | Referencia | Razón | Evidencia |
|---|---|---|---|---|
| `client_funds(client_id)` | `client_funds_client_id_fkey` | `public.clients` | Filtro relacional central identificado | [L1888](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1888) |
| `client_funds(organization_id)` | `client_funds_organization_id_fkey` | `public.organizations` | Filtro org automático/RLS en CRM | [L1893](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1893) |
| `company_settings(organization_id)` | `company_settings_organization_id_fkey` | `public.organizations` | Filtro org automático/RLS en CRM | [L1913](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1913) |
| `documents(client_id)` | `documents_client_id_fkey` | `public.clients` | Filtro relacional central identificado | [L1923](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1923) |
| `documents(expense_id)` | `documents_expense_id_fkey` | `public.expenses` | Filtro relacional central identificado | [L1928](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1928) |
| `documents(income_id)` | `documents_income_id_fkey` | `public.incomes` | Filtro relacional central identificado | [L1933](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1933) |
| `documents(quotation_id)` | `documents_quotation_id_fkey` | `public.quotations` | Filtro relacional central identificado | [L1948](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1948) |
| `documents(service_id)` | `documents_service_id_fkey` | `public.services` | Filtro relacional central identificado | [L1953](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1953) |
| `expenses(payroll_payment_id)` | `expenses_payroll_payment_id_fkey` | `public.payroll_payments` | Filtro relacional central identificado | [L1998](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1998) |
| `fund_movements(organization_id)` | `fund_movements_organization_id_fkey` | `public.organizations` | Filtro org automático/RLS en CRM | [L2043](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2043) |
| `income_allocations(income_id)` | `income_allocations_income_id_fkey` | `public.incomes` | Filtro relacional central identificado | [L2048](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2048) |
| `income_allocations(organization_id)` | `income_allocations_organization_id_fkey` | `public.organizations` | Filtro org automático/RLS en CRM | [L2053](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2053) |
| `income_distributions(income_id)` | `income_distributions_income_id_fkey` | `public.incomes` | Filtro relacional central identificado | [L2073](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2073) |
| `income_distributions(organization_id)` | `income_distributions_organization_id_fkey` | `public.organizations` | Filtro org automático/RLS en CRM | [L2078](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2078) |
| `income_tax_reservations(income_id)` | `income_tax_reservations_income_id_fkey` | `public.incomes` | Filtro relacional central identificado | [L2093](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2093) |
| `income_tax_reservations(organization_id)` | `income_tax_reservations_organization_id_fkey` | `public.organizations` | Filtro org automático/RLS en CRM | [L2098](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2098) |
| `incomes(client_id)` | `incomes_client_id_fkey` | `public.clients` | Filtro relacional central identificado | [L2103](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2103) |
| `incomes(prospect_id)` | `incomes_prospect_id_fkey` | `public.prospects` | Filtro relacional central identificado | [L2113](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2113) |
| `incomes(service_id)` | `incomes_service_id_fkey` | `public.services` | Filtro relacional central identificado | [L2118](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2118) |
| `notifications(organization_id)` | `notifications_organization_id_fkey` | `public.organizations` | Filtro org automático/RLS en CRM | [L2128](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2128) |
| `operational_reserve_movements(organization_id)` | `operational_reserve_movements_organization_id_fkey` | `public.organizations` | Filtro org automático/RLS en CRM | [L2143](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2143) |
| `payroll_payments(organization_id)` | `payroll_payments_organization_id_fkey` | `public.organizations` | Filtro org automático/RLS en CRM | [L2173](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2173) |
| `quotations(client_id)` | `quotations_client_id_fkey` | `public.clients` | Filtro relacional central identificado | [L2263](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2263) |
| `quotations(prospect_id)` | `quotations_prospect_id_fkey` | `public.prospects` | Filtro relacional central identificado | [L2283](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2283) |
| `services(client_id)` | `services_client_id_fkey` | `public.clients` | Filtro relacional central identificado | [L2368](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2368) |
| `staff(organization_id)` | `staff_organization_id_fkey` | `public.organizations` | Filtro org automático/RLS en CRM | [L2393](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2393) |
| `website_leads(organization_id)` | `website_leads_organization_id_fkey` | `public.organizations` | Filtro org automático/RLS en CRM | [L2468](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2468) |

#### Prioridad media

| Tabla(columnas) | FK exacta | Referencia | Razón | Evidencia |
|---|---|---|---|---|
| `agenda_events(client_id)` | `agenda_events_client_id_fkey` | `public.clients` | Módulo secundario/relación; validar frecuencia | [L1863](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1863) |
| `agenda_events(service_id)` | `agenda_events_service_id_fkey` | `public.services` | Módulo secundario/relación; validar frecuencia | [L1873](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1873) |
| `agenda_events(stage_id)` | `agenda_events_stage_id_fkey` | `public.service_stages` | Módulo secundario/relación; validar frecuencia | [L1878](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1878) |
| `client_funds(service_id)` | `client_funds_service_id_fkey` | `public.services` | Módulo secundario/relación; validar frecuencia | [L1898](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1898) |
| `documents(provider_id)` | `documents_provider_id_fkey` | `public.providers` | Módulo secundario/relación; validar frecuencia | [L1943](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1943) |
| `expenses(client_id)` | `expenses_client_id_fkey` | `public.clients` | Módulo secundario/relación; validar frecuencia | [L1983](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1983) |
| `expenses(fund_id)` | `expenses_fund_id_fkey` | `public.client_funds` | Módulo secundario/relación; validar frecuencia | [L1988](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1988) |
| `expenses(provider_id)` | `expenses_provider_id_fkey` | `public.providers` | Módulo secundario/relación; validar frecuencia | [L2003](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2003) |
| `expenses(service_id)` | `expenses_service_id_fkey` | `public.services` | Módulo secundario/relación; validar frecuencia | [L2008](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2008) |
| `fund_movements(expense_id)` | `fund_movements_expense_id_fkey` | `public.expenses` | Módulo secundario/relación; validar frecuencia | [L2028](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2028) |
| `fund_movements(fund_id)` | `fund_movements_fund_id_fkey` | `public.client_funds` | Módulo secundario/relación; validar frecuencia | [L2033](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2033) |
| `fund_movements(income_id)` | `fund_movements_income_id_fkey` | `public.incomes` | Módulo secundario/relación; validar frecuencia | [L2038](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2038) |
| `income_distributions(client_id)` | `income_distributions_client_id_fkey` | `public.clients` | Módulo secundario/relación; validar frecuencia | [L2063](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2063) |
| `income_distributions(prospect_id)` | `income_distributions_prospect_id_fkey` | `public.prospects` | Módulo secundario/relación; validar frecuencia | [L2083](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2083) |
| `income_distributions(service_id)` | `income_distributions_service_id_fkey` | `public.services` | Módulo secundario/relación; validar frecuencia | [L2088](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2088) |
| `payroll_payments(staff_id)` | `payroll_payments_staff_id_fkey` | `public.staff` | Módulo secundario/relación; validar frecuencia | [L2183](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2183) |
| `quotation_items(catalog_id)` | `quotation_items_catalog_id_fkey` | `public.service_catalog` | Módulo secundario/relación; validar frecuencia | [L2233](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2233) |
| `quotation_items(pack_id)` | `quotation_items_pack_id_fkey` | `public.service_packs` | Módulo secundario/relación; validar frecuencia | [L2243](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2243) |
| `quotation_items(service_id)` | `quotation_items_service_id_fkey` | `public.service_catalog` | Módulo secundario/relación; validar frecuencia | [L2253](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2253) |
| `quotations(service_id)` | `quotations_service_id_fkey` | `public.services` | Módulo secundario/relación; validar frecuencia | [L2288](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2288) |
| `service_pack_items(service_id)` | `service_pack_items_service_id_fkey` | `public.service_catalog` | Módulo secundario/relación; validar frecuencia | [L2333](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2333) |
| `website_book_categories(organization_id)` | `website_book_categories_organization_id_fkey` | `public.organizations` | Módulo secundario/relación; validar frecuencia | [L2408](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2408) |
| `website_book_categories(parent_id)` | `website_book_categories_parent_id_fkey` | `public.website_book_categories` | Módulo secundario/relación; validar frecuencia | [L2413](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2413) |
| `website_book_category_links(category_id)` | `website_book_category_links_category_id_fkey` | `public.website_book_categories` | Módulo secundario/relación; validar frecuencia | [L2423](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2423) |
| `website_books(organization_id)` | `website_books_organization_id_fkey` | `public.organizations` | Módulo secundario/relación; validar frecuencia | [L2428](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2428) |
| `website_footer_gallery(organization_id)` | `website_footer_gallery_organization_id_fkey` | `public.organizations` | Módulo secundario/relación; validar frecuencia | [L2433](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2433) |
| `website_footer_settings(organization_id)` | `website_footer_settings_organization_id_fkey` | `public.organizations` | Módulo secundario/relación; validar frecuencia | [L2438](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2438) |
| `website_hero_quick_services(organization_id)` | `website_hero_quick_services_organization_id_fkey` | `public.organizations` | Módulo secundario/relación; validar frecuencia | [L2443](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2443) |
| `website_hero_settings(featured_book_id)` | `website_hero_settings_featured_book_id_fkey` | `public.website_books` | Módulo secundario/relación; validar frecuencia | [L2448](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2448) |
| `website_hero_settings(organization_id)` | `website_hero_settings_organization_id_fkey` | `public.organizations` | Módulo secundario/relación; validar frecuencia | [L2453](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2453) |
| `website_links(organization_id)` | `website_links_organization_id_fkey` | `public.organizations` | Módulo secundario/relación; validar frecuencia | [L2473](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2473) |
| `website_sections(organization_id)` | `website_sections_organization_id_fkey` | `public.organizations` | Módulo secundario/relación; validar frecuencia | [L2478](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2478) |
| `website_services(organization_id)` | `website_services_organization_id_fkey` | `public.organizations` | Módulo secundario/relación; validar frecuencia | [L2483](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2483) |
| `website_settings(organization_id)` | `website_settings_organization_id_fkey` | `public.organizations` | Módulo secundario/relación; validar frecuencia | [L2488](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2488) |

#### Prioridad baja

| Tabla(columnas) | FK exacta | Referencia | Razón | Evidencia |
|---|---|---|---|---|
| `company_settings(user_id)` | `company_settings_user_id_fkey` | `auth.users` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L1918](../../supabase/migrations/20261014031607_noveli_baseline.sql#L1918) |
| `expenses(source_income_id)` | `expenses_source_income_id_fkey` | `public.incomes` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2013](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2013) |
| `fund_movements(created_by)` | `fund_movements_created_by_fkey` | `auth.users` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2023](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2023) |
| `income_allocations(user_id)` | `income_allocations_user_id_fkey` | `auth.users` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2058](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2058) |
| `income_distributions(created_by)` | `income_distributions_created_by_fkey` | `auth.users` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2068](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2068) |
| `notifications(user_id)` | `notifications_user_id_fkey` | `auth.users` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2133](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2133) |
| `operational_reserve_movements(distribution_id)` | `operational_reserve_movements_distribution_id_fkey` | `public.income_distributions` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2138](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2138) |
| `operational_reserve_movements(source_income_id)` | `operational_reserve_movements_source_income_id_fkey` | `public.incomes` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2148](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2148) |
| `operational_reserve_movements(user_id)` | `operational_reserve_movements_user_id_fkey` | `auth.users` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2153](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2153) |
| `payroll_payments(distribution_id)` | `payroll_payments_distribution_id_fkey` | `public.income_distributions` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2168](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2168) |
| `payroll_payments(source_income_id)` | `payroll_payments_source_income_id_fkey` | `public.incomes` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2178](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2178) |
| `payroll_payments(user_id)` | `payroll_payments_user_id_fkey` | `auth.users` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2188](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2188) |
| `prospects(converted_client_id)` | `prospects_converted_client_id_fkey` | `public.clients` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2193](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2193) |
| `prospects(converted_to_client_id)` | `prospects_converted_to_client_id_fkey` | `public.clients` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2198](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2198) |
| `quotation_items(user_id)` | `quotation_items_user_id_fkey` | `auth.users` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2258](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2258) |
| `quotations(converted_client_id)` | `quotations_converted_client_id_fkey` | `public.clients` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2268](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2268) |
| `quotations(converted_prospect_id)` | `quotations_converted_prospect_id_fkey` | `public.prospects` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2273](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2273) |
| `service_checklists(user_id)` | `service_checklists_user_id_fkey` | `auth.users` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2318](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2318) |
| `service_pack_items(user_id)` | `service_pack_items_user_id_fkey` | `auth.users` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2338](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2338) |
| `service_stages(user_id)` | `service_stages_user_id_fkey` | `auth.users` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2363](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2363) |
| `staff(user_id)` | `staff_user_id_fkey` | `auth.users` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2398](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2398) |
| `website_leads(converted_prospect_id)` | `website_leads_converted_prospect_id_fkey` | `public.prospects` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2458](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2458) |
| `website_leads(converted_quotation_id)` | `website_leads_converted_quotation_id_fkey` | `public.quotations` | Autoría/conversión/trazabilidad; filtro frecuente no demostrado | [L2463](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2463) |

#### FK ya cubiertas (44): no añadir índice duplicado

| FK | Cobertura |
|---|---|
| `activity_log(organization_id)` | `idx_activity_log_org_id` |
| `activity_log(user_id)` | `idx_activity_log_user_id` |
| `agenda_events(organization_id)` | `idx_agenda_events_org_id` |
| `agenda_events(user_id)` | `idx_agenda_events_user_id` |
| `clients(organization_id)` | `idx_clients_org_id` |
| `clients(user_id)` | `idx_clients_user_id` |
| `documents(organization_id)` | `idx_documents_org_id` |
| `documents(user_id)` | `idx_documents_user_id` |
| `editorial_stages(organization_id)` | `idx_editorial_stages_org_id` |
| `editorial_stages(user_id)` | `idx_editorial_stages_user_id` |
| `exchange_rates(organization_id)` | `idx_exchange_rates_org_id` |
| `exchange_rates(user_id)` | `idx_exchange_rates_user_id` |
| `expenses(organization_id)` | `idx_expenses_org_id` |
| `expenses(user_id)` | `idx_expenses_user_id` |
| `incomes(organization_id)` | `idx_incomes_org_id` |
| `incomes(user_id)` | `idx_incomes_user_id` |
| `organization_members(organization_id)` | `idx_organization_members_org, organization_members_organization_id_user_id_key` |
| `organization_members(user_id)` | `idx_organization_members_user` |
| `prospects(organization_id)` | `idx_prospects_org_id` |
| `prospects(user_id)` | `idx_prospects_user_id` |
| `providers(organization_id)` | `idx_providers_org_id` |
| `providers(user_id)` | `idx_providers_user_id` |
| `quick_replies(organization_id)` | `idx_quick_replies_org_id` |
| `quick_replies(user_id)` | `idx_quick_replies_user_id` |
| `quotation_items(organization_id)` | `idx_quotation_items_org_id` |
| `quotation_items(quotation_id)` | `idx_quotation_items_quot` |
| `quotations(organization_id)` | `idx_quotations_org_id` |
| `quotations(user_id)` | `idx_quotations_user_id` |
| `service_catalog(organization_id)` | `idx_catalog_org_id` |
| `service_catalog(user_id)` | `idx_catalog_user_id` |
| `service_checklists(organization_id)` | `idx_service_checklists_org_id` |
| `service_checklists(service_id)` | `idx_service_checklists_serv` |
| `service_pack_items(organization_id)` | `idx_pack_items_org_id` |
| `service_pack_items(pack_id)` | `idx_pack_items_pack` |
| `service_packs(organization_id)` | `idx_packs_org_id` |
| `service_packs(user_id)` | `idx_packs_user_id` |
| `service_stages(organization_id)` | `idx_service_stages_org_id` |
| `service_stages(service_id)` | `idx_service_stages_serv` |
| `services(organization_id)` | `idx_services_org_id` |
| `services(user_id)` | `idx_services_user_id` |
| `settings(organization_id)` | `idx_settings_org_id` |
| `settings(user_id)` | `idx_settings_user_id` |
| `user_profiles(id)` | `user_profiles_pkey` |
| `website_book_category_links(book_id)` | `website_book_category_links_book_id_category_id_key` |

### 10.5 Archivos con referencias a funciones

Se muestran todas las rutas de código/proyecto encontradas, con primera línea y conteo. Cachés .temp contienen las cinco por duplicación de catálogos y no se consideran uso de aplicación.

#### get_user_org_id

- [schema.sql:36](../../schema.sql#L36): 141 líneas; SQL histórico.
- [supabase_migration_14.sql:5](../../supabase_migration_14.sql#L5): 5 líneas; SQL histórico.
- [supabase_migration_24.sql:13](../../supabase_migration_24.sql#L13): 25 líneas; SQL histórico.
- [supabase_migration_35.sql:9](../../supabase_migration_35.sql#L9): 2 líneas; SQL histórico.
- [supabase_migration_38.sql:5](../../supabase_migration_38.sql#L5): 8 líneas; SQL histórico.
- [supabase_migration_40.sql:5](../../supabase_migration_40.sql#L5): 6 líneas; SQL histórico.
- [supabase_migration_41.sql:6](../../supabase_migration_41.sql#L6): 12 líneas; SQL histórico.
- [supabase_migration_43.sql:6](../../supabase_migration_43.sql#L6): 12 líneas; SQL histórico.
- [supabase_migration_44.sql:6](../../supabase_migration_44.sql#L6): 12 líneas; SQL histórico.
- [supabase_migration_9.sql:7](../../supabase_migration_9.sql#L7): 15 líneas; SQL histórico.
- [supabase_migration_schema_guard.sql:134](../../supabase_migration_schema_guard.sql#L134): 8 líneas; SQL histórico.
- [supabase/migrations/20261014031607_noveli_baseline.sql:80](../../supabase/migrations/20261014031607_noveli_baseline.sql#L80): 54 líneas; baseline actual.

#### get_user_role

- [schema.sql:45](../../schema.sql#L45): 83 líneas; SQL histórico.
- [supabase_migration_14.sql:25](../../supabase_migration_14.sql#L25): 3 líneas; SQL histórico.
- [supabase_migration_24.sql:32](../../supabase_migration_24.sql#L32): 15 líneas; SQL histórico.
- [supabase_migration_35.sql:17](../../supabase_migration_35.sql#L17): 1 líneas; SQL histórico.
- [supabase_migration_38.sql:8](../../supabase_migration_38.sql#L8): 6 líneas; SQL histórico.
- [supabase_migration_40.sql:39](../../supabase_migration_40.sql#L39): 2 líneas; SQL histórico.
- [supabase_migration_41.sql:35](../../supabase_migration_41.sql#L35): 4 líneas; SQL histórico.
- [supabase_migration_43.sql:37](../../supabase_migration_43.sql#L37): 4 líneas; SQL histórico.
- [supabase_migration_44.sql:42](../../supabase_migration_44.sql#L42): 4 líneas; SQL histórico.
- [supabase_migration_9.sql:44](../../supabase_migration_9.sql#L44): 9 líneas; SQL histórico.
- [supabase/migrations/20261014031607_noveli_baseline.sql:93](../../supabase/migrations/20261014031607_noveli_baseline.sql#L93): 22 líneas; baseline actual.

#### is_org_admin

- [supabase/migrations/20261014031607_noveli_baseline.sql:106](../../supabase/migrations/20261014031607_noveli_baseline.sql#L106): 29 líneas; baseline actual.

#### is_org_member

- [supabase/migrations/20261014031607_noveli_baseline.sql:124](../../supabase/migrations/20261014031607_noveli_baseline.sql#L124): 82 líneas; baseline actual.

#### get_public_schema_columns

- [supabase/migrations/20261014031607_noveli_baseline.sql:62](../../supabase/migrations/20261014031607_noveli_baseline.sql#L62): 5 líneas; baseline actual.

### 10.6 Índice de valores de rol por archivo

Palabras completas, incluyendo etiquetas/comentarios/proveedores. No cada coincidencia es autorización; la clasificación semántica está en sección 3.

#### admin

- [src/App.jsx:1152](../../src/App.jsx#L1152): 2 líneas; frontend/JS.
- [src/supabaseClient.js:942](../../src/supabaseClient.js#L942): 2 líneas; frontend/JS.
- [src/utils.js:743](../../src/utils.js#L743): 2 líneas; frontend/JS.
- [src/components/AuditTestingCenter.jsx:846](../../src/components/AuditTestingCenter.jsx#L846): 2 líneas; frontend/JS.
- [src/components/UsersPermissions.jsx:9](../../src/components/UsersPermissions.jsx#L9): 1 líneas; frontend/JS.
- [supabase/migrations/20261014031607_noveli_baseline.sql:116](../../supabase/migrations/20261014031607_noveli_baseline.sql#L116): 1 líneas; baseline.

#### administrador

- [schema.sql:21](../../schema.sql#L21): 10 líneas; SQL histórico.
- [src/App.jsx:470](../../src/App.jsx#L470): 4 líneas; frontend/JS.
- [src/supabaseClient.js:952](../../src/supabaseClient.js#L952): 4 líneas; frontend/JS.
- [src/utils.js:231](../../src/utils.js#L231): 4 líneas; frontend/JS.
- [src/components/AuditTestingCenter.jsx:832](../../src/components/AuditTestingCenter.jsx#L832): 6 líneas; frontend/JS.
- [src/components/Clients.jsx:116](../../src/components/Clients.jsx#L116): 1 líneas; frontend/JS.
- [src/components/Configuration.jsx:377](../../src/components/Configuration.jsx#L377): 4 líneas; frontend/JS.
- [src/components/Prospects.jsx:13](../../src/components/Prospects.jsx#L13): 1 líneas; frontend/JS.
- [src/components/Quotations.jsx:93](../../src/components/Quotations.jsx#L93): 1 líneas; frontend/JS.
- [src/components/UsersPermissions.jsx:9](../../src/components/UsersPermissions.jsx#L9): 1 líneas; frontend/JS.
- [supabase/migrations/20261014031607_noveli_baseline.sql:2541](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2541): 2 líneas; baseline.

#### editor

- [schema.sql:21](../../schema.sql#L21): 1 líneas; SQL histórico.
- [supabase_migration.sql:3](../../supabase_migration.sql#L3): 1 líneas; SQL histórico.
- [supabase_migration_2.sql:3](../../supabase_migration_2.sql#L3): 1 líneas; SQL histórico.
- [src/supabaseClient.js:928](../../src/supabaseClient.js#L928): 1 líneas; frontend/JS.
- [src/utils.js:231](../../src/utils.js#L231): 2 líneas; frontend/JS.
- [src/components/Configuration.jsx:378](../../src/components/Configuration.jsx#L378): 1 líneas; frontend/JS.
- [src/components/Login.jsx:50](../../src/components/Login.jsx#L50): 1 líneas; frontend/JS.
- [src/components/QuickQuoteModal.jsx:57](../../src/components/QuickQuoteModal.jsx#L57): 1 líneas; frontend/JS.
- [src/components/Quotations.jsx:106](../../src/components/Quotations.jsx#L106): 3 líneas; frontend/JS.
- [src/components/Staff.jsx:919](../../src/components/Staff.jsx#L919): 1 líneas; frontend/JS.
- [src/components/UsersPermissions.jsx:11](../../src/components/UsersPermissions.jsx#L11): 5 líneas; frontend/JS.

#### diseñador

- [schema.sql:21](../../schema.sql#L21): 2 líneas; SQL histórico.
- [src/supabaseClient.js:55](../../src/supabaseClient.js#L55): 2 líneas; frontend/JS.
- [src/utils.js:695](../../src/utils.js#L695): 1 líneas; frontend/JS.
- [src/components/AuditTestingCenter.jsx:719](../../src/components/AuditTestingCenter.jsx#L719): 1 líneas; frontend/JS.
- [src/components/Configuration.jsx:379](../../src/components/Configuration.jsx#L379): 1 líneas; frontend/JS.
- [src/components/Providers.jsx:23](../../src/components/Providers.jsx#L23): 5 líneas; frontend/JS.
- [src/components/Staff.jsx:919](../../src/components/Staff.jsx#L919): 1 líneas; frontend/JS.
- [src/components/UsersPermissions.jsx:14](../../src/components/UsersPermissions.jsx#L14): 1 líneas; frontend/JS.
- [supabase/migrations/20261014031607_noveli_baseline.sql:735](../../supabase/migrations/20261014031607_noveli_baseline.sql#L735): 1 líneas; baseline.

#### corrector

- [schema.sql:21](../../schema.sql#L21): 1 líneas; SQL histórico.
- [src/utils.js:703](../../src/utils.js#L703): 1 líneas; frontend/JS.
- [src/components/Agenda.jsx:826](../../src/components/Agenda.jsx#L826): 1 líneas; frontend/JS.
- [src/components/Configuration.jsx:380](../../src/components/Configuration.jsx#L380): 1 líneas; frontend/JS.
- [src/components/UsersPermissions.jsx:12](../../src/components/UsersPermissions.jsx#L12): 1 líneas; frontend/JS.

#### contador

- [schema.sql:21](../../schema.sql#L21): 2 líneas; SQL histórico.
- [src/utils.js:711](../../src/utils.js#L711): 1 líneas; frontend/JS.
- [src/components/Configuration.jsx:381](../../src/components/Configuration.jsx#L381): 1 líneas; frontend/JS.
- [src/components/Integrations.jsx:37](../../src/components/Integrations.jsx#L37): 1 líneas; frontend/JS.
- [src/components/Providers.jsx:146](../../src/components/Providers.jsx#L146): 2 líneas; frontend/JS.
- [supabase/migrations/20261014031607_noveli_baseline.sql:735](../../supabase/migrations/20261014031607_noveli_baseline.sql#L735): 1 líneas; baseline.

#### solo lectura

- [schema.sql:21](../../schema.sql#L21): 77 líneas; SQL histórico.
- [supabase_migration_14.sql:25](../../supabase_migration_14.sql#L25): 3 líneas; SQL histórico.
- [supabase_migration_24.sql:32](../../supabase_migration_24.sql#L32): 15 líneas; SQL histórico.
- [supabase_migration_38.sql:8](../../supabase_migration_38.sql#L8): 6 líneas; SQL histórico.
- [supabase_migration_40.sql:39](../../supabase_migration_40.sql#L39): 2 líneas; SQL histórico.
- [supabase_migration_41.sql:35](../../supabase_migration_41.sql#L35): 4 líneas; SQL histórico.
- [supabase_migration_43.sql:37](../../supabase_migration_43.sql#L37): 4 líneas; SQL histórico.
- [supabase_migration_44.sql:42](../../supabase_migration_44.sql#L42): 4 líneas; SQL histórico.
- [supabase_migration_9.sql:44](../../supabase_migration_9.sql#L44): 9 líneas; SQL histórico.
- [src/App.jsx:573](../../src/App.jsx#L573): 14 líneas; frontend/JS.
- [src/utils.js:718](../../src/utils.js#L718): 4 líneas; frontend/JS.
- [src/components/AuditTestingCenter.jsx:1109](../../src/components/AuditTestingCenter.jsx#L1109): 1 líneas; frontend/JS.
- [src/components/Configuration.jsx:382](../../src/components/Configuration.jsx#L382): 1 líneas; frontend/JS.
- [supabase/migrations/20261014031607_noveli_baseline.sql:2493](../../supabase/migrations/20261014031607_noveli_baseline.sql#L2493): 15 líneas; baseline.

## 11. Integridad y límites

Baseline SHA-256: `C41D2D67C856F1D50CDFF9A27A739D8655F93844A7876301795AC0AFF1B42620`; 136434 bytes. Coincide con la huella comprobada antes de esta auditoría. No se editaron fuentes, SQL ni config: único artefacto escrito es este documento.

Las conclusiones se basan en análisis estático. No se midieron datos, planes, frecuencia real ni ACL efectivos del sistema vivo. No se ejecutaron pruebas de explotación ni SQL de este informe. Las necesidades exactas de la web externa y roles almacenados requieren revisión autorizada posterior.
