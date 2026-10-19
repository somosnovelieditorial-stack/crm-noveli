# Phase 1A — implementación backend local

Estado de cierre: **PHASE 1A BACKEND: READY FOR REVIEW**. **PRODUCTION CHANGES: NONE**.

Autorización: Javier aprobó Phase 1 y exactamente tres lotes: fundamentos, Orders/OrderItems y conversión quotation→order. El alcance amplía a tres lotes el Phase1A inicial de dos lotes mencionado en el review. No se implementan pagos, cuotas, refunds, contratos, protección contractual de archivos ni UI Orders.

## Migraciones

| Versión | Archivo | Propósito |
|---|---|---|
| 20261018214233 | [phase_1a_foundations](../../../supabase/migrations/20261018214233_phase_1a_foundations.sql) | Schema privado, rol mínimo, flags Orders/conversión, numeración y pricing decimal |
| 20261018214235 | [phase_1a_orders](../../../supabase/migrations/20261018214235_phase_1a_orders.sql) | orders/items, constraints, RLS, comandos y representación RPC decimal |
| 20261018214237 | [phase_1a_quotation_conversion](../../../supabase/migrations/20261018214237_phase_1a_quotation_conversion.sql) | Revisiones aceptadas inmutables, aceptación atómica opt-in y conversión idempotente |

Archivos creados con Supabase CLI2.109.1. Cada archivo usa BEGIN/COMMIT. No DROP de tablas/columnas, renames, backfill ni modificación de las ocho migraciones anteriores. Instalación deja flags por tenant ausentes/deshabilitados; únicamente fixtures locales los habilitan.

## Schema final y helpers

Nuevas tablas public:
- **orders**: UUID/tenant/client, origen quote/revisión opcional, clave de creación y hash, número/año/secuencia, estados comercial/operativo, moneda y subtotal/discount/tax/total, pricing_version/metadata, actor/fecha/evidencia de aceptación, cancelación, notas y timestamps.
- **order_items**: UUID/tenant/order/posición, noveli_service, referencias opcionales catalog/pack, UUID histórico de quotation_item, nombre/alcance, cantidad, precio neto, residual acotado, descuento/base/impuesto/total, moneda/tasa/modo y metadata/version snapshot.

Auxiliares **privados**, sin API de datos directa:
- order_capabilities: solo orders y quotation_conversion, default false.
- order_number_counters: contador por tenant/año UTC.
- order_operation_pauses: estado anterior para retorno validado desde paused/waiting_client.
- quotation_acceptance_snapshots: revisión canónica aceptada, hash y fingerprint de fuente; append-only.

Helpers privados de identidad/autorización, decimales/currency, pricing y largest remainder, composición de packs, inserción de snapshots, auditoría, guards y serialización. Rol noveli_orders_executor: NOLOGIN/NOINHERIT/NOBYPASSRLS, no propietario de tablas y sin CREATE en schema al commit de cada lote. Tiene mínimos permisos y policies por tenant; no UPDATE a clients ni DELETE a orders.

El helper actor_uid usa exactamente las fuentes de identidad de auth.uid: request.jwt.claim.sub / sub de request.jwt.claims verificados por PostgREST. Evita conceder acceso adicional al schema Auth. No autoriza con user_metadata, claims de rol de negocio ni get_user_org_id con LIMIT1.

## Dinero, snapshots e integridad

