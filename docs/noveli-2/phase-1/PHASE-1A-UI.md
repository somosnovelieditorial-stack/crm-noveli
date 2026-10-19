# Phase 1A UI — CRM local

Javier aprobó formalmente el backend Phase 1A. Esta iteración integra únicamente cotización→orden, listado y detalle. No crea migraciones ni cambia las tres migraciones aprobadas. No implementa Payments, Contracts ni creación manual de órdenes.

## Rutas y navegación

- `/admin/ordenes`: listado, búsqueda por número/cliente/cotización, filtros comercial/pago/operativo/moneda y fecha ascendente/descendente.
- `/admin/ordenes/:id`: detalle con refresh directo, estados separados, resumen, actores, ítems históricos, notas, origen y actividad visible.
- `/propuestas-comerciales?quotation=:id`: diálogo de consulta y conversión integrado en Cotizaciones. Conserva el editor legacy; agrega acceso de lectura con el icono de ojo y regreso desde la orden.
- Comercial: Prospectos → Clientes → Cotizaciones → Órdenes → Seguimientos. No existían entradas independientes de Contratos/Pagos en este menú y no se agregan placeholders ni módulos ficticios.

Se mantiene el router existente basado en history/popstate, sin dependencias nuevas. El path de detalle no se normaliza al listado al iniciar sesión/recargar. La navegación entre listado y detalle actualiza también cuando sigue activo el mismo módulo. Las rutas CRM requieren sesión; el tenant y el ID forman la clave de los componentes para descartar resultados anteriores al cambiar de contexto.

## Componentes y acceso a datos

Nuevos componentes en `src/components/orders/`:

- `Orders.jsx`: loading, empty, error/retry, filtros, tabla desktop y tarjetas mobile.
- `OrderDetail.jsx`: representación histórica, atribución de actores, hasta50 eventos recientes visibles, estados independientes y origen navegable.
- `QuotationOrderDialog.jsx`: lectura, revisión explícita de aceptación, confirmación y conversión. Bloquea doble clic y cierre durante una operación; focus inicial, retorno de foco, Escape y ciclo de Tab.
- `OrderPrimitives.jsx`: cards, badges, loading y error compartidos por estas pantallas. Reutiliza el patrón visual Tailwind/lucide actual; no incorpora otro design system.

`src/services/orders.js` concentra consultas y payloads RPC, con cliente inyectable. `src/utils/orders.js` concentra presentación decimal, etiquetas, rutas, filtros, errores seguros y control de petición de conversión. `src/utils/ordersFeature.js` contiene el opt-in de build.

Modificaciones existentes: `App.jsx` (menú/rutas), `Quotations.jsx` (entrada de lectura), `supabaseClient.js` (forward de rpc al mismo cliente y sesión Auth), `utils/roles.js` (lectura Orders para los seis roles). No cambios al cliente WEB ni a dependencias/lockfile.

Las lecturas incluyen filtro explícito organization_id además de RLS. El listado obtiene todas las páginas de200 filas con orden estable; los resúmenes de pago se consultan con concurrencia máxima4. El detalle solo consulta orders/order_items y referencias cliente/cotización/miembros/actividad: nunca consulta catálogo para reemplazar un ítem histórico. La actividad o atribución no visible por policies existentes no impide abrir la orden; un fallo del resumen canónico de pago sí se muestra como error, sin inventar un estado.

## Flujo quotation → order

1. Abrir la cotización guardada; consultar la orden existente por tenant+quotation_id. Si existe, mostrar **Esta cotización ya fue convertida** y **Abrir orden** sin crear otra revisión ni convertir de nuevo.
2. Solo admin/editor, cotización aceptada con fecha y cliente vinculados, pueden solicitar `phase1a_quotation_review_source`. Esta lectura valida membresía y capability de conversión en el servidor.
3. El backend aprobado no expone la última revisión aceptada como lectura pública. Por eso la UI no inventa ID/hash ni intenta leer el schema privado: solicita explícitamente la referencia de aceptación real y llama `phase1a_review_and_accept_quotation`. Esta acción separada valida precios/cliente/fingerprint y devuelve la revisión inmutable. No cambia borrador a aceptada ni acepta cotizaciones silenciosamente.
4. Solo después aparece **Convertir en orden**. La confirmación explica el vínculo y la conservación histórica, sin pagos/contratos.
5. Confirmar ejecuta una sola llamada `phase1a_convert_quotation_to_order`, con org, quotation, snapshot, hash y UUID de operación. Un ref síncrono y el controlador de petición compartida bloquean doble clic. La operación DB completa sigue siendo la RPC transaccional aprobada.
6. Mostrar confirmación de éxito en el detalle y navegar a `/admin/ordenes/:id`. Ante respuesta perdida/error, consultar si ya existe orden; ofrecerla si está disponible. Si se reintenta en el mismo diálogo se reutiliza la misma clave. Después de recargar, la búsqueda por origen y la unicidad DB evitan duplicación.

