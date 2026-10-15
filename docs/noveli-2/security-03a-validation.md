# Seguridad 03A: consolidación RLS de WEB y membresías

Fecha: 2026-10-15. Migración: `supabase/migrations/20261015030234_harden_security_03a_rls_web.sql`, creada con `supabase migration new harden_security_03a_rls_web`.

## Checkpoint y alcance

Commit de Seguridad 02: **df21a50**, `chore(noveli-2): harden roles and read-only access`. Incluyó once archivos aprobados (migración 02, SQL de pruebas 02, runner compatible 01, utilidad/tests de roles, cinco archivos frontend y validación 02). Se confirmó `nothing to commit, working tree clean` antes de iniciar 03A. No se hizo push. Los archivos temporales/.temp/Docker no se incluyeron.

Referencias: [auditoría](security-audit.md), [validación 01](security-01-validation.md), [validación 02](security-02-validation.md). No se modificaron esos documentos históricos, el baseline, las migraciones 01/02 ni sus pruebas. Frontend sin cambios en esta fase.

El trabajo 03A se limita a las quince tablas solicitadas. No se modificaron políticas de clients/prospects/quotations ni del resto del CRM, estructura comercial, índices, orders, payments, projects o colaboradores. No hubo consultas/cambios remotos, db push, db pull, reset --linked ni migration repair.

## Conteos y comparación real

Se capturó pg_policies local antes de modificarlo y se compararon por tabla/nombre **comando, roles, USING, WITH CHECK y permissive/restrictive**. El inventario previo completo de cada política retirada queda reproducido abajo; los motivos no se basan en nombres.

| Métrica | Antes | Después |
|---|---:|---:|
| Políticas totales public | 290 | 284 |
| Permisivas | 164 | 158 |
| Restrictivas | 126 | 126 |
| Políticas dentro del alcance | 106 | 100 |
| Políticas fuera del alcance | 184 | 184, idénticas |
| Tablas public | 46 | 46 |
| Funciones public | 6 | 6 |
| Índices explícitos idx_* | 42 | 42 |

**54 políticas existentes eliminadas y 48 creadas**. Una política existente se modifica sin eliminarla: `website_book_category_links_public_read`. Las dos políticas de website_exchange_rates se conservan exactamente porque ya cumplen el modelo de admin activo + lectura pública activa; no se eliminan por estética.

Los **126 guards restrictivos de Seguridad 02 permanecen idénticos**, no solo en cantidad: comparación íntegra del catálogo ordenado, incluidos comandos/roles/predicados. SHA-256 de su JSON canónico ordenado: `50b84854c605e3ad3b96f1830158f9df0c01a0a93cc6caa5e6eed31d09e4adc2`.

Los DROP IF EXISTS de nombres nuevos permiten reaplicar 03A; en la primera aplicación esos nombres aún no existían y no se cuentan como políticas antiguas eliminadas. No se ejecutó limpieza global de las 41 candidatas del audit.

## Modelo final por tabla

En CMS, los guards se combinan con las permisivas mediante AND. Miembro significa membresía activa evaluada sobre la organización de la fila; escritor utiliza is_org_writer, no un rol arbitrario retornado por LIMIT 1. Visualizador/desconocido/inactivo no escriben CMS. Usuarios desconocidos sin membresía solo pueden consumir publicaciones/formularios como visitantes.

