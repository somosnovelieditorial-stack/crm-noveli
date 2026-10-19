# Phase 1 — plan de pruebas antes de implementación

Este archivo especifica pruebas futuras. **No son pruebas ejecutadas**. No contiene SQL ni crea migraciones. Fixtures sintéticos y entorno local reconstruido baseline→04B→lote bajo prueba; no copiar Auth, contratos ni PII productivos.

## Método y evidencia

- Verificar host/proyecto local antes de cada suite. Credenciales y claves solo en memoria/entorno, nunca en evidencias.
- Dos organizaciones, usuarios activos admin/editor/diseñador/corrector/finanzas/visualizador en ambas; inactive, unknown y anon. Un usuario miembro de ambos tenants prueba tenant explícito.
- Cada escenario documenta actor, request sanitizado, resultado, invariantes antes/después y SQLSTATE/código de dominio esperado cuando se implemente.
- Concurrencia real: dos conexiones/transacciones independientes y barreras coordinadas; no Promise.all sobre una misma conexión. Repetir con orden invertido y timeout/retry tras commit.
- Comparar conteos e identidades de order/items/logs/idempotency/contador; ningún assert basado solo en status HTTP.
- Pruebas negativas por REST/RPC y SQL bajo roles de aplicación, no todas como postgres/service_role. Las pruebas con owner privilegiado solo comprueban triggers, no se presentan como evidencia RLS.
- No mutar hora del servidor para signed URLs; probar expiración real local con TTL de prueba y verificar también configuración300. Signed URL ya emitida es bearer: revocar sesión no garantiza invalidarla antes de TTL.
- Security SQL01–04, Storage/Auth HTTP y pruebas04B continúan pasando. Frontend build/lint de código modificado y browser smoke después de implementar; no repetir checks globales sin motivo.

## Casos y oráculos

