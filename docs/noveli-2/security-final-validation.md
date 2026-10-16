# Validación final de seguridad Noveli 2.0

**NOT READY FOR DEPLOYMENT**

Actualización: 2026-10-16 America/Santiago. La cadena DB/Storage y su transición pasan las pruebas locales; el smoke real en Chrome se ejecutó y encontró fallos de frontend que impiden cerrar la fase integral. No se autoriza aplicar todas las migraciones juntas en producción: 04B depende de operaciones y verificaciones intermedias. No se crearon migraciones nuevas durante este cierre.

## Matriz de preparación y bloqueos

| FASE | ESTADO | BLOQUEO |
|---|---|---|
| Baseline–03C | Validado localmente | Solo baseline figura remoto en el último preflight; despliegue posterior pendiente y no autorizado aquí |
| 04A | TECHNICALLY READY (SQL); paquete fase A NO listo | Fallos frontend del smoke integral, revisión/corrección y repetición |
| Migración assets | Script y transición local validados | 04A y RPC productivo pendientes; después dry-run en vivo, revisión y ejecución real autorizada |
| default-org | Asociación tenant/gasto confirmada | Copia tenant-aware y metadata vinculada todavía no ejecutadas |
| 04B | Validado localmente | Transición productiva, default-org y verificaciones previas del runbook |
| Smoke navegador | EJECUTADO — FAIL | Clientes, controles de lectura Documents/Services, consulta CMS y branding/ruido React |
| Producción completa | NOT READY | No desplegar hasta resolver bloqueos y completar orden A–E |

**READY FOR PHASE A: NO (paquete integral). 04A SQL permanece técnicamente preparado.**

**READY FOR FULL DEPLOYMENT: NO.** No confundir las pruebas locales de B con autorización de despliegue remoto.

## Checkpoints e integridad

Checkpoint Seguridad 04: `70987d61f028738e3e03740622b2b1c2aaf194cd`, mensaje `chore(noveli-2): secure storage and prepare staged migration`. Incluye exactamente los 19 archivos aprobados de migraciones, scripts/manifest/tests, frontend y documentación. `git status --short` quedó vacío inmediatamente después del commit. No hubo push. Este informe se crea después del checkpoint y queda pendiente de revisión, sin incluirse en aquel commit.

| Fase | Checkpoint Git |
|---|---|
| Baseline + 01 | `e1b2b76a941cd24274f6e65d6c3d9286b7d48b7e` |
| 02 | `df21a50e2a5176966a3d1ac128b6780a2f4b4bba` |
| 03A | `c1f8b3e85596f971dec6a82e979197deca6f7eca` |
| 03B | `21980d43cc7dc3ae62325fa31ec729ec8f8ec764` |
| 03C | `77c4067b23b26c8e289a7db62a39a0531965decd` |
| 04A / 04B | `70987d61f028738e3e03740622b2b1c2aaf194cd` |

Orden exacto de archivos:

1. `20261014031607_noveli_baseline.sql`
2. `20261015021942_harden_security_01_critical.sql`
3. `20261015023731_harden_security_02_roles.sql`
4. `20261015030234_harden_security_03a_rls_web.sql`
5. `20261015230850_harden_security_03b_rls_crm_editorial.sql`
6. `20261015233425_harden_security_03c_finance_sensitive.sql`
7. `20261016013219_harden_security_04a_storage_prepare.sql`
8. Transición de assets y reconciliación legacy, verificadas antes del siguiente archivo.
9. `20261016013221_harden_security_04b_storage_lockdown.sql`

Todos los SQL están bajo `supabase/migrations/`. La antigua `20261016001336_harden_security_04_storage.sql` no existe como archivo aplicable, no está en el checkpoint y no está en el historial local reconstruido. Baseline y migraciones 01–03C no fueron editados.

SHA256 del baseline: `c41d2d67c856f1d50cdff9a27a739d8655f93844a7876301795ac0aff1b42620`.

SHA256 de 04A: `fe75e3fc8f61a76bd4b8ca30ef69e9866649ff0c7f191dea2789563b7f4a178b`.

