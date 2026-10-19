# NOVELI 2.0 — Phase 1B Payments Readiness Review

**Fecha:** 2026-10-19
**Resultado:** READY FOR IMPLEMENTATION APPROVAL
**Implementación Phase 1B:** NO INICIADA
**Cambios productivos de esta revisión:** NINGUNO

## 1. Alcance exacto

El diseño aprobado enumera diez lotes P1-01 a P1-10; no llama explícitamente “Phase 1B” a ningún grupo. El maestro de Noveli 2.0 ya identifica la fase posterior a Phase 1A como **Phase 1B Payments**. La correspondencia por dominio y secuencia es inequívoca: Phase 1A cubrió P1-01 a P1-03; Phase 1B Payments corresponde a los cuatro lotes siguientes:

| Lote aprobado | Alcance |
|---|---|
| P1-04 Calendario de obligaciones | `payment_schedules`, plan draft/publicación, RLS e índices; saldo pagado derivado; no registra cobros |
| P1-05 Estructura ledger | `payments`, `payment_refunds`, `payment_allocations`; relaciones tenant/order/currency, checks, append-only y guards; sin comandos de escritura expuestos |
| P1-06 Comandos ledger | Entrypoints idempotentes y transaccionales para registrar/confirmar pagos, asignar y devolver; locks, cálculo de estados y resumen autorizado |
| P1-07 Conciliación con ingresos | `incomes.payment_id` nullable/unique, posting idempotente de un pago sucedido, proyección y guards únicamente para ingresos vinculados |

La etiqueta “Phase 1B” es del maestro de estado, no una etiqueta literal del documento de diseño. Esta revisión conserva ambos nombres para no presentarlos como una cita textual del diseño.

## 2. Fuera de alcance

- P1-08 a P1-10: templates/contracts, protección de bytes contractuales y comandos de firma.
- Integraciones automáticas con proveedores, checkout, auto-cobro o fee/FX incierto; Phase 1 registra cobros manuales trazables.
- `collaborator_payables` y `settlements` de Red Noveli.
- Backfill, auto-matching o reescritura de ingresos legacy; cambios globales de reportes sin análisis de compatibilidad.
- UI de pagos productiva: los lotes son instalables con el CRM existente. La especificación de pantallas/flujo UI y su autorización de release deben revisarse aparte antes de exponer captura.
- Cambiar capacidades existentes de Orders/quotation conversion o habilitar nuevos flujos productivos por el mero hecho de instalar esquema.

## 3. Dependencias de Phase 1A

Phase 1A está desplegada y habilitada. `orders` es la entidad comercial central; `orders` y `order_items` contienen el total, moneda y snapshots aceptados. Los nuevos pagos deben referenciar una orden del mismo tenant y moneda; no leer de aliases monetarios legacy para reconstruir precio. Phase 1A también instala las capacidades privadas por tenant y el resumen de pago de orden sin ledger; dicho resumen no es una tabla ni una fuente de pagos.

Producción revisada en modo read-only: proyecto `bdxlzhpmifxwmqjnnmxa`, `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.127`; historial hasta `20261018214237_phase_1a_quotation_conversion`. Existen 48 tablas `public`; las tablas productivas Phase 1A tienen RLS. `orders=0` y `order_items=0` en esta captura. El checkpoint válido informado para Phase 1A es `pre-phase-1a/20261019T032415Z`; no es un checkpoint post-Phase-1A.

## 4. Modelo productivo reutilizable

Consulta de catálogo y agregados read-only al 2026-10-19:

