# NOVELI 2.0 — Estado maestro

Actualización: **2026-10-19**. Único punto de seguimiento general; resume y enlaza informes técnicos, sin reemplazarlos. Las migraciones Phase 1A ya están aplicadas; CRM aún requiere despliegue flag-off, smoke legacy y activación controlada.

## 1. Estado general

Estados permitidos: NOT STARTED · IN DESIGN · IN DEVELOPMENT · READY FOR REVIEW · READY FOR DEPLOY · DEPLOYED · VERIFIED · BLOCKED.

| Área / fase | Estado | Situación |
|---|---|---|
| Security 01–04B | VERIFIED | Cerrado y verificado en producción; documents privado |
| Asset Transition | VERIFIED | Imágenes migradas, default-org reconciliado y cero dependencias públicas documents |
| Phase 1 Design | VERIFIED | Javier aprobó formalmente el diseño y sus decisiones finales |
| Phase 1A Orders | IN DEVELOPMENT | Migraciones 1A aplicadas; Orders y conversiones siguen cerradas por capabilities vacías; CRM productivo aún sin la UI Phase 1A |
| Phase 1A Backend | VERIFIED | Javier aprobó formalmente backend/RPC; las tres migraciones están ahora aplicadas y verificadas en producción |
| Phase 1A UI | VERIFIED | Integration Review PASS; revisión manual PASS; formato monetario pulido; flag predeterminado OFF |
| Phase 1B Payments | NOT STARTED | Diseño preparado; implementación no iniciada |
| Phase 1C Contracts | NOT STARTED | Diseño preparado; implementación no iniciada |
| Phase 2 Projects | NOT STARTED | Sin inicio de trabajo registrado |
| Phase 3 Red Noveli | NOT STARTED | Sin inicio de trabajo registrado |
| Phase 4 Catalog/Pricing | NOT STARTED | Sin inicio de trabajo registrado |
| Phase 5 CRM | NOT STARTED | Evolución Noveli 2.0 pendiente; CRM actual ya productivo |
| Phase 6 CMS | NOT STARTED | Evolución Noveli 2.0 pendiente; CMS actual ya productivo |
| Phase 7 Public Web | NOT STARTED | Evolución Noveli 2.0 pendiente; web actual ya productiva |
| Phase 8 Digital Products | NOT STARTED | Sin inicio de trabajo registrado |
| Phase 9 Portals | NOT STARTED | Sin inicio de trabajo registrado |
| Phase 10 Automations | NOT STARTED | Sin inicio de trabajo registrado |

El diseño cuenta con aprobación formal de Javier. Los estados de fases futuras no califican la disponibilidad de los productos legacy. IN DEVELOPMENT no autoriza despliegue productivo.

## 2. Producción actual

| Componente | Último estado documentado |
|---|---|
| Supabase | crm-noveli — proyecto `bdxlzhpmifxwmqjnnmxa`; PostgreSQL 17.6 |
| Última migración aplicada | `20261018214237_phase_1a_quotation_conversion.sql` (última de Phase 1A) |
| Project health | ACTIVE_HEALTHY, comprobado durante cierre/auditoría del 2026-10-18 |
| Storage | documents: **private**, 36 objetos; brand-assets: **public**, 19 objetos; total55 |
| DB / órdenes | 48 tablas public con RLS; orders y order_items existen con 0 filas; 7 filas public.documents; seis cotizaciones siguen `borrador` |
| Web pública / Storage | PUBLIC LEGACY STORAGE DEPENDENCIES=0, último smoke productivo posterior a04B |
| CRM repo / branch | somosnovelieditorial-stack/crm-noveli — main |
| CRM commit productivo | `d4332c4ac3f6d6f5b84325ab532f4e3bd39ba273` |
| CRM deployment | Último production conocido corresponde a `d4332c4…`; despliegue Phase 1A flag-off pendiente |
| CRM dominio | https://crm-noveli.vercel.app |
| WEB repo / branch | somosnovelieditorial-stack/noveli-web — main |
| WEB commit productivo | `7803993e24662c973fe41ccff1c5dcee463c08a4` |
| WEB deployment | Production completado/success y smoke VERIFIED; registro GitHub7134314612 |
| WEB dominio | https://www.somosnovelieditorial.com |

