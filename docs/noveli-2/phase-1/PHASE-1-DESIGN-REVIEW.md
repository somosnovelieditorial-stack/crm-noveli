# Phase 1 — revisión adversarial resuelta

**PHASE 1 DESIGN REVIEW: PASS**<br>
**READY TO IMPLEMENT PHASE 1A: YES**<br>
**PRODUCTION CHANGES: NONE**

PASS se refiere al diseño corregido, no a tests de implementación inexistente. Phase 1A autoriza como alcance técnico propuesto fundamentos y órdenes manuales locales (P1-01/P1-02); esta revisión no crea migraciones ni inicia implementación. No se consultó ni modificó producción en esta revisión.

## Fuentes y comprobación

Fuentes principales: CURRENT-MODEL-AUDIT.md, PHASE-1-DESIGN.md y REVIEW-MANIFEST.json de la primera entrega. Antes de editar se verificaron los siete hashes de artefactos y los ocho hashes de migraciones del manifiesto: 15/15, cero mismatch. La auditoría original y JSON de captura se mantienen intactos. Los conteos productivos se citan como evidencia histórica, no como revalidación actual.

El diseño inicial SHA-256 fue 7a48c5de487ca09c54cf376b097157cd6e8942a5fbe99586a67e2cc188aaf3a4. El manifiesto actualizado conserva ese origen y registra hashes de todos los artefactos actuales sin autorreferencia.

## Problemas encontrados y resolución

| # | Problema del diseño anterior | Cambio final | Estado |
|---|---|---|---|
| F01 | Cabecera/subtotal histórico y residual JSON poco precisos | Tipos, bases netas, fórmula y residual tipado acotado; algoritmo versionado | RESUELTO |
| F02 | Cache de paid_amount/payment_status duplica ledger | Derivados sin columnas físicas ni cache de trigger | RESUELTO |
| F03 | payment_status con refund previo nunca vuelve paid aunque se repague | Precedencia paid por cobertura C; refund histórico separado | RESUELTO |
| F04 | UNIQUE external_reference bloquea referencias reutilizadas | Referencia descriptiva repetible; identidad proveedor estable con namespace y key de operación | RESUELTO |
| F05 | Requiere aplicar todo pago y rechaza overpayment real | N:N append-only, U no asignado de misma orden, topes efectivos | RESUELTO |
| F06 | Refund siempre exige reversar amount aun si hay dinero sin asignar | Consume U primero; reversos solo sobre porción aplicada | RESUELTO |
| F07 | RESTRICT catálogo impide borrar fuente aunque exista snapshot | SET NULL selectivo en FK compuesta, tenant intacto, snapshot independiente | RESUELTO |
| F08 | Lock quotation/serializable no arregla guardado legacy en tres requests | Revisión aceptada interna inmutable y RPC opt-in de aceptación completa | RESUELTO |
| F09 | accepted_by ausente; confusión actor con aceptante | Actor registrador más evidencia/fecha aceptación, separado de created_by | RESUELTO |
| F10 | Vista invoker financiera produce cero pagos para viewer/editor | Agregado limitado autorizado, sin acceso al ledger ni fee/proveedor | RESUELTO |
| F11 | Relación incomes/payments queda pendiente de elección | FK única incomes.payment_id, posting explícito y proyección sin doble caja | RESUELTO |
| F12 | EUR y numeric(18,2) nuevos no caben siempre en incomes actual | Phase 1 CLP/USD y límite de negocio; posting valida numeric(12,2)/tasa, overflow rollback | RESUELTO |
| F13 | Draft contractual exige texto/hash cuando aún no existe documento | Campos condicionales; generated/signed exigen evidencia según estado | RESUELTO |
| F14 | DB immutable no protege overwrite, hash/TOCTOU incompletos | Prefijo exclusivo create-only, barrera restrictive old/new y verificación de ambos archivos | RESUELTO |
| F15 | Retorno a draft pierde historial de líneas ya publicadas | Prohibido en Phase 1; cancelar/reemplazar según guards | RESUELTO |
| F16 | Matriz amplia y DELETE no cerrados | Ocho tablas×seis roles, DML directo no, DELETE API no; excepciones internas solo draft nunca publicado | RESUELTO |
| F17 | Última migración de activación depende de frontend futuro | Lotes instalables seguros con flags false; activación release separado | RESUELTO |
| F18 | “No borrar ninguna tabla” ocultaba excepciones de reemplazo draft | Excepciones internas de ítems/cuotas especificadas y bloqueadas tras publicar | RESUELTO |

