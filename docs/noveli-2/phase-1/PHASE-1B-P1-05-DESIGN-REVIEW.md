# NOVELI 2.0 — P1-05 Estructura ledger / Payments — Design Review

**Fecha de revisión:** 2026-10-19
**Tipo:** diseño solamente; no autoriza implementación ni despliegue
**Resultado:** alcance y diseño físico congelados; se requiere aprobación separada para implementar
**Producción modificada durante esta revisión:** no

## 1. Alcance aprobado exacto

El diseño aprobado llama explícitamente al siguiente lote **P1-05 Estructura ledger**. La agrupación de estos lotes bajo “Phase 1B Payments” pertenece al estado maestro/readiness review, no es una etiqueta textual del documento de diseño. El alcance de P1-05 es inequívoco:

- Crear conjuntamente `payments`, `payment_refunds` y `payment_allocations`, porque refunds y reversos tienen dependencias mutuas.
- Instalar las claves, checks, referencias compuestas de tenant/orden/moneda, restricciones append-only, validaciones diferidas/topes, índices y RLS/grants desde este lote.
- Mantener DML directo de API denegado. La migración no expone comandos públicos de escritura; validación local de fixtures se hace bajo rol interno.
- No crear datos iniciales ni pagos de producción.

La fuente normativa es el lote P1-05 de [PHASE-1-DESIGN.md](PHASE-1-DESIGN.md) §16 y el detalle de payments, allocations, refunds y seguridad en §§7–10. [PHASE-1B-READINESS-REVIEW.md](PHASE-1B-READINESS-REVIEW.md) §1 mapea el lote al dominio Payments y registra su separación de P1-06/P1-07.

## 2. Fuera de alcance

- RPC/entrypoints para crear/confirmar pagos, asignar cobros, solicitar/procesar refunds, registrar reversos, cambiar lifecycle o calcular agregados: **P1-06**.
- Posting `payment → incomes`, `incomes.payment_id`, proyección/conciliación y guards de ingresos enlazados: **P1-07**.
- Provider webhooks, checkout, auto-cobro y llamadas a procesadores; P1 registra eventos manuales trazables.
- UI de captura/reconciliación, feature/capability activation y release de cobros.
- Cualquier reutilización de `income_allocations`, cambio de `payment_schedules` o `orders`, backfill, dato productivo, alteración de `incomes` o cambio de Vercel.

`payment_refunds` y `payment_allocations` sí pertenecen a P1-05, no a un lote posterior: la tabla P1-05 de §16 las incluye junto a `payments`, y §8 las hace mutuamente necesarias para conservar reversos de refunds.

## 3. Dependencia de P1-04 y modelo de producción observado

P1-04 ya está desplegado. Tras sincronizar `main`, comprobación read-only del proyecto `bdxlzhpmifxwmqjnnmxa` reportó `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.127`, 49 tablas `public` y 49 con RLS. Migration history termina en `20261019045900_phase_1b_p1_04_payment_schedules`.

| Objeto | Producción observada | Relación propuesta en P1-05 |
|---|---|---|
| `orders` | Existe; 0 filas | Padre obligatorio de cada payment; orden debe ser del mismo tenant y estar accepted al crear/confirmar según comando P1-06 |
| `order_items` | Existe; 0 filas | No se referencia desde el ledger |
| `payment_schedules` | Existe, RLS habilitado/forzado; 0 filas | Puede recibir aplicaciones; siempre del mismo order/tenant/currency |
| `payments` | Ausente | Tabla nueva P1-05; FK directa y obligatoria a order |
| `payment_allocations` | Ausente | Tabla nueva P1-05; puente append-only payment ↔ schedule |
| `payment_refunds` | Ausente | Tabla nueva P1-05; eventos enlazados a payment |
| `incomes` | 4 filas | No tocar en P1-05; vínculo nullable/unique `payment_id` es P1-07 |
| `income_allocations` | 10 filas | Distribución contable legacy; no es `payment_allocations` |
| `income_distributions` | 0 filas | Sin uso para asignar cobros |
| `expenses` | 13 filas | Sin cambios |

La consulta read-only posterior al push confirmó `payment_schedules=0`, `orders=0`, `order_items=0`, quotations 6 (`borrador`: 6), `payments/payment_refunds/payment_allocations` ausentes y contabilidad 4/10/0/13. Este snapshot no reemplaza un pre-deployment check futuro.

## 4. Modelo propuesto y campos

Los nombres de campos y semántica siguientes provienen del diseño aprobado §§7–8. Los tipos concretos indicados siguen la convención aprobada: UUID para identidad, `numeric(18,2)` para importes liquidados, `text` + checks para códigos cerrados, `timestamptz` para instantes e integer positivo para secuencias. No crear migración durante este review.

### `payments`