| Objeto actual | Estado | Uso correcto en Phase 1B |
|---|---|---|
| `orders`, `order_items` | Existen; RLS activo; 0 filas cada una en la lectura | Referencia de orden, tenant, moneda y total comercial |
| `incomes` | Existe; RLS activo; 4 filas. Incluye `amount`, `currency`, `exchange_rate`, `value_converted`, `gross_amount`, `net_amount`, `tax_amount`, además de campos legacy/source | Extender con una FK nullable al payment y contabilizar por comando; no convertir aliases existentes en canon monetario nuevo |
| `income_allocations` | Existe; RLS activo; 10 filas; modela distribución contable/áreas | **No reutilizar** para asignar cobros a cuotas: es otra relación y otra semántica |
| `income_distributions` | Existe; RLS activo; 0 filas | No es el ledger de pagos |
| `expenses` | Existe; RLS activo; 13 filas | No sustituye cobros ni refunds |
| `payment_schedules` | No existe | Nueva estructura P1-04 |
| `payments` | No existe | Nueva estructura P1-05 |
| `payment_allocations` | No existe | Nueva estructura P1-05; distinta de `income_allocations` |
| `payment_refunds` | No existe | Nueva estructura P1-05 |

`documents` y Storage privado permanecen bajo Security 04B. El diseño permite un documento de evidencia opcional para payment, sujeto a los refs autorizados; no cambia bucket flags ni políticas generales.

## 5. Nuevas estructuras necesarias

- **P1-04 `payment_schedules`:** obligaciones positivas en moneda de la orden, secuencia única, due date fija o milestone, lifecycle draft/scheduled/cancelled. El plan publicado reconcilia exactamente con el total de la orden; no genera cuotas de cero ni cambia planes legacy.
- **P1-05 `payments`:** cobro recibido con `gross_amount`, `provider_fee` y `net_amount` generado como gross−fee; moneda igual para los tres; identidad/idempotency key, proveedor/método, referencia externa descriptiva y estado operativo. No modela el proveedor procesador automáticamente.
- **P1-05 `payment_allocations`:** ledger N:N apply/reverse entre pago y cuotas de una misma orden/tenant/moneda. Conserva filas append-only y liga los reversos a refunds exitosos.
- **P1-05 `payment_refunds`:** cadena de eventos append-only por refund key; conserva solicitudes, procesamiento y resultado terminal, sin editar el payment original.
- **P1-06 funciones/comandos:** operaciones con autorización vigente, locks uniformes, idempotencia/replay y activity log en una transacción; ninguna escritura directa desde REST.
- **P1-07 extensión de `incomes`:** `payment_id` nullable, único por tenant y FK RESTRICT a `payments`; posting explícito solo de payment succeeded. Ingresos existentes mantienen `payment_id=NULL`.

No se proponen otras tablas. Los nombres de lotes son etiquetas del diseño, no nombres/timestamps de archivos de migración; los filenames se decidirán al implementar.

## 6. Estados y fuentes de verdad

- `payment_schedules.paid_amount`, `payment_schedules.status` y `orders.payment_status` son derivados de lifecycle + allocations + pagos/refunds; no se persistirán como caches editables.
- `payments.status` es un resultado real por comando, con transiciones permitidas y terminal inmutable.
- Refund status es un historial de eventos; no cambia `payments.status` ni borra/modifica los importes originales.
- Los pagos pueden quedar parcialmente sin asignar dentro de su orden. Overpayment recibido se conserva; no se asigna a otra orden.

## 7. Migraciones previstas

Secuencia aprobada: cuatro migraciones aditivas, una por P1-04, P1-05, P1-06 y P1-07. Cada lote instala sus constraints, grants, RLS/policies e índices junto a sus objetos; no dejar seguridad para un lote posterior. P1-05 mantiene juntas las tres tablas interrelacionadas por refunds/reversos. P1-07 no hace backfill ni cambia datos legacy. Ninguna migration activa capacidades ni depende de frontend futuro.

## 8. Seguridad y RLS