SHA256 de 04B: `7321203bb0e3ce58844be4ef5d989b0c5f1202abb079ce0f5ec84ba362b9c917`.

## Reproducción local limpia y pruebas

Se ejecutó `supabase db reset --local --version 20261016013219`: eliminó el estado previo local y reprodujo baseline → 04A. Se reiniciaron exclusivamente Auth, REST y gateway locales para evitar conexiones obsoletas después del reset. Las suites se ejecutaron en A; después el driver creó datos sintéticos, migró/verificó assets y aplicó 04B mediante `supabase migration up --local`. Se repitieron todas las suites en B. Así se validó el orden real, no solo un reset que aplicara B sobre buckets vacíos.

| Suite | Estado A | Estado B |
|---|---:|---:|
| Security 01 | 49 PASS | 49 PASS |
| Security 02 | 274 PASS | 274 PASS |
| Security 03A | 316 PASS | 316 PASS |
| Security 03B | 989 PASS | 989 PASS |
| Security 03C | 1.041 PASS | 1.041 PASS |
| Security 04 SQL | 225 PASS | 225 PASS |
| Storage API / Auth local / HEAD | 130 PASS | 130 PASS |

Comandos de suites: `python supabase/tests/security_04_regressions.py --prepare` y `python supabase/tests/security_04_storage_api.py --prepare` en A; los mismos sin `--prepare` en B. El runner adapta expectativas históricas al inventario final sin editar los archivos SQL 01–03C.

`python supabase/tests/security_04_transition.py`: **32 PASS**. Crea exclusivamente UUID, registros y bytes sintéticos; no importa datos productivos a la base local. Comprueba 35 fuentes y cinco brand-assets previos, URLs antiguas públicas en A, rechazo de referencias inesperadas, bloqueo de B por URLs antiguas/destinos faltantes/legacy sin reconciliar, copias verificadas, referencias actualizadas, fuentes conservadas y URLs firmadas en B.

| Script con fixtures locales | Resultado |
|---|---|
| Dry-run | 14 copias y 16 referencias pendientes; cero mutaciones |
| Apply | 14 copias, exactamente 16 campos actualizados |
| Verify | Destinos, identidad por metadata/HEAD y referencias correctos |
| Segundo apply | Cero copias y cero actualizaciones |
| Adjuntos existentes | Seis paths intactos, firmables tras B |
| Sin referencia / legacy original | Conservados; sin acceso público después de B |

La matriz SQL/API incluye los seis roles canónicos, usuario desconocido/inactivo, anon, organización A/B, operaciones permitidas y negativas. Verifica finanzas solo admin/finanzas, visualizador sin escritura, aislamiento padre/hijo, CMS y formularios públicos según las suites de cada fase. Storage comprueba listado, firma, escritura, borrado y cruces de tenant; firmas válidas, acceso bearer y expiración con TTL corto. El helper frontend utiliza 300 segundos y tiene test específico. No se descargó contenido productivo ni cuerpos de documentos en estas verificaciones.

Estado final local: **46 tablas públicas, 13 funciones públicas, 306 políticas públicas, 126 restrictivas públicas, 16 políticas storage.objects y ocho restrictivas Storage**. Ninguna tabla pública tiene RLS deshabilitado. `documents.public=false`, `brand-assets.public=true`. Limpieza comprobada: cero usuarios Auth y cero objetos Storage sintéticos restantes.

## Frontend y smoke tests reales — actualización 2026-10-16

**READY FOR PHASE A: NO, para el paquete DB + frontend.** El SQL 04A mantiene su estado **TECHNICALLY READY**, pero el smoke integral encontró fallos frontend que requieren revisión/corrección y repetición. **READY FOR FULL DEPLOYMENT: NO.**

### Recursos y ejecución

No existen Playwright, @playwright/test, Puppeteer ni Cypress en package.json, package-lock.json ni node_modules. Sí existen Chrome y Edge instalados. Se utilizó el Chrome existente en modo headless, identificado como **HeadlessChrome/155.0.0.0**, con Node v24.14.1 y su WebSocket nativo para CDP, sin instalar paquetes ni navegadores.

