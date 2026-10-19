# NOVELI 2.0 — PHASE 1A Integration Review

Fecha: 2026-10-18. Revisión conjunta de Foundations, Orders, Order Items, quotation → order RPC y UI.

## Resultado

**PHASE 1A INTEGRATION REVIEW: PASS (revisión técnica local)**<br>
**PHASE 1A UI: VERIFIED**<br>
**READY FOR DEPLOYMENT REVIEW: YES**<br>
**PRODUCTION CHANGES: NONE**

Javier aprobó la revisión visual manual (PASS) sobre el preview local. La revisión de código y las capturas desktop/mobile pasan. No se creó commit, push, db push, ni deployment.

## Working tree y clasificación

No hay cambios staged. Las cinco rutas tracked modificadas son cuatro archivos del contrato UI Phase 1A y una edición documental ajena al alcance. Los archivos creados siguen en el working tree sin commit.

| Grupo / archivos | Clasificación | Recomendación de integración |
|---|---|---|
| `src/App.jsx`, `src/components/Quotations.jsx`, `src/supabaseClient.js`, `src/utils/roles.js` | Phase 1A requerido; modificaciones tracked | Incluir |
| `src/components/orders/**`, `src/services/orders.js`, `src/services/orders.test.js`, `src/utils/orders.js`, `src/utils/orders.test.js`, `src/utils/ordersFeature.js` | Phase 1A requerido | Incluir |
| Las tres migraciones `20261018214233`, `20261018214235`, `20261018214237` y `supabase/tests/phase_1a_*` | Phase 1A requerido (backend aprobado y tests) | Incluir junto con UI como una unidad |
| `NOVELI-2-STATUS.md`, documentos estables de diseño/decisiones/pruebas, informes Phase 1A y deployment review | Documentación requerida | Incluir exactamente según la lista de `PHASE-1A-DEPLOYMENT-REVIEW.md` |
| JSON/logs locales, manifests de evidencia, browser E2E `phase-1a-ui-browser-evidence.json`, lint snapshots, fixtures y cuatro capturas desktop/mobile | Evidencia local sin necesidad de publicación | Excluir del commit y conservar intacta en workspace |
| `docs/noveli-2/security-deployment-runbook.md` (edición tracked de reconciliación Asset Transition), `asset-transition-closure-status.md`, `evidence/asset-closure/**`, `phase-a-deployment-checklist.md` | Cambios/preexistentes ajenos a Phase 1A | Excluir de este commit; conservar intactos |
| `.security-browser-evidence.json` | Evidencia temporal de otra fase | Excluir; conservar intacto localmente |
| `phase-1a-*-attempt*.json`, `*.log`, reset/build/lint outputs, `phase-1a-ui-fixtures.json`, rutas `*-preview-location.txt`, snapshots `phase-1a-ui-lint-before/after.json` | Temporal, ejecución local o fixture; no debe entrar al commit | Excluir; no borrar |

No se detectaron archivos nuevos de Payments, Contracts, Phase 1B, web pública o Security 04B; tampoco archivos `.env`, backups, credenciales o tokens dentro del conjunto Phase 1A. El `.env` del repo no fue modificado y no se incluye en Git. No se revirtió ni eliminó ningún archivo del working tree.

## Migraciones e integridad

Las migraciones Phase 1A son las únicas tres posteriores a Security 04B en el árbol. Todas tienen `BEGIN`/`COMMIT`, son aditivas a nivel de esquema y se aplican en orden después de `20261016013221_harden_security_04b_storage_lockdown.sql`.

| Migración | SHA-256 actual | Coincide con manifest backend aprobado |
|---|---|---|
| `20261018214233_phase_1a_foundations.sql` | `c0949c7292ec16824b320fb97d0b7055d195ab2bcc1eb52ee9e23287b7478b6e` | Sí |
| `20261018214235_phase_1a_orders.sql` | `39a245f32f8dc2a0782b8cd3d67ab16af3a2c9632de04b7c26d4bef7f7c4bb33` | Sí |
| `20261018214237_phase_1a_quotation_conversion.sql` | `68e5d3efbaa6e4b6774d2e051d9ce139c1b27948a66c2857f9ec388c47feb7d8` | Sí |

Se refrescaron los dos manifests para este cierre: backend 43/43 artefactos y UI 37/37, sin diferencias ni faltantes. Los SHA-256 SQL coinciden con la aprobación backend y no se modificó ninguna migración. El snapshot schema sigue siendo local/evidencia y no afecta el hash de migraciones.

