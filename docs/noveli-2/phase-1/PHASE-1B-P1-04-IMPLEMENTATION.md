# Phase 1B — P1-04: calendario de obligaciones

**Estado:** implementación local, aprobada tras revisión técnica
**Producción:** sin cambios; `production_deployed=false`
**Recovery previo:** `POST_PHASE_1A_PRE_PHASE_1B`, `C:/Users/xavie/Desktop/backup/pre-phase-1b/20261019T044950Z/` (verificado por Javier; restore integral no ensayado)

## Alcance

Se implementa únicamente el lote aprobado P1-04 del diseño: calendario de obligaciones por orden, edición de planes aún en borrador, publicación transaccional y aislamiento RLS. La migración añade una sola tabla pública, `payment_schedules`, sus constraints, índice, policies, un trigger guard y comandos acotados para guardar/publicar planes.

Quedan fuera: `payments`, `payment_refunds`, `payment_allocations`, cualquier relación con `incomes`/`income_allocations`, conciliación, UI/rutas de Payments, flags o capabilities nuevos, providers, generación automática de cuotas y lógica de reembolsos. P1-05, P1-06 y P1-07 no empezaron.

## Esquema

Migración: `supabase/migrations/20261019045900_phase_1b_p1_04_payment_schedules.sql` (SHA-256 `a7746b6a77df66618570203c41c5d70462211d972004cbfb0ebbe737b5da7600`). Envuelta en `BEGIN/COMMIT`; se validó reconstruyendo localmente la cadena baseline → Security 04B → Phase 1A → P1-04.

`payment_schedules` contiene:

| Campo | Tipo / regla |
|---|---|
| `id` | `uuid` PK |
| `organization_id` | `uuid` obligatorio; FK a `organizations`, RESTRICT |
| `order_id` | `uuid` obligatorio; FK compuesta `(organization_id, order_id)` a `orders`, RESTRICT |
| `sequence` | `integer > 0`, única por organización/orden |
| `currency` | `text`, solo `CLP` o `USD`, debe coincidir con `orders.currency` |
| `expected_amount` | `numeric(18,2) > 0`; helper monetario canónico y escala de entrada estricta por moneda |
| `due_kind` | `fixed_date` o `milestone` |
| `due_date`, `milestone_key` | Fecha fija o identificador de hito; completitud exigida al publicar |
| `lifecycle_status` | `draft`, `scheduled` o `cancelled`; estado de ciclo explícito |
| `published_at`, `cancelled_at`, `cancellation_reason` | Marcas condicionales a lifecycle; no se expone una operación de cancelación en P1-04 |
| `label`, `notes` | Texto opcional |
| `created_by` | Actor UUID FK a `auth.users`, RESTRICT |
| `created_at`, `updated_at` | `timestamptz`, defaults transaccionales; `updated_at` se refresca en edición |

Hay constraints para tipos de vencimiento, moneda, monto, lifecycle coherente y fechas/hitos. Índices: PK, unicidad `(organization_id,id)`, unicidad `(organization_id,order_id,sequence)` y un índice parcial por vencimientos publicados. `orders`/`order_items` no se alteran.

No existen columnas `paid_amount`, `status` financiero ni cache en la tabla. Según D09, esos valores se derivarán desde allocations/netos cuando exista ledger; mientras P1-05/P1-06 no existan, P1-04 no declara ni simula pagos. El calendario representa deuda bruta del cliente, no fee ni neto recibido.

## Commands y consistencia