Harness local: `supabase/tests/security_browser_smoke.mjs`. Requiere Vite local en `http://127.0.0.1:5179` y Supabase en `http://127.0.0.1:54321`. Crea un perfil de Chrome temporal, tenant aleatorio y siete usuarios sintéticos; las claves quedan en memoria. Intercepta requests de la página y bloquea destinos ajenos a localhost/127.0.0.1. Las fuentes Google fueron bloqueadas intencionalmente, sin afectar las operaciones evaluadas. No se navegó al CRM productivo.

El harness recibe acciones JSON por stdin (sesión TTY): `login`, `nav`, `inspect`, `fill`, `click`, `files`, `eval`, `seed`, `summary`, `finish`. Por ejemplo `{"type":"login","role":"admin"}` y `{"type":"nav","path":"/clientes"}`. Las interacciones se ejecutan sobre DOM/React reales, sin sustituir respuestas de Supabase ni habilitar modo mock. Los formularios se guardaron desde sus controles y se comprobaron respuestas/persistencia; las pruebas negativas de Storage se hicieron mediante el SDK real dentro del navegador. No son todas pruebas de botón: se distingue la UI de las verificaciones programáticas de Storage y PostgreSQL.

Evidencia resumida, sin contraseñas ni tokens: [security-browser-smoke-evidence.json](security-browser-smoke-evidence.json). Contiene **193 registros de acciones/observaciones**, no 193 pruebas aprobadas; incluye reintentos del harness y un resultado global FAIL. Se obtuvieron 30 observaciones adicionales de rol × ruta para los seis usuarios no-admin.

### Resultado por módulo

| Módulo / ruta | Resultado real |
|---|---|
| AUTH, `/` / `/dashboard` | Login admin, redirección, logout y nuevo login PASS. Perfil propio leído desde el SDK del navegador: Local admin. La UI carga contexto de membresía y correo; no se inventa una pantalla de perfil que no existe en este flujo. Login FAIL en limpieza de Network por branding anónimo 401. |
| Dashboard, `/dashboard` | Renderiza widgets financieros admin/finanzas y vista operativa para otros roles. Sin excepción React no controlada. Hay logs console.error con resultados null y requests redundantes al cargar. |
| Clientes, `/clientes` | Listar, abrir ficha, editar, adjuntar PDF, firmar/ver y borrar como admin PASS. **Crear FAIL**: inserta la fila, después muestra `createdClient is not defined`. Se recargó para continuar, sin repetir INSERT. |
| Prospectos, `/prospects` | Listar, crear, editar y borrar fixture admin PASS; se verificó persistencia/ausencia posterior. |
| Cotizaciones, `/propuestas-comerciales` | Crear propuesta, ítem manual de $1.000, editar cantidad a dos y visualizar total $2.000 PASS. Vista previa del formulario renderiza. Borrado admin de propuesta e ítems PASS. No se afirma descarga/exportación PDF: no fue un paso probado. |
| Servicios, `/services` | Listar, crear, editar y borrar como admin PASS. **UI visualizador FAIL**: edición y Configurar etapas siguen habilitados; DELETE principal sí está deshabilitado. No se abrió acceso adicional en RLS. |
| Web/CMS, `/sitio-web/identidad` | Carga de configuración, modificación de marca, upload a brand-assets, guardado y restauración PASS. Tres previews cargan la imagen; URL pública 200. **Network FAIL** por consulta a category_links con columna inexistente. No se probó otro repositorio/hosting público de noveli-web. |
| Documentos, `/documentos` | Upload desde Centro Documental y ficha de cliente PASS. documents privado, firma 300 segundos, acceso firmado 200, URL pública rechazada, expiración con firma corta y borrado admin PASS. **UI visualizador FAIL**: upload/delete habilitados y borrado optimista falso. |
| Finanzas, `/ingresos`, `/gastos` | Listar, crear, editar y borrar fixtures como admin PASS. Finanzas puede abrir ingresos y no tiene DELETE; configuración administrativa denegada. Otras sesiones no financieras no obtienen el módulo financiero. No se repitió toda operación con cada rol; la matriz RLS completa permanece cubierta por las suites SQL previas. |
| Storage multi-tenant | Objeto B real sintético: admin A obtiene listado vacío, no puede firmar ni modificar; remove devuelve cero objetos. Se confirmó después que el objeto B seguía presente con tamaño original. PASS. |