La UI no replica normalización monetaria ni validación exhaustiva de negocio. La RPC revalida todas las condiciones al convertir, incluidas ambas capabilities y cambios concurrentes. La revisión previa no garantiza que no cambie el estado entre acciones. Los errores por revisión obsoleta indican volver a abrir y revisar, sin reintentos automáticos de escritura.

Las seis cotizaciones productivas mencionadas por Javier no se consultaron ni modificaron en esta iteración. Todos los escenarios de aceptación/conversión usan datos sintéticos locales.

## Estados, monedas y snapshots

Se presentan por separado los cuatro estados comerciales, cinco de pago y nueve operativos con traducciones explícitas. El pago viene de `phase1a_order_payment_summary`: actualmente informa ausencia de ledger; no se simulan cobros, cuotas ni contratos. No hay campo editable de pago en React.

Header e ítems se leen con casts PostgREST a texto para las cantidades/importes canónicos. El formato usa strings y BigInt, sin sumar, repriciar o redondear en binario: CLP sin decimales para importes, USD con dos; el precio unitario conserva precisión decimal adicional cuando existe. Cada ítem usa su propia currency y su snapshot, incluso con catalog_id/pack_id NULL. La identidad del cliente se resuelve por FK; created_by y accepted_by se resuelven por membresía visible o se muestran como UUID, nunca se consulta Auth directamente.

## Permisos y feature flags

| Rol | Listado/detalle | Revisar aceptación / convertir | Edición / borrado desde esta UI |
|---|---|---|---|
| admin | Sí según RLS | Sí si capabilities y guards permiten | No se expone |
| editor | Sí según RLS | Sí si capabilities y guards permiten | No se expone |
| diseñador | Sí según RLS | No | No |
| corrector | Sí según RLS | No | No |
| finanzas | Sí según RLS | No | No |
| visualizador | Sí según RLS | No | No |
| anon / unknown / otro tenant | Sin acceso autorizado | No | No |

Ocultar acciones solo controla presentación; la RPC y las policies conservan la autoridad. No se agregan policies ni grants. `VITE_PHASE_1A_ORDERS_ENABLED` requiere exactamente `true`; ausente/false queda OFF. Solo el build de preview local recibió true por variables de proceso; ningún `.env` fue editado. Los flags privados orders/quotation_conversion siguen default OFF y solo se habilitan para organizaciones sintéticas de prueba. El modo Mock no simula el ledger/backend: las pantallas nuevas requieren Supabase real LOCAL.

## Pruebas y evidencias

