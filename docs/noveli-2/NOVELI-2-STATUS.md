# NOVELI 2.0 — Estado maestro

Actualización: **2026-10-19**. Único punto de seguimiento general; resume y enlaza informes técnicos, sin reemplazarlos. Phase 1A está desplegada y habilitada; smoke productivo de Órdenes PASS. No se han creado órdenes ni convertido cotizaciones reales.

## 1. Estado general

Estados permitidos: NOT STARTED · IN DESIGN · IN DEVELOPMENT · READY FOR REVIEW · READY FOR DEPLOY · DEPLOYED · VERIFIED · BLOCKED.

| Área / fase | Estado | Situación |
|---|---|---|
| Security 01–04B | VERIFIED | Cerrado y verificado en producción; documents privado |
| Asset Transition | VERIFIED | Imágenes migradas, default-org reconciliado y cero dependencias públicas documents |
| Phase 1 Design | VERIFIED | Javier aprobó formalmente el diseño y sus decisiones finales |
| Phase 1A Orders | VERIFIED | DB y CRM desplegados; Vercel `dpl_HmD6rciHvLWUVpTfz5HS7zAp4DsE` READY en `main` (`b085161…`), flag ON y capabilities `orders`/`quotation_conversion` habilitadas. Smoke productivo PASS; 0 órdenes y 0 conversiones reales |
| Phase 1A Backend | VERIFIED | Aprobado por Javier; las tres migraciones aplicadas y verificadas en producción; tablas sin filas |
| Phase 1A UI | VERIFIED | Integration Review PASS; revisión manual PASS; formato monetario pulido; flag predeterminado OFF |
| Phase 1B Payments | IN DEVELOPMENT | P1-04 deployed y verificado en producción; P1-05/P1-06/P1-07 aún no iniciados |
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
| Última migración aplicada | `20261019045900_phase_1b_p1_04_payment_schedules.sql` (P1-04) |
| Project health | ACTIVE_HEALTHY, comprobado nuevamente durante el pre-enable check del 2026-10-19 |
| Storage | documents: **private**, 36 objetos; brand-assets: **public**, 19 objetos; total55 |
| DB / órdenes | 49 tablas public con RLS; `payment_schedules` existe con 0 filas; orders/order_items 0/0; 7 filas public.documents; seis cotizaciones siguen `borrador` |
| Web pública / Storage | PUBLIC LEGACY STORAGE DEPENDENCIES=0, último smoke productivo posterior a04B |
| CRM repo / branch | somosnovelieditorial-stack/crm-noveli — main |
| CRM commit productivo | `b0851619b3ba38fbde93d6846ce7c3dda08e5d36` |
| CRM deployment | Production READY, branch `main`, commit `b0851619…`; flag `VITE_PHASE_1A_ORDERS_ENABLED=true`; deployment `dpl_HmD6rciHvLWUVpTfz5HS7zAp4DsE` |
| CRM dominio | https://crm-noveli.vercel.app |
| WEB repo / branch | somosnovelieditorial-stack/noveli-web — main |
| WEB commit productivo | `7803993e24662c973fe41ccff1c5dcee463c08a4` |
| WEB deployment | Production completado/success y smoke VERIFIED; registro GitHub7134314612 |
| WEB dominio | https://www.somosnovelieditorial.com |

Deployment completado/success se sustenta en evidencia GitHub/Vercel y smokes, no en una nueva consulta del campo readyState de Vercel. Los números anteriores son registros GitHub de deployment, no IDs internos dpl_ de Vercel.

Recovery point vigente previo a Phase 1A: **POST-04B / PRE-PHASE-1A**, `C:/Users/xavie/Desktop/backup/pre-phase-1a/20261019T032415Z/`; verificado con DB/Auth/Storage 55/55. Restore integral no ensayado.

Recovery point vigente previo a Phase 1B: **POST_PHASE_1A_PRE_PHASE_1B**, `C:/Users/xavie/Desktop/backup/pre-phase-1b/20261019T044950Z/`; database, Auth, Storage 55/55, manifest y hashes verificados. **Restore integral no ensayado.**

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
| 2026-10-19 | Phase1A CRM rollout | `b085161…` Production READY; smoke legacy PASS; Vercel flag ON y capabilities Phase 1A habilitadas | Producción | `b0851619b3ba38fbde93d6846ce7c3dda08e5d36`; `dpl_HmD6rciHvLWUVpTfz5HS7zAp4DsE` | VERIFIED |
| 2026-10-19 | Phase1A production smoke | Órdenes/sidebar, listado vacío y filtros PASS; seis cotizaciones `borrador` correctamente no muestran conversión; 0 órdenes y 0 conversiones reales | Producción + auditoría de código/tests locales | `b0851619b3ba38fbde93d6846ce7c3dda08e5d36` | PASS |
| 2026-10-19 | Recovery Phase1B | Recovery point POST-Phase1A/PRE-Phase1B verificado; restore no ensayado | Backup fuera de Git | `pre-phase-1b/20261019T044950Z` | VERIFIED |
| 2026-10-19 | Phase1B P1-04 review | Review PASS; test dedicado de publicación concurrente cierra el LOW; implementación aprobada localmente antes del deployment | Local / review | `e3604dd…`; `20261019045900` | VERIFIED |
| 2026-10-19 | Phase1B P1-04 deployment | Una migración aplicada; `payment_schedules` creada vacía; invariantes de Orders, cotizaciones y accounting verificadas | Producción Supabase | `20261019045900`; funcional `e3604dd40eb4f103c1bd81c7091b68acc8ee187c` (local, no push) | DEPLOYED / VERIFIED |