- Monedas activas CLP/USD; numeric(18,2) para importes con límite de negocio9.999.999.999,99; CLP sin fracción. quantity numeric(12,3), unit_price numeric(30,12), tax_rate numeric(7,4).
- Validación antes de casts: escala/rango, negativos, NaN/infinito, cantidad positiva y descuento<=base. No COALESCE entre aliases monetarios legacy.
- Función de pricing servidor, nearest/half-away-from-zero, descuentos e impuestos por largest remainder con desempate position. Suma de líneas=cabecera mediante constraint triggers diferidos.
- RPC de orden devuelve importes de cabecera como **strings decimales**. Entrada monetaria se recomienda como strings; evita usar Number de JS como autoridad. La Data API directa sobre columnas numeric conserva su formato nativo PostgREST: futuras pantallas deben usar el contrato RPC/lecturas con conversión decimal explícita, nunca recalcular autoridad monetaria desde floats.
- Referencias catalog/pack: FK compuestas, SET NULL selectivo solo del ID, nunca del tenant. Snapshot conserva nombre, descripción/precio y composición de pack capturada antes de conversión.
- Fuente quotation_item histórica sin FK para no romper delete/reinsert legacy. La revisión aceptada conserva además términos comerciales de cabecera, no solo su hash.
- Accepted/pending_acceptance congelan pricing; sin retorno a draft. Cancelación es transición, no DELETE. completed es terminal operacional, también frente a cancelación.
- created_by/created_at/número/tenant/clave de operación inmutables. accepted_by registra al miembro verificador, distinto del cliente aceptante en evidencia; accepted_at admite ocurrencia verificada anterior, rechaza futuro.
- No columna física payment_status ni tablas de ledger. Resumen devuelve ledger_available=false, cobrado0, deuda=total; gratuita aceptada paid sin fabricar payment. Este resumen y cancelación deben ampliarse con guards reales antes de activar Payments/Contracts.

## API RPC pública

Todas las funciones públicas son **SECURITY INVOKER**, EXECUTE solo authenticated, con delegación a comandos privados de propietario mínimo. Search path vacío; sin SQL dinámico desde payload.

| RPC (prefijo phase1a_) | Acción |
|---|---|
| create_order_draft | Alta manual con clave idempotente y pricing canónico |
| edit_order_draft | Reemplazo atómico de líneas solo en draft nunca publicado |
| submit_order | draft→pending_acceptance |
| accept_order | pending_acceptance→accepted, evidencia/actor/ocurrencia |
| cancel_order | Cambio de estado conservando historia; accepted solo admin |
| advance_order_operation | Máquina operativa y pausas/retorno validado |
| update_order_notes | Notas operativas, sin precio ni estado financiero |
| order_payment_summary | Resumen explícito sin ledger aún |
| quotation_review_source | Fuente/fingerprint para revisión autorizada |
| review_and_accept_quotation | Revisión canónica explícita de cotización ya aceptada |
| save_and_accept_quotation | Cabecera de pricing+ítems+aceptación+revisión en una transacción |
| convert_quotation_to_order | Conversión única, transaccional e idempotente |

El save opt-in admite cabecera de pricing/currency/IVA/descuento/extensión/notas; otros campos legacy se conservan. No es un patch genérico de cualquier columna. Las cotizaciones legacy no se convierten automáticamente.

### Conversión atómica

1. Autorizar actor/tenant y comprobar ambos flags; tomar barrera de escritura y lock quotation.
2. Verificar revisión aceptada, huella, estado y cliente del mismo tenant.
3. Detectar orden por quotation y claves de operación: retry idéntico devuelve mismo ID incluso cancelada; conflicto de payload/revisión produce error.
4. Reservar número transaccional NOV-ORD-YYYY-XXXXXX, crear draft interno y copiar snapshots canónicos de revisión.
5. Vincular quotation/revisión, pasar order a accepted y conservar actor/fecha/evidencia aprobados.
6. Insertar activity_log created/quotation_converted; los retries no agregan eventos.
7. Commit con totales/FK validados; cualquier error revierte orden, líneas, contador y log.

UNIQUE tenant/quotation y tenant/creation_operation_key son defensa final. Dos conexiones concurrentes crean UNA orden. Caso real sintético:490000 +30% extensión =637000 neto; IVA121030; total758030, ignorando aliases legacy0.