| ID | Escenario | Resultado exacto esperado |
|---|---|---|
| T01 | Dos órdenes simultáneas mismo tenant/año, primer contador inexistente | Números distintos, secuencias únicas; una fila contador; formato correcto |
| T02 | Año UTC cambia y dos tenants emiten | Secuencia independiente por tenant/año; número anterior inmutable |
| T03 | Secuencia999999 y nuevo pedido | Error explícito; ningún order/log/contador parcial; nunca siete dígitos |
| T04 | Misma conversion key y mismos parámetros, retry tras commit | Mismo order_id, número y snapshots; un log y un incremento |
| T05 | Dos conversiones concurrentes misma quotation/revisión | Una order; la segunda devuelve misma order tras lock |
| T06 | Misma key con otra quotation o misma quote con revisión distinta | Conflicto; no segundo order ni log |
| T07 | Quote draft/rechazada/vencida o aceptada sin revisión canónica | Rechazo sin side effects |
| T08 | Cliente ausente, otro tenant, actor falso o snapshot alterado | Rechazo; no matching por autor/email; auth actor manda |
| T09 | Quote aceptada y source fingerprint cambió | Rechazo stale_revision; conserva revisión y order existentes |
| T10 | Guardado legacy intercalado cabecera/borrado/reinserción durante conversión | Nunca snapshot intermedio; conversión solo revisión aceptada consistente o rechazo |
| T11 | Error insert ítem/log o validación final de conversión | Rollback íntegro de order/items/número/log/key; retry posterior correcto |
| T12 | Legacy conversion actual a prospecto y CHECK incompatible | Sigue identificado como deuda legacy; no se reutiliza ese estado/RPC para Order |
| T13 | Caso real sintético490000+30%+19% | subtotal637000, discount0, tax121030, total758030 CLP; ignorar price/gross legacy0 |
| T14 | Catálogo cambia nombre/precio y luego se elimina fuente | Orden conserva nombre/texto/pricing; solo FK fuente NULL, tenant intacto |
| T15 | Ítem publicado intenta repricing, cambio cliente/moneda o retorno a draft | Rechazo; también admin; ninguna pérdida del snapshot |
| T16 | IVA incluido, added/exempt, descuento global y ajuste extensión | Mismo acuerdo aprobado, sumas exactas en unidades mínimas; exempt tax0 |
| T17 | Redondeos USD0.005/CLP0.5 y empate de largest remainder | Regla única versionada; desempate position/UUID estable |
| T18 | Bases todas0, descuento>base, NaN/infinito/overflow/escala extra | Total0 válido solo con descuento/tax0; demás rechazados sin cast silencioso |
| T19 | Un pago cubre tres cuotas y una cuota recibe tres pagos | N:N correcto; suma efectiva por cuota y pago coincide, ninguna duplicación |
| T20 | Pago bruto50000 fee1500 | net48500 generado; aplica hasta50000, no48500; net enviado distinto rechazado |
| T21 | Aplicar parcialmente y dejar dinero sin asignar, incluido exceso real recibido | Payment conserva gross real; U=G-R-A>=0; no cuota sobrepagada |
| T22 | Dos aplicaciones concurrentes agotan mismo payment/schedule | Solo importe admisible; ninguna suma excede topes al commit |
| T23 | Apply con payment pending/failed, moneda/orden/tenant distintos | Rechazo por rol/FK/guard; sin saldo parcial |
| T24 | Direct UPDATE/DELETE allocation o reverse de reverse | Rechazo; historial original intacto |
| T25 | Repetir external_reference legible en pagos legítimos | Permitido con operation keys distintas y sin ID proveedor duplicado |
| T26 | Replay provider_payment_id en misma cuenta/scope; scopes legítimos diferentes | Mismo scope bloqueado; distinto namespace real permitido; payload conflictivo rechazado |
| T27 | Cuotas: único pago, anticipo+saldo, N cuotas con residual | Suma expected=total; residual determinista; no fechas inventadas para hito |
| T28 | Refund parcial de pago asignado | Nuevo evento succeeded; reverse exacto; payment original sin cambios; cuota reabre saldo |
| T29 | Refund desde U y luego desde aplicaciones | Primero reduce U; solo resto crea reverse, suma correcta |
| T30 | Refund total en varios refunds sucesivos | R=G permitido; payment inmutable, C0 y estado orden refunded; fee original preservado |
| T31 | Refund excesivo o dos solicitudes concurrentes sobre mismo pago | Exceso rechazado; mientras pending segundo request/aplicación bloqueados; fallo libera reserva |
| T32 | Duplicar chain/event_sequence/previous/operation key; actualizar refund | Solo replay idéntico devuelve evento; ninguna bifurcación ni UPDATE/DELETE |
| T33 | Fallo al insertar reverse tras evento succeeded | Rollback completo; no refund sin reversión necesaria |
| T34 | Pago nuevo cubre saldo después de refund | order.payment_status paid si C>=total; refund histórico visible separadamente |
| T35 | Pago sin asignar cubre orden | Order paid por C; cuota puede seguir scheduled; U/allocation_gap explícitos |
| T36 | Leer paid_amount/status como rol financiero y comparar ledger | Derivados correctos, no columnas cache; ninguna escritura directa de estado financiero |
| T37 | Agregado de orden para editor/viewer sin SELECT payments | Resumen correcto (no falso unpaid por RLS), sin fee/provider/transacciones; order de otro tenant bloqueada |
| T38 | Matriz RLS completa ocho tablas × seis roles × operaciones | Exactamente permisos §10; visualizador nunca muta y no obtiene ledger |
| T39 | Inactive/unknown/anon/otro tenant y tenant NULL | Cero acceso; ni usuario con Auth válido sin membresía ni caché UI elude controles |
| T40 | Revocar active/rol mientras otra sesión intenta comando | Verificación actual de membresía; sin autorización basada en user_metadata o LIMIT1 |
| T41 | DELETE API sobre draft/order/payment/refund/template/contract | Siempre bloqueado; cancel/deactivate por comando cuando corresponda |
| T42 | Reemplazar ítems/cuotas internos draft y luego publicados | Solo nunca publicados/sin dependencias reemplazables; published/accepted/signed jamás borrados |
| T43 | Versionar template y cambiar active después de generar contrato | Contrato conserva contenido/variables/hash originales; active no cambia snapshot |
| T44 | Contract draft sin archivo, generated incompleto, signed sin evidencia | Draft permitido; generated/signed incompletos rechazados |
| T45 | UPDATE de cada columna de contract signed, incluido updated_at y hash/path | Todos rechazados, también admin; actividad nueva fuera de contrato |
| T46 | Dos revisiones contractuales vigentes concurrentes | Una sola vigente por orden; no borrar firmada para crear otra |
| T47 | Writer/admin authenticated Storage overwrite/upsert/delete/move/rename de prefijo contractual | Bloqueado; probar old/new path y cambio bucket; service_role no se usa como prueba de RLS |
| T48 | Upload endpoint al mismo path, UUID ajeno o payload arbitrario | No overwrite; conflicto o retry hash idéntico; no proxy Storage arbitrario |
| T49 | Firmar con mismo tamaño/ETag aparente pero SHA incorrecto, MIME/path/revisión erróneos | Rechazo; contrato no pasa a signed |
| T50 | Upload OK y DB falla; retry finalización | Objeto queda para revisión, sin signed huérfano ni borrado automático; retry idempotente |
| T51 | Modificar/borrar public.documents contractual generado/firmado | Guard bloquea path/hash/MIME/tamaño/tenant/refs, FK bloquea borrado; legacy fuera de prefijo funciona |
| T52 | Signed URL300 y public URL de documents | Signed válida para tenant, expira según diseño; public URL bloqueada; brand-assets público intacto |
| T53 | Postear payment succeeded dos veces/concurrente | Un income payment_id, mismo id en retry, un log; sin FK de regreso |
| T54 | Posting pending/failed, otro tenant, overflow amount/value_converted o USD sin tasa | Error total; payment queda intacto/unposted, ningún income parcial |
| T55 | Legacy income payment_id NULL y nuevo income vinculado | Legacy intacto; nuevo financiero/provenance protegido; no matching automático |
| T56 | Refund antes/después de posting y fee no devuelto | amount ingreso original no cambia; cash_after_refunds=net_amount-refunds (fee ya descontado en net), sin doble cash |
| T57 | Intento quitar payment_id, cambiar monto/cliente/moneda o borrar income ligado | Rechazo específico solo linked; edición legacy NULL mantiene políticas vigentes |
| T58 | Capacidad default false; instalar cada lote con CRM anterior | Ningún flujo nuevo habilitado, ningún CRUD legacy roto, sin dependencia de frontend futuro |
| T59 | Regresión general y errores de autorización | SQL01–04B, HTTP Storage/Auth, Documents signed URLs, cotizaciones/clientes/finanzas/CMS/web pasan; cero nuevo permiso anon |
| T60 | Endpoint devuelve o logs registran secretos/URL firmada persistida | Bloqueo de release: evidencia segura, tokens solo memoria, no service_role en bundle |

## Gates por lote

- Phase 1A/P1-01/P1-02: T01–03, T08 relevante, T14–18, T38–42 para tablas disponibles y compatibilidad58/59; tests de actor/timestamps/tenant/money.
- P1-03: T04–13, retries y carreras reales. Antes de habilitar conversión, guardado/aceptación opt-in y lectura de revisión aprobada operativos.
- P1-04: T27 y calendario/roles; todavía no hay cobros.
- P1-05: invariantes T19–36 con fixtures internos locales, constraints/triggers y denegación API directa; ningún entrypoint financiero público habilitado.
- P1-06: T19–40 completos vía comandos SQL/HTTP y carreras reales; ninguna cache a reparar después.
- P1-07: T53–57, reconciliación de reportes y compatibilidad de tipos/tasa; captura permanece deshabilitada hasta consumidores compatibles.
- P1-08: T43–46 con refs sintéticas; no firma expuesta.
- P1-09/P1-10: T47–52 y T60 end-to-end API→bytes→DB→lectura autorizada.
- Release posterior: todos los gates + build/lint pertinente/browser smoke, sin mutar datos productivos durante revisión.

Evidencia futura deberá distinguir PASS real, FAIL y NOT RUN; no convertir este plan en supuestos resultados de ejecución.