| Tabla | Lectura interna | INSERT / UPDATE | DELETE | Lectura pública |
|---|---|---|---|---|
| organization_members | Miembro activo de la misma org; directorio de miembros usado por CRM | Admin activo de esa org | Admin activo de esa org | Ninguna |
| user_profiles | Solo perfil propio authenticated | Solo perfil propio, preservado de 01/02 | Solo propio, preservado de 01/02 | Ninguna |
| website_settings | Miembro activo | Escritor de org | Admin de org | Ninguna: no hay consumidor público versionado que justifique abrirla |
| website_sections | Miembro activo | Escritor de org | Admin de org | Ninguna añadida |
| website_services | Miembro activo, incluidas filas privadas | Escritor de org | Admin de org | active/visible_on_website IS DISTINCT FROM false, como antes |
| website_books | Miembro activo, incluidas filas privadas | Escritor de org | Admin de org | active/visible IS DISTINCT FROM false, como antes |
| website_links | Miembro activo | Escritor de org | Admin de org | Ninguna añadida |
| website_book_categories | Miembro activo | Escritor de org | Escritor de org | active=true |
| website_book_category_links | Miembro activo de la org del libro | Escritor del libro; categoría, si no es NULL, debe pertenecer a la misma org | Escritor del libro; permite retirar relaciones antiguas inválidas | Solo libro publicado + categoría activa del mismo tenant |
| website_hero_settings | Miembro activo | Escritor de org | Escritor de org | active=true |
| website_hero_quick_services | Miembro activo | Escritor de org | Escritor de org | active=true |
| website_footer_settings | Miembro activo | Escritor de org | Escritor de org | active=true |
| website_footer_gallery | Miembro activo | Escritor de org | Escritor de org | active=true |
| website_exchange_rates | Tasas activas públicas; admin activo de alguna org también ve inactivas | Solo admin activo de alguna org; tabla global | Solo admin activo de alguna org | active=true |
| website_leads | Miembro activo de la org | Ingreso público acotado o escritor de org para INSERT; escritor de org para UPDATE | Admin activo de org | Ninguna |

Los cinco DELETE admin-only de settings/sections/services/books/links se conservan de las políticas granulares más fuertes preexistentes. Antes podían ser eludidos por otras permisivas. La consolidación hace efectiva esa restricción: los demás escritores conservan INSERT/UPDATE, pero ya no ese borrado. No es una equivalencia completa de permisos efectivos; es un endurecimiento explícito conforme al objetivo. La UI puede seguir mostrando algunos botones de borrar a escritores y recibir un rechazo RLS: ajuste de presentación pendiente, sin rediseñar componentes ahora.

Se eliminan Manage members/Select members (PUBLIC, helpers LIMIT 1) y se retienen las cuatro reglas modernas de membresía/admin parametrizadas y sus tres guards. No queda get_user_role/get_user_org_id en las políticas de las quince tablas. Los defaults de algunas tablas siguen usando get_user_org_id y no se modificaron.

profiles_self_access reemplaza las dos políticas de perfil por ALL authenticated con auth.uid=id en USING y WITH CHECK. No hay lectura adicional de perfiles ajenos ni directorio anónimo. La edición de cuenta propia sigue siendo una excepción deliberada al solo-lectura comercial, igual que en Seguridad 02.

Se mantienen las nueve finalidades públicas preexistentes; no se abren settings/sections/links a anon. El consumidor web externo no está versionado en este repositorio: su necesidad exacta no se certifica mediante navegador. Se validó el contrato de datos y se preservaron las reglas específicas existentes, excepto la fuga de asociaciones de libros/categorías ocultas o cruzadas, ahora cerrada. Las asociaciones NULL siguen admitidas internamente por compatibilidad y no se publican.

## Website_leads: corrección sin reestructurar el formulario

### Vulnerabilidad constatada

website_leads_public_insert era INSERT TO anon,authenticated WITH CHECK true. Un visitante podía elegir cualquier organization_id existente y fijar status, notes, converted_to_proposal/prospect, referencias de conversión, is_test y test_run_id. El default no impedía sobrescribir esos campos. No existe assigned_to en el baseline; un payload con esa columna no es parte del contrato actual.

### Resultado aplicado

- `website_leads_public_submit` mantiene INSERT público para anon/authenticated, **sin SELECT**, y exige el tenant `11111111-1111-1111-1111-111111111111`, exactamente el default existente del baseline. No se añade un tenant ni se actualizan datos. El formulario puede omitir organization_id o enviar ese mismo valor; otro tenant o NULL se rechaza.
- Campos públicos de contacto/solicitud siguen funcionando: name, email, phone, instagram, service_interest, message, manuscript_info, source, accepted_terms y accepted_terms_at.
- Los campos internos deben conservar los valores iniciales: status='nuevo'; notes NULL; flags converted_* false; referencias converted_*_id NULL; is_test=false; test_run_id NULL. Pueden enviarse explícitamente esos defaults; no pueden manipularse para otro estado.
- No se revoca INSERT por columnas ni se cambia su JSON/endpoint. El límite se aplica por valores en RLS; no se afirma que exista una allowlist de privilegios por columna.
- `website_leads_internal_insert` permite a un escritor activo crear leads de su org con campos internos; `website_leads_internal_update` permite gestión por escritor y comprueba el tenant nuevo también. Se conservan la SELECT de miembro activo y DELETE admin existentes.
- Visualizador/inactivo/desconocido no gestionan leads. Pueden enviar un formulario público válido como cualquier visitante; esta excepción no concede acceso de administración ni lectura.
- El CRM en Website.jsx solo gestiona estado y conversiones mediante UPDATE; esos flujos permanecen disponibles para escritores. No se modificó su contrato ni su código.

