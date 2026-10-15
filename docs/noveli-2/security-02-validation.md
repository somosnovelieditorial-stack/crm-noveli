# Seguridad 02: roles y escritura restrictiva

Migración: `supabase/migrations/20261015023731_harden_security_02_roles.sql`, creada mediante `supabase migration new harden_security_02_roles`.

Checkpoint previo: `e1b2b76` (`chore(noveli-2): establish baseline and security phase 01`). Los cambios de Seguridad 02 se dejan sin commit para revisión. No se hizo push ni se consultó/modificó el remoto.

## Roles y normalización

Roles canónicos: **admin, editor, diseñador, corrector, finanzas, visualizador**.

| Alias histórico aprobado | Canónico |
|---|---|
| administrador | admin |
| direccion | admin |
| maquetador | diseñador |
| asistente | editor |
| contador | finanzas |
| solo lectura | visualizador |

Antes: el frontend asignaba nueve IDs (incluidos direccion/maquetador/asistente) y usaba además administrador/contador/solo lectura en controles anteriores. Después: el selector solo permite los seis canónicos y una utilidad central interpreta los seis aliases durante la transición. No se añaden roles.

La base local tenía **0 membresías** antes de la implementación; por tanto, **0 filas locales reales requirieron normalización**. Las pruebas insertaron los seis aliases dentro de una transacción y confirmaron sus seis conversiones, preservando canónicos e inactivos. Todos los fixtures se revirtieron.

**Cantidad en producción: desconocida, no consultada.** No confundir la base local vacía con datos productivos. La migración comprueba primero si hay roles no mapeados y aborta antes de actualizar si los encuentra. Después modifica exclusivamente aliases y agrega el CHECK canónico. La reproducción y reaplicación local se probaron. CHECK no convierte roles desconocidos: los rechaza.

Una inspección productiva futura necesitará autorización; la consulta de inventario sería:

```sql
SELECT role, count(*) FROM public.organization_members GROUP BY role;
SELECT count(*) AS aliases_a_normalizar
FROM public.organization_members
WHERE role IN ('administrador','direccion','maquetador','asistente','contador','solo lectura');
```

Estas consultas se documentan, **no se ejecutaron en producción**.

## Helper final

```sql
CREATE OR REPLACE FUNCTION public.is_org_writer(org_uuid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT org_uuid IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.organization_members AS membership
        WHERE membership.organization_id = org_uuid
          AND membership.user_id = auth.uid()
          AND membership.active = true
          AND membership.role IN ('admin','editor','diseñador','corrector','finanzas')
    );
$$;
```

SECURITY DEFINER evita recursión: el helper se usa también en guards de organization_members. Propietario postgres, tabla/auth.uid cualificados, search_path vacío. Se revoca EXECUTE de PUBLIC/anon y se concede a authenticated/service_role/postgres. No hay tenant nulo válido ni selección arbitraria con LIMIT 1. Visualizador, desconocido, inactivo y ausencia de membresía devuelven false.

## Guards restrictivos: inventario exacto

Se agregan tres políticas **AS RESTRICTIVE TO authenticated** por tabla: INSERT con WITH CHECK; UPDATE con USING y WITH CHECK; DELETE con USING. Todas exigen is_org_writer(organization_id), salvo la asociación de categorías que resuelve el libro padre. No se agregan guards de SELECT ni se eliminan las políticas permisivas históricas.