- `public.phase1b_save_payment_schedule_draft(p_org uuid, p_order uuid, p_schedules jsonb)` es un wrapper invoker. Solo admin/finanzas del tenant activo pueden usarlo. Serializa sobre la fila de `orders`, guarda/upsertea secuencias draft y reemplaza únicamente drafts omitidos del payload. Replay idéntico no duplica filas ni activity. El borrador puede prepararse antes de aceptar la orden; una orden cancelada no admite calendario.
- `public.phase1b_publish_payment_schedule_plan(p_org uuid, p_order uuid)` publica en una transacción solo si la orden está `accepted`, todas las obligaciones están completas y la suma de `expected_amount` coincide exactamente con `orders.total`. Replay publicado es idempotente. No se genera plan para órdenes gratuitas.
- Los montos llegan como strings JSON para evitar `float`; se rechaza escala extra (CLP: 0 decimales; USD: 2), valores no positivos, precisión fuera del helper monetario y moneda incompatible. El total no se redistribuye ni redondea en frontend.
- Ambas escrituras registran actor, tenant y acción en `activity_log` dentro de la misma transacción. Las llamadas fallidas revierten cambios y log juntos.
- El guard impide crear filas no-draft, cambiar identidad o modificar cualquier término tras publicar. No permite borrar filas publicadas/canceladas. La eliminación interna se limita a drafts nunca publicados al reemplazar un plan.
- Publicar requiere orden aceptada para que el total comercial esté congelado por Phase 1A. Esta condición protege la conciliación del plan y no introduce un flujo de aceptación nuevo.

## Seguridad / permisos

RLS está habilitado y forzado. `SELECT` queda solo para miembros activos con rol admin o finanzas. Los permisos de escritura autenticados son únicamente los dos entrypoints acotados; no hay DML directo para ningún rol.

| Rol | Leer | Guardar draft / publicar | DML directo |
|---|---:|---:|---:|
| admin | Sí | Sí | No |
| editor | No | No | No |
| diseñador | No | No | No |
| corrector | No | No | No |
| finanzas | Sí | Sí | No |
| visualizador | No | No | No |
| anon, inactivo, desconocido, otro tenant | No | No | No |

Los comandos internos pertenecen a `noveli_orders_executor` (`NOLOGIN`, `NOBYPASSRLS`), validan el actor mediante `noveli_private.actor_role`, tienen `search_path` vacío y no alteran el esquema/helper de Security 04B. `service_role` no tiene grants de tabla ni `EXECUTE` en wrappers; el rol no es necesario para el flujo. `postgres` conserva sus privilegios operativos de propietario/superusuario.

No se crea capability ni flag: ninguno está aprobado ni hace falta para P1-04. Las capabilities Phase 1A no se modifican.

## Accounting y compatibilidad

La migración no lee ni modifica `incomes`, `income_allocations`, `income_distributions` o `expenses`. `income_allocations` no se reutiliza. No hay backfill, cambios a cotizaciones, órdenes productivas, Storage, Auth ni frontend. `payment_status` de órdenes sigue derivado/no persistido. No se crean órdenes ni cobros.

La única tabla nueva del dominio Payment en P1-04 es `payment_schedules`; las tablas P1-05 y posteriores permanecen ausentes. Los tests actualizaron las expectativas antiguas de “ninguna tabla Payment” para permitir solo P1-04 y seguir rechazando ledger/contratos.

## Validación local

Se reconstruyó Supabase local con `npx.cmd --yes supabase@2.109.1 db reset --local`; las migraciones hasta P1-04 aplicaron sin error. Pruebas finales, sobre esa DB local:

- P1-04 dominio/RLS/concurrencia: **49 checks PASS** (incluye una prueba dedicada que retiene el lock de la orden hasta confirmar que dos publicaciones simultáneas están esperando; al liberar, una publica y la otra retorna replay idempotente, con una sola cuota publicada y una sola actividad).
- Phase 1A Orders + quotation conversion: **55 checks PASS**.
- Assertions SQL Phase 1A/P1-04: **19 PASS**.
- Security 01–04B regression: **2.894 assertions PASS** (49 + 274 + 316 + 989 + 1.041 + 225).
- No se ejecutó build/frontend, porque P1-04 no modifica frontend.

## Revisión formal y cierre de cobertura