### Límites y propuesta posterior

El tenant público está fijado al default actual de Noveli, no es una solución genérica multi-sitio. Si el sitio público usa otro tenant o defaults internos distintos, debe revisarse su integración antes de despliegue. No se inspeccionaron payloads del sitio externo; las pruebas usan los campos/defaults documentados del baseline.

id, created_at, updated_at, source y evidencia de consentimiento siguen pudiendo ser enviados por el cliente. No deben tratarse como prueba confiable de origen/fecha/consentimiento. Próxima propuesta: endpoint/Edge Function de ingreso con allowlist explícita, tenant resuelto en servidor, timestamps de servidor, validación de consentimiento y rate-limit/CAPTCHA. No se implementó esa reestructuración ni se bloquean campos de contacto legítimos por suposiciones.

El guard general de Seguridad 02 sigue excluyendo leads para no bloquear formularios. En esta fase su gestión se limita por políticas específicas, sin añadir SELECT público. No existe ninguna otra permisiva ALL/UPDATE que permita eludir el writer check de leads en el catálogo revisado.

## Pruebas ejecutadas

### Antes de aplicar 03A

- security_01_after_02.py: pasó sobre esquema 02.
- security_02_roles.sql original e intacto: pasó sobre esquema 02 con ROLLBACK.
- Los archivos de tests 01/02 y migraciones anteriores se compararon contra el checkpoint y permanecen intactos.

### Después de supabase db reset local

`supabase db reset` sin --linked: **código 0**, aplicó baseline + 01 + 02 + 03A. Avisos de DROP IF EXISTS para nombres nuevos y seed.sql ausente; no errores SQL.

`security_03a_regressions.py` conserva las fuentes antiguas y adapta expectativas explícitas en memoria:

- 01: 158 permisivas después de consolidar, mismas cinco funciones originales, payroll no tocado, fixture visualizador compatible con CHECK 02. **49 comprobaciones PASS**.
- 02: 284 políticas, replay solo de su preflight/mapeo de roles (reaplicar sus políticas antiguas desharía la consolidación), DELETE admin-only en los cinco CMS, formulario fijado al tenant default. **274 comprobaciones PASS**. Se mantienen los casos de los cinco escritores, visualizador, desconocido, inactivo, nueve lecturas públicas, ACL, TRUNCATE y multi-org.

No se declara que los conteos/fixtures originales sean válidos literalmente sobre un esquema consolidado. El runner separado evita editar tests protegidos y conserva verificaciones de acceso acordes con los endurecimientos intencionales.

`security_03a_rls_web.sql`: **código 0, marcador ALL_CHECKS_PASSED_AND_ROLLED_BACK**. Prueba DML sobre las once tablas CMS, administración de miembros/perfiles/leads, roles admin/editor/visualizador/inactivo/desconocido y contexto anon real. Se ejecutó con psql ON_ERROR_STOP=1 dentro de supabase_db_CRM_NOVELI, con fixtures dentro de BEGIN/ROLLBACK.

| Verificación | Resultado |
|---|---|
| Admin CMS y membresías | INSERT/UPDATE/DELETE autorizados |
| Escritores no admin | INSERT/UPDATE conservados; DELETE según restricción más fuerte |
| Visualizador | Lee contenido interno permitido, no escribe ni se autoeleva |
| Inactivo | No lee CMS privado ni administra; sin escritura |
| Desconocido con CHECK temporalmente retirado solo en test | Sin escritura CMS/leads |
| Anon | Sin perfiles/membresías/leads; sin gestión CMS |
| Publicaciones | Nueve SELECT legítimos preservados; no asociaciones privadas/cruzadas |
| Formulario válido | Inserta con campos públicos y tenant/defaults correctos |
| Tenant ajeno/NULL en lead público | Rechazado |
| status/notes/conversiones/test flags en lead público | Rechazados |
| Gestión interna de leads | Writer de org permitido; viewer/inactivo/desconocido bloqueados |
| Multi-org | Writer A/viewer B no escribe ni mueve filas hacia B |
| Categoría de otro tenant | INSERT de asociación rechazado |
| Guard 02 y políticas fuera de alcance | Definiciones idénticas antes/después |
| Fixtures | 0 usuarios de prueba y 0 leads restantes |