| Tabla con organization_id | Protección |
|---|---|
| activity_log | INSERT / UPDATE / DELETE |
| agenda_events | INSERT / UPDATE / DELETE |
| client_funds | INSERT / UPDATE / DELETE |
| clients | INSERT / UPDATE / DELETE |
| company_settings | INSERT / UPDATE / DELETE |
| documents | INSERT / UPDATE / DELETE |
| editorial_stages | INSERT / UPDATE / DELETE |
| exchange_rates | INSERT / UPDATE / DELETE |
| expenses | INSERT / UPDATE / DELETE |
| fund_movements | INSERT / UPDATE / DELETE |
| income_allocations | INSERT / UPDATE / DELETE |
| income_distributions | INSERT / UPDATE / DELETE |
| income_tax_reservations | INSERT / UPDATE / DELETE |
| incomes | INSERT / UPDATE / DELETE |
| notifications | INSERT / UPDATE / DELETE |
| operational_reserve_movements | INSERT / UPDATE / DELETE |
| organization_members | INSERT / UPDATE / DELETE |
| payroll_payments | INSERT / UPDATE / DELETE |
| prospects | INSERT / UPDATE / DELETE |
| providers | INSERT / UPDATE / DELETE |
| quick_replies | INSERT / UPDATE / DELETE |
| quotation_items | INSERT / UPDATE / DELETE |
| quotations | INSERT / UPDATE / DELETE |
| service_catalog | INSERT / UPDATE / DELETE |
| service_checklists | INSERT / UPDATE / DELETE |
| service_pack_items | INSERT / UPDATE / DELETE |
| service_packs | INSERT / UPDATE / DELETE |
| service_stages | INSERT / UPDATE / DELETE |
| services | INSERT / UPDATE / DELETE |
| settings | INSERT / UPDATE / DELETE |
| staff | INSERT / UPDATE / DELETE |
| website_book_categories | INSERT / UPDATE / DELETE |
| website_books | INSERT / UPDATE / DELETE |
| website_footer_gallery | INSERT / UPDATE / DELETE |
| website_footer_settings | INSERT / UPDATE / DELETE |
| website_hero_quick_services | INSERT / UPDATE / DELETE |
| website_hero_settings | INSERT / UPDATE / DELETE |
| website_links | INSERT / UPDATE / DELETE |
| website_sections | INSERT / UPDATE / DELETE |
| website_services | INSERT / UPDATE / DELETE |
| website_settings | INSERT / UPDATE / DELETE |

**Tabla adicional:** website_book_category_links recibe los tres guards mediante EXISTS sobre website_books.id=book_id e is_org_writer(book.organization_id). No tiene organization_id propio; omitirla permitiría a visualizador modificar asociaciones de catálogo público.

Total: **42 tablas, 126 políticas restrictivas nuevas**. Las permisivas aplicables deben seguir permitiendo la operación: un guard no otorga permisos adicionales. Los writers conservan su alcance previo; no todos los módulos se vuelven accesibles a todo writer.

### Exclusiones deliberadas

| Tabla | Decisión |
|---|---|
| website_leads | Sin guard ni cambios RLS: preservar formulario público, incluido ingreso de solicitudes por visitantes/usuarios. Este ingreso es una excepción deliberada al bloqueo de escritura interna; su riesgo de campos/destino sigue pendiente. |
| user_profiles | Sin guard de organización: sin organization_id. Conserva lectura/escritura de perfil propio de Seguridad 01, incluso para visualizador; no es autorización de escritura comercial. |
| organizations | Sin guard is_org_writer: utiliza id como tenant y ya exige admin para escribir. Se ajusta el literal histórico administrador a admin para evitar bloqueo después del mapeo. |
| website_exchange_rates | Sin guard is_org_writer: tabla global, ya exige admin activo desde Seguridad 01. |

No existen orders/payments/projects/colaboradores en el baseline y no se tocaron ni crearon. La lista explícita de guards no se extiende automáticamente a tablas futuras.

### TRUNCATE: vía que RLS no cubre

El baseline concedía TRUNCATE a roles API mediante GRANT ALL. Se revoca únicamente TRUNCATE de anon/authenticated sobre las **46 tablas explícitas del baseline**, ya que RLS no lo restringe. También deja de estar disponible para admins que operen como authenticated; su INSERT/UPDATE/DELETE autorizado se conserva. Se mantienen service_role/postgres y no se toca ninguna tabla futura implícitamente. Esto no afecta formularios ni lecturas públicas. Se verificó ausencia de ese privilegio en las 46 tablas.

## Cambios mínimos en políticas existentes