- Node: **33 PASS**, incluyendo16 nuevos casos Orders/API y17 regresiones existentes. Formato CLP/USD/precisión, estados, filtros, seis roles, rutas, request compartida, reintento con misma clave, errores sin SQL, paginación, snapshot con FK NULL y payload exacto.
- Reconstrucción: `supabase db reset --local --no-seed`, baseline→04B→las tres migraciones Phase1A, PASS. Sin --linked.
- Backend: **55 dominio +19 SQL +38 Auth/REST PASS**; idempotencia/concurrencia/rollback y negativas RLS incluidos.
- Security01–04: **2.894 asserts PASS** mediante adaptador acotado de inventarios existente, sin cambiar los asserts de autorización históricos.
- Storage/Auth: **130 PASS**, signed URL válida/expirada, documents privado y brand-assets público. Tras reset se reinició únicamente el gateway Kong LOCAL antes de HTTP, como en la validación backend anterior.
- Catálogo de seguridad:306 policies legacy,13 funciones legacy y8 migraciones originales sin cambios;16 policies Storage preservadas. Ninguna migración Phase1A editada.
- Build local con flag ON y configuración loopback: PASS. Build inicial por defecto OFF: PASS. Advertencias preexistentes de tamaño de bundle/sourcemaps, sin impedir compilación.
- Lint baseline:393 errores/22 warnings. Final completo:391/22. **NEW PHASE 1A UI LINT ERRORS = 0**, warnings nuevos0. Los dos errores menos corresponden a Eye/userRole antes sin uso. Comparación multiset por archivo/regla/diagnóstico, quitando únicamente codeframes React con números de línea desplazados. ESLint aislado para componentes, utilidades y tests nuevos: exit0. Al ejecutar ESLint sobre todos los archivos modificados también aparecen46 errores/4 warnings legacy concentrados en App, Cotizaciones y el cliente Supabase; todos están en el baseline, delta0. No se arregló masivamente legacy.
- Browser: **62/62 PASS** con Chrome headless y Supabase LOCAL, red remota bloqueada. Desktop1440×1000 y mobile390×844; 728 respuestas observadas; **cero HTTP inesperados ≥400, cero errores de consola y cero excepciones JS**. Los únicos ≥400 son fallos controlados (RPC503, capability403 y listado500) y se verificó el manejo/reintento. Las11 rutas CRM mantienen respuesta e imágenes correctas. Datos sintéticos; sin secretos en evidencias.

Cobertura browser: empty/listado/filtros, detalle/snapshot/USD/CLP/FK NULL, aceptación explícita, confirmación, doble clic, un POST de conversión inicial, redirect con éxito, refresh directo, orden existente sin duplicación, mobile sin overflow global, logout/login, anon bloqueado, visualizador read-only, capability OFF, orden inexistente, RPC503 controlado/reintento, listado500/retry/loading y fallo real de red controlado. Regresión de Dashboard, Prospectos, Clientes, Cotizaciones, Servicios, CMS servicios/libros/identidad, Documentos, Ingresos y Gastos.

Se conservan intentos fallidos previos de selector y viewport, además de su evidencia, sin presentarlos como runs productivos. La corrida final incluye el ajuste `min-w-0` del contenedor CRM, valida que la cabecera de detalle quepa en mobile y vuelve a revisar las rutas/regresiones completas.

La evidencia detallada de Node, reset, backend, SQL, HTTP, Security, Storage, build, lint y browser, junto con manifiestos y logs, se conserva localmente y queda fuera del commit. Los resultados se resumen en este informe y en la revisión de integración.

Las capturas desktop/mobile son evidencia visual local y se excluyen del commit.

## Riesgos y límites

- No desplegado: el entorno productivo aún carece de las tablas Phase1A; dejar OFF el flag de UI. Integración/despliegue y activación por tenant requieren una autorización posterior.
- Revisión de aceptación y conversión son dos acciones explícitas con RPC existentes. No se amplía el backend aprobado para exponer capabilities/revisiones; todavía no hay UI nueva para aceptar/editar cotizaciones atómicamente con save_and_accept.
- El listado usa consultas por orden para el resumen de pago (máximo4 simultáneas) y filtros locales sobre las páginas cargadas. Para tenants grandes convendrá diseñar una lectura paginada con filtros/resumen en servidor en una iteración separada.
- Se mantiene la barrera global de escrituras de cotizaciones, la normalización legacy estricta y la deuda del editor antiguo; no se retocaron con esta UI.
- Actividad y nombres de actores dependen de las policies existentes; RLS puede ocultarlos. No se amplía exposición para completar etiquetas.
- Los fixtures aceptados se conservan en Supabase LOCAL: no se deshabilitan triggers de inmutabilidad para borrarlos. Un futuro reset local los elimina. El arnés elimina solo su perfil temporal de Chrome.
- No se hicieron push, commit, deploy, db push, queries remotas, cambios de WEB, Payments ni Contracts. No se ensayó restore ni se corrigieron advisors legacy.

**PHASE 1A UI: READY FOR REVIEW**<br>
**PHASE 1A: READY FOR INTEGRATION REVIEW**<br>
**PRODUCTION CHANGES: NONE**