- RLS desde la creación; referencias compuestas tenant/order/currency; miembro activo y organización explícita en todas las operaciones. Anon, inactive/unknown y otro tenant no obtienen filas ni comandos.
- Denegar DML directo authenticated sobre nuevas tablas y no conceder DELETE API. Escrituras únicamente por entrypoints acotados que vuelven a comprobar actor, membresía, rol y capacidad en DB.
- Admin/finanzas operan el ledger de acuerdo con la matriz aprobada; editor/diseñador/corrector/visualizador no leen ni escriben el ledger financiero. El resumen de orden permitido a roles comerciales no revela fee, proveedor ni transacciones.
- No debilitar 04B ni modificar las policies legacy generales. El guard de ingresos aplica solo a filas nuevas vinculadas por `payment_id`.
- La decisión aprobada establece una capacidad de cobro por defecto false, pero no fija en estos lotes el nombre final de la clave. Confirmar su nombre exacto durante la especificación de implementación; no activar ninguna capacidad en migraciones.

## 9. Idempotencia e inmutabilidad

Usar idempotency key y hash de request canónico; conflicto de payload con la misma key es error, replay idéntico devuelve el mismo resultado. Referencias legibles externas no son únicas; deduplicación fuerte usa ID transaccional estable con namespace real de proveedor/cuenta. Aplicaciones y refunds usan locks con orden consistente y validaciones diferidas de sumas para impedir sobreasignación concurrente. Ledger apply/reverse/refund es append-only. No borrar pagos, refunds ni historia; corregir mediante eventos/comandos de reverso aprobados.

## 10. Integración contable

Payments representa el cobro operacional; `incomes` sigue siendo la entrada contable legacy. Un payment succeeded puede postearse después, una sola vez, a un income que referencia el payment. El income registra importe bruto y conserva moneda/tasa de reporting validada; no mapear `incomes.net_amount` al neto de caja del proveedor. No sumar payment+income como dos ingresos ni inferir pagos desde income legacy. El posting aborta por completo ante overflow/tasa ausente o incompatibilidad; los reportes deben separar gross, fee, net, refunds y pagos aún no posteados.

**Gate obligatorio antes de habilitar captura:** compatibilidad demostrada de Dashboard, Reports, Taxes, CompletedSales y Clientes con ingresos vinculados; tasa contable USD explícita; sin doble conteo ni reinterpretación tributaria. La auditoría de diseño advierte que los lectores actuales podrían tener semántica incompatible; esto no está resuelto por la mera existencia de Phase 1A.

## 11. UI/API previstas

P1-06 introduce entrypoints transaccionales de servidor/DB para los comandos; P1-07 introduce posting idempotente y proyección/reconciliación. El documento aprobado requiere instalación segura con el frontend actual y flags/capabilities apagadas, pero no especifica páginas ni interacción UI de Payments. Por ello, no incluir pantallas de captura en el alcance técnico de migraciones; definirlas y probarlas en un paquete UI posterior antes de activar cobros reales.

## 12. Riesgos

1. Lecturas legacy de `gross_amount`/`net_amount` y conversión `numeric(12,2)` pueden interpretar mal el nuevo income o desbordarse.
2. Las reglas de USD exigen tasa/fecha/fuente explícitas y auditables para contabilización; no usar una tasa mutable por lectura.
3. Concurrencia de aplicaciones/refunds puede exceder pago o cuota si se usan SUMs sin locks y guards diferidos.
4. Referencia externa manual no ofrece deduplicación matemática perfecta sin ID estable.
5. `income_allocations` no representa cuotas; reutilizarla mezclaría distribución de ingreso con aplicación de un pago.
6. No hay órdenes productivas todavía; pruebas de Phase 1B deben usar fixtures locales y no crear una orden/pago comercial de prueba en producción.
7. El recovery pre-Phase1A queda anterior al deploy A; exigir checkpoint post-Phase1A / pre-Phase1B antes de un futuro db push.

## 13. Test plan

Usar el plan aprobado `PHASE-1-TEST-PLAN.md`, fixtures sintéticos locales y sesiones DB independientes para concurrencia. Gates mínimos:

