# NOVELI 2.0 — P1-05 Payments Ledger Foundation

**Estado:** DEPLOYED / VERIFIED
**Aprobación local:** APPROVED
**Producción:** HEALTHY; deployment verificado el 2026-10-20

## Alcance

Implementa exclusivamente las estructuras congeladas de P1-05: `payments`, `payment_refunds` y `payment_allocations`, sus constraints, índices, RLS, guards INVOKER y la clave compuesta de evidencia en `documents`. No agrega RPC de escritura pública, capability, frontend, webhook ni datos iniciales.

Quedan fuera P1-06 (comandos de negocio del ledger) y P1-07 (vínculo/posting/conciliación con `incomes`). `income_allocations` continúa siendo un dominio contable separado.

## Migración

- `supabase/migrations/20261019070000_phase_1b_p1_05_payments_ledger.sql`
- SHA-256: `ce32ff184ec52305be8290722f9c215945defa4044c97efcd654bf40a45f34d0`
- Superseded pre-review SHA-256: `7c13b31b93d02d0df1e12f873b5c95a9434cf9e79bb07831754a94598495f653` (net_amount NOT NULL correction before commit/deploy).
- Una migración aditiva, sin `DROP`, backfill ni cambios en datos de negocio existentes.
- Dependencias: Phase 1A, P1-04 y helpers monetarios aprobados.

## Modelo instalado

### `payments`

20 columnas congeladas. Importes `gross_amount` y `provider_fee` son `numeric(18,2)`; bruto `>0`, fee entre cero y bruto, escala monetaria validada, moneda CLP/USD. `net_amount` es `numeric(18,2) GENERATED ALWAYS AS (gross_amount-provider_fee) STORED NOT NULL`; catálogo PostgreSQL local confirma generated stored, NOT NULL y expresión. Identidad externa usa `text COLLATE "C"`; `idempotency_key` es UUID; `request_hash` valida `sha256-v1:` más 64 hexadecimales minúsculos. La identidad externa parcial es única por tenant/proveedor/cuenta/ID informado; la idempotencia por tenant; `external_reference` no es única.

FK compuesta a order del mismo tenant; FK opcional compuesta a documento; actor Auth RESTRICT. El estado inicial es `pending`; el guard permite solo la transición a un estado terminal y notes mientras está pending. No borra ni modifica términos financieros o identidad.

### `payment_refunds`

17 columnas congeladas. Eventos append-only por `refund_key`, secuencia consecutiva sin bifurcación; monto positivo, moneda enlazada por FK compuesta al payment, status requested/processing/terminal y `processed_at` coherente. Hash versionado, operation key por tenant, actor Auth RESTRICT. Los IDs de refund del proveedor se serializan y deduplican en el namespace heredado del payment. No se actualiza ni elimina un evento.

### `payment_allocations`

14 columnas congeladas. Importe positivo `numeric(18,2)`, N:N payment↔schedule, contexto redundante tenant/order/moneda comprobado contra los padres. `apply` no admite referencia de reverso; `reverse` exige apply original y refund succeeded del mismo contexto. Claves de operación/posición y reverso impiden replay duplicado. Append-only.

## Integridad, índices e inmutabilidad

- Los CHECK imponen moneda CLP/USD, importes/límites/escala, hash, enums y forma/timestamps.
- FK compuestas `ON DELETE RESTRICT` aíslan tenant, order, currency, schedule, refund, reverso, actor y documento.
- Índices de dedupe/candidate keys y de historial por order/payment/schedule; índices parciales para identidades externas, refunds y reversos. No se indexan saldos derivados.
- Triggers INVOKER en `noveli_private`, `search_path=''`; cinco funciones P1-05, ninguna SECURITY DEFINER ni RPC pública.
- Los guards serializan por fila de order, payments por UUID, cadenas de refund por advisory transaction lock y schedules por UUID. Constraint triggers diferidos validan refund succeeded + reservas contra gross, reversos contra aplicaciones originales, net applied contra retained gross y límite efectivo de cada schedule.
- El índice único `documents(organization_id,id)` se creó como clave candidata requerida para la FK compuesta; la baseline local solo tenía PK global en `id`. No se tocaron filas, Storage ni RLS de documents.
- Para que `SELECT … FOR UPDATE` respete el orden de locks bajo RLS, el executor tiene permisos de UPDATE a nivel de columna y policies de lock en `orders`/`payment_schedules` con `WITH CHECK(false)`. Los tests confirman que no puede cambiar esas filas. No se alteraron columnas, datos ni reglas comerciales de esas tablas.

## RLS y grants

Las tres tablas tienen RLS ENABLE + FORCE. `admin` y `finanzas` activos del tenant pueden leer; `editor`, `diseñador`, `corrector`, `visualizador` y `anon` no pueden leer ni escribir. Ningún rol authenticated tiene DML directo. `service_role` tiene revocados los privilegios directos.