Los fixtures de usuario desconocido se representan como usuario autenticado sin membresía válida: el CHECK canónico impide guardar un rol desconocido sin alterar SQL. La UI cae en visualizador; no tiene escritura efectiva. La normalización de strings desconocidos ya tiene pruebas unitarias. No se retiró el CHECK para fabricar una membresía inválida en este smoke.

### Roles: UI observada

| Rol | CRM clientes | Documentos | CMS identidad | Finanzas | Configuración global |
|---|---|---|---|---|---|
| admin | CRUD salvo bug de posguardado al crear | Upload, firma y DELETE real | Edita/sube | CRUD probado | Rol autorizado; administración completa no recorrida en este smoke |
| finanzas | Añadir/editar permitido; sin DELETE principal | Botón upload presente | Solo lectura | Acceso operativo, sin DELETE | Denegada |
| editor | Añadir/editar; sin DELETE principal | Upload presente | Edición habilitada | Denegada | Denegada |
| diseñador | Añadir/editar; sin DELETE principal | Upload presente | Edición habilitada | Denegada | Denegada |
| corrector | Añadir/editar; sin DELETE principal | Upload presente | Edición habilitada | Denegada | Denegada |
| visualizador | Sin acciones de escritura en clientes/prospectos/cotizaciones | **FAIL UI:** upload/delete habilitados; RLS bloquea escritura | Sin guardado habilitado | Denegada | Denegada |
| desconocido / sin membresía | Sin filas ni acciones CRM de escritura | **FAIL UI:** upload presente; Storage rechaza escritura | Sin guardado habilitado | Denegada | Denegada |

Visualizador también conserva el botón Editar y Configurar etapas en Servicios; no se considera coherencia completa UI ↔ RLS aunque la base no permita mutar.

### Errores inesperados y propuestas — no aplicadas

1. **Clientes: persistencia parcial del flujo y riesgo de duplicación.** `Clients.jsx:1678` declara `createdClient` dentro de un bloque y `Clients.jsx:1797` lo referencia fuera. POST fue exitoso, pero el modal queda abierto con ReferenceError. Propuesta: conservar el ID resultante en un ámbito común a insert/update, separar el éxito de persistencia de las tareas posteriores y evitar reintentar un INSERT ya completado. Reproducido en Chrome y confirmado en PostgreSQL local.
2. **Documents no aplica el modo de lectura a controles/handlers.** `Documents.jsx:13` no recibe isReadOnly/userRole; upload en línea 543 y DELETE en líneas 993/1104 siguen activos. Propuesta: usar utilidad central y props de autorización, ocultar/deshabilitar controles y proteger handlers; verificar filas/objetos efectivamente eliminados antes de actualizar estado.
3. **Falso DELETE de visualizador.** `Documents.jsx:157`: Storage remove y DELETE RLS pueden devolver éxito con cero filas. La UI elimina optimistamente el documento de su estado. Se verificaron fila y objeto intactos después del intento. No fue bypass de RLS. Debe comprobar el resultado efectivo y recargar/mostrar falta de permiso.
4. **Services ignora lectura en edición/configuración.** Editar en `Services.jsx:1334` y Configurar etapas alrededor de línea 1417 permanecen habilitados para visualizador. Propuesta: aplicar canRolePerformAction/isReadOnly a controles y handlers de edición/etapas/documentos; mantener el DELETE admin-only ya existente.
5. **CMS consulta una columna inexistente.** `Website.jsx:1617` usa el wrapper genérico, que añade organization_id a `website_book_category_links`. La respuesta es HTTP 400 / PostgreSQL `42703: column website_book_category_links.organization_id does not exist`. Propuesta frontend: adaptar el wrapper/consulta de esta tabla hija al modelo parent/child existente y revisar también el payload de links de `Website.jsx:1729`, que incluye esa columna. No añadir una columna ni relajar RLS para solucionar este contrato.
6. **Branding antes de autenticar.** `App.jsx:356–389` ejecuta get_org_branding desde login; 401 inesperados. Propuesta: consultar branding interno solo con sesión/membresía resuelta y mantener defaults visuales en login. No conceder EXECUTE a anon por este fallo.
7. **React warning en upload del Centro Documental:** input cambia uncontrolled → controlled al seleccionar archivo (`documents-file`). No causó excepción ni impidió guardar. Propuesta: inicializar campos controlados con strings/valores definidos.
8. **Ruido de consola:** Dashboard.jsx:232–235 imprime cuatro console.error sin comprobar error; creación de cliente imprime payload/data mediante console.error. Propuesta: registrar solo errores reales y retirar logs de payload de uso normal.
9. **Fixture sin tasa:** dos HTTP 406 en exchange_rates por lookup opcional con .single() sobre cero filas. Se creó una tasa CLP→CLP=1 solo para el tenant local. No fue una denegación de RLS ni se abrió acceso financiero. Revisar también si .maybeSingle()/fallback evita ese error normal de ausencia; no se modificó el wrapper en este cierre.