## 4. Fase actual

**PHASE 1 — ORDERS / PAYMENTS / CONTRACTS**

- Diseño inicial completado.
- Design review aprobada formalmente por Javier; Phase 1 Design VERIFIED.
- Phase 1A Backend VERIFIED por aprobación formal de Javier: fundamentos, orders/items y conversión.
- Phase 1A UI VERIFIED: rutas /admin/ordenes y /admin/ordenes/:id, conversión explícita quotation→order, E2E aprobado 62/62 y revisión manual PASS. Pulido local monetario verificado; sin Payments/Contracts.
- Phase 1A Integration Review PASS y deployment productivo VERIFIED. CRM `b085161…` está en Production READY con flag ON; capabilities `orders` y `quotation_conversion` están habilitadas para la organización aprobada.
- Smoke productivo: sidebar Órdenes, `/admin/ordenes`, lista vacía y búsqueda/filtros PASS. Detalle NOT APPLICABLE (0 órdenes). La acción de conversión queda correctamente oculta mientras las seis cotizaciones estén `borrador`; los tests locales cubren diálogo elegible, evidencia, confirmación y permisos. 0 órdenes y 0 conversiones reales.
- Recovery point POST-Phase1A/PRE-Phase1B verificado en `pre-phase-1b/20261019T044950Z`; Auth cifrado, Storage 55/55 con provenance y hashes verificados. Restore integral no ensayado.
- Phase 1B Payments corresponde a P1-04 Calendario, P1-05 Estructura ledger, P1-06 Comandos ledger y P1-07 Conciliación incomes. P1-04 está desplegado y verificado: tabla aditiva `payment_schedules`, RLS y 0 filas; no crea cobros ni modifica contabilidad. P1-05/P1-06/P1-07 no iniciados. El recovery `20261019T044950Z` es PRE-P1-04; su restore no se ha ensayado.
- Las60 pruebas son el plan general; el subset Phase1A quedó validado localmente. Resultados en el informe de implementación.
- Backend local aprobado por Javier:55 comprobaciones de dominio,19 SQL,38 REST,2894 asserts Security y130 Auth/Storage PASS, repetidos durante la UI. La UI agrega pruebas frontend/E2E sin alterar las migraciones.
- El cierre productivo Security no equivale a que Noveli2.0 completo esté listo para despliegue.

## 5. Próximo paso

**Acción aprobada vigente, completada:** integración técnica Phase 1A backend+UI: cotización→orden, listado y detalle; sin UI manual, Payments ni Contracts.

**Próxima acción:** mantener P1-05/P1-06/P1-07 sin iniciar hasta aprobación separada. Antes de cualquier futuro despliegue productivo de esos lotes, crear un recovery point posterior a P1-04; el checkpoint vigente es PRE-P1-04 y el restore integral no se ha ensayado.

**Estado productivo:** HEALTHY; Phase 1A desplegada y habilitada. Flag ON, ambas capabilities habilitadas, Orders smoke PASS; no se crearon órdenes ni se convirtieron cotizaciones. Phase 1B no iniciada.

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
- [Phase 1B Readiness Review](phase-1/PHASE-1B-READINESS-REVIEW.md): alcance propuesto P1-04–P1-07 y brechas entre el diseño y el modelo productivo actual.
- [Implementación P1-04](phase-1/PHASE-1B-P1-04-IMPLEMENTATION.md), [manifest P1-04](phase-1/PHASE-1B-P1-04-MANIFEST.json) y [deployment review](phase-1/PHASE-1B-P1-04-DEPLOYMENT-REVIEW.md): review local, migración desplegada/verificada y límites del smoke productivo.

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

| 2026-10-19 | Phase 1A DB deploy | Recovery point PRE-PHASE-1A verificado; tres migraciones aplicadas; cero órdenes/items y cotizaciones intactas |
| 2026-10-19 | Phase 1A CRM flag-off | `b085161…` Production READY en main; smoke legacy manual PASS; feature sigue cerrada por flag OFF y capabilities false |
| 2026-10-19 | Phase 1A enablement y smoke | Flag ON, capabilities `orders` y `quotation_conversion` habilitadas; ruta/listado PASS y borradores correctamente no convertibles; 0 cambios comerciales reales |
| 2026-10-19 | Phase 1A cierre documental / Phase 1B readiness | Cierre productivo documentado; P1-04–P1-07 mapeados a Payments para review, sin inicio de implementación |
| 2026-10-19 | Phase 1B P1-04 | P1-04 desplegado y verificado en producción; 49 tablas public con RLS, `payment_schedules` vacía, sin cambios de datos existentes; P1-05 no iniciado |
Regla de mantenimiento: cada cambio de estado de fase debe actualizar estado general, fase actual y próximo paso; agregar cambio reciente y milestone cuando sea significativo, con fecha, entorno, commit/migration y enlace a evidencia. Conservar hitos y estados anteriores importantes. Las pruebas locales por sí solas no implican despliegue; VERIFIED registra aprobación/revisión formal de fase y permanece separado de DEPLOYED.
