# Validación final de seguridad Noveli 2.0

**READY FOR PHASE A: YES.**

**READY FOR FULL DEPLOYMENT: NO. FULL DEPLOYMENT: NOT READY.**

Actualización 2026-10-16: correcciones exclusivamente frontend y harness local, pendientes de revisión y sin commit. El smoke integral real de Chrome headless terminó en PASS. No se modificaron migraciones, grants, cuerpos SQL, RLS ni políticas Storage. Ninguna operación productiva ni push.

## Matriz de preparación y bloqueos

| FASE | ESTADO | BLOQUEO |
|---|---|---|
| Baseline–03C | Validado localmente; regresiones PASS | Despliegue productivo pendiente de autorización |
| 04A | READY FOR PHASE A; SQL y frontend compatibles validados | Revisión y despliegue productivo todavía no ejecutados |
| Migración assets | Script/fixtures y transición local validados | Ejecutar/revisar dry-run productivo actualizado y después migrar 14 imágenes / 16 referencias |
| default-org | Tenant y gasto reconciliados por metadata | Traslado físico tenant-aware y actualización de asociación pendientes |
| 04B | Validado localmente en Estado B | Requiere transición productiva, default-org y verificaciones intermedias del runbook |
| Smoke navegador | PASS: 73 assertions / 248 acciones | Sin bloqueos frontend encontrados en estos flujos |
| Producción completa | NOT READY | Completar fases A–D y observación E en orden, con autorización separada |

La preparación local no autoriza desplegar. Permanecen pendientes 04A productivo, frontend compatible, migración real de assets, traslado default-org, verificación intermedia y 04B productivo.

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

La validación anterior aprobada de la transición A → B se conserva sin alterar sus suites. En esa validación se ejecutó `supabase db reset --local --version 20261016013219`: eliminó el estado previo local y reprodujo baseline → 04A. Se reiniciaron exclusivamente Auth, REST y gateway locales para evitar conexiones obsoletas después del reset. Las suites se ejecutaron en A; después el driver creó datos sintéticos, migró/verificó assets y aplicó 04B mediante `supabase migration up --local`. Se repitieron todas las suites en B. Así se validó el orden real, no solo un reset que aplicara B sobre buckets vacíos.

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

En esta ronda frontend se repitió `supabase db reset --local` antes de los smoke tests y nuevamente al cerrar, siempre hasta 04B. El reset final terminó con exit 0. Después pasaron otra vez `security_04_regressions.py` (49 / 274 / 316 / 989 / 1.041 / 225 = 2.894 assertions) y `security_04_storage_api.py` (130 assertions). La transición A → assets → B conserva la evidencia anterior; no se presenta como una nueva ejecución productiva.

## Frontend y smoke tests reales — correcciones y repetición

El diagnóstico original se conserva en `security-browser-smoke-evidence.json`, dentro del checkpoint `267243b8c79368f27f2569ccc27ea311b89e8083` (`test(noveli-2): add browser security smoke coverage`). Git quedó limpio al crear ese checkpoint. La detención previa por el RPC privado fue correcta y quedó resuelta por la autorización explícita del usuario de usar fallback local; no se abrió el RPC.

Evidencia posterior: `security-browser-smoke-after-fixes.json`. Incluye pasos, assertions, eventos CDP, clasificación de errores intencionales, conteos por endpoint y SHA-256 de los fuentes probados. No contiene tokens, contraseñas ni claves privilegiadas.

### Causas y cambios