| Campo | Tipo / nullability propuesta | Regla |
|---|---|---|
| `id` | UUID, requerido | PK |
| `organization_id` | UUID, requerido | Tenant; referencia compuesta al order |
| `order_id` | UUID, requerido | FK compuesta tenant/order; no puede existir pago huérfano ni de otro tenant |
| `currency` | text, requerido | `CLP`/`USD`; igual a `orders.currency` |
| `gross_amount` | numeric(18,2), requerido | Bruto recibido del cliente, `>0`; máximo de negocio aprobado 9.999.999.999,99 |
| `provider_fee` | numeric(18,2), requerido | `0 <= fee <= gross`, explícito y conocido al confirmar; fee manual cero debe ser verificado, no asumido |
| `net_amount` | numeric(18,2), generated stored | Exactamente `gross_amount - provider_fee`; nunca entrada editable |
| `method` | text, requerido | Check: `transfer`, `card`, `cash`, `other` |
| `provider` | text, requerido según lista de campos del diseño | Identifica fuente/processor; no significa integración automática |
| `provider_account_scope` | text, requerido según lista de campos | Namespace real y estable de cuenta para unicidad externa; nunca inventado con fecha |
| `provider_payment_id` | text, nullable | ID de transacción estable si existe; único parcial por tenant/proveedor/cuenta/ID |
| `external_reference` | text, nullable | Etiqueta descriptiva; repetible y no única |
| `idempotency_key` | UUID, requerido | Única por tenant para una operación de comando futura |
| `request_hash` | text, requerido | `sha256-v1:` + 64 dígitos hex minúsculos (SHA-256 del payload canónico); replay/comparación en P1-06 |
| `received_at` | timestamptz, nullable hasta succeeded | Requerido en estado succeeded |
| `status` | text, requerido | Check: `pending`, `succeeded`, `failed`, `cancelled` |
| `notes` | text, nullable | Inmutable tras succeeded; corrección futura mediante actividad/evento |
| `evidence_document_id` | UUID, nullable | FK compuesta a `public.documents`; no ruta Storage arbitraria |
| `created_by` / timestamps | UUID + timestamptz | Actor Auth y auditoría; no confiar en actor enviado por cliente |

La especificación marca expresamente nullable `provider_payment_id`, `external_reference` y `received_at` antes de succeeded; por contraste, `provider` y `provider_account_scope` son NOT NULL. La representación física definitiva está congelada en §17.

Un payment siempre pertenece directamente a una order. Puede no estar asignado a ningún schedule: el payment registra el hecho cobrado a nivel de order, y `payment_allocations` puede asignar cero, una o varias partes a cuotas. No se crea una FK `payments.payment_schedule_id` directa, que impediría la relación N:N y confundiría pago recibido con aplicación.

### `payment_allocations`

Campos mínimos de identidad/contexto: `id`, `organization_id`, `payment_id`, `payment_schedule_id`, `order_id`, `currency`, `amount`, `created_by`, `created_at`, `direction`, `reversal_of_id`, `refund_event_id`, `operation_key`, `operation_position`.

- `amount numeric(18,2) > 0`; currency, organization y order coinciden con payment y schedule.
- `direction` es `apply` o `reverse`. Apply requiere `reversal_of_id` y `refund_event_id` nulos; reverse requiere ambos y referencia un apply del mismo tenant/order/payment/schedule/currency y un refund succeeded.
- Apply/reverse son append-only; no UPDATE/DELETE. Reverso de reverso no permitido.
- Unique `(refund_event_id,reversal_of_id)` para replay del reverso, y unique `(organization_id,operation_key,operation_position)` para operación idempotente.
- Sumas diferidas mantienen `0 <= A <= G-R`, `U=G-R-A >= 0` y por cuota `0 <= applied <= expected_amount`; el fee no reduce el límite de aplicación porque aplica el bruto pagado por el cliente.

### `payment_refunds`

Una fila es un evento append-only de una cadena de refund, no un UPDATE de un refund previo. Campos: `id`, `organization_id`, `payment_id`, `currency`, `refund_key`, `event_sequence`, `previous_event_id`, `amount`, `reason`, `status`, `processed_at`, `provider_refund_id`, `external_reference`, `operation_key/request_hash`, `created_by`, `created_at`.

- `amount numeric(18,2) > 0`, reason no vacío, moneda igual al payment.
- `status`: `requested`, `processing`, `succeeded`, `failed`, `cancelled`; evento terminal no tiene sucesor. Amount/payment/currency/reason son constantes de la cadena.
- Unique tenant/refund_key/event_sequence, único `previous_event_id` no nulo, primer evento único por refund_key, FK compuesta al payment y a la misma cadena/pago/moneda.
- `provider_refund_id` opcional se deduplica por tenant/provider/account/ID; `external_reference` descriptiva repetible.
- No UPDATE/DELETE. Solo eventos succeeded cuentan en refund total; pending/processing reservan importe/topología según guards.

## 5. Reglas monetarias y constraints

- Canon payment: bruto del cliente `gross_amount`; fee explícito `provider_fee`; neto generado almacenado `net_amount = gross_amount - provider_fee`.
- Moneda única por payment/fee/net, igual a la order. Fase 1 activa únicamente `CLP` y `USD`; importes `numeric(18,2)` con máximo de negocio `9.999.999.999,99`; CLP debe tener escala efectiva cero. Nada de float/double ni conversión JS como fuente autoritativa.
- Proveedor con FX, fee desconocido/tardío, rebate o fee mayor que gross queda fuera. No asumir fee=0 para completar datos.
- Estado payment es explícito, pero solo cambia por comandos P1-06: `pending → succeeded|failed|cancelled`; terminales inmutables. `succeeded` exige `received_at` y la evidencia asociada al método según diseño.
- Refund total succeeded más reservas `requested/processing` no excede gross. Múltiples refunds secuenciales se admiten; solicitudes/apps concurrentes sobre el pago se congelan mientras refund esté pendiente, bajo los locks aprobados.
- External reference no unique. Dedupe fuerte usa idempotency key y provider payment ID estable con namespace real `(organization, provider, account_scope, provider_payment_id)`; mismo ID/namespace conflictivo se rechaza. Cuenta/scope distinto solo es legítimo si es un namespace real definido por proveedor.
- FK compuestas/RESTRICT impiden mezcla tenant/order/currency y borrado de padres con historia. `income_allocations` no aparece en constraints como sustituto.