La barrera de quote/items es un advisory lock de dominio compartido adquirido BEFORE STATEMENT para evitar inversión child→parent. Es conservadora y serializa escrituras de cotizaciones entre tenants; no convierte tres requests legacy en una transacción. La revisión completa e inmutable y el fingerprint evitan capturar un guardado intermedio. Un cambio legacy previo a conversión exige nueva aceptación; posterior no cambia Order.

## RLS y DELETE

RLS habilitada desde creación; SELECT miembro activo del tenant con fence restrictivo. DML directo authenticated denegado. Nuevas policies del executor están dirigidas exclusivamente a ese rol, sin reemplazar guards/policies Security previas.

| Rol activo del tenant | orders | order_items | Conversión |
|---|---|---|---|
| admin | Lectura; alta/edición draft, aceptación, operación, notas y cancelación válida | Lectura; edición solo draft mediante comando | Permitida |
| editor | Lectura; alta/edición draft, aceptación, operación/notas; no cancelar accepted | Lectura; edición solo draft mediante comando | Permitida |
| diseñador / corrector | Lectura, operación y notas | Lectura | Denegada |
| finanzas | Lectura y notas operativas | Lectura | Denegada |
| visualizador | Lectura | Lectura | Denegada |
| anon / unknown / inactive / otro tenant | Sin acceso | Sin acceso | Denegada |

Ningún rol de aplicación tiene DELETE directo, incluidos admin/draft. Solo comando de edición reemplaza internamente líneas draft nunca publicadas. Revisiones aceptadas no se actualizan ni eliminan. FK RESTRICT conserva clients/quotation usados en historia; el catálogo puede desaparecer sin romper snapshot. No se crean permisos financieros ni contractuales nuevos.

## Validación local

| Comprobación | Resultado |
|---|---|
| Tres lotes instalables individualmente A / A+B / A+B+C | PASS, resets locales y flags false en cada etapa |
| Reset final baseline→04B→tres lotes | PASS; historial local11 |
| SQL estructural/seguridad | 19 PASS |
| Integración de dominio | 55 PASS, incluidas cancelación/terminal y tres carreras concurrentes |
| REST/Auth de Orders y conversión | 38 PASS, incluidas strings decimales y FK SET NULL con admin autenticado |
| Security01/02/03A/03B/03C/04 | 49/274/316/989/1041/225 =2894 PASS |
| Storage/Auth04B HTTP | 130 PASS; signed URL válida/expirada, buckets y roles |
| Unitarias existentes Node | 23 PASS |
| Build frontend existente | PASS; sin modificación de src |
| Lint informativo | 393 errores/22 warnings históricos; sin cambios frontend |
| Browser CRM existente | 37 PASS sobre build estático local:15 rutas,361 responses, login/logout/login, imágenes correctas;0 HTTP>=400,0 errores/warnings de consola,0 excepciones JS |

Las regresiones históricas se ejecutan sin modificar sus fuentes. Un adaptador excluye únicamente los nombres Phase1A de inventarios históricos de tablas/funciones/policies; sus asserts de autorización siguen intactos. Otra comprobación compara las306 policies y13 funciones públicas anteriores contra la evidencia: idénticas; ocho hashes SQL originales intactos;16 policies Storage y flags04B preservados.

Negativas: anon/cross-tenant/unknown/inactive; viewer sin escritura; writer sin cambios monetarios; escala/NaN/overflow/descuento; hash/revisión stale; key con payload distinto; late failure de log; accepted-order/item mutation; counter exhaustion y cambio fuente. Carreras reales en conexiones distintas: numeración, doble conversión y legacy edit vs conversión. Fallo inyectado tardío demuestra rollback de contador/rows/log; objetos de prueba temporales se retiran solo en local.

## Evidencia y reproducción

Solo contra Docker/URL127.0.0.1. Nunca --linked ni db push.