- **P1-04:** T27 y calendario/roles; plan único, anticipo+saldo/cuotas, residual determinista, suma igual al total, fechas/milestones y nada cobrado antes del ledger.
- **P1-05:** T19–36, T38–42: N:N, gross/fee/net, overpayment/unallocated, topes bajo concurrencia, monedas/tenant, append-only, refund parcial/total/excesivo y DML directo denegado.
- **P1-06:** T19–40 completos vía comandos/RPC y dos sesiones reales; idempotencia/replay, locks y orden de locks, estados agregados, actor/tenant, actividad atómica, permission matrix y rollback transaccional.
- **P1-07:** T53–57: posting repetido/concurrente, overflow/tasa ausente, legacy NULL intacto, refunds antes/después, income enlazado inmutable y lectores financieros reconciliados.
- **Cada lote:** T58/T59 regresión CRM actual, Security 01–04B, Auth/Storage/Documents, citas/clientes/ingresos/gastos/CMS/web; build y diagnósticos de consumidores modificados. Sin pruebas con service_role como sustituto de RLS.

## 14. Estrategia de deployment

1. Aprobar este alcance y la futura implementación; no reutilizar el checkpoint pre-Phase1A como recuperación previa a nuevos cambios.
2. Crear y verificar recovery point manual post-Phase1A/pre-Phase1B (DB, Auth cifrado y Storage privado) con manifest/hash; registrar limitación de restore si no se ensaya.
3. Implementar y validar cada lote localmente baseline→04B→Phase1A→lote; conservar capacidades false y no alterar data legacy.
4. Revisión de migraciones/hashes, RLS, funciones, tests y compatibilidad; commit/push separado sujeto a gate.
5. Futuro despliegue controlado: DB aditiva primero con capacidad false; verificar tablas/policies/funciones y CRM legacy; frontend compatible después. Habilitar capacidades solo tras reconciliación financiera y autorización específica. No crear cobros productivos durante smoke.

## 15. Rollback / contención

Preferir forward fix. Si una migración falla: detener lote, inspeccionar historial/esquema, no ejecutar repair/reset linked ni DROP automático. Si schema completo y UI/API falla: dejar tablas y ledger intactos, deshabilitar capability(s) nuevas y flag de UI, corregir hacia delante. Si actor válido queda bloqueado: cerrar la capacidad de escritura afectada, preservar lecturas permitidas e investigar RLS/rol; no ampliar policies globales. No borrar órdenes, payments, allocations, refunds o ingresos enlazados para “volver atrás”.

## 16. Criterios de aceptación

- Cuatro lotes P1-04–P1-07 implementados y validados individualmente, sin tocar P1-08–P1-10.
- Todos los invariantes monetarios, N:N, refund, locks e idempotencia del diseño pasan en local bajo sesiones/roles correctos.
- RLS y deny-DML directos pasan matriz tenant/roles; anon/inactive/unknown/cross-tenant quedan bloqueados.
- `payment_status`, schedule status y paid amount son derivados; ningún dato duplicado editable.
- Incomes legacy sin FK siguen intactos; posting linked es idempotente y los lectores reconciliados no duplican caja ni alteran impuestos.
- Las capacidades nuevas permanecen apagadas hasta una autorización de release; UI de cobros no se presume aprobada por esta revisión.
- Regresiones Phase 1A/Security/Storage y CRM legacy pasan; producción permanece sin cambios hasta autorización separada.

## Estado y decisión

**NEXT APPROVED LOT:** P1-04 Calendario de obligaciones.
**PHASE 1B SCOPE EXPLICIT IN DESIGN:** NO — el diseño denomina los lotes P1-04–P1-07; “Phase 1B Payments” es el agrupamiento del maestro de estado.
**SCOPE MAPPING:** inequívoco con el orden y dominio de los lotes aprobados.
**CURRENT MODEL AUDIT:** PASS — catálogo, RLS, rutinas y conteos agregados productivos consultados read-only.
**READY FOR PHASE 1B IMPLEMENTATION APPROVAL:** YES.
**PHASE 1B IMPLEMENTATION STARTED:** NO.
**PRODUCTION CHANGES:** NONE.