## Decisiones finales y trazabilidad de requisitos

El [decision log](PHASE-1-DECISIONS.md) contiene únicamente 18 decisiones finales, cada una con DECISION, RATIONALE, REJECTED ALTERNATIVES e IMPACT.

| Requisito de revisión | Resultado definitivo | Ubicación en diseño |
|---|---|---|
| 1 Modelo monetario | Columnas nuevas canónicas; importes18,2, cantidad12,3, unitario30,12, CLP/USD y redondeo versionado | §3 |
| 2 Orders | UNIQUE tenant/número; contador bloqueado por tenant/año; accepted_by/evidencia; no duplicar ficha client | §5 |
| 3 Conversión | RPC única, revisión canónica, locks, FK/UNIQUE, estado accepted válido y activity en mismo commit | §11 |
| 4 Snapshot/FK | Todos los campos de precio/alcance congelados; catálogo SET NULL selectivo, historia RESTRICT | §4–5 |
| 5 Schedules | paid_amount opción A calculado; lifecycle explícito y status financiero derivado | §6 |
| 6 Allocations | Puente N:N append-only apply/reverse; FK tenant/order/currency; U y topes bajo lock | §8 |
| 7 Payments | gross-fee=net generado; referencia legible no UNIQUE; idempotencia y ID proveedor | §7 |
| 8 Refunds | Eventos append-only, R+reservas<=G, moneda idéntica y payment original intacto | §8–9 |
| 9 Estados | payment real explícito, cuota derivada y order.payment_status calculado | §9 |
| 10 Contracts | Template/partes/orden/render completo; cero columnas editables después de signed | §12 |
| 11 Bytes | UUID create-only, sin upsert, restricción prefijo, SHA de bytes y finalización idempotente | §13 |
| 12 Incomes | income.payment_id nullable UNIQUE → payment; legacy NULL; no FK circular ni doble conteo | §14 |
| 13 RLS | Matriz exacta, ledger solo admin/finanzas; viewer lectura comercial; ningún anon | §10 |
| 14 DELETE | Ningún DELETE API; conservar terminales; reemplazo interno de draft nunca publicado acotado | §15 |
| 15 Migraciones | Diez lotes (ocho originales divididos), con propósito, validación y deny-by-default propios; sin activación automática | §16 |
| 16 Test plan | 60 casos y gates de evidencia, carreras reales y rollback | PHASE-1-TEST-PLAN.md |
| 17 Decision log | 18 decisiones finales; diseño revisado para eliminar contradicciones | PHASE-1-DECISIONS.md |

## Límites residuales explícitos

- El modelo no deduplica perfectamente pagos manuales sin identidad de transacción confiable; referencia repetible no se hace UNIQUE por conveniencia.
- Estado paid comercial no significa todas las cuotas asignadas; U/allocation_gap revela la diferencia a finanzas.
- Refund total no devuelve fee automáticamente. Posting no constituye contabilidad fiscal completa ni inventa notas de crédito.
- Secreto servidor y operador privilegiado pueden eludir RLS; el mecanismo de contratos no se presenta como almacenamiento WORM frente al dueño de plataforma.
- Revisión canónica aceptada requiere flujo opt-in y pruebas antes de habilitar conversión. No se reinterpretan como válidas las seis cotizaciones incompletas auditadas.
- Completar estas pruebas/consumidores/endpoint es gate de release posterior. No es motivo para bloquear implementación local de Phase 1A.
- Guard nuevo sobre income enlazado puede impedir edición/borrado de ese registro en UI legacy: es intencional, afecta solo nuevos enlaces y exige UI compatible antes de activación.

## Archivos de esta revisión

Modificados:
- PHASE-1-DESIGN.md: versión revisada y normativa.
- REVIEW-MANIFEST.json: hashes actuales, procedencia original y validación documental.

Creados:
- PHASE-1-DECISIONS.md.
- PHASE-1-DESIGN-REVIEW.md (este informe).
- PHASE-1-TEST-PLAN.md.

Sin cambios a CURRENT-MODEL-AUDIT.md, snapshots JSON originales, src, configuración de aplicación, package files ni supabase/migrations. Sin SQL nuevo, DB local, queries productivas, Git push, deploy, cambios Storage ni migraciones.

**PHASE 1 DESIGN REVIEW: PASS**<br>
**READY TO IMPLEMENT PHASE 1A: YES**<br>
**PRODUCTION CHANGES: NONE**