## 6. Derivados, allocation y frontera de implementación

P1-05 instala modelo y protección de datos; no instala operaciones comerciales invocables. Las escrituras controladas de `pending`, `succeeded`, allocations/reversals y refunds se habilitan exclusivamente en P1-06. Los checks que requieren sumas entre filas deben ser deferred y acompañarse por las funciones/guards de serialización especificadas; no aceptar un `SUM()` sin lock como protección de carrera.

Definiciones del diseño:

- Para pago succeeded: `G = gross_amount`, `R = refunds succeeded únicos`, `A = sum(apply - reverse)`, `U = G - R - A`.
- El dinero cobrado puede quedar sin asignar (`U>0`), incluso cuando exista overpayment real; no inventar cuota ni trasladar crédito a otra orden.
- La cuota y `orders.payment_status` permanecen derivados. P1-05 no agrega ni actualiza `paid_amount`, `refunded_amount`, `settled_amount` ni un cache. Cualquier agregado visible se completa en P1-06.
- El diseño conserva referencia directa payment→order y allocation N:N payment↔schedule, siempre dentro de una orden/tenant/moneda.

## 7. RLS y seguridad esperados

El modelo aprobado §10 da permisos de ledger a admin y finanzas; el SELECT financiero de ambos queda disponible bajo tenant activo. P1-05 no adelanta la C (commands) de esa matriz, que corresponde a P1-06. DML directo authenticated se deniega a todos; no hay DELETE API. Matriz efectiva instalada por P1-05:

| Actor | SELECT ledger | INSERT/UPDATE/DELETE directo | Comandos de negocio |
|---|---:|---:|---|
| admin | Sí, tenant activo | No | No en P1-05; comandos autorizados se agregan en P1-06 |
| editor | No | No | No |
| diseñador | No | No | No |
| corrector | No | No | No |
| finanzas | Sí, tenant activo | No | No en P1-05; comandos autorizados se agregan en P1-06 |
| visualizador | No | No | No |
| anon | No | No | No |
| service_role | No como vía de app; sin grants/API de ledger | No como acceso directo aprobado | Ninguno |
| executor interno | Solo lo mínimo de fixtures/guards bajo rol no-login `NOBYPASSRLS` | Solo contexto interno de validación; no identidad de usuario | No callable por API; P1-06 define RPCs acotados |

Policies deben comprobar membresía activa, tenant explícito y roles usando helpers endurecidos, sin confiar en `user_metadata`. Ningún rol de CRM puede ejecutar una mutación directa durante P1-05. `income`/`payment_id` no se agrega aún.

P1-05 no requiere un RPC público. Constraints y triggers son mecanismos de integridad, no endpoints. Si una validación diferida necesita función `SECURITY DEFINER`, debe ser privada/no expuesta, `search_path=''`, propietario interno no-login `NOBYPASSRLS`, EXECUTE revocado a anon/authenticated/public salvo el mínimo inevitable del trigger y sin callable entrypoint. Preferir invoker cuando baste. No usar `service_role` como bypass de pruebas.

## 8. Concurrencia e idempotencia

- DDL debe imponer unicidad tenant/idempotency key; la operación futura compara hash canónico y falla si se reutiliza key con otro payload.
- DDL debe imponer unicidad parcial de provider transaction ID en su namespace; replays del mismo ID no crean segundo pago. `external_reference` se puede repetir y no pretende dedupe perfecta para registro manual sin ID fiable.
- P1-05 instala unique/FK/checks y deferred guards para impedir topes inválidos; P1-06 implementa replay observable, actor/transacción y orden de locks: order primero, payments en UUID order, refund chain y schedules en UUID order.
- Requests repetidos/concurrentes de proveedor, imports y creación manual deben usar idempotency key. P1-05 no incorpora importer ni callback handler.
- Una vez registrado succeeded, gross/fee/net/currency/order/provider identity quedan congelados; failed/cancelled también terminales según comandos. No UPDATE/DELETE del ledger ni refund para “corregir” importe.
- Tenant crossing y currency mismatch se previenen a nivel de FK compuesto/check y se vuelven a comprobar en los comandos P1-06.
- Como P1-05 no habilita commands, el acceso efectivo de escritura es solo interno/test harness. No prometer que el sistema acepta pagos productivos hasta P1-06 + release autorizada.

## 9. Fronteras con P1-06 y P1-07

### P1-06 — comandos ledger

No implementar en P1-05 RPC para crear pago, confirmar pago, cambiar status, asignar, reversar, solicitar/procesar refund, lock service, operación idempotente visible, actividad/log ni summary/agregado `payment_status`. P1-06 implementa esos comandos de forma atómica; capacidad de cobro default false. P1-05 debe dejar constraints, RLS e índices listos sin abrir DML.

### P1-07 — accounting