La revisión formal P1-04 fue **PASS**. El único hallazgo LOW —ausencia de una prueba dedicada de publicaciones simultáneas— quedó cerrado con el caso de concurrencia descrito arriba. El test confirma contención simultánea en PostgreSQL, resultado inicial más replay, una sola fila, secuencia intacta, suma exacta y una sola actividad de publicación.

La migración conserva el SHA-256 aprobado y no cambió. La aprobación es únicamente local; `production_deployed=false` y producción no fue modificada.

Los tests usan organizaciones/usuarios/órdenes sintéticas en la DB local; no alteran producción.

## Fronteras y riesgos diferidos

- No existe todavía el ledger; paid/status calculados no pueden reflejar cobros hasta P1-05/P1-06.
- La transición a `cancelled` de cuotas publicadas queda reservada al flujo de cancelación de órdenes de P1-06; P1-04 no expone cancelación aislada.
- La publicación requiere orden aceptada; los drafts pueden prepararse antes y deben reconciliar de nuevo al publicar.
- No se ha desplegado ni se ha probado el comportamiento productivo; requiere revisión independiente y autorización de deployment.
- Los tests SQL/HTTP de Storage/Auth no se repitieron: no hubo cambios de Auth/Storage ni policies globales; las regresiones Security 01–04B y checks locales de bucket flags pasaron.

## Contención / recuperación

P1-04 es aditivo y esta iteración es local. No hay rollback productivo que ejecutar. Si una futura instalación presenta un fallo, contener revocando `EXECUTE` de los dos wrappers a `authenticated` y dejar el esquema aditivo intacto; preferir forward fix. No borrar schedules publicados ni usar `DROP`, migration repair o reset linked. El recovery point pre-Phase1B vigente está documentado arriba; restore integral sigue no ensayado.

**P1-04 REVIEW: PASS**
**P1-04 LOCAL IMPLEMENTATION: APPROVED**
**P1-04 PRODUCTION DEPLOYED: YES (2026-10-19)**
**P1-05 STARTED: NO**

## Deployment posterior — 2026-10-19

P1-04 se aplicó a `crm-noveli` (`bdxlzhpmifxwmqjnnmxa`) mediante `supabase db push --linked --yes`. El dry-run inmediatamente previo propuso exclusivamente `20261019045900_phase_1b_p1_04_payment_schedules`; el push terminó con exit code 0 y registró esa única migración. SHA-256 verificado antes del push: `a7746b6a77df66618570203c41c5d70462211d972004cbfb0ebbe737b5da7600`.

Verificación posterior read-only: proyecto `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.127`, 49 tablas public y 49 con RLS; `payment_schedules` presente, RLS habilitado/forzado, `numeric(18,2)`, CLP/USD, 0 filas. Constraints, FK compuesta tenant/orden, índices, policies y funciones esperadas presentes. Los dos wrappers públicos son `SECURITY INVOKER`; anon y `service_role` carecen de execute y DML directo. Los dos helpers internos `SECURITY DEFINER` pertenecen a `noveli_orders_executor` y tienen `search_path` vacío.

Datos invariantes tras el despliegue: orders 0, order_items 0, quotations 6 (`borrador`: 6), incomes 4, income_allocations 10, income_distributions 0, expenses 13. Las tablas P1-05 (`payments`, `payment_refunds`, `payment_allocations`) siguen ausentes. Capabilities Phase 1A siguen habilitadas; Storage conserva 19 objetos públicos en `brand-assets` y 36 privados en `documents`. No se crearon datos reales ni se modificaron frontend, Vercel, Storage, Auth o contabilidad.

Smoke HTTP GET sin sesión: `/admin/ordenes` y `/admin/cotizaciones` respondieron 200. No se automatizó login ni se inspeccionó consola autenticada; no hubo cambios de frontend en este despliegue DB-only.
**P1-05 STARTED: NO**