Los tests manipulan temporalmente CHECK/roles/filas para escenarios negativos dentro del rollback; no forman parte de la migración. No se ejecutó un login o formulario real en navegador ni peticiones contra producción.

### Frontend

- `node --test src/utils/roles.test.js`: **4/4 pasan**.
- `npm run build`: **código 0**; mismos avisos de sourcemap Tailwind y chunk >500 kB.
- No se modificó src, package.json, dependencias ni componentes en 03A. El lint general previo de 02 no se reaborda en esta fase SQL.

## Políticas eliminadas: reemplazo y motivo

La tabla enumera las 54 retiradas reales en la primera aplicación. Los reemplazos nuevos se crean en la misma migración; en membresías se conservan políticas modernas ya existentes. El anexo posterior conserva cada predicado anterior para revisión independiente.

| tabla | política eliminada | reemplazo | motivo |
|---|---|---|---|
| `organization_members` | `Manage members` | `admins_can_insert_members / admins_can_update_members / admins_can_delete_members / members_can_read_same_org` | PUBLIC + tenant LIMIT 1 sustituido por membresía/admin activo de la org solicitada; guards intactos. |
| `organization_members` | `Select members` | `members_can_read_same_org` | PUBLIC + tenant LIMIT 1 sustituido por membresía/admin activo de la org solicitada; guards intactos. |
| `user_profiles` | `Manage profile` | `profiles_self_access` | Acceso propio equivalente mediante una sola política authenticated; sin PUBLIC ni directorio global. |
| `user_profiles` | `Select profile` | `profiles_self_access` | Acceso propio equivalente mediante una sola política authenticated; sin PUBLIC ni directorio global. |
| `website_settings` | `Delete settings` | `website_settings_cms_delete` | Conservar y hacer efectiva la restricción admin de DELETE ya existente, eliminando la ruta alternativa writer/member. |
| `website_settings` | `Insert settings` | `website_settings_cms_insert` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_settings` | `Select settings` | `website_settings_cms_select` | Lectura interna de miembro activo explícita, sin PUBLIC ni selección arbitraria de tenant; publicación aparte. |
| `website_settings` | `Update settings` | `website_settings_cms_update` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_settings` | `website_settings_org_delete` | `website_settings_cms_delete` | Conservar y hacer efectiva la restricción admin de DELETE ya existente, eliminando la ruta alternativa writer/member. |
| `website_settings` | `website_settings_org_insert` | `website_settings_cms_insert` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_settings` | `website_settings_org_select` | `website_settings_cms_select` | Lectura interna de miembro activo explícita, sin PUBLIC ni selección arbitraria de tenant; publicación aparte. |
| `website_settings` | `website_settings_org_update` | `website_settings_cms_update` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_sections` | `Delete sections` | `website_sections_cms_delete` | Conservar y hacer efectiva la restricción admin de DELETE ya existente, eliminando la ruta alternativa writer/member. |
| `website_sections` | `Insert sections` | `website_sections_cms_insert` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_sections` | `Select sections` | `website_sections_cms_select` | Lectura interna de miembro activo explícita, sin PUBLIC ni selección arbitraria de tenant; publicación aparte. |
| `website_sections` | `Update sections` | `website_sections_cms_update` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_sections` | `website_sections_org_delete` | `website_sections_cms_delete` | Conservar y hacer efectiva la restricción admin de DELETE ya existente, eliminando la ruta alternativa writer/member. |
| `website_sections` | `website_sections_org_insert` | `website_sections_cms_insert` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_sections` | `website_sections_org_select` | `website_sections_cms_select` | Lectura interna de miembro activo explícita, sin PUBLIC ni selección arbitraria de tenant; publicación aparte. |
| `website_sections` | `website_sections_org_update` | `website_sections_cms_update` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_services` | `Delete services` | `website_services_cms_delete` | Conservar y hacer efectiva la restricción admin de DELETE ya existente, eliminando la ruta alternativa writer/member. |
| `website_services` | `Insert services` | `website_services_cms_insert` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_services` | `Select services` | `website_services_cms_select` | Lectura interna de miembro activo explícita, sin PUBLIC ni selección arbitraria de tenant; publicación aparte. |
| `website_services` | `Update services` | `website_services_cms_update` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_services` | `website_services_org_all` | `website_services_cms_select / website_services_cms_insert / website_services_cms_update / website_services_cms_delete` | Dividir SELECT activo y escrituras writer por comando; conservar DELETE admin donde existía y guards. |
| `website_services` | `website_services_org_delete` | `website_services_cms_delete` | Conservar y hacer efectiva la restricción admin de DELETE ya existente, eliminando la ruta alternativa writer/member. |
| `website_services` | `website_services_org_insert` | `website_services_cms_insert` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_services` | `website_services_org_select` | `website_services_cms_select` | Lectura interna de miembro activo explícita, sin PUBLIC ni selección arbitraria de tenant; publicación aparte. |
| `website_services` | `website_services_org_update` | `website_services_cms_update` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_books` | `Delete books` | `website_books_cms_delete` | Conservar y hacer efectiva la restricción admin de DELETE ya existente, eliminando la ruta alternativa writer/member. |
| `website_books` | `Insert books` | `website_books_cms_insert` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_books` | `Select books` | `website_books_cms_select` | Lectura interna de miembro activo explícita, sin PUBLIC ni selección arbitraria de tenant; publicación aparte. |
| `website_books` | `Update books` | `website_books_cms_update` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_books` | `website_books_org_all` | `website_books_cms_select / website_books_cms_insert / website_books_cms_update / website_books_cms_delete` | Dividir SELECT activo y escrituras writer por comando; conservar DELETE admin donde existía y guards. |
| `website_books` | `website_books_org_delete` | `website_books_cms_delete` | Conservar y hacer efectiva la restricción admin de DELETE ya existente, eliminando la ruta alternativa writer/member. |
| `website_books` | `website_books_org_insert` | `website_books_cms_insert` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_books` | `website_books_org_select` | `website_books_cms_select` | Lectura interna de miembro activo explícita, sin PUBLIC ni selección arbitraria de tenant; publicación aparte. |
| `website_books` | `website_books_org_update` | `website_books_cms_update` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_links` | `Delete links` | `website_links_cms_delete` | Conservar y hacer efectiva la restricción admin de DELETE ya existente, eliminando la ruta alternativa writer/member. |
| `website_links` | `Insert links` | `website_links_cms_insert` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_links` | `Select links` | `website_links_cms_select` | Lectura interna de miembro activo explícita, sin PUBLIC ni selección arbitraria de tenant; publicación aparte. |
| `website_links` | `Update links` | `website_links_cms_update` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_links` | `website_links_org_delete` | `website_links_cms_delete` | Conservar y hacer efectiva la restricción admin de DELETE ya existente, eliminando la ruta alternativa writer/member. |
| `website_links` | `website_links_org_insert` | `website_links_cms_insert` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_links` | `website_links_org_select` | `website_links_cms_select` | Lectura interna de miembro activo explícita, sin PUBLIC ni selección arbitraria de tenant; publicación aparte. |
| `website_links` | `website_links_org_update` | `website_links_cms_update` | Consolidar el comando bajo writer activo; mismo alcance interno protegido por guard; publicación aparte. |
| `website_book_categories` | `website_book_categories_org_all` | `website_book_categories_cms_select / website_book_categories_cms_insert / website_book_categories_cms_update / website_book_categories_cms_delete` | Dividir SELECT activo y escrituras writer por comando; conservar DELETE admin donde existía y guards. |
| `website_hero_settings` | `website_hero_settings_org_all` | `website_hero_settings_cms_select / website_hero_settings_cms_insert / website_hero_settings_cms_update / website_hero_settings_cms_delete` | Dividir SELECT activo y escrituras writer por comando; conservar DELETE admin donde existía y guards. |
| `website_hero_quick_services` | `website_hero_quick_services_org_all` | `website_hero_quick_services_cms_select / website_hero_quick_services_cms_insert / website_hero_quick_services_cms_update / website_hero_quick_services_cms_delete` | Dividir SELECT activo y escrituras writer por comando; conservar DELETE admin donde existía y guards. |
| `website_footer_settings` | `website_footer_settings_org_all` | `website_footer_settings_cms_select / website_footer_settings_cms_insert / website_footer_settings_cms_update / website_footer_settings_cms_delete` | Dividir SELECT activo y escrituras writer por comando; conservar DELETE admin donde existía y guards. |
| `website_footer_gallery` | `website_footer_gallery_org_all` | `website_footer_gallery_cms_select / website_footer_gallery_cms_insert / website_footer_gallery_cms_update / website_footer_gallery_cms_delete` | Dividir SELECT activo y escrituras writer por comando; conservar DELETE admin donde existía y guards. |
| `website_book_category_links` | `website_book_category_links_org_all` | `website_book_category_links_cms_select / website_book_category_links_cms_insert / website_book_category_links_cms_update / website_book_category_links_cms_delete` | Separar comandos; writer del libro y coherencia de tenant de categoría; lectura pública aparte. |
| `website_leads` | `website_leads_org_update` | `website_leads_internal_update` | Separar ingreso público acotado y gestión writer; cerrar tenant/campos internos o edición por visualizador. |
| `website_leads` | `website_leads_public_insert` | `website_leads_public_submit / website_leads_internal_insert` | Separar ingreso público acotado y gestión writer; cerrar tenant/campos internos o edición por visualizador. |

## Anexo: comparación íntegra de las políticas retiradas

Definiciones del catálogo antes de 03A. Todas eran PERMISSIVE; se muestran comando, roles, USING y WITH CHECK para no confundir nombre con equivalencia. Los reemplazos y motivos están en la tabla anterior.

### organization_members / Manage members

- Comando: `ALL`; roles: `public`; tipo: `PERMISSIVE`.
- Reemplazo: `admins_can_insert_members / admins_can_update_members / admins_can_delete_members / members_can_read_same_org`.

USING:

```sql
((organization_id = get_user_org_id()) AND (get_user_role() = 'admin'::text))
```

WITH CHECK:

```sql
((organization_id = get_user_org_id()) AND (get_user_role() = 'admin'::text))
```

### organization_members / Select members

- Comando: `SELECT`; roles: `public`; tipo: `PERMISSIVE`.
- Reemplazo: `members_can_read_same_org`.

USING:

```sql
(organization_id = get_user_org_id())
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### user_profiles / Manage profile