No ALTER de `incomes`; no `payment_id`; no posting; no tasa contable USD; no proyección/reporte ni guards contables. `incomes` sigue legacy y no crea pagos al interpretarse. `income_allocations` sigue distribución distinta. P1-07 enlaza una sola vez un payment succeeded a income y protege únicamente filas enlazadas.

## 10. Índices propuestos

Además de PK/unique y los índices requeridos por FK:

- Payments: `(organization_id, order_id, received_at)` para historia por orden; unique tenant/idempotency key; unique parcial provider/account/payment ID cuando el ID no es NULL.
- Allocations: `(organization_id,payment_id)` y `(organization_id,payment_schedule_id)`; unique refund/reversal; unique operation key/position.
- Refunds: `(organization_id,payment_id,refund_key,event_sequence)`/unique chain; FK de evento previo unique; unique provider-refund identity parcial cuando se informe.
- Ningún índice por balances derivados ni external_reference repetible; revisar redundancia de prefijos con unique constraints antes de congelar migration.

## 11. Plan de pruebas

Usar sesiones PostgreSQL separadas para carreras, fixtures sintéticos locales y roles reales aplicados. No hacer escrituras en producción ni sustituir autorización con service_role.

| Caso/riesgo | Cobertura requerida |
|---|---|
| Esquema, tipos, generated net, checks, FK compuestas e índices | PASS esperado con introspección DB |
| Gross/fee/net exactos (50000/1500/48500), USD/CLP, fee 0 explícito, escala/overflow | T20 + validaciones negativas |
| Order requerido, order accepted en comando futuro, otro tenant, currency distinta | T08, T23, T39–40 |
| Provider ID duplicado y namespace distinto; external reference repetible | T25–26 |
| Idempotency key mismo payload vs hash conflictivo | T04/T06 y P1-05 estructural; replay funcional se prueba P1-06 |
| Un payment a varias schedules / varios payments a una schedule; unallocated | T19/T21 |
| Pending/failed no se asignan; topes gross/refund/apply/schedule | T21–24, T31, T36 |
| Refund partial/total/secuencial/excesivo, reservations y reversos | T28–33 |
| Carreras concurrentes de applications/refunds y topes diferidos | T22/T31 con sesiones reales independientes y locks de §8 |
| Append-only; UPDATE/DELETE bloqueado sobre payments, allocations, refund events | T24/T32/T41; DML directo denegado |
| Matriz RLS por tenant/roles; anon, inactive/unknown, cross-tenant | T38–40 |
| RLS de payment_schedules y regresión P1-04/P1A/Security 04B | T27/T58–59 y suites existentes |
| Frontera Phase 1B | afirmar absence of commands; ninguna FK a incomes ni cambio contable |

Los casos P1-05 son T19–36 y T38–42 del plan; los escenarios de comportamiento de comandos se mantienen como pruebas contractuales que deberán completarse al llegar P1-06. P1-05 debe demostrar constraints, direct-DML denial, append-only y fixtures internos sin crear endpoint de cobro.

## 12. Estrategia de migración/deployment

1. Congelar el schema anterior en review de implementación y resolver los detalles SQL señalados en §16 antes de crear migration.
2. Una migration aditiva P1-05 que cree juntas las tres tablas relacionadas y su seguridad; sin backfill, DML de negocio o capability activation.
3. Reset local baseline→04B→Phase1A→P1-04→P1-05; schema/domain/RLS/negative/concurrency/regression suites.
4. Revisión independiente del hash, grants, trigger/deferred constraints, candidate set y `db push --dry-run`; solo P1-05 pendiente.
5. Antes de despliegue productivo, crear recovery point **POST-P1-04 / PRE-P1-05-PRODUCTION**. El checkpoint `pre-phase-1b/20261019T044950Z` es PRE-P1-04; nunca llamarlo post-P1-04. Restore rehearsal sigue no realizado.
6. Deploy DB-only con capabilities apagadas; post-check de invariantes, tabla vacía y ninguna orden/cotización cambiada. UI/flags quedan fuera.

## 13. Contención

- Antes de db push: cualquier baseline, migration hash o dry-run inesperado significa STOP sin mutation.
- Si migration falla: STOP, preservar historial/esquema, sin repair/reset linked, recreación manual ni DROP.
- Si aplica pero post-check falla: no iniciar P1-06 ni agregar datos; dejar estructura vacía, contener todo acceso de lectura/escritura mediante grants/capability si ya existiera (P1-05 no activa capability), guardar evidencia redactada y diagnosticar.
- Preferir forward migration revisada. No borrar pagos/refunds/allocations ni reescribir contabilidad.

## 14. Preguntas obligatorias resueltas / decisiones de implementación

| Tema | Conclusión del diseño |
|---|---|
| Importe canónico | gross del cliente; fee explícito; net generated `gross-fee` |
| Provider dedupe | idempotency key + request hash; provider payment ID estable único por tenant/proveedor/cuenta; external_reference no unique |
| Order vs schedule | payment requiere order; schedule se relaciona N:N solo vía allocation; payment sin allocation es válido |
| Moneda | CLP/USD, numeric(18,2), gross/fee/net iguales en moneda y currency order; CLP escala de negocio 0 |
| Estado | pending/succeeded/failed/cancelled; solo comandos, terminal inmutable |
| Mutabilidad/borrado | sin delete; inmutabilidad tras registro y terminalidad; cambio solo por P1-06 controlado antes de terminal |
| Creación | P1-05 no tiene callers de escritura; admin/finanzas commands se definen en P1-06 |
| Refunds/allocations | ambas estructuras forman parte de P1-05; comandos posteriores P1-06 |
| Accounting | fuera de P1-05/P1-06; P1-07 |

