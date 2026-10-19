## D01 — Fuente monetaria

**DECISION**

Las columnas tipadas de Phase 1 son la única fuente monetaria para órdenes y pagos nuevos; legacy permanece sin backfill.

**RATIONALE**

Los aliases auditados discrepan incluso cuando tienen default cero.

**REJECTED ALTERNATIVES**

COALESCE entre aliases; sincronizar balances de clientes; recalcular desde catálogo vivo.

**IMPACT**

Conversión legacy exige revisión canónica explícita; ningún nuevo registro depende de saldos legacy.

## D02 — Precisión y redondeo

**DECISION**

Importes numeric(18,2); cantidad numeric(12,3); unit_price neto numeric(30,12); tasa numeric(7,4). Phase 1 activa CLP0 y USD2 decimales; límite de negocio9.999.999.999,99 (CLP entero). Redondeo nearest con empate alejándose de cero; largest remainder determinista para descuentos e impuestos.

**RATIONALE**

Evita errores binarios y conserva suma de líneas/cabecera en unidades mínimas.

**REJECTED ALTERNATIVES**

Number/Math.round de JS; impuesto por línea sin conciliación; residual monetario arbitrario en JSON.

**IMPACT**

pricing_version=1, rounding_adjustment tipado acotado a una unidad mínima y comandos que rechazan escala inválida antes de casts.

## D03 — Neto de pago

**DECISION**

payments.net_amount es columna generada gross_amount-provider_fee, misma moneda, fee conocido y 0<=fee<=gross.

**RATIONALE**

No hay un tercer importe editable que pueda divergir; fee no es IVA ni descuento comercial.

**REJECTED ALTERNATIVES**

Neto editable; fee asumido cero; FX/liquidación multimoneda con esa ecuación.

**IMPACT**

Phase 1 registra manualmente pagos con fee conocido; fee tardío/FX/rebates requieren extensión.

## D04 — Numeración

**DECISION**

UNIQUE(organization_id,order_number); contador privado por organización/año UTC actualizado bajo lock en transacción; formato NOV-ORD-YYYY-XXXXXX, secuencia1..999999.

**RATIONALE**

Serializa generación y evita colisiones, incluso primer alta concurrente.

**REJECTED ALTERNATIVES**

MAX()+1; número de frontend; reutilizar números cancelados; prometer ausencia de huecos.

**IMPACT**

Overflow bloquea; contador/número/log revierten juntos si creación falla. Registro de capacidades privado deshabilita comandos nuevos por defecto.

## D05 — Cliente y aceptación

**DECISION**

Orders guarda client_id, accepted_at, accepted_by y evidencia; sin ficha de cliente duplicada. Contrato congela party_snapshot legal.

**RATIONALE**

Identidad relacional evita drift; identidad contractual necesita preservación histórica.

**REJECTED ALTERNATIVES**

Copiar contacto actual en todas las entidades; inferir accepted_by de quotation.user_id.

**IMPACT**

Cliente/moneda inmutables al aceptar; accepted_by identifica a quien registra, evidencia identifica al aceptante real.

## D06 — Conversión transaccional

**DECISION**

Única RPC explícita con lock quote, revisión aceptada inmutable interna, snapshots de ítems, vínculo único, número y activity_log en una transacción. UNIQUE tenant/quotation y clave de operación.

**RATIONALE**

Una transacción frontend no existe entre requests REST independientes; fila padre sola no protege una aceptación compuesta incompleta.

**REJECTED ALTERNATIVES**

Trigger que crea órdenes al cambiar estado; varias llamadas frontend; SERIALIZABLE sobre tres requests legacy como supuesto remedio.

**IMPACT**

P1-03 añade aceptación/guardado atómico opt-in y coordinación de locks; legacy sigue funcionando. Sin revisión aprobada no convierte.

## D07 — Idempotencia y estado quotation

**DECISION**

Una cotización origina a lo sumo una orden, incluso si se cancela; order contiene quotation_id y revisión aceptada. Quotation sigue aceptada; estado convertido no se inventa.

