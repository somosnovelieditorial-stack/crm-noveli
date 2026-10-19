# Phase 1B — P1-04 Deployment Review

**Estado del review previo:** preparado y aprobado antes del deployment
**P1-04 local:** aprobado; commit `e3604dd`
**Producción al cierre del review previo:** sin cambios
**P1-05:** no iniciado

## A. Recovery point

- Clasificación: `POST_PHASE_1A_PRE_PHASE_1B`
- Ruta: `C:\Users\xavie\Desktop\backup\pre-phase-1b\20261019T044950Z`
- Recovery: **VERIFIED** (database, Auth cifrado, Storage 55/55, manifest y hashes)
- Restore rehearsal: **NOT PERFORMED**

## B. Baseline productivo requerido antes del deployment

Revalidar en modo read-only inmediatamente antes de cualquier push. Si algún valor difiere, detenerse y actualizar esta revisión antes de mutar.

| Verificación | Baseline esperado |
|---|---:|
| Proyecto Supabase | `bdxlzhpmifxwmqjnnmxa`, `ACTIVE_HEALTHY` |
| Tablas public / con RLS | 48 / 48 |
| `orders` / `order_items` | presentes, 0 / 0 filas |
| `quotations` | 6; todas `borrador` |
| `payment_schedules` | ausente |
| `payments`, `payment_refunds`, `payment_allocations` | ausentes |
| `incomes` | 4 |
| `income_allocations` | 10 |
| `income_distributions` | 0 |
| `expenses` | 13 |

`income_allocations` es contabilidad legacy y no equivale a `payment_allocations`.

## C. Payload

El único payload de base de datos autorizado por este review es:

```text
supabase/migrations/20261019045900_phase_1b_p1_04_payment_schedules.sql
SHA-256: a7746b6a77df66618570203c41c5d70462211d972004cbfb0ebbe737b5da7600
```

Commit local congelado: `e3604dd` (`feat(payments): add phase 1B payment schedules foundation`). No se ha hecho push. El commit contiene exactamente los ocho archivos del candidate set P1-04; este documento de Deployment Review se creó después y permanece fuera de ese commit.

## D. Impacto esperado

- Tablas `public`: 48 → 49.
- Única tabla nueva: `payment_schedules`.
- `orders`, `order_items` y sus filas: sin cambios.
- Accounting (`incomes`, `income_allocations`, `income_distributions`, `expenses`): sin cambios.
- Filas existentes: sin backfill ni mutación.
- Frontend, Vercel, flags y capabilities: sin cambios.
- `payments`, `payment_refunds` y `payment_allocations`: continúan ausentes.

La tabla nueva comienza con 0 filas. No se crea calendario para órdenes existentes.

## E. Gates antes del deployment

1. Confirmar recovery point verificado y aceptar explícitamente que el restore rehearsal no se ha realizado.
2. Confirmar que el commit activo para revisión es `e3604dd` y que su candidate set son los ocho archivos P1-04 aprobados.
3. Recalcular el SHA-256 de la migración y exigir coincidencia exacta.
4. Confirmar que el working tree no incorpora cambios funcionales ajenos al payload.
5. Ejecutar `supabase db push --dry-run` desde el artefacto/workdir controlado.
6. Exigir que el dry-run proponga únicamente `20261019045900_phase_1b_p1_04_payment_schedules.sql`; cualquier otra migración bloquea el despliegue.
7. No ejecutar SQL productivo ni mutar datos antes de que estos gates pasen y exista autorización de deployment.

## F. Verificación posterior

Después de una futura aplicación autorizada, comprobar en producción, sin crear datos de negocio:

- proyecto `ACTIVE_HEALTHY` y migration history con P1-04 aplicada;
- `payment_schedules` presente con RLS habilitado y forzado;
- constraints/FK compuesta, índice de vencimientos, policies, trigger y cuatro entrypoints esperados (dos helpers privados y dos wrappers públicos) presentes;
- `payment_schedules` = 0 filas; `orders` = 0; `order_items` = 0;
- quotations = 6, todas `borrador`;
- accounting sigue en 4 / 10 / 0 / 13;
- tablas P1-05 (`payments`, `payment_refunds`, `payment_allocations`) siguen ausentes;
- Phase 1A y Security 04B permanecen funcionales e intactos;
- ningún cambio en Vercel, frontend, flags, capabilities ni Storage.

No publicar ni probar un calendario comercial real como parte del smoke.

## G. Contención

- Si el dry-run difiere o el preflight no coincide: detenerse sin ejecutar `db push`.
- Si la migración falla: detenerse; no recrear objetos manualmente ni aplicar una reparación de migration history.
- Si la migración se aplicó pero falla cualquier post-check: no iniciar P1-05, no hacer rollback destructivo y no alterar datos. Conservar evidencia redactada y diagnosticar antes de cualquier otra mutación.
- Preferir una corrección forward tras revisar el defecto. No ejecutar `DROP`, `migration repair`, reset linked ni limpieza de datos automáticamente.

**Estado histórico del review previo al despliegue:** preparado, pendiente de autorización; producción sin cambios; P1-04 aún no desplegado.
**P1-05 STARTED:** NO

## H. Resultado de deployment posterior — 2026-10-19

Se ejecutó el despliegue autorizado de una única migración. El hash se verificó antes de la operación y el dry-run inmediatamente previo mostró únicamente `20261019045900_phase_1b_p1_04_payment_schedules`. `supabase db push --linked --yes` finalizó con exit code 0 y reportó solo esa migración.

| Gate / post-check | Resultado |
|---|---|
| Proyecto / PostgreSQL | `ACTIVE_HEALTHY` / `17.6.1.127` |
| Tablas public / con RLS | 49 / 49 |
| `payment_schedules` | presente, RLS habilitado y forzado, 0 filas |
| Importe / moneda | `numeric(18,2)`; restricciones CLP/USD y monto positivo presentes |
| Integridad / índices | FK compuesta tenant/orden, secuencia única y positiva, índices esperados presentes |
| Funciones / permisos | 2 RPC públicos invoker; 2 helpers definer con owner interno y `search_path` vacío; anon/service_role sin acceso |
| Orders / items | 0 / 0 filas |
| Quotations | 6; `borrador`: 6 |
| Accounting | incomes 4; income_allocations 10; income_distributions 0; expenses 13 |
| P1-05 ledger tables | ausentes |
| CRM GET `/admin/ordenes`, `/admin/cotizaciones` | 200 / 200 |
| Recovery | verificado; restore rehearsal no realizado |

El smoke del CRM fue de solo lectura y sin sesión autenticada. No se inspeccionó consola de navegador autenticada; esta migración no cambió frontend ni Vercel. No se crearon schedules, órdenes ni conversiones reales, y no se inició P1-05.

**P1-04 DEPLOYED:** YES
**PRODUCTION STATUS:** HEALTHY
**PRODUCTION CHANGES:** P1-04 migration only