- Las 15 escrituras históricas Insert/Update/Delete de website_settings/sections/services/books/links conservan sus nombres, pero pasan a TO authenticated e is_org_writer(organization_id). UPDATE comprueba origen y destino. Desaparecen de esas escrituras los predicados get_user_role IS NULL o distinto de solo lectura.
- Las nueve políticas públicas específicas de SELECT permanecen intactas.
- Manage organization y Manage members cambian el literal administrador a admin, manteniendo su alcance previo. Sin esto, la normalización bloquearía su ruta administrativa histórica. No se consolidan otras políticas.
- No se eliminan las 41 históricas completas ni otras candidatas por semejanza. DROP POLICY IF EXISTS se usa solo para recrear idempotentemente los nuevos guards, no para limpiar políticas anteriores.

## Frontend

Nueva utilidad `src/utils/roles.js`: catálogo canónico/etiquetas, aliases, normalizeRole, isAdminRole, isWriterRole y comprobaciones de módulo/acción. Un desconocido se normaliza a null y no obtiene acceso ni escritura; visualizador conserva lectura de sus módulos y no acciones de escritura.

- utils.js usa la utilidad; hasPermission vuelve a respetar el role recibido. El rol de membresía cacheado prima sobre el rol de un Auth user antiguo; un valor desconocido no cae en permisos de escritor.
- App normaliza membresías/estado y deja de iniciar con administrador. Sus controles de administración usan isAdminRole.
- UsersPermissions ofrece solo seis roles, normaliza valores al guardar y no convierte un desconocido automáticamente a editor.
- Configuration y AuditTestingCenter reconocen admin canónico mediante la utilidad. permissions.all deja de interpretarse visualmente como un rol admin.
- Se conservan los ámbitos de módulo anteriores para editor/diseñador/corrector y el ámbito financiero anterior de contador bajo finanzas. No se rediseña el CRM ni se implementa autorización por JSON permissions.

## Pruebas y resultados

### PostgreSQL local

1. `supabase db reset`: código 0 con baseline + 01 + 02. Tras incorporar la revocación de TRUNCATE se volvió a reproducir todo desde cero.
2. `supabase db reset --version 20261015021942`: reconstrucción **solo local** hasta fase 01 para ejecutar **security_01_critical.sql original e intacto**, que pasó. Después se ejecutó otro reset local completo, dejando finalmente Seguridad 02 aplicada.
3. `python supabase/tests/security_01_after_02.py`: pasó sobre esquema 02. Runner separado, sin modificar el SQL original: ajusta en memoria únicamente conteos para considerar las cinco funciones/164 políticas permisivas originales, las cinco permisivas de payroll y reemplaza el fixture administrador por visualizador (el CHECK 02 prohíbe aliases nuevos). Mantiene todos los controles de acceso 01. La conversión administrador→admin se verifica en la suite 02.
4. `security_02_roles.sql`: pasó. Copiada con migrations como carpeta hermana dentro del contenedor local, ejecutada por psql ON_ERROR_STOP=1. Todas las operaciones de fixtures/replays están dentro de BEGIN/ROLLBACK.

La prueba original 01 no puede ejecutarse literalmente sobre esquema 02 porque fija 5 funciones/164 políticas y crea administrador: no se ocultó esa incompatibilidad ni se editó el archivo validado. El runner nuevo conserva sus protecciones bajo el esquema nuevo. No se requiere modificar baseline ni migración 01.

| Caso | Resultado |
|---|---|
| Seis aliases normalizados | Correctos; canónicos intactos |
| Reaplicar migración 02 dos veces en transacción de prueba | Correcto, sin duplicar guards |
| CHECK con rol desconocido | Rechazado |
| Helper con rol desconocido incluso al retirar temporalmente CHECK dentro del test | False; INSERT/UPDATE/DELETE bloqueados en las ocho tablas probadas |
| Helper con org NULL, org ajena o membresía visualizador en otro tenant | False |
| Admin activo | SELECT/INSERT/UPDATE/DELETE funcionan en los casos probados |
| Editor/diseñador/corrector/finanzas | Conservan INSERT/UPDATE y DELETE propio donde ya permitido |
| Visualizador | Lee datos permitidos; INSERT rechazado, UPDATE/DELETE cero filas |
| Autoelevación de visualizador en organization_members | Bloqueada |
| Inactivo | Helpers falsos; no escribe ni su propio cliente autorizado por ownership antiguo |
| Anon | Sin acceso interno adicional; DML rechazado en los casos probados |
| Nueve SELECT públicos de libros/servicios/categorías/asociaciones/footer/hero/tasas | Preservados |
| Formulario website_leads | INSERT público preservado |
| Seguridad 01: perfiles propios/metadatos/tasas/admin/inactivo | Regresión pasó |
| TRUNCATE de roles API | Revocado en 46 tablas |