**RATIONALE**

Preserva CHECK y flags legacy, vínculo inverso consultable y semántica de aceptación.

**REJECTED ALTERNATIVES**

Duplicar order_id en quotation; modificar converted_to_service/prospect/client; recrear order cancelada.

**IMPACT**

Retry idéntico devuelve mismo id sin incrementar contador/log; payload/revisión distinto produce conflicto.

## D08 — Snapshot y referencias fuente

**DECISION**

Snapshot de ítem inmutable desde publicación; catalog_id/pack_id opcionales con SET NULL selectivo, conservando tenant; fuentes originales como provenance. No FK a quotation_item efímero.

**RATIONALE**

Cambiar o eliminar fuente no debe borrar/romper acuerdo histórico.

**REJECTED ALTERNATIVES**

RESTRICT sobre catálogo como única preservación; CASCADE; copiar precios en cada lectura.

**IMPACT**

FK compuesta no debe nulificar organization_id. Única excepción a bloqueo de item publicado es nulificación referencial, nunca cambio de snapshot.

## D09 — Cuotas derivadas

**DECISION**

Opción A: paid_amount y status de cuota son calculados desde allocations netas y lifecycle_status; no columnas cache.

**RATIONALE**

Evita drift, jobs de reparación y dos fuentes de verdad.

**REJECTED ALTERNATIVES**

Cache mantenida por triggers; status financiero editable; paid_amount enviado desde UI.

**IMPACT**

expected_amount fijo tras publicar, overdue calculado y plan total reconciliado; tablas conservan solo lifecycle y obligación.

## D10 — Aplicaciones y cobro no asignado

**DECISION**

payment_allocations es ledger append-only apply/reverse, monto positivo, FK tenant/order/currency, reversos vinculados a refund. Aplicaciones efectivas<=gross menos refunds; cuotas nunca sobrepagadas.

**RATIONALE**

Soporta N:N y devoluciones sin borrar historia; el fee no reduce aplicación del cliente.

**REJECTED ALTERNATIVES**

Reutilizar income_allocations; sumas sin lock; exigir asignación completa para reconocer un hecho cobrado.

**IMPACT**

U=G-R-A queda como dinero no asignado a la misma orden. Overpayment real se conserva; no crédito entre órdenes. Triggers diferidos y lock order serializan topes.

## D11 — Identidad externa

**DECISION**

external_reference es descriptiva/repetible. Deduplicación fuerte por idempotency_key y, si existe, provider_payment_id estable con namespace de organización/proveedor/cuenta.

**RATIONALE**

Algunos proveedores reutilizan referencias legibles; convertirlas en UNIQUE impediría pagos legítimos.

**REJECTED ALTERNATIVES**

UNIQUE indiscriminado en external_reference; deduplicar solo por importe/fecha; scopes arbitrarios para evadir conflictos.

**IMPACT**

Sin identidad externa inequívoca, registro manual idempotente y revisión de posibles duplicados; no prometer detección perfecta.

## D12 — Refunds append-only

**DECISION**

payment_refunds conserva cadena de eventos por refund_key; jamás UPDATE/DELETE. Múltiples solicitudes secuenciales, total succeeded y reservas<=gross; mientras haya pendiente, congelar nuevas aplicaciones/solicitudes del mismo pago.

**RATIONALE**

Preserva intentos/resultado y evita gastar fondos reservados en otra cuota.

**REJECTED ALTERNATIVES**

Modificar/borrar pago original; sumar todos los eventos como refunds distintos; requests simultáneos sin reserva.

**IMPACT**

Succeeded utiliza U primero y agrega reversos por el resto en misma transacción. Resultado fallido libera reserva por evento terminal.

## D13 — Estados financieros

**DECISION**

orders.payment_status se calcula desde cobros y devoluciones; no columna materializada. Payment.status es explícito por comando y terminal; schedule.status es derivado.

**RATIONALE**

El resultado real de cobro es distinto de cobertura y de aplicación de cuotas.

**REJECTED ALTERNATIVES**