- **Clientes:** `createdClient` se declaraba dentro de la rama de creación, pero se usaba fuera para sincronizaciones posteriores. El INSERT ya había terminado cuando se producía ReferenceError. Ahora tiene alcance sobre la continuación completa; `insertClientRecord` devuelve el registro real con id, propaga errores y ejecuta un único INSERT. Chrome comprobó una fila, un POST, actividad con el mismo `entity_id`, detalle, adjunto, edición y borrado.
- **Branding:** App ejecutaba `get_org_branding` sin sesión. `branding.js` centraliza el fallback existente: nombre `Somos Noveli`, logo vacío que conserva el icono local de la UI y favicon `/favicon.svg`. Antes de autenticar no hay RPC ni consulta `company_settings`. Solo tras resolver usuario y organización desde su membresía se consulta el RPC privado. La respuesta lleva identidad de usuario/tenant, se descartan respuestas obsoletas al desmontar/cambiar sesión y logout vuelve inmediatamente al fallback. El RPC y sus permisos permanecen intactos; anon EXECUTE sigue false.
- **Servicios y documentos:** `mutationPermissions` utiliza exclusivamente el mecanismo central de roles de Seguridad 02. Visualizador/desconocido no obtienen escritura; se protegen controles y handlers. Lectura conservada. Incluye adjuntos de Clientes y Servicios.
- **Borrado documental:** antes se filtraba el estado local sin comprobar el resultado efectivo de Storage/DB. `deleteDocumentConfirmed` exige primero éxito y objeto eliminado en Storage, después éxito y fila eliminada en DB; las respuestas 200 con arrays vacíos tampoco son éxito. Solo entonces se retira de la UI. Cualquier error conserva el documento visible y muestra el fallo. También se corrigió el reset del formulario para conservar strings controlados y sus nombres reales.
- **CMS category_links:** el wrapper agregaba `organization_id` a filtros/payloads y `user_id` al INSERT, aunque el baseline solo tiene `id`, `book_id`, `category_id`, `created_at`. Se excluye de la inyección directa de tenant/actor, se consultan columnas reales y se guardan solo relaciones padre; el aislamiento sigue a cargo del RLS existente por padres.
- **Otros contratos CMS detectados durante la repetición:** categorías y otras tablas CMS sin columna `user_id` ya no reciben ese campo automático. El formulario de libros enviaba `novelty`/`upcoming`; ahora utiliza `is_new`/`is_coming_soon`, existentes en el baseline. Publicación sincroniza los campos existentes `visible` y `visible_on_website`, evitando una UI que anuncie ocultación mientras RLS todavía lo considere público. Los errores de guardado de categorías se propagan. La carga de settings sin fila ya no intenta hacer seeding cuando `isReadOnly` es true; se eliminó así el 403 inesperado del usuario sin membresía.
- **Agenda ligada a Servicios:** la sincronización enviaba columnas inexistentes `notes`, `category` y tipo no permitido `etapa_servicio`. Ambos productores frontend envían `description`, tipo existente `evento` y `action_key='etapa_servicio'`, preservando service_id/stage_id/client_id y el reconocimiento de la etapa. No cambió el esquema.
- **Dashboard:** se quitaron logs residuales y se registran errores de queries solo cuando realmente existen; se retiró la consulta Auth usada únicamente para debug. Se mantienen los errores legítimos.
- **406 de tasa:** ausencia de cotización diaria es un escenario real, no solo un defecto del fixture. Se usa lookup opcional acotado por organización/moneda/fecha, `limit(1).maybeSingle()`, conservando el fallback anterior; CLP usa 1 sin consultar. Los errores reales siguen visibles. No cambió el modelo financiero.

### Ejecución y resultados

Mismo Chrome headless instalado, mismo harness CDP sin dependencias nuevas, React y Supabase reales exclusivamente locales. Se conserva el modo interactivo y se añade escenario automatizado repetible. La compilación de Vite preview se hizo con URL/key locales en memoria y el bundle se comprobó contra el endpoint local. Se evitó importar un segundo cliente GoTrue dentro del navegador: las pruebas HTTP negativas usan la sesión real local mediante probes; los flujos UI usan el SDK de la aplicación. Las recargas/HMR del servidor de desarrollo dejaron de interrumpir las pruebas.

Se añadieron esperas por finalización de formulario/red, sin reducir assertions. La detección final no acepta cualquier fallo por estar en una fase negativa: solo admite los endpoints/status Storage deliberados; cualquier excepción React o HTTP 500 falla la ejecución.

| Módulo | Resultado |
|---|---|
| Auth / perfil / logout / relogin | PASS; fallback sin RPC privado ni company_settings antes de sesión, branding personalizado después, fallback tras logout |
| Dashboard | PASS; widgets renderizados; sin errores propios inesperados; sin peticiones durante observación final de 7 segundos |
| Clientes | PASS; una fila/un INSERT, actividad, detalle, edición, adjunto firmado y DELETE admin |
| Prospectos | PASS; listar, crear, editar y eliminar |
| Cotizaciones | PASS; crear, item, vista previa, cantidad/importe actualizado y eliminar |
| Servicios | PASS; CRUD admin; lectura visualizador con escritura/configuración deshabilitadas |
| CMS | PASS; configuración, imagen pública brand-assets, categoría, libro, vínculo, edición y ocultar/republicar con comprobación anon |
| Documentos | PASS; upload, firma UI de 300 s, acceso firmado, URL pública rechazada, expiración corta, rechazo conserva UI/DB y borrado real autorizado |
| Finanzas | PASS; ingreso/gasto creados y editados; admin puede eliminar; finanzas accede sin administración global |
| Roles | PASS; seis roles canónicos y usuario sin membresía/desconocido; visualizador y desconocido sin controles habilitados de escritura; otros roles sin finanzas |
| Storage / tenants | PASS; documents privado, brand-assets público, listado/firma/update/delete cross-tenant bloqueados y metadata del objeto B intacta |