Decisiones físicas cerradas en §17: identificadores externos como `text` sin truncamiento; `provider` y `provider_account_scope` NOT NULL; origen manual `provider='manual'`, `provider_account_scope='manual'` (la organización forma parte del namespace y el provider ID queda NULL); request hash como text versionado con SHA-256; `processed_at` NULL en eventos no terminales y requerido en terminales; no hay `updated_at` en los ledgers. No queda una pregunta que permita variar columnas, constraints, uniqueness o RLS.

## 15. Criterios de aceptación de P1-05

- Solo las tablas `payments`, `payment_refunds`, `payment_allocations`, sus constraints/keys/indexes/policies/triggers privados necesarios; no commands/API, no accounting, no UI.
- Invariantes monetarios y de tenant/order/currency están en base de datos y cubiertos por pruebas negativas.
- Net es generado; referencias descriptivas repetibles no únicas; identidad/idempotency protegida por constraints.
- Append-only y DELETE denegado para las tres tablas; terminalidad e invariantes deferred no tienen race bajo sesiones concurrentes.
- Ledger solo es legible por roles financieros autorizados dentro de tenant; ningún DML directo authenticated, anon ni `service_role`.
- Ninguna mutación de `orders`, `payment_schedules`, accounting, Auth, Storage, Vercel, capabilities o datos productivos.
- Fixtures locales se eliminan en reset final; `payments`, `payment_refunds`, `payment_allocations` empiezan con 0 rows.
- Separación P1-06/P1-07 demostrada por catálogo/introspección y tests.

## 16. Riesgos y cierre de readiness

El límite importante es no convertir este lote de estructura en un camino de captura: aunque las tablas existan, ningún payment operativo se registra hasta P1-06 y su release aprobada. Los triggers diferidos y locks son críticos; un CHECK fila por sí solo no impide carreras de sumas. Dedupe manual sin provider ID inequívoco no puede garantizar que dos pagos sean el mismo evento. El checkpoint disponible es PRE-P1-04 y no ha sido restaurado en ensayo; hace falta uno nuevo PRE-P1-05 production.

**P1-05 SCOPE CONFIRMED:** YES — tres tablas del ledger, sin commands ni posting.
**DESIGN SOURCE REVIEWED:** YES.
**PHYSICAL DESIGN FREEZE:** PASS.
**OPEN BLOCKING QUESTIONS:** 0.
**P1-05 IMPLEMENTATION STARTED:** NO.
**PRODUCTION CHANGES:** NONE.
**READY FOR IMPLEMENTATION APPROVAL:** YES.
**NEW RECOVERY REQUIRED BEFORE P1-05 PRODUCTION:** YES — POST-P1-04 / PRE-P1-05-PRODUCTION.
**RESTORE REHEARSAL:** NOT PERFORMED.

## 17. PHYSICAL DESIGN FREEZE

Esta sección fija la representación PostgreSQL de las decisiones aprobadas. No crea SQL ni objetos. La especificación estructurada paralela es [PHASE-1B-P1-05-PHYSICAL-DESIGN.json](PHASE-1B-P1-05-PHYSICAL-DESIGN.json).

### 17.1 `payments`

| Columna | Tipo PostgreSQL | NULL / default | CHECK / FK / mutabilidad |
|---|---|---|---|
| `id` | `uuid` | NOT NULL / `gen_random_uuid()` | PK; inmutable |
| `organization_id` | `uuid` | NOT NULL / ninguno | Parte de FK `(organization_id,order_id)` a orders; inmutable |
| `order_id` | `uuid` | NOT NULL / ninguno | FK compuesta a orders con `ON DELETE RESTRICT`; inmutable |
| `gross_amount` | `numeric(18,2)` | NOT NULL / ninguno | `>0`, máximo negocio `9999999999.99`; inmutable |
| `provider_fee` | `numeric(18,2)` | NOT NULL / ninguno | `>=0 AND <=gross_amount`; cero permitido solo como valor explícito verificado; inmutable |
| `net_amount` | `numeric(18,2)` generated stored | NOT NULL / `gross_amount - provider_fee` | Exacta, misma moneda, no input ni update |
| `currency` | `text COLLATE "C"` | NOT NULL / ninguno | CHECK `CLP`,`USD`; debe coincidir con order; inmutable |
| `provider` | `text COLLATE "C"` | NOT NULL / ninguno | Clave opaca no vacía, trim y minúscula; sin enum que anticipe integraciones; inmutable |
| `provider_account_scope` | `text COLLATE "C"` | NOT NULL / ninguno | Scope opaco no vacío definido por la cuenta real; no se deriva de fecha; inmutable |
| `provider_payment_id` | `text COLLATE "C"` | NULL / NULL | Identificador externo exacto, sin truncamiento ni UUID supuesto; inmutable |
| `method` | `text` | NOT NULL / ninguno | CHECK `transfer`,`card`,`cash`,`other`; inmutable |
| `idempotency_key` | `uuid` | NOT NULL / ninguno | UNIQUE por tenant; inmutable |
| `request_hash` | `text COLLATE "C"` | NOT NULL / ninguno | CHECK `sha256-v1:` + 64 hex minúsculos; inmutable |
| `external_reference` | `text` | NULL / NULL | Descriptiva, repetible, NO UNIQUE; inmutable tras registro |
| `received_at` | `timestamptz` | NULL / NULL | NULL salvo `succeeded`; requerido para succeeded; UTC instant; cambio único junto al status por P1-06 |
| `status` | `text` | NOT NULL / `pending` | CHECK `pending`,`succeeded`,`failed`,`cancelled`; transición de comando P1-06 `pending→terminal`; terminal inmutable |
| `notes` | `text` | NULL / NULL | Edición solo mientras pending por comando P1-06; inmutable tras succeeded |
| `evidence_document_id` | `uuid` | NULL / NULL | FK compuesta `(organization_id,evidence_document_id)` a `public.documents`, RESTRICT; inmutable tras registro |
| `created_by` | `uuid` | NOT NULL / ninguno | FK `auth.users(id) ON DELETE RESTRICT`; actor lo aporta servidor, inmutable |
| `created_at` | `timestamptz` | NOT NULL / `now()` | Inmutable; sin `updated_at` |