No hay `DROP`, `TRUNCATE` ni operación de bytes/Storage en las migraciones. Los `DELETE` que aparecen son cuerpo de funciones transaccionales: reemplazo explícito de ítems de un borrador de orden, liberación de estado interno de pausa y reemplazo de quotation items dentro de `save_and_accept_quotation`. No se ejecutan al aplicar las migraciones. La UI actual no llama `save_and_accept_quotation`; sí conserva el flujo de revisión/conversión de la especificación. Los triggers protegen snapshots ya aceptados y las pruebas validan rollback si falla una escritura intermedia.

## Contrato exacto backend/UI

- **Orden:** `orders.organization_id`, `client_id`, `quotation_id` opcional; unicidad `(organization_id, order_number)`, `(organization_id, year, sequence)` y una orden por `(organization_id, quotation_id)`. Formato validado SQL `NOV-ORD-YYYY-XXXXXX`. El contador tenant/año usa `INSERT ... ON CONFLICT ... DO UPDATE`, no `MAX()+1`.
- **Moneda y dinero:** CLP/USD; importes SQL `numeric(18,2)`, cantidades `numeric(12,3)`, precios unitarios snapshot `numeric(30,12)`. La presentación usa decimales string/BigInt; el servidor aplica half-away-from-zero y asignación largest remainder. React no suma ni repricia.
- **Snapshot:** order item conserva item_type `noveli_service`, nombre, descripción, quantity, unit_price, subtotal, descuento, impuesto, total, currency, `pricing_version` y metadata. FKs de `catalog_id`/`pack_id` permiten `SET NULL` y no son la fuente visual del historial.
- **Estados:** `commercial_status` = draft/pending_acceptance/accepted/cancelled; `operational_status` = pending/preparing/in_progress/waiting_client/review/delivered/completed/paused/cancelled. `payment_status` no es columna editable ni estado persistido de la orden: llega de `phase1a_order_payment_summary` como campo calculado; en 1A la respuesta declara `ledger_available=false` y solo unpaid/paid para órdenes de total cero ya aceptadas. La UI puede traducir los demás valores definidos para el futuro sin simularlos.
- **Conversión:** el contrato RPC es `phase1a_convert_quotation_to_order(p_org uuid, p_quotation uuid, p_snapshot uuid, p_expected_sha text, p_operation_key uuid) RETURNS jsonb`. El JSON usa `order_json`, serializa importes como strings e incluye `id`, `organization_id`, `order_number`, `quotation_id` y estados canónicos. El servicio UI manda estos mismos cinco argumentos; conserva el mismo UUID de operación en retries.
- **Preparación:** `phase1a_quotation_review_source(p_org,p_quotation)` devuelve fingerprint, header e items; `phase1a_review_and_accept_quotation(p_org,p_quotation,p_client,p_evidence,p_expected_fingerprint)` devuelve snapshot id/hash. La acción requiere cotización ya aceptada con fecha y cliente; UI pide evidencia explícita y luego confirmación. No cambia automáticamente las seis cotizaciones legacy draft conocidas.
- **Vínculo/actividad:** `orders.quotation_id` y snapshot FK guardan el origen; RPC y constraints garantizan vínculo único por tenant. La misma transacción crea el order, copia pricing snapshots y registra `activity_log`; cualquier fallo revierte todo.
- **Permisos:** miembros activos del tenant pueden leer según RLS; admin/editor pueden solicitar operaciones autorizadas. El frontend solo muestra acciones de conversión a admin/editor. Diseñador, corrector, finanzas y visualizador son read-only para estas acciones. Anon no accede; políticas restrictivas bloquean cross-tenant. La RPC revalida membresía/rol/capabilities, así que React no sustituye la autorización SQL.

## Feature flags y activación futura