1. python supabase/tests/phase_1a_migration_stages.py (reconstruye LOCAL tres veces).
2. phase_1a_orders.sql mediante docker exec/psql ON_ERROR_STOP; rollback de asserts de catálogo.
3. python supabase/tests/phase_1a_orders.py.
4. python supabase/tests/phase_1a_catalog.py.
5. python supabase/tests/phase_1a_security_regressions.py.
6. python supabase/tests/phase_1a_http.py.
7. python supabase/tests/security_04_storage_api.py.
8. Pruebas Node, build y lint; preview estático local5179 compilado con URL/anon locales en memoria; node supabase/tests/phase_1a_browser_smoke.mjs --run.

El smoke final recorre dashboard, clientes, prospectos, propuestas comerciales, servicios, documentos, ingresos, gastos, catálogo, packs, CMS servicios/libros/identidad, configuración y reportes. Usa navegación SPA existente y datos sintéticos; no prueba UI Orders inexistente ni presenta esa navegación como ensayo exhaustivo de deep-links de hosting.

Los intentos extendidos previos sobre Vite dev terminaron con carreras de contexto/frame, ERR_ABORTED y espera de requests. Se conservan browser-attempt1…5; no se maquillaron como PASS. El arnés Phase1A reutiliza el original sin editarlo, agrega diagnóstico/espera de frame y ejecuta el smoke requerido sobre el bundle estático, evitando recargas de desarrollo. Un segundo recorrido estático también terminó PASS; attempt6 conserva el primero. No se modificó React para hacer pasar pruebas.

Después de resets hubo502 del gateway local aunque Auth/Postgres estaban healthy. Se reinició únicamente supabase_kong_CRM_NOVELI; luego las38 pruebas REST y130 Auth/Storage pasaron. No fue una reparación productiva. El readiness check del test no reintenta errores de negocio de las RPC.

La evidencia detallada de etapas, integración, catálogo, Security, HTTP, SQL, Storage, build, lint y Node se conserva localmente y se excluye del commit; los resultados y alcance se resumen en este informe.

El smoke final, log Chrome, snapshot de schema y manifiesto son evidencia local excluida del commit. Las55 comprobaciones nuevas no equivalen a55 de los60 casos del plan general: Payments/Contracts siguen fuera de alcance y sus pruebas no se presentan ejecutadas.

Los fixtures son sintéticos y quedan únicamente en la instancia local para inspección; un reset local los elimina. No se limpian órdenes mediante DELETE ni se copian usuarios/datos productivos. Las sesiones HTTP de fixtures se cierran; no se guardan contraseñas, API keys ni tokens en evidencias.

## Archivos y límites

- Exactamente tres migraciones nuevas y pruebas nuevas phase_1a_* en supabase/tests. Fuentes Security históricas, src, package y lockfile intactos.
- [Maestro](../NOVELI-2-STATUS.md) actualizado: Phase 1 Design y Phase 1A Backend VERIFIED; Phase 1A UI e integración revisadas; producción sin cambios.
- Este informe y evidencias locales; sin commit/push/redeploy, sin modificaciones productivas.
- Los guards/FK nuevos impedirán borrar fuentes con historia vinculada cuando se active el modelo; es protección intencional. Frontend actual permanece sin Orders y sin llamadas nuevas.
- La barrera global de cotizaciones limita throughput; evaluar granularidad futura solo con pruebas que mantengan orden de locks.
- Adoptar RPC y decimales explícitos en UI futura; no habilitar flags productivos todavía.
- Interpretación legacy estricta: modo desconocido o diferencia de redondeo que cambia acuerdo bloquea conversión; no repara ni repricia silenciosamente.
- No se ensayó restore backup ni se corrigieron advisors/lint preexistentes.
- Se conserva la deuda UI legacy “convertida a prospecto” incompatible con su CHECK, documentada en la auditoría. La nueva RPC no usa ese estado ni modifica ese flujo frontend.

**PHASE 1A BACKEND: READY FOR REVIEW**<br>
**PRODUCTION CHANGES: NONE**