El monto bruto cero se rechaza: el diseño aprobado dice `gross_amount > 0`; el fee cero sí es válido si se registró/verificó explícitamente; neto cero queda permitido solo si gross positivo y fee igual a gross.

`provider` usa `text`, no enum: no trunca nombres ni requiere migración para incorporar un código de proveedor aprobado; P1-05/P1-06 siguen sin integrar proveedores. `provider_account_scope` y los IDs externos también son `text COLLATE "C"`, conservan comparación exacta y no imponen límite de longitud inventado. La unicidad btree puede rechazar valores que excedan el límite físico de índice PostgreSQL; no hay truncamiento silencioso.

Para captura manual, `provider='manual'`, `provider_account_scope='manual'`, `provider_payment_id=NULL`. La unicidad de provider ID es una restricción parcial solo cuando el ID no es NULL; no convierte referencias repetibles en identidad. Idempotency usa UUID v4/UUID Postgres, y el hash físico `text` lleva algoritmo/versión: `sha256-v1:<64 lowercase hex>`. El payload se serializa RFC 8785/JCS UTF-8; los montos viajan como strings decimales canónicos, UUID lowercase y timestamps normalizados a UTC RFC 3339. Mismo tenant/key/hash es replay idéntico; mismo tenant/key/hash distinto es conflicto en P1-06.

### 17.2 `payment_refunds`

| Columna | Tipo PostgreSQL | NULL / default | CHECK / FK / mutabilidad |
|---|---|---|---|
| `id` | `uuid` | NOT NULL / `gen_random_uuid()` | PK; inmutable |
| `organization_id` | `uuid` | NOT NULL / ninguno | FK compuesta a payment; inmutable |
| `payment_id` | `uuid` | NOT NULL / ninguno | FK `(organization_id,payment_id)` a `payments`, RESTRICT; inmutable |
| `currency` | `text COLLATE "C"` | NOT NULL / ninguno | CHECK CLP/USD; FK compuesto al candidate key payment `(organization_id,id,currency)`, RESTRICT; inmutable |
| `refund_key` | `uuid` | NOT NULL / ninguno | Identidad de cadena lógica; inmutable |
| `event_sequence` | `integer` | NOT NULL / ninguno | `>0`; empieza en 1 y aumenta de uno en uno; UNIQUE por tenant/refund_key/sequence |
| `previous_event_id` | `uuid` | NULL / NULL | NULL solo en evento 1; FK al evento anterior del mismo tenant/payment/moneda/refund_key; único no-NULL para prohibir bifurcación |
| `amount` | `numeric(18,2)` | NOT NULL / ninguno | `>0`, máximo negocio `9999999999.99`; constante en toda la cadena |
| `reason` | `text` | NOT NULL / ninguno | `btrim(reason) <> ''`; constante en cadena |
| `status` | `text` | NOT NULL / ninguno | CHECK `requested`,`processing`,`succeeded`,`failed`,`cancelled`; evento append-only |
| `processed_at` | `timestamptz` | NULL / NULL | NULL para requested/processing; requerido para succeeded/failed/cancelled |
| `provider_refund_id` | `text COLLATE "C"` | NULL / NULL | Identificador externo exacto; inmutable si aparece en evento terminal |
| `external_reference` | `text` | NULL / NULL | Descriptiva, repetible; inmutable |
| `operation_key` | `uuid` | NOT NULL / ninguno | UNIQUE por tenant para cada evento/comando; inmutable |
| `request_hash` | `text COLLATE "C"` | NOT NULL / ninguno | Misma representación versionada SHA-256; inmutable |
| `created_by` | `uuid` | NOT NULL / ninguno | FK Auth RESTRICT; servidor, inmutable |
| `created_at` | `timestamptz` | NOT NULL / `now()` | Inmutable; sin `updated_at` |

Refund no repite `provider` ni `provider_account_scope`: su contexto se deriva del payment y queda fijo por FK/trigger. Dedupe de `provider_refund_id` es global dentro de tenant/provider/account incluso entre pagos: trigger invoker serializa mediante advisory lock del namespace y consulta la cadena enlazada; una unicidad local `(organization_id,payment_id,provider_refund_id)` sola sería insuficiente. External reference nunca es unique.