Deployment completado/success se sustenta en evidencia GitHub/Vercel y smokes, no en una nueva consulta del campo readyState de Vercel. Los números anteriores son registros GitHub de deployment, no IDs internos dpl_ de Vercel.

Recovery point vigente previo a Phase 1A: **POST-04B / PRE-PHASE-1A**, `C:/Users/xavie/Desktop/backup/pre-phase-1a/20261019T032415Z/`; verificado con DB/Auth/Storage 55/55. Restore integral no ensayado.

Recovery point histórico anterior a04B: **POST-ASSET-TRANSITION / PRE-04B**, creado 2026-10-17 y hashes revalidados antes de04B:
`C:/Users/xavie/Desktop/backup/pre-04b/20261017T035357Z/`.

72 archivos; Storage55/55; esquema, datos public, roles y Auth cifrado DPAPI CurrentUser; integridad verificada. **Restore no ensayado**. Es un punto anterior al lockdown04B; no un backup posterior a04B. Mantiene el estado histórico de buckets públicos de esa captura.

Evidencias fuera de Git:
- [Cierre productivo04B](</C:/Users/xavie/Desktop/backup/04b-deployment/20261018T204408Z/CLOSURE-REPORT.md>).
- [Recovery manifest](</C:/Users/xavie/Desktop/backup/pre-04b/20261017T035357Z/RECOVERY-MANIFEST.json>).

## 3. Cambios recientes

Fechas UTC según evidencia; un estado de diseño no significa despliegue.

| Fecha | Área | Cambio | Entorno | Commit / migration | Estado |
|---|---|---|---|---|---|
| 2026-10-17 | Security / CRM | 01–04A y frontend compatible publicados | Producción | 01→04A; `d4332c4…` | VERIFIED |
| 2026-10-17 | Asset Transition / WEB | Assets, default-org y logos reconciliados; web sin dependencia documents | Producción | `7803993…`; sin migración nueva | VERIFIED |
| 2026-10-17 | Recovery | Backup manual post-assets/pre04B verificado | Backup fuera de Git | `20261017T035357Z` | VERIFIED |
| 2026-10-18 | Security04B | documents privado; brand-assets público; bytes conservados | Producción | `20261016013221` | VERIFIED |
| 2026-10-18 | Phase1 | Auditoría y diseño inicial entregados | Documentación local | Sin commit/migración | READY FOR REVIEW |
| 2026-10-18 | Phase1 | Revisión adversarial:18 decisiones,60 pruebas previstas,10 lotes definidos | Documentación local | Sin commit/migración | READY FOR REVIEW |
| 2026-10-18 | Seguimiento | Documento maestro creado | Documentación local | Sin commit/migración | READY FOR REVIEW |
| 2026-10-18 | Phase1 Design | Javier aprueba formalmente el diseño | Documentación | Sin commit/migración | VERIFIED |
| 2026-10-18 | Phase1A backend | Fundamentos, Orders/items y conversión implementados y probados | Local exclusivamente | 20261018214233 / 20261018214235 / 20261018214237 | READY FOR REVIEW |
| 2026-10-18 | Phase1A backend | Aprobación formal de Javier | Local / revisión | Tres migraciones Phase1A sin cambios | VERIFIED |
| 2026-10-18 | Phase1A UI | Inicio de listado, detalle y conversión integrada al CRM | Local exclusivamente | Sin commit / sin migración nueva | IN DEVELOPMENT |
| 2026-10-18 | Phase1A UI | Listado, detalle, conversión, accesos y pruebas locales terminados; visual desktop/mobile revisado | Local exclusivamente | Sin commit / sin migración nueva | READY FOR REVIEW |
| 2026-10-18 | Phase1A cierre UI | Javier aprueba revisión visual; formato monetario pulido y nota interna retirada | Local exclusivamente | Sin commit / sin migración nueva | VERIFIED |
| 2026-10-18 | Phase1A deployment review | Preflight y dry-run enumeran únicamente las tres migraciones aprobadas | Read-only / workdir temporal | 20261018214233 / 20261018214235 / 20261018214237 | PASS |
| 2026-10-19 | Phase1A database | Recovery point POST-04B/PRE-PHASE-1A verificado; tres migraciones aplicadas; orders/order_items vacías, cotizaciones intactas y capabilities OFF | Producción Supabase | 20261018214233 / 20261018214235 / 20261018214237 | VERIFIED |