`noveli_payments_executor` es `NOLOGIN NOINHERIT NOBYPASSRLS`, asumible solo por `postgres`; tiene policies tenant-scoped y grants mínimos para insertar ledger, leer contexto y la transición acotada de payment. No puede borrar refunds/allocations/payments ni alterar parents. Los guards no son entrypoints invocables por API.

## Validación local

Base recreada baseline → Security 04B → Phase 1A → P1-04 → P1-05.

| Suite | Resultado |
|---|---:|
| P1-05 schema/domain/RLS/concurrency | 126 PASS |
| P1-04 schedules | 49 PASS |
| Phase 1A Orders/conversion | 55 PASS |
| Phase 1A SQL assertions | 19 PASS |
| Security 01–04B | 2.894 PASS |
| Python syntax, JSON validation, `git diff --check` | PASS |

P1-05 cubre metadatos de columnas desde catálogo, CLP/USD, net generated (incluidos 100−20=80 y fee cero 100−0=100), fees/hash/dedupe/manual IDs, cadenas y reservas refund, N:N, caps diferidos y dos carreras con sesiones independientes: dos reservas refund concurrentes y dos allocations concurrentes excedían sus límites. En cada carrera una transacción confirmó y la otra fue rechazada; los agregados quedaron consistentes. También comprueba los seis roles, denegaciones UPDATE/DELETE, anon/service_role, tenant boundaries, evidence FK e inmutabilidad.

Tras el reset local final se verificó: `payments=0`, `payment_refunds=0`, `payment_allocations=0`, `payment_schedules=0`, `orders=0` y `order_items=0`. No quedan fixtures persistentes.

## Fronteras y contención

P1-06 sigue a cargo de record/confirm payment, lifecycle command, allocation/reversal/refund commands, replay observable, actor/capability checks, orquestación uniforme de locks, actividad y resúmenes financieros. Los guards P1-05 mantienen invariantes de filas y agregados, pero no exponen operaciones de negocio.

P1-07 sigue a cargo de `incomes.payment_id`, posting y conciliación. `incomes`, `income_allocations`, `income_distributions` y `expenses` no se alteran.

La migración es aditiva. Si falla en local, corregir y resetear localmente. Para un futuro fallo remoto, detenerse, conservar evidencia y preferir forward fix revisado; no usar rollback destructivo, `migration repair` ni borrar ledger. El recovery actual es `C:\Users\xavie\Desktop\backup\pre-phase-1b\20261019T044950Z`, clasificación **PRE-P1-04**, restore rehearsal **NOT PERFORMED**; es insuficiente como recovery de deployment P1-05. Crear uno **POST-P1-04 / PRE-P1-05-PRODUCTION** antes de cualquier despliegue futuro.

P1-06 y P1-07 no iniciados.

## Revisión estructural y corrección pre-commit — 2026-10-20

La primera revisión revocó la aprobación porque el catálogo reportaba `payments.net_amount` nullable frente al freeze `NOT NULL`. Se corrigió únicamente esa constraint en la columna generada; no cambió la expresión ni otra semántica de la migración. El test de catálogo confirma `numeric(18,2)`, generated stored, NOT NULL y `(gross_amount - provider_fee)`. LOW #2 quedó cerrado con metadatos catalog-driven, variantes negativas, schedule cross-tenant aislado y UPDATE/DELETE por rol. P1-05 se revalidó con 126 checks; regresiones P1-04, Phase 1A, SQL y Security también pasaron. `P1-05 REVIEW: PASS`; aprobación local recuperada.

## Deployment productivo — 2026-10-20

- Recovery inmediato: `C:\Users\xavie\Desktop\backup\pre-p1-05-production\20261020T211445Z`, clasificación `POST_P1_04_PRE_P1_05_PRODUCTION`, verificado. Restore rehearsal: **NOT PERFORMED**.
- Pre-check read-only, hash canónico y dry-run pasaron; el dry-run propuso exclusivamente `20261019070000_phase_1b_p1_05_payments_ledger.sql`.
- La migración `20261019070000` figura en el historial remoto. El proyecto permanece `ACTIVE_HEALTHY`; public tables/RLS: 52/52.
- `payments`, `payment_refunds` y `payment_allocations` existen con 0 filas y RLS. Catálogo confirma `net_amount numeric(18,2) GENERATED STORED NOT NULL`, expresión `(gross_amount - provider_fee)`. Índice auxiliar de documents presente; sin SECURITY DEFINER, comandos públicos P1-06 ni integración contable P1-07.
- `payment_schedules`, orders y order_items permanecen en 0; quotations siguen 6 `borrador`; baseline accounting sin cambios. No se creó dato financiero real.
- Producción HEALTHY. Commit funcional `70511f490c6cbbc1c4b415ef18a316a819ddb14f` todavía no se ha sincronizado con `main`; P1-06/P1-07 siguen sin iniciar.