1. `VITE_PHASE_1A_ORDERS_ENABLED` controla navegación/rutas en build; únicamente el valor exacto `true` las muestra. Ausente/false es OFF. Es flag global de build y no cambió `.env` ni hosting productivo. La UI requiere el flag para mostrar Órdenes y conversión.
2. `noveli_private.order_capabilities` añade capabilities `orders` y `quotation_conversion`, ambas `enabled DEFAULT false` y no expuestas por Data API. Las llamadas de escritura/revisión las validan desde PostgreSQL. No se habilitó ninguna en producción.
3. Activación futura, después de migrar y desplegar un build verificado: limitar capabilities a la organización piloto, y encender ambas en una sola transacción controlada por un operador DB autorizado:

   ```sql
   BEGIN;
   INSERT INTO noveli_private.order_capabilities (organization_id, capability, enabled)
   VALUES
     ('<ORGANIZATION_UUID>', 'orders', true),
     ('<ORGANIZATION_UUID>', 'quotation_conversion', true)
   ON CONFLICT (organization_id, capability)
   DO UPDATE SET enabled = EXCLUDED.enabled;
   COMMIT;
   ```

   El build de Vercel deberá usar `VITE_PHASE_1A_ORDERS_ENABLED=true` para esa activación. Es un switch de UI global; sin capability por tenant, la navegación puede aparecer vacía para otros tenants, pero RLS y RPC siguen aislando datos y mutaciones. No habilitar fuera de la organización piloto sin decidir expresamente la exposición global de navegación.

## Conversión E2E y revisión UI

Se reutiliza la corrida final aprobada, posterior al ajuste de layout, ya que no hubo cambios de código desde ella. Evidencia: `phase-1a-ui-browser-evidence.json`; 62 assertions PASS, 728 respuestas observadas, 0 requests de Supabase productivo, 0 errores de consola y 0 excepciones JS. Hubo tres HTTP >=400 deliberados y comprobados: RPC 503 con retry, capability 403 bloqueada y listado 500 con retry; cero errores inesperados.

El flujo cubre cotización aceptada y revisión/evidencia explícita → confirmación → un único RPC → una orden y sus snapshots → activity log → redirect al detalle → retorno al listado → vínculo a cotización. Doble clic produjo una llamada y una fila; retry comparte operation key; replay consulta la orden existente; RPC concurrente, rollback y retry posterior pasaron en las pruebas backend. Resultado duplicados: **0**.

Revisión de capturas desktop 1440×1000 y mobile 390×844: lista, búsqueda, filtros separados para estados/moneda, tabla y tarjetas, badges independientes, CLP/USD, snapshot detail, origen, actor y layout sin overflow global. El detalle mobile muestra `NOV-ORD-2026-000001` completo. Componentes con labels, focus trap, Escape, `role=dialog/status`, botón disabled mientras escribe y ruta protegida por sesión. Las capturas permanecen como evidencia local excluida del commit.

## Regresión y lint

- Backend: 55 dominio + 19 SQL + 38 REST/Auth PASS; concurrencia, idempotencia, rollback, negativas y aislamiento incluidos.
- Security 01–04: 2.894 asserts PASS; Storage/Auth: 130 PASS; tablas RLS, políticas Storage, flags de buckets y migraciones heredadas preservadas según catálogo local.
- Frontend: 33 pruebas Node (16 Orders/API + 17 existentes), build PASS, browser E2E 62/62 PASS. No se repiten reset/browser suites por ser evidencia final vigente y no haberse cambiado código.
- Lint: 391 errores legacy y 22 warnings en el estado actual; **NEW PHASE 1A ERRORS = 0** y warnings nuevos = 0. Delta original documentado 393/22 → 391/22 por imports antes no usados; no se limpió deuda legacy.
- `git diff --check`: PASS.

## Orden de integración/despliegue futuro (no ejecutado)

1. Tras aprobación de deployment, crear un commit limpio usando exclusivamente la lista A–D del deployment review; dejar todo artifact/evidencia local fuera.
2. Push de la rama aprobada y revisión PR. No integrar main hasta aprobación de despliegue.
3. Confirmar backup vigente, proyecto correcto/ACTIVE_HEALTHY, remoto en 04B y que dry-run aislado enumere exactamente las tres migraciones Phase 1A.
4. `supabase db push` solo tras autorización nueva; detenerse si no se aplican en orden las tres o aparece una extra. Verificar historial, tablas/RLS/RPC y capabilities OFF.
5. Desplegar CRM con `VITE_PHASE_1A_ORDERS_ENABLED=false` primero para preservar UI apagada y hacer smoke de rutas existentes.
6. Para activación piloto, configurar build flag true y desplegar; solo después habilitar ambas capabilities para la organización aprobada en una transacción; smoke autenticado por roles y tenant. Si se requiere evitar incluso menú vacío a otros tenants, diseñar y aprobar capability-aware visibility en una iteración aparte.
7. Verificar lista/detalle/conversión y rutas legacy; detenerse ante cualquier 4xx inesperado, fuga tenant o fallo de datos. No desplegar pagos/contratos con Phase 1A.