Ninguna propuesta fue aplicada a código productivo. No se detectó necesidad de una nueva migración para estos hallazgos. Si la revisión concluye que hace falta cambiar SQL/RLS, detenerse y pedir revisión antes de crearla.

### Consola, Network y pruebas negativas

Se capturaron Runtime.consoleAPICalled, Runtime.exceptionThrown, Log.entryAdded y Network.responseReceived. Se observaron **8.217 respuestas HTTP** (incluye módulos Vite, recargas y preflights), de ellas **4.147 de Supabase local**. No son 8.217 transacciones de negocio.

- **UNEXPECTED:** 27 respuestas 401 de get_org_branding; 17 respuestas 400 de category_links (incluye la reproducción diagnóstica); dos 406 del fixture sin tasa. Total 46 respuestas, con las dos de fixture identificadas por separado.
- **EXPECTED negativos:** seis respuestas HTTP 400 de Storage: URL pública de documents, upload visualizador, firma cross-tenant, update cross-tenant, firma expirada y upload sin membresía. Los uploads devuelven código lógico 403 en el SDK aunque este Storage local responde HTTP 400. No se cuentan como fallos del smoke.
- DELETE/list con RLS pueden responder 200 y cero filas/objetos; se verificó ausencia de efectos en las negativas. El falso borrado visual sí es fallo de UI.
- Cero respuestas 404 o 5xx capturadas; ningún RPC inexistente observado. El RPC de branding existe y rechaza correctamente a anon.
- Cero pageerror/exception no controlada de la aplicación; un ReferenceError capturado por el handler de cliente y un warning React uncontrolled/controlled. Cero console.warn/console.warning de aplicación. Los logs null/debug se separan de errores reales.
- 71 requests a Google Fonts bloqueados por el harness y sus mensajes de recurso bloqueado son efectos esperados de la restricción de red local; no fallos de RLS.
- Consultas a organization_members, user_profiles, clients, prospects, quotations/items, services/stages, website_*, incomes, expenses, Storage y firmas quedaron observadas. Hay fan-out y cargas duplicadas al navegar; **cero respuestas durante siete segundos de reposo final**, por lo que no se observó un bucle sostenido en esa ventana. No equivale a un perfil de rendimiento de larga duración.
- Se corrigieron siete errores de sincronización/selectores/sintaxis del propio harness y se repitieron esas acciones. Están separados de los hallazgos de la aplicación. Al finalizar, se corrigió también el cierre de stdin TTY del harness; la sesión anterior se interrumpió después de completar y verificar la limpieza.

### Limpieza y límites

Como admin se eliminaron los registros comerciales/financieros/documentales desde UI y se verificaron cero filas restantes. La marca se restauró desde CMS; el cleanup local retiró los restantes settings, catálogo, membresías, usuarios y objetos de prueba. El objeto del tenant B se comprobó intacto antes de retirarlo con credencial de fixture local. Conteo final: **cero organizaciones, cero usuarios Auth y cero objetos Storage de prueba**; documents continúa privado y brand-assets público.