## 4. Fase actual

**PHASE 1 — ORDERS / PAYMENTS / CONTRACTS**

- Diseño inicial completado.
- Design review aprobada formalmente por Javier; Phase 1 Design VERIFIED.
- Phase 1A Backend VERIFIED por aprobación formal de Javier: fundamentos, orders/items y conversión.
- Phase 1A UI VERIFIED: rutas /admin/ordenes y /admin/ordenes/:id, conversión explícita quotation→order, E2E aprobado 62/62 y revisión manual PASS. Pulido local monetario verificado; sin Payments/Contracts.
- Phase 1A Integration Review PASS y revisión visual manual PASS. Las migraciones están desplegadas y verificadas; el frontend/flag-off y el smoke legacy están pendientes.
- El esquema Phase 1A ya está aplicado en producción; orders y order_items permanecen vacías, las seis cotizaciones siguen en borrador y capabilities siguen deshabilitadas. El CRM todavía ejecuta el commit anterior.
- Las60 pruebas son el plan general; el subset Phase1A quedó validado localmente. Resultados en el informe de implementación.
- Backend local aprobado por Javier:55 comprobaciones de dominio,19 SQL,38 REST,2894 asserts Security y130 Auth/Storage PASS, repetidos durante la UI. La UI agrega pruebas frontend/E2E sin alterar las migraciones.
- El cierre productivo Security no equivale a que Noveli2.0 completo esté listo para despliegue.

## 5. Próximo paso

**Acción aprobada vigente, completada:** integración técnica Phase 1A backend+UI: cotización→orden, listado y detalle; sin UI manual, Payments ni Contracts.

**Siguiente gate:** desplegar CRM con `VITE_PHASE_1A_ORDERS_ENABLED=false`, pasar smoke legacy, habilitar solamente `orders` y `quotation_conversion` para la organización aprobada y desplegar el build flag-on; luego ejecutar smoke Phase 1A sin crear órdenes ni convertir cotizaciones. Recovery point usado: `pre-phase-1a/20261019T032415Z`. Las capabilities continúan OFF.

**Estado productivo:** DB Phase 1A aplicada; commit/push y despliegues frontend aún pendientes. Flag/capabilities OFF.

## 6. Bloqueos / deuda técnica separada

| Tema | Situación | Tratamiento |
|---|---|---|
| pg_net en public | Advisor preexistente | Inventariado; corrección separada |
| Leaked password protection | Advisor preexistente | Inventariado; corrección separada |
| SECURITY DEFINER advisors | Warnings preexistentes | Revisar por función en tarea separada; no mezclar con Phase1 |
| Lint legacy | Baseline UI:393 errores /22 warnings; diagnóstico UI inicial391/22 | No corrección masiva; exigir cero errores nuevos Phase1A UI |
| Restore backup no ensayado | Integridad verificada, recuperación integral no practicada | Planificar ensayo aislado; no confundir hashes con restore probado |

Cierre04B:12 findings preexistentes en cuatro grupos y cero nuevos atribuibles a04B. No se corrigieron en esa ejecución. Diseño y backend Phase1A ya cuentan con aprobación; integración y despliegue siguen siendo gates separados.

## 7. Documentación de referencia