Ninguno de estos pasos fue ejecutado en esta revisión.

## Plan de falla/recuperación

- **Migración 1 aplicada, 2 falla:** detener `db push`, consultar history/schema; conservar migración 1 y diagnóstico. No reset/repair. Corregir con migración forward pequeña y luego continuar con 2/3 aprobadas.
- **Tres migraciones aplicadas, frontend falla:** dejar DB aditiva y datos intactos; apagar `VITE_PHASE_1A_ORDERS_ENABLED` y desplegar el build CRM anterior/fix forward. No revertir schema ni borrar órdenes.
- **RPC falla:** apagar capability `quotation_conversion` para el tenant, preservar Orders/read; investigar error safe + logs, corregir función con migración forward y revalidar replay/concurrencia.
- **Capability/flag causa problema:** poner capability(s) en false en DB y volver flag Vercel a false con redeploy. El flag de build requiere build/deployment; un cambio de `.env` local no altera producción.
- **RLS bloquea un actor válido:** mantener escritura OFF, comparar rol/membership/policies y pruebas negativas; preparar ajuste restrictivo forward. No otorgar grants amplios ni deshabilitar RLS.
- **Deshabilitación urgente:** Vercel build flag false + redeploy; capability rows false para el tenant. La operación no elimina datos ni cambia migraciones. No usar `migration repair` salvo decisión extraordinaria y autorización explícita.

## Riesgos y límites

- Phase 1A sigue sin schema en producción. Esta review no autoriza deploy ni enablement.
- El UI flag es global; capability es por tenant. La UI no consulta la capability para ocultar el listado fuera del piloto. Seguridad de datos sigue en RLS; exposición de navegación vacía está documentada arriba.
- Payment status sigue siendo un estado entregado por backend; la UI no añade mensajes internos ni placeholders de Payments.
- Lista/filters se aplican sobre filas cargadas; para organizaciones grandes se requiere paginación/filtros server-side antes de escalar.
- Los artefactos temporales locales quedan excluidos del commit; manifests y hashes migración están íntegros.
- El preview actual solo acepta localhost; cuenta admin y orden de ejemplo son sintéticas/locales. La clave de esa cuenta se comunica por esta sesión y no queda en docs.

## Preview local para Javier

- URL: **http://127.0.0.1:5178/admin/ordenes**
- Supabase: LOCAL loopback `http://127.0.0.1:54321`; el módulo servido contiene ese endpoint y cero host/ref productivo.
- Flag UI: `VITE_PHASE_1A_ORDERS_ENABLED=true` solo en el proceso Vite local.
- Preview usado por Javier con cuenta admin/tenant sintéticos; identificadores de cuenta y credenciales de fixtures locales se excluyen de Git.
- Vite PID 22168, bound `127.0.0.1:5178`; Supabase Auth local health 200. Mantener ambos servicios activos durante revisión visual manual.
- No quedó CLI, test runner ni proceso de build pendiente. Los únicos listeners nuevos del trabajo son Vite local y servicios Supabase local; los procesos Node residentes ajenos son dos helpers `codex.js` sin puertos abiertos y se conservaron intactos.

## Pulido local posterior a la revisión manual

Javier aprobó manualmente el layout (PHASE 1A UI MANUAL REVIEW: PASS). A petición suya se aplicó únicamente formato monetario de presentación: USD se muestra como `US$ 119,60` y CLP como `$ 1.190 CLP`; currency, decimales canónicos y valores no cambian. Se retiró la nota interna sobre el módulo de pagos, sin añadir placeholders. Se actualizaron las expectativas unitarias y del escenario E2E. Validación posterior: 16/16 pruebas Node de Orders/API PASS; ESLint aislado en archivos Phase 1A PASS (cero errores); `npm run build` PASS. El GET HTTP de `/admin/ordenes` y `/admin/ordenes/:id` en el preview local respondió 200; Auth local respondió 200. El navegador automatizado no pudo completar la repetición del escenario porque su subproceso `supabase status -o json` falló al consultar credenciales locales; no se afectó el E2E aprobado previamente (62/62), ni se llamó a producción. El cambio no toca CSS: se conserva la revisión visual manual aprobada y las capturas desktop/mobile previas como evidencia de layout. `git diff --check` PASS. Sin cambios backend, producción, commit, push o deployment.

Estado: **Phase 1A Backend VERIFIED · Phase 1A UI VERIFIED · Phase 1A Manual Review PASS · READY FOR DEPLOYMENT REVIEW**.