Las pruebas JavaScript 15/15 y build de 422 módulos de la validación anterior siguen vigentes: este intento no modifica src, dependencias ni migraciones. No se volvieron a presentar como ejecutadas en este intento. Se verificó sintaxis del nuevo harness con node --check. Las regresiones SQL/API previas conservan su evidencia; este smoke agrega la observación real de navegador y descubre fallos que aquellas suites no cubrían.

No hace falta una checklist manual por ausencia de navegador: ese bloqueo técnico quedó resuelto. Sí es necesario repetir el smoke integral después de revisar/corregir los fallos frontend. No se otorga READY por el simple hecho de disponer de automatización.


## Preflight productivo exclusivamente read-only

Proyecto `bdxlzhpmifxwmqjnnmxa`. Se consultaron migrations por CLI/MCP y metadata por SQL dentro de `BEGIN READ ONLY` / `COMMIT`; no se aplicó SQL del baseline ni de seguridad.

`supabase migration list` confirma únicamente `20261014031607` en remoto, alineado con el baseline local. 01, 02, 03A, 03B, 03C, 04A y 04B están pendientes remotamente.

| Inventario | Resultado |
|---|---:|
| Organizaciones | 1 |
| Membresías | 2 admin activas; ningún alias histórico actual |
| Filas que requieren normalización de roles según este inventario | 0 |
| Clients | 4 |
| Prospects | 7 |
| Quotations | 6 |
| Services | 1 |
| Incomes | 4 |
| Expenses | 13 |
| Documents (registros) | 6 |
| Bucket documents | Público, 35 objetos |
| Bucket brand-assets | Público, 5 objetos |
| Fuentes del manifest | 14/14 presentes con ID esperado y metadata de identidad válida |
| Referencias CMS | 16/16 exactas, tenant esperado; escaneo de las 46 tablas públicas |
| Adjuntos | 6/6 file_path con objeto existente y tenant Noveli |
| Sin referencia encontrada | 14 imágenes documents conservadas para revisión posterior |
| Legacy default-org | 1 objeto; tenant/gasto confirmados; copia/vinculación aún pendientes |

La clasificación de los 35 objetos documents sigue siendo 14 imágenes web activas + seis adjuntos + 14 imágenes sin referencia encontrada + un legacy. No se determinó contenido de archivos mediante apertura/descarga.

### Dry-run productivo: alcance exacto

Se revisó el código del script: `mode='dry-run'` no invoca `copy` ni `updateReference`. Se obtuvo un snapshot fresco read-only de objetos y referencias reales y se ejecutó **el mismo `runMigration` exportado**, con un adapter de solo lectura sobre ese snapshot. Los métodos de mutación del adapter lanzan error incondicional. Resultado:

```json
{"mode":"dry-run","assets":14,"references":16,"copied":0,"updated":0,"pendingCopies":14,"pendingReferences":16}
```

Esto es un dry-run contra metadata productiva real, **no una ejecución del CLI conectado en vivo a producción**. Ningún destino de los 14 existe aún en brand-assets, por lo que no hizo falta HEAD de destinos. No prueba copias remotas ni permisos de una futura credencial de ejecución.

El CLI productivo en vivo queda pendiente: `security04_asset_reference_inventory()` no existe todavía en producción y lo instala 04A; no se creó para adelantar este preflight. Tampoco se incorporó una credencial service_role al repositorio. Tras Fase A debe ejecutarse el CLI `--dry-run` según runbook con credenciales gestionadas fuera de Git, revisar el resultado fresco y solo entonces autorizar la migración real. El snapshot temporal de esta auditoría se retira después de generar el informe.

### Default-org confirmado, aún no migrado

Objeto `e6a2506c-a78a-4268-a9d2-146c084b2d19`:

```text
default-org/proveedores/general/gastos/a0bff6fd-9dac-46f7-a521-c3493eefa9b8/comprobante de pago/Captura_de_pantalla_2026-06-27_191648.png
```

Consulta read-only confirma expense `a0bff6fd-9dac-46f7-a521-c3493eefa9b8`, organization `11111111-1111-1111-1111-111111111111`, categoría publicidad, 13.000 CLP, fecha 2026-06-05, notas publicidad Instagram. Expense creado `2026-06-27T23:17:46.721512Z`; objeto `2026-06-27T23:17:47.963744Z`, diferencia 1,242232 s. Junto a la confirmación del usuario, acredita la asociación inequívoca, sin abrir el contenido.