Cada transición de refund agrega una fila. Cadena permitida: `requested→processing` opcional y luego terminal, o `requested→terminal`; no hay UPDATE/DELETE ni sucesor de terminal. `R` suma un único evento succeeded por `refund_key`; reservas son el último evento requested/processing de cada cadena. Una validación diferida impone `succeeded + reservations <= payment.gross_amount` bajo el lock de order/payment; los comandos/locks completos son P1-06.

### 17.3 `payment_allocations`

| Columna | Tipo PostgreSQL | NULL / default | CHECK / FK / mutabilidad |
|---|---|---|---|
| `id` | `uuid` | NOT NULL / `gen_random_uuid()` | PK; inmutable |
| `organization_id` | `uuid` | NOT NULL / ninguno | Tenant para todas las FK; inmutable |
| `payment_id` | `uuid` | NOT NULL / ninguno | FK `(organization_id,payment_id)` a payment, RESTRICT; inmutable |
| `payment_schedule_id` | `uuid` | NOT NULL / ninguno | FK `(organization_id,payment_schedule_id)` a schedule, RESTRICT; inmutable |
| `order_id` | `uuid` | NOT NULL / ninguno | FK `(organization_id,order_id)` a orders, RESTRICT; inmutable |
| `currency` | `text COLLATE "C"` | NOT NULL / ninguno | CHECK CLP/USD; debe coincidir con payment, order y schedule; inmutable |
| `amount` | `numeric(18,2)` | NOT NULL / ninguno | `>0`, máximo negocio `9999999999.99`; inmutable |
| `created_by` | `uuid` | NOT NULL / ninguno | FK Auth RESTRICT; servidor, inmutable |
| `created_at` | `timestamptz` | NOT NULL / `now()` | Inmutable |
| `direction` | `text` | NOT NULL / ninguno | CHECK `apply`,`reverse`; inmutable |
| `reversal_of_id` | `uuid` | NULL / NULL | NULL para apply; requerido para reverse; apunta a apply original mismo contexto |
| `refund_event_id` | `uuid` | NULL / NULL | NULL para apply; requerido para reverse; FK al evento refund succeeded mismo contexto |
| `operation_key` | `uuid` | NOT NULL / ninguno | Identidad de comando; inmutable |
| `operation_position` | `integer` | NOT NULL / ninguno | `>0`; posición determinista en comandos multi-row |

`apply` obliga ambos campos reversal/refund a NULL; `reverse` obliga ambos no-NULL, refund succeeded y reversal que apunta a apply, nunca a reverse. La tabla es insert-only, sin soft delete ni updates. N:N queda explícita: una fila payment puede generar múltiples applies a diferentes schedules y cada schedule acepta múltiples payments. Un payment puede tener cero allocations y mantener `U>0`.

### 17.4 Keys, constraints e índices exactos

**Keys/FKs/uniqueness:**

- Payments: PK `(id)`; candidate keys UNIQUE `(organization_id,id)` y `(organization_id,id,currency)`; FK `(organization_id,order_id)` a `orders`; FK opcional `(organization_id,evidence_document_id)` a documents; FK created_by Auth. UNIQUE `(organization_id,idempotency_key)`. Partial UNIQUE `(organization_id,provider,provider_account_scope,provider_payment_id) WHERE provider_payment_id IS NOT NULL`.
- Refunds: PK `(id)`; UNIQUE `(organization_id,id)` y `(organization_id,id,currency)` para FKs compuestas; FK `(organization_id,payment_id,currency)` a payments; UNIQUE `(organization_id,refund_key,event_sequence)` y candidate key `(organization_id,payment_id,id)` para allocations; UNIQUE parcial `(organization_id,previous_event_id) WHERE previous_event_id IS NOT NULL`; UNIQUE `(organization_id,operation_key)`; `previous_event_id` FK a `id` + trigger que valida mismo tenant/payment/refund_key/currency/sequence.
- Allocations: PK `(id)`; UNIQUE `(organization_id,id)`; FK `(organization_id,payment_id)` a payments; FK `(organization_id,payment_schedule_id)` a payment_schedules; FK `(organization_id,order_id)` a orders; FK `(organization_id,payment_id,refund_event_id)` a refund event; FK `(organization_id,reversal_of_id)` a allocation; UNIQUE `(organization_id,operation_key,operation_position)`; UNIQUE `(organization_id,refund_event_id,reversal_of_id)` para reverse no nulo. Trigger valida que payment, schedule y order sean el mismo order y moneda, que refund pertenezca al mismo payment/order/tenant/currency y que reversal refiera a apply. No se modifica P1-04 para agregar candidate keys nuevos.
- Todas las relaciones padre usan `ON DELETE RESTRICT`. No `CASCADE` sobre ledger ni identidad.

**CHECK/FK/trigger:** CHECK maneja montos fila, moneda y enums, hash, nonblank, status timestamps y forma apply/reverse. FK/UNIQUE maneja identidad, tenant, secuencias, cadenas y dedupe de IDs de payment. Triggers invoker validan comparaciones entre órdenes/schedules/monedas, terminalidad/append-only, contexto y secuencia de refund, provider refund ID global y transiciones de payment. Constraint triggers diferidos verifican refund succeeded + reservas ≤ gross, aplicaciones netas ≤ gross menos refunds/reservas, y suma aplicada por schedule ≤ expected_amount; se ejecutan con lock jerárquico order→payments orden UUID→refund chain→schedules orden UUID. P1-06 commands deben adquirir primero los mismos locks; no se permite escritor API paralelo.