**73 assertions PASS; 248 acciones.** Exit 0 y limpieza de tenant/usuarios/objetos del harness confirmada. Los errores encontrados en intentos intermedios se corrigieron; no se relabelaron como negativos esperados.

- **2.766 respuestas HTTP**, incluidas recargas y preflights; **2.570** corresponden a Supabase local. No son transacciones de negocio distintas.
- **HTTP inesperados: 0.** Cero 401 pre-login, 406 por tasa, errores de columnas o RPC inexistentes.
- **7 HTTP negativos esperados:** un 403 de borrado Storage inyectado; seis HTTP 400 nativos de Storage al probar URL pública privada, firma expirada, upload prohibido visualizador/desconocido y firma/update cross-tenant. Storage expresa varias denegaciones RLS mediante HTTP 400; no son errores de consultas válidas.
- **Consola inesperada: 0. React/pageerror/ReferenceError: 0.** Se conserva un console.error esperado del rechazo deliberado de borrado, con aviso al usuario. Los mensajes de recurso fallido correspondientes a esas negativas también son esperados.
- Google Fonts se bloqueó expresamente por el harness para evitar conexiones externas; se usaron fuentes fallback. No hubo tráfico Supabase productivo. Esta prueba no evalúa disponibilidad de Google Fonts.
- **23/23 tests JavaScript PASS**, frente a 15 de la base previa; incluye 8 nuevos tests de contratos/bugs. Comando: `node --test src/utils/frontendSecurity.test.js src/utils/roles.test.js src/utils/storageDocuments.test.js scripts/noveli-2/migrate-storage-assets.test.mjs`.
- **Build PASS: 425 módulos.** Persisten avisos históricos de sourcemaps Tailwind/tamaño de chunk.
- **Lint diagnóstico global:** 393 errores / 22 warnings históricos. La comparación de archivos frontend modificados con HEAD, normalizando codeframes/números de línea, no detecta diagnósticos nuevos. No se hizo limpieza general de lint.

### Archivos de esta revisión, sin commit

Frontend: `src/App.jsx`, `src/components/{Clients,Dashboard,Documents,Services,Website}.jsx`, `src/supabaseClient.js`, `src/utils.js`, `src/utils/{branding,frontendMutations,querySchema}.js`.

Pruebas: `src/utils/frontendSecurity.test.js`, `supabase/tests/security_browser_smoke.mjs`, `supabase/tests/security_browser_scenarios.mjs`, `supabase/tests/security_browser_probes.mjs`.

Documentación/evidencia: este informe y `docs/noveli-2/security-browser-smoke-after-fixes.json`. El JSON de diagnóstico original permanece intacto en el checkpoint previo. No se incluyen archivos temporales, credenciales ni artefactos Docker.

## Preflight productivo exclusivamente read-only

Evidencia conservada del preflight anterior, no repetido en esta ronda frontend. Esta ronda no realizó consultas ni cambios productivos.

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
- El borrado documental coordina Storage y DB desde frontend, sin transacción distribuida: si Storage confirma el borrado y luego DB falla, la fila permanece visible y se informa el fallo, pero el archivo puede haberse eliminado. Revisar/restaurar antes de reintentar; esta fase no añade un sistema de compensación ni cambia SQL.
- Firmas son bearer tokens durante su TTL; no se persisten ni se registran. Un cambio de membresía no invalida inmediatamente una firma ya emitida.
- Los 14 objetos sin referencia no están demostrados como huérfanos definitivos; conservarlos y observar consumidores externos.
- El modelo documental sigue siendo por tenant y no agrega clasificación financiera por archivo. No se rediseñó contabilidad, auditoría ni clasificación de adjuntos.
- El bloqueo frontend del smoke quedó resuelto en la repetición documentada arriba. Phase A está preparada para revisión/despliegue autorizado; producción completa sigue bloqueada por la transición pendiente.
- El CLI dry-run en vivo, la migración real de imágenes y la reconciliación default-org son pasos futuros explícitos del runbook, no acciones completadas por esta auditoría.

No se ejecutaron db push, Git push, migration repair, reset linked, cambios de bucket remoto, copias/movimientos/borrados de objetos remotos ni UPDATE de datos productivos.