Destino revisado dentro del mismo bucket documents:

```text
11111111-1111-1111-1111-111111111111/expenses/a0bff6fd-9dac-46f7-a521-c3493eefa9b8/e6a2506c-a78a-4268-a9d2-146c084b2d19_legacy.png
```

Queda pendiente la operación autorizada de copiar/verificar y crear/vincular metadata documents con ese organization_id y expense_id, conservando original. No está en el manifest de imágenes. No se ejecutó. 04B seguirá bloqueando el dataset productivo actual hasta completar esa reconciliación y las 16 referencias CMS.

## Orden productivo y criterios de salida

Referencia operativa: [security-deployment-runbook.md](security-deployment-runbook.md). Orden obligatorio:

1. **Fase A:** backups DB/metadata, snapshot de buckets y referencias, revisión de hashes y paquete limitado; desplegar DB solo hasta 04A y frontend compatible. No ejecutar un lote que incluya 04B. Repetir preflight fresco después de A.
2. **Fase B:** CLI `--dry-run`, revisar 14/16 y ausencia de referencias inesperadas; ejecución real solo bajo autorización posterior; `--verify`, revisar las 16 referencias; conservar fuentes.
3. **Fase C:** reconciliar default-org al tenant/gasto confirmados, verificar copia y metadata; comprobar web pública, cachés y seis adjuntos autenticados con firmas de 300 segundos.
4. **Fase D:** desplegar 04B solo tras las condiciones anteriores; confirmar documents privado y brand-assets público; smoke tests navegador/API, firmas, roles y aislamiento entre tenants.
5. **Fase E:** observación; únicamente después considerar limpieza revisada de originales/huérfanos. No hay borrados automáticos preparados en este cierre.

## Rollback y riesgos restantes

- Antes de cualquier despliegue, comprobar restauración de backups y registrar referencias/metadata/origen-destino; no basta con tener archivos de backup sin verificar.
- Antes de B: si el script detecta drift, colisión o fallo, detenerse. Las copias originales permanecen; no borrar destinos ni sobrescribir referencias concurrentes. Con logs y compare-and-swap puede reanudarse después de revisar el estado.
- Copias Storage y 16 actualizaciones no constituyen una única transacción. Coordinar una ventana sin edición CMS y ejecutar verify inmediatamente antes de 04B.
- Durante A documents sigue público: endurecer RLS no vuelve privados sus bytes. Evitar presentar esta fase como confidencialidad ya desplegada.
- Después de B no reabrir automáticamente documents ni volver a un frontend que dependa de URLs públicas de adjuntos. Ante fallo, detener el rollout y restaurar/avanzar con un procedimiento revisado que conserve privacidad y las rutas correctas. Cualquier SQL correctivo requiere revisión separada, no se prepara una migración nueva aquí.
- Restaurar DB sin coordinar Storage puede dejar referencias rotas; conservar ambas instantáneas y fuentes. Cualquier reversión de referencias debe revisar el valor actual, no pisar ediciones posteriores.
- Firmas son bearer tokens durante su TTL; no se persisten ni se registran. Un cambio de membresía no invalida inmediatamente una firma ya emitida.
- Los 14 objetos sin referencia no están demostrados como huérfanos definitivos; conservarlos y observar consumidores externos.
- El modelo documental sigue siendo por tenant y no agrega clasificación financiera por archivo. No se rediseñó contabilidad, auditoría ni clasificación de adjuntos.
- Bloqueo principal actualizado: el navegador CLI ya está disponible y el smoke real está ejecutado, con fallos frontend documentados. Corregir/revisar esos fallos y repetirlo antes de declarar READY FOR PHASE A.
- El CLI dry-run en vivo, la migración real de imágenes y la reconciliación default-org son pasos futuros explícitos del runbook, no acciones completadas por esta auditoría.

No se ejecutaron db push, Git push, migration repair, reset linked, cambios de bucket remoto, copias/movimientos/borrados de objetos remotos ni UPDATE de datos productivos.