Actualizar payment_status libremente; cambiar payment a refunded; dejar partially_refunded para siempre tras repago.

**IMPACT**

Paid tiene precedencia cuando retained_cash cubre total; mostrar refund_total y allocation_gap por separado. Función de agregado autorizada para roles sin SELECT al ledger, sin devolver datos financieros restringidos.

## D14 — Plantillas y contrato

**DECISION**

Template completo versionado; contracts congela template/partes/orden/render/hash. Ninguna columna de contrato signed se actualiza ni borra, incluido updated_at.

**RATIONALE**

Firma debe referirse a texto, partes y archivo exactos, no a plantilla o cliente que cambian.

**REJECTED ALTERNATIVES**

Editar metadata después de signed; plantilla por referencia solamente; checkbox legacy como prueba de firma.

**IMPACT**

Nueva versión/revisión antes de firma; actividad adicional fuera de fila signed. Anexos/terminación posteriores no implementados.

## D15 — Bytes contractuales

**DECISION**

Prefijo documents tenant/contracts reservado, paths UUID create-only/upsert=false, policy restrictive old/new contra escrituras authenticated, metadata congelada y SHA-256 verificado de bytes generados/firmados antes de sign.

**RATIONALE**

Bloquear contracts no impide overwrite Storage. ETag no es hash de integridad suficiente.

**REJECTED ALTERNATIVES**

RLS de contracts como protección de bytes; upsert; firmar una URL/path aportada sin verificar; buckets públicos.

**IMPACT**

Endpoint servidor acotado, reserva durable y finalización idempotente; no SQL de manipulación de bytes. No garantiza WORM frente a operador/service_role fuera del endpoint.

## D16 — Contabilización unidireccional

**DECISION**

incomes.payment_id nullable, UNIQUE por tenant, FK a payments, RESTRICT. Posting explícito idempotente de succeeded crea como máximo un income con amount=gross. Payment no apunta de vuelta a income.

**RATIONALE**

Conserva legacy sin asociación inventada y evita doble contabilización/circularidad.

**REJECTED ALTERNATIVES**

payments.income_id más incomes.payment_id; puente innecesario; auto-matching legacy; sumar incomes+payments indiscriminadamente.

**IMPACT**

Proyección desde incomes con LEFT JOIN al payment/refunds separa bruto/fee/caja; unposted se reconcilia. Posting valida numeric(12,2) de incomes y snapshot explícito de tasa contable USD; overflow aborta completo. EUR no se activa todavía. Refund no modifica ingreso original ni genera otro automáticamente.

## D17 — Autorización y borrado

**DECISION**

Matriz exacta de §10: admin/finanzas manejan ledger; editor comercial/contratos no firmados; diseñador/corrector operativos; visualizador solo lectura comercial. Sin DELETE API en ninguna tabla ni DML directo.

**RATIONALE**

Roles de UI no sustituyen invariantes DB ni habilitan finanzas a visualizador.

**REJECTED ALTERNATIVES**

GRANT ALL writer; finanzas firma contratos; admin borra historia; soft-delete que invisibiliza pagos.

**IMPACT**

Solo reemplazo interno de líneas/cuotas draft nunca publicadas y sin dependencias; fuera de eso cancelar/desactivar. No retorno de orden publicada a draft en Phase 1.

## D18 — Instalación y activación

**DECISION**

Diez lotes: fundamentos, órdenes, conversión, calendario, estructura ledger, comandos ledger, conciliación, modelo contractual, protección archivos, comandos contractuales. Cada lote seguro y validable con frontend actual; capacidades default false.

**RATIONALE**

Una migración no debe activar UI/flujo incompleto ni esperar una futura migración para estar protegida.

**REJECTED ALTERNATIVES**

Última migración activa todo; crear tablas abiertas antes de RLS; introducir guards que rompan guardado legacy.

**IMPACT**

Phase 1A=P1-01/P1-02 local. Activación productiva requiere pruebas, lectores compatibles, endpoint verificador y autorización separada; revisión actual solo documentación.