**Índices no redundantes:**

- Payments: los UNIQUE/FK keys anteriores cubren tenant/id, idempotency y provider identity; adicional B-tree `(organization_id,order_id,received_at DESC,id)` para historia de cobros de la orden. No indexar currency o status sin consulta definida; no indexar `external_reference` como unique.
- Refunds: UNIQUE chain cubre búsqueda por tenant/refund; adicional B-tree `(organization_id,payment_id,created_at DESC,id)` para historia por payment y partial B-tree `(organization_id,provider_refund_id)` para trigger de identidad externa; unique previous event cubre traversal/replay.
- Allocations: B-tree `(organization_id,payment_id)` y `(organization_id,payment_schedule_id)`; unique operation key cubre replay. Partial B-tree `(organization_id,reversal_of_id) WHERE direction='reverse'` para sumas de reverso.
- Evitar índices duplicados si una PK/UNIQUE existente ya cubre exactamente el prefijo consultado; revisar `pg_indexes` contra este plan en implementación.

### 17.5 Mutabilidad y RLS congelados

| Tabla | INSERT | UPDATE | DELETE |
|---|---|---|---|
| `payments` | solo contexto interno/command; no DML API en P1-05 | ninguna edición directa; P1-06 puede cambiar solo `pending→terminal` y `received_at` para succeeded, notes mientras pending; nunca importes, identidad, currency, order, actor ni fechas de creación; terminal inmutable | nunca |
| `payment_refunds` | append de evento nuevo por command P1-06; fixtures internos locales | nunca; transición agrega evento nuevo | nunca |
| `payment_allocations` | append apply/reverse por command P1-06 | nunca | nunca |

| Rol | SELECT ledger | INSERT | UPDATE | DELETE |
|---|---:|---:|---:|---:|
| admin | Sí, tenant activo | No directo | No directo | No |
| editor | No | No | No | No |
| diseñador | No | No | No | No |
| corrector | No | No | No | No |
| finanzas | Sí, tenant activo | No directo | No directo | No |
| visualizador | No | No | No | No |
| anon | No | No | No | No |
| service_role | No grants de tablas ni EXECUTE; no es API autorizada | No | No | No |
| `noveli_payments_executor` interno | Sí según tenant/policy interna | Sí solo para calls P1-06/fixtures controlados | payments solo lifecycle pre-terminal; no refund/allocation | No |

P1-05 crea el rol dedicado `noveli_payments_executor NOLOGIN NOINHERIT NOBYPASSRLS`; solo `postgres` puede `SET ROLE`, no se concede a API roles, anon ni service_role. Los wrappers P1-06 serán propietarios de ese executor y revalidarán actor/tenant/rol/capability. RLS `ENABLE` + `FORCE` en las tres tablas, tenant fence restrictivo y policies de SELECT financiero únicamente admin/finanzas activos. SELECT de otras áreas comerciales será por agregado autorizado futuro P1-06, no por abrir ledger.

No se requiere `SECURITY DEFINER` en P1-05: triggers/functions de guard serán `SECURITY INVOKER`, `search_path=''`, en `noveli_private`, revocados a `PUBLIC/anon/authenticated/service_role`; executor tiene solo grants y policy mínimos. No hay RPC público en este lote. P1-06 podrá agregar wrappers definer narrowly scoped bajo executor no-login, `search_path=''`, EXECUTE solo authenticated autorizado y sin grants a anon/service_role, con checks de actor/tenant/capability.

### 17.6 Fronteras y tests físicos

**DEFERRED TO P1-06:** record/confirm payment; allocate/reverse; create/process refund; transiciones de estado por comandos; replay observable; idempotency request/response; acquiring de locks completos; control de over-allocation/refund por comandos; logging/activity; cálculo de `paid_amount`, `payment_status`, `allocation_gap`, `U`; evidencia method-specific al confirmar succeeded. P1-05 instala el esquema/guards que esos commands deberán satisfacer, sin exponerlos.

**DEFERRED TO P1-07:** `incomes.payment_id`, posting/linkage, reconciliation, income allocation reconciliation, accounting reporting/tax projections y reglas de moneda/tasa de posting. No ALTER de accounting en P1-05.

Test matrix previo a implementación: schema y RLS; numeric generation/precision CLP/USD; gross=0 rechazado, fee=0 explícito y fee>gross rechazado; provider/idempotency dedupe incluidas NULL y manual identity; order/schedule/refund cross-tenant y moneda mismatch; N:N y no sobreasignación; secuencias/branch/replay de refunds; total+reservation bajo concurrencia de sesiones separadas; payment pending→terminal y terminal inmutable; refund/allocation append-only; delete denegado; permisos de los ocho actores/roles; `service_role` sin grants y executor interno limitado; regresiones Phase 1A, P1-04 y Security 01–04B. Ningún test escribe producción.

Con este freeze, refund total/reservas y over-allocation tienen dos capas: (1) constraints y deferred triggers P1-05 mantienen estado final íntegro; (2) comandos P1-06 serializan el escritor con locks uniformes. El trigger invoker valida bajo el mismo lock de order; un SUM sin locks no se acepta.