Pruebas DML completas sobre clients, cinco tablas legacy website, website_book_categories y website_book_category_links para todos los seis roles, inactivo y desconocido. Se comprueba además metadato de cobertura de cada una de las 42 tablas; no se fabricaron fixtures de negocio para las otras 34. La autorización se prueba con SET ROLE authenticated/anon real y claims de sesión, no solo con postgres. Las condiciones temporales de test (drop/recreate CHECK para aliases y desconocidos) se revierten y no se incluyen en la migración.

Se corrigió una consulta de privilegios del test que confundía nombres de tablas temporales con public; fue un error del test, no de la migración. La suite final terminó con código 0. Se comprobaron **0 usuarios y 0 leads de prueba restantes**.

### Estado final

| Métrica | Antes de fase 02 | Después |
|---|---:|---:|
| Tablas public | 46 | 46 |
| Funciones public | 5 | 6 |
| Políticas permisivas | 164 | 164 |
| Políticas restrictivas | 0 | 126 |
| Total políticas | 164 | 290 |
| Índices explícitos idx_* | 42 | 42 |
| RLS habilitado | 46 tablas | 46 tablas |

### Frontend

- `node --test src/utils/roles.test.js`: **4/4 pruebas pasan**, incluidos aliases, visualizador, desconocidos/nombres heredados de objetos y conservación de ámbitos de módulos.
- `npm run build`: **código 0**. Avisos de chunk >500 kB, sourcemap Tailwind y tiempo de plugins; no impiden compilar.
- `npm run lint`: **404 errores y 22 warnings** del repositorio. Comparación ESLint de los cinco archivos modificados contra HEAD: mismos diagnósticos por regla, salvo utils.js que reduce dos no-unused-vars y un no-empty. Los dos archivos nuevos roles.js/roles.test.js tienen cero diagnósticos. No se amplió el trabajo a reparar errores existentes ajenos a esta fase.
- No hay script npm test previo; se añadieron las pruebas unitarias de roles con node:test sin instalar dependencias. No se hizo login o recorrido end-to-end en navegador.

## Integridad y riesgos pendientes

Baseline sin cambios, SHA-256 `C41D2D67C856F1D50CDFF9A27A739D8655F93844A7876301795AC0AFF1B42620`. Migración 01 y security_01_critical.sql también sin diferencias respecto al checkpoint.

- La limpieza completa de históricas y permisos por módulo/acción sigue pendiente. Los cinco roles escritores mantienen autorización general previa; no se convierte finanzas en un rol estrictamente financiero mediante RLS en esta fase.
- website_leads mantiene su ingreso abierto y riesgos de columnas/destino/spam: excluido por instrucción. Un visualizador aún puede enviar una solicitud pública, como cualquier visitante. user_profiles conserva actualización de perfil propio: no se promete impedir todas las escrituras de cuenta personal.
- No cambia selección UI por data[0] ni helpers antiguos LIMIT 1; is_org_writer sí evalúa el tenant solicitado. Los writers aún pueden mover filas entre organizaciones donde sean escritores si otras reglas lo permiten; la coherencia entre FK de distintos tenants requiere otra fase.
- Los SELECT públicos existentes pueden publicar NULL/filas de prueba y asociaciones de padres ocultos; no se amplió ni corrigió esa exposición aquí.
- El alta de miembros aún depende de get_user_id_by_email ausente y de un wrapper sin rpc: problema previo, fuera del alcance de roles.
- service_role y postgres siguen siendo roles privilegiados, no sujetos a estos guards de authenticated. Ninguna clave privilegiada debe llegar al frontend.
- No se crearon índices FK, tablas comerciales, orders, payments, projects ni colaboradores. No se ejecutaron comandos ni cambios remotos.