- Comando: `ALL`; roles: `public`; tipo: `PERMISSIVE`.
- Reemplazo: `profiles_self_access`.

USING:

```sql
(auth.uid() = id)
```

WITH CHECK:

```sql
(auth.uid() = id)
```

### user_profiles / Select profile

- Comando: `SELECT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `profiles_self_access`.

USING:

```sql
(( SELECT auth.uid() AS uid) = id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_settings / Delete settings

- Comando: `DELETE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_settings_cms_delete`.

USING:

```sql
is_org_writer(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_settings / Insert settings

- Comando: `INSERT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_settings_cms_insert`.

USING:

```sql
-- No especificado
```

WITH CHECK:

```sql
is_org_writer(organization_id)
```

### website_settings / Select settings

- Comando: `SELECT`; roles: `public`; tipo: `PERMISSIVE`.
- Reemplazo: `website_settings_cms_select`.

USING:

```sql
(organization_id = get_user_org_id())
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_settings / Update settings

- Comando: `UPDATE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_settings_cms_update`.

USING:

```sql
is_org_writer(organization_id)
```

WITH CHECK:

```sql
is_org_writer(organization_id)
```

### website_settings / website_settings_org_delete

- Comando: `DELETE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_settings_cms_delete`.

USING:

```sql
is_org_admin(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_settings / website_settings_org_insert

- Comando: `INSERT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_settings_cms_insert`.

USING:

```sql
-- No especificado
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_settings / website_settings_org_select

- Comando: `SELECT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_settings_cms_select`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_settings / website_settings_org_update

- Comando: `UPDATE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_settings_cms_update`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_sections / Delete sections

- Comando: `DELETE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_sections_cms_delete`.

USING:

```sql
is_org_writer(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_sections / Insert sections

- Comando: `INSERT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_sections_cms_insert`.

USING:

```sql
-- No especificado
```

WITH CHECK:

```sql
is_org_writer(organization_id)
```

### website_sections / Select sections

- Comando: `SELECT`; roles: `public`; tipo: `PERMISSIVE`.
- Reemplazo: `website_sections_cms_select`.

USING:

```sql
(organization_id = get_user_org_id())
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_sections / Update sections

- Comando: `UPDATE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_sections_cms_update`.

USING:

```sql
is_org_writer(organization_id)
```

WITH CHECK:

```sql
is_org_writer(organization_id)
```

### website_sections / website_sections_org_delete

- Comando: `DELETE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_sections_cms_delete`.

USING:

```sql
is_org_admin(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_sections / website_sections_org_insert

- Comando: `INSERT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_sections_cms_insert`.

USING:

```sql
-- No especificado
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_sections / website_sections_org_select

- Comando: `SELECT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_sections_cms_select`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_sections / website_sections_org_update

- Comando: `UPDATE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_sections_cms_update`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_services / Delete services

- Comando: `DELETE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_services_cms_delete`.

USING:

```sql
is_org_writer(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_services / Insert services

- Comando: `INSERT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_services_cms_insert`.

USING:

```sql
-- No especificado
```

WITH CHECK:

```sql
is_org_writer(organization_id)
```

### website_services / Select services

- Comando: `SELECT`; roles: `public`; tipo: `PERMISSIVE`.
- Reemplazo: `website_services_cms_select`.

USING:

```sql
(organization_id = get_user_org_id())
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_services / Update services

- Comando: `UPDATE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_services_cms_update`.

USING:

```sql
is_org_writer(organization_id)
```

WITH CHECK:

```sql
is_org_writer(organization_id)
```

### website_services / website_services_org_all

- Comando: `ALL`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_services_cms_select / website_services_cms_insert / website_services_cms_update / website_services_cms_delete`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_services / website_services_org_delete

- Comando: `DELETE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_services_cms_delete`.

USING:

```sql
is_org_admin(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_services / website_services_org_insert

- Comando: `INSERT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_services_cms_insert`.

USING:

```sql
-- No especificado
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_services / website_services_org_select

- Comando: `SELECT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_services_cms_select`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_services / website_services_org_update

- Comando: `UPDATE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_services_cms_update`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_books / Delete books

- Comando: `DELETE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_books_cms_delete`.

USING:

```sql
is_org_writer(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_books / Insert books

- Comando: `INSERT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_books_cms_insert`.

USING:

```sql
-- No especificado
```

WITH CHECK:

```sql
is_org_writer(organization_id)
```

### website_books / Select books

- Comando: `SELECT`; roles: `public`; tipo: `PERMISSIVE`.
- Reemplazo: `website_books_cms_select`.

USING:

```sql
(organization_id = get_user_org_id())
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_books / Update books

- Comando: `UPDATE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_books_cms_update`.

USING:

```sql
is_org_writer(organization_id)
```

WITH CHECK:

```sql
is_org_writer(organization_id)
```

### website_books / website_books_org_all

- Comando: `ALL`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_books_cms_select / website_books_cms_insert / website_books_cms_update / website_books_cms_delete`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_books / website_books_org_delete

- Comando: `DELETE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_books_cms_delete`.

USING:

```sql
is_org_admin(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_books / website_books_org_insert

- Comando: `INSERT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_books_cms_insert`.

USING:

```sql
-- No especificado
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_books / website_books_org_select

- Comando: `SELECT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_books_cms_select`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_books / website_books_org_update

- Comando: `UPDATE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_books_cms_update`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_links / Delete links

- Comando: `DELETE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_links_cms_delete`.

USING:

```sql
is_org_writer(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_links / Insert links

- Comando: `INSERT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_links_cms_insert`.

USING:

```sql
-- No especificado
```

WITH CHECK:

```sql
is_org_writer(organization_id)
```

### website_links / Select links

- Comando: `SELECT`; roles: `public`; tipo: `PERMISSIVE`.
- Reemplazo: `website_links_cms_select`.

USING:

```sql
(organization_id = get_user_org_id())
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_links / Update links

- Comando: `UPDATE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_links_cms_update`.

USING:

```sql
is_org_writer(organization_id)
```

WITH CHECK:

```sql
is_org_writer(organization_id)
```

### website_links / website_links_org_delete

- Comando: `DELETE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_links_cms_delete`.

USING:

```sql
is_org_admin(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_links / website_links_org_insert

- Comando: `INSERT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_links_cms_insert`.

USING:

```sql
-- No especificado
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_links / website_links_org_select

- Comando: `SELECT`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_links_cms_select`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
-- No especificado; para ALL/UPDATE se hereda USING cuando corresponde
```

### website_links / website_links_org_update

- Comando: `UPDATE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_links_cms_update`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_book_categories / website_book_categories_org_all

- Comando: `ALL`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_book_categories_cms_select / website_book_categories_cms_insert / website_book_categories_cms_update / website_book_categories_cms_delete`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_hero_settings / website_hero_settings_org_all

- Comando: `ALL`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_hero_settings_cms_select / website_hero_settings_cms_insert / website_hero_settings_cms_update / website_hero_settings_cms_delete`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_hero_quick_services / website_hero_quick_services_org_all

- Comando: `ALL`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_hero_quick_services_cms_select / website_hero_quick_services_cms_insert / website_hero_quick_services_cms_update / website_hero_quick_services_cms_delete`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_footer_settings / website_footer_settings_org_all

- Comando: `ALL`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_footer_settings_cms_select / website_footer_settings_cms_insert / website_footer_settings_cms_update / website_footer_settings_cms_delete`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_footer_gallery / website_footer_gallery_org_all

- Comando: `ALL`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_footer_gallery_cms_select / website_footer_gallery_cms_insert / website_footer_gallery_cms_update / website_footer_gallery_cms_delete`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_book_category_links / website_book_category_links_org_all

- Comando: `ALL`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_book_category_links_cms_select / website_book_category_links_cms_insert / website_book_category_links_cms_update / website_book_category_links_cms_delete`.

USING:

```sql
(EXISTS ( SELECT 1
   FROM website_books b
  WHERE ((b.id = website_book_category_links.book_id) AND is_org_member(b.organization_id))))
```

WITH CHECK:

```sql
(EXISTS ( SELECT 1
   FROM website_books b
  WHERE ((b.id = website_book_category_links.book_id) AND is_org_member(b.organization_id))))
```

### website_leads / website_leads_org_update

- Comando: `UPDATE`; roles: `authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_leads_internal_update`.

USING:

```sql
is_org_member(organization_id)
```

WITH CHECK:

```sql
is_org_member(organization_id)
```

### website_leads / website_leads_public_insert

- Comando: `INSERT`; roles: `anon, authenticated`; tipo: `PERMISSIVE`.
- Reemplazo: `website_leads_public_submit / website_leads_internal_insert`.

USING:

```sql
-- No especificado
```

WITH CHECK:

```sql
true
```

## Inventario final del alcance

| Tabla | Permisivas | Restrictivas | Total |
|---|---:|---:|---:|
| `organization_members` | 4 | 3 | 7 |
| `user_profiles` | 1 | 0 | 1 |
| `website_settings` | 4 | 3 | 7 |
| `website_sections` | 4 | 3 | 7 |
| `website_services` | 5 | 3 | 8 |
| `website_books` | 5 | 3 | 8 |
| `website_links` | 4 | 3 | 7 |
| `website_book_categories` | 5 | 3 | 8 |
| `website_book_category_links` | 5 | 3 | 8 |
| `website_hero_settings` | 5 | 3 | 8 |
| `website_hero_quick_services` | 5 | 3 | 8 |
| `website_footer_settings` | 5 | 3 | 8 |
| `website_footer_gallery` | 5 | 3 | 8 |
| `website_exchange_rates` | 2 | 0 | 2 |
| `website_leads` | 5 | 0 | 5 |

## Riesgos pendientes e integridad

- UI de borrado para no-admin puede requerir ocultar acciones ahora rechazadas por RLS; no se rediseñaron componentes.
- Ingreso público sigue necesitando controles contra spam y atribución confiable; no se implementó backend/antiabuso ni un registro de tenants públicos multi-sitio.
- Publicaciones existentes mantienen IS DISTINCT FROM false en libros/servicios; NULL puede publicar. No se filtraron is_test ni columnas en otras tablas sin revisar sus consumidores externos.
- Helpers antiguos/defaults LIMIT 1, coherencia de tenant en otras FK, matriz por módulo, última membresía admin y limpieza RLS del resto del CRM quedan pendientes. No se tocó esa estructura.
- service_role/postgres siguen siendo privilegiados; los guards de authenticated no pretenden restringirlos.
- Baseline SHA-256 intacto: `C41D2D67C856F1D50CDFF9A27A739D8655F93844A7876301795AC0AFF1B42620`. Migraciones/pruebas 01/02 sin diferencias respecto a df21a50 (normalización LF/CRLF de Git considerada).
- 03A se deja sin commit para revisión. Solo se agregan su migración, sus pruebas/runners y este documento; no quedan snapshots temporales en el cambio final.