- [Auditoría Security](security-audit.md).
- [Validaciones01](security-01-validation.md), [02](security-02-validation.md), [03A](security-03a-validation.md), [03B](security-03b-validation.md), [03C](security-03c-validation.md) y [Storage04](security-04-storage-validation.md).
- [Validación final Security](security-final-validation.md), [runbook](security-deployment-runbook.md) y [checklist PhaseA](phase-a-deployment-checklist.md).
- Asset Transition: cierre y evidencia de Storage/web se mantienen en su expediente separado y quedan fuera del commit Phase 1A.
- [Auditoría modelo Phase1](phase-1/CURRENT-MODEL-AUDIT.md).
- [Diseño Phase1 revisado](phase-1/PHASE-1-DESIGN.md).
- [Revisión adversarial](phase-1/PHASE-1-DESIGN-REVIEW.md).
- [Decisiones finales](phase-1/PHASE-1-DECISIONS.md).
- [Plan de pruebas](phase-1/PHASE-1-TEST-PLAN.md).
- La evidencia detallada de modelo/Storage y manifests de pruebas Phase 1A permanece en workspace local y se excluye del commit.
- [Implementación Phase1A](phase-1/PHASE-1A-IMPLEMENTATION.md), [UI](phase-1/PHASE-1A-UI.md), [revisión de integración](phase-1/PHASE-1A-INTEGRATION-REVIEW.md), [revisión de deployment](phase-1/PHASE-1A-DEPLOYMENT-REVIEW.md) y [manifest de deployment](phase-1/PHASE-1A-DEPLOYMENT-MANIFEST.json).

[Revisión de integración Phase 1A](phase-1/PHASE-1A-INTEGRATION-REVIEW.md).

Algunos informes conservan estados históricos anteriores (por ejemplo04B pendiente o documents público). Consultar su fecha/etapa: el cierre04B y la captura posterior son evidencia del estado productivo más reciente aquí resumido. Este maestro no reescribe ni invalida esos registros históricos.

## 8. Historial y milestones

| Fecha | Milestone | Cambio relevante |
|---|---|---|
| 2026-10-17 | Base Security/CRM | Security01–04A y CRM compatible desplegados/verificados |
| 2026-10-17 | Asset Transition | Transición y reconciliación verificadas; WEB publicada |
| 2026-10-17 | Recovery | Nuevo recovery point post-assets/pre04B aprobado |
| 2026-10-18 | Storage lockdown | Security01–04B queda VERIFIED en producción |
| 2026-10-18 | Phase1 inicial | Diseño pasa a READY FOR REVIEW |
| 2026-10-18 | Phase1 adversarial | PASS técnico entregado; permanece READY FOR REVIEW hasta aprobación de Javier |
| 2026-10-18 | Seguimiento maestro | Se establece este archivo como índice general |
| 2026-10-18 | Aprobación formal | Phase 1 Design cambia READY FOR REVIEW→VERIFIED por autorización de Javier |
| 2026-10-18 | Inicio Phase1A | Orders cambia NOT STARTED→IN DEVELOPMENT; tres lotes backend locales autorizados |
| 2026-10-18 | Backend Phase1A | READY FOR REVIEW local; fase Orders permanece IN DEVELOPMENT hasta revisión/integración posterior; ninguna migración productiva |
| 2026-10-18 | Aprobación backend Phase1A | Backend cambia READY FOR REVIEW→VERIFIED por Javier; UI cambia NOT STARTED→IN DEVELOPMENT; producción sin cambios |
| 2026-10-18 | Phase1A UI | UI cambia IN DEVELOPMENT→READY FOR REVIEW tras E2E62/62; Phase1A completo queda listo para revisión de integración; producción sin cambios |
| 2026-10-18 | Phase1A Integration Review | UI pasa a VERIFIED en revisión técnica; integración queda READY FOR DEPLOYMENT REVIEW; falta aprobación visual manual de Javier; producción sin cambios |

Regla de mantenimiento: cada cambio de estado de fase debe actualizar estado general, fase actual y próximo paso; agregar cambio reciente y milestone cuando sea significativo, con fecha, entorno, commit/migration y enlace a evidencia. Conservar hitos y estados anteriores importantes. Las pruebas locales por sí solas no implican despliegue; VERIFIED registra aprobación/revisión formal de fase y permanece separado de DEPLOYED.
| 2026-10-19 | Phase 1A database deployment | Tras backup válido, se aplican y verifican foundations, orders/items y RPC; UI todavía apagada, capabilities OFF, cero órdenes y cero conversiones |
