# NOVELI 2.0 — Phase 1A Deployment Review

> **Resultado posterior (2026-10-19):** Este documento es el preflight previo al deployment y sus secciones describen el estado observado entonces. Phase 1A se desplegó después con las tres migraciones aprobadas; CRM `b0851619b3ba38fbde93d6846ce7c3dda08e5d36`, deployment `dpl_HmD6rciHvLWUVpTfz5HS7zAp4DsE` READY, flag ON y capabilities `orders`/`quotation_conversion` habilitadas. Recovery `pre-phase-1a/20261019T032415Z` VERIFIED; legacy y Phase 1A smoke PASS; production HEALTHY; 0 órdenes y 0 conversiones reales. “PRODUCTION CHANGES: NONE” y el flag OFF son snapshots históricos de la revisión pre-deployment. Ver [estado maestro](../NOVELI-2-STATUS.md).

Fecha: 2026-10-18. Revisión congelada de deployment; no ejecuta operaciones de producción.

## Resultado

**PHASE 1A DEPLOYMENT REVIEW: PASS**<br>
**READY FOR DEPLOYMENT APPROVAL: YES**<br>
**PRODUCTION CHANGES: NONE**

El working tree sigue sin commit. No se ejecutó `db push`, Git push, deployment ni activación de capabilities. La autorización de deployment y un recovery point actual pre-Phase-1A siguen siendo gates separados.

## Auditoría del working tree y commit propuesto

### A. REQUIRED PHASE 1A CODE

```text
src/App.jsx
src/components/Quotations.jsx
src/components/orders/OrderDetail.jsx
src/components/orders/OrderPrimitives.jsx
src/components/orders/Orders.jsx
src/components/orders/QuotationOrderDialog.jsx
src/services/orders.js
src/supabaseClient.js
src/utils/orders.js
src/utils/ordersFeature.js
src/utils/roles.js
```

### B. REQUIRED PHASE 1A MIGRATION

```text
supabase/migrations/20261018214233_phase_1a_foundations.sql
supabase/migrations/20261018214235_phase_1a_orders.sql
supabase/migrations/20261018214237_phase_1a_quotation_conversion.sql
```

### C. REQUIRED PHASE 1A TEST

```text
src/services/orders.test.js
src/utils/orders.test.js
supabase/tests/phase_1a_browser_scenarios.mjs
supabase/tests/phase_1a_browser_smoke.mjs
supabase/tests/phase_1a_catalog.py
supabase/tests/phase_1a_http.py
supabase/tests/phase_1a_migration_stages.py
supabase/tests/phase_1a_orders.py
supabase/tests/phase_1a_orders.sql
supabase/tests/phase_1a_security_regressions.py
supabase/tests/phase_1a_ui_browser.mjs
supabase/tests/phase_1a_ui_scenarios.mjs
```

### D. REQUIRED PHASE 1A DOCUMENTATION

```text
docs/noveli-2/NOVELI-2-STATUS.md
docs/noveli-2/phase-1/CURRENT-MODEL-AUDIT.md
docs/noveli-2/phase-1/PHASE-1-DESIGN.md
docs/noveli-2/phase-1/PHASE-1-DESIGN-REVIEW.md
docs/noveli-2/phase-1/PHASE-1-DECISIONS.md
docs/noveli-2/phase-1/PHASE-1-TEST-PLAN.md
docs/noveli-2/phase-1/PHASE-1A-IMPLEMENTATION.md
docs/noveli-2/phase-1/PHASE-1A-UI.md
docs/noveli-2/phase-1/PHASE-1A-INTEGRATION-REVIEW.md
docs/noveli-2/phase-1/PHASE-1A-DEPLOYMENT-REVIEW.md
docs/noveli-2/phase-1/PHASE-1A-DEPLOYMENT-MANIFEST.json
```

### E. PREEXISTING / UNRELATED — exclude

```text
docs/noveli-2/security-deployment-runbook.md  (tracked modification; preserve untouched)
docs/noveli-2/asset-transition-closure-status.md
docs/noveli-2/phase-a-deployment-checklist.md
docs/noveli-2/evidence/**
```

### F. LOCAL EVIDENCE / DO NOT COMMIT

```text
.security-browser-evidence.json
docs/noveli-2/phase-1/catalog-audit.json
docs/noveli-2/phase-1/data-profile.json
docs/noveli-2/phase-1/frontend-dependencies.txt
docs/noveli-2/phase-1/integrity-and-grants.json
docs/noveli-2/phase-1/read-only-verification.json
docs/noveli-2/phase-1/REVIEW-MANIFEST.json
docs/noveli-2/phase-1/PHASE-1A-MANIFEST.json
docs/noveli-2/phase-1/PHASE-1A-UI-MANIFEST.json
docs/noveli-2/phase-1/phase-1a-*.json
docs/noveli-2/phase-1/phase-1a-*.log
docs/noveli-2/phase-1/phase-1a-*.png
docs/noveli-2/phase-1/*preview-location.txt
```

Generated evidence is useful for local audit and remains in the workspace; it is not needed in the code commit. Stable reports were updated to describe evidence without requiring the excluded files.

### G. SECRET / MUST NEVER COMMIT

No secret or credential file is part of the proposed list. No `.env`, backup, service-role key, password, token, cookie, or local credential is proposed for commit. Local preview account details were removed from stable documentation. Do not stage files outside sections A–D.

`git diff --check` passes. The tracked runbook change is unrelated and is explicitly excluded; no existing file was reverted.

## Migrations and isolated dry-run

All three migration SHA-256 values exactly match the approved values. They are the only Phase 1A migrations in the repo and follow Security 04B. The local migration directory contains the 8 historical migrations through 04B plus exactly these three. The remote history ends at 04B.

An isolated temporary workdir contained the Supabase config, linked-project metadata and 11 migrations. Supabase CLI 2.109.1 ran `supabase db push --dry-run --linked` there and proposed exactly, in order:

```text
20261018214233_phase_1a_foundations.sql
20261018214235_phase_1a_orders.sql
20261018214237_phase_1a_quotation_conversion.sql
```

Exit code 0. Dry-run connected read-only to inspect remote history and did not apply migrations. No other migration was proposed.

The SQL files are transactional/aditive schema and function definitions. No migration-time data backfill inserts Orders or Order Items, and no migration-time statement changes existing quotation statuses or contents. `UPDATE`/`DELETE` statements found are inside explicitly invoked RPC/function bodies, not executed as a migration backfill. Existing quotations remain untouched by applying DDL alone.

## Production read-only preflight

Supabase project `crm-noveli` (`bdxlzhpmifxwmqjnnmxa`) returned `ACTIVE_HEALTHY`; PostgreSQL 17.6.1.127. Read-only remote checks confirm:

- Migration history: baseline → Security 01 → 02 → 03A → 03B → 03C → 04A → 04B; newest is `20261016013221`.
- `public` base tables: 46. `orders` and `order_items`: both absent (zero matching tables).
- Storage: `brand-assets public=true`; `documents public=false`.
- Six existing quotations are all `borrador` (draft). No quotation was modified or converted.
- Security 04B is present as the final migration. Its bucket configuration remains as expected above.

Thus Orders start at zero on the currently observed production schema. The three proposed migrations do not seed/backfill Orders. No production mutation was used for these checks.

## Frontend flag, capabilities, and activation order

`src/utils/ordersFeature.js` uses the build-time expression `import.meta.env.VITE_PHASE_1A_ORDERS_ENABLED === 'true'`. Missing or any other value means OFF. At current production CRM commit `d4332c4ac3f6d6f5b84325ab532f4e3bd39ba273`, the feature helper is absent, so the effective feature is OFF. The actual Vercel environment variable was not queried; no claim is made about its stored value. Once the Phase 1A code is built, production must explicitly build with `false`/unset first.

Migration A creates `noveli_private.order_capabilities` with `enabled DEFAULT false` and the only accepted capability names `orders` and `quotation_conversion`. The Orders read/write authorization path checks `orders`; conversion RPC checks `quotation_conversion` independently. Both remain absent/OFF after migration unless explicitly enabled for an approved organization.

Recommended order after a separate deployment authorization:

1. Create and verify a fresh recovery point for the current post-04B state (see recommendation below).
2. Make the exact local commit candidate, push only the approved branch, and confirm the remote branch/commit. No action is authorized by this review itself.
3. Re-run the isolated dry-run; it must still enumerate exactly the three hashes below.
4. Apply the three migrations in order, then verify history, schema/RLS/RPC, both capability names disabled, zero Orders, six quotations still draft, and unchanged Storage.
5. Deploy CRM with `VITE_PHASE_1A_ORDERS_ENABLED=false` (or unset). Smoke legacy CRM. This build cannot expose the Phase 1A UI.
6. Enable `orders` capability only for the approved pilot organization in a controlled transaction while the UI build flag remains OFF.
7. Enable `quotation_conversion` only when the conversion smoke is separately ready. Neither capability is enabled by the migrations.
8. Build/deploy CRM with `VITE_PHASE_1A_ORDERS_ENABLED=true`. This is a compile-time Vite flag: changing the Vercel environment value alone does not change an existing deployment; it requires a new build/deployment. The flag is global, so the Orders nav may appear for other organizations, while RLS and capabilities continue to block their data/actions.
9. Run the approved-role Orders smoke. Do not convert a real customer quotation. Positive conversion smoke requires an explicitly approved controlled production fixture; otherwise test draft rejection and idempotency only in local/staging.

## Recovery / containment

- **Migration 1 succeeds, 2 fails:** keep capabilities absent/OFF and UI OFF. Stop migration execution, inspect applied history and schema read-only, then prepare a forward migration/fix. Do not reset linked DB, repair history, drop tables, or delete orders.
- **Migrations 1–2 succeed, 3 fails:** same containment. No UI build with flag true. Fix the RPC migration forward after review; do not alter migration history.
- **DB completes, frontend deployment fails:** schema is additive; leave capabilities OFF, retain the prior frontend or redeploy a corrected build with flag OFF. No schema rollback/drop.
- **Frontend is live but Orders fails:** first disable `orders`/`quotation_conversion` capabilities for the pilot; deploy a new build with the Vite flag false to hide the UI. The flag is build-time, so rollback of the UI needs a deployment.
- **RPC fails:** set `quotation_conversion=false` for pilot; keep Orders read available only if its read path is verified. Preserve quotation and order history; fix forward.
- **RLS blocks a valid actor:** disable affected capability; inspect membership and role mapping; ship a narrowly scoped forward fix. Never bypass RLS or grant broad access.
- **Urgent feature shutdown:** capability false is the immediate database gate for data/operations. Also redeploy a build with `VITE_PHASE_1A_ORDERS_ENABLED=false` to remove navigation/routes. Do not drop schema or delete records.

`migration repair`, `db reset --linked`, destructive Phase 1A DDL, and order deletion are excluded absent a separate extraordinary authorization.

## Backup recommendation

**Recommend YES: create a new full recovery point immediately before the eventual Phase 1A `db push`.** The verified recovery point is `20261017T035357Z`, pre-04B. Security 04B was applied after it, so it does not represent the current database/Storage security state. The prior point is useful history but is not a current predeployment rollback checkpoint. Do not create that backup until deployment is approved and the authorized backup procedure begins.

## E2E harness classification

Last valid full E2E remains **62/62 PASS**. The post-polish rerun did not produce an application PASS or FAIL: the Node harness invokes `supabase status -o json` in a child PowerShell whose PATH did not resolve a global `supabase` executable. This is CLI resolution/environment setup (the harness assumes the CLI is on PATH), not evidence of an app regression. Supabase CLI 2.109.1 was subsequently invoked through `npx.cmd` for the isolated dry-run. The E2E run was not falsified or relabeled; no harness rewrite or repeat was needed for deployment review.

Post-polish retained checks: Node 16/16 PASS, isolated Phase 1A ESLint PASS with zero new errors, build PASS, diff-check PASS, preview route HTTP 200 for list/detail. The prior 62/62 E2E remains the valid full run.

## Post-deployment smoke checklist

**Legacy CRM:** login; Dashboard; Prospectos; Clientes; Cotizaciones; Servicios; CMS; Documentos; Ingresos; Gastos; logout/login.

**Phase 1A:** `/admin/ordenes` and empty state for approved pilot; direct `/admin/ordenes/:id` remains tenant/RLS controlled; verify roles and capability OFF/ON; draft quotation is not convertible; confirm initial production Orders count is zero. Never create or convert a real client Order in smoke. A positive conversion test requires separate authorization and a controlled fixture.

## Risks

- UI flag is global and requires rebuild/redeployment to change; capability gates are tenant-specific.
- Deployment remains unapproved and a new current-state backup is recommended before migration execution.
- No production positive conversion is covered without an approved synthetic fixture.
- The local environment's global CLI PATH is inconsistent; use the verified CLI invocation or repair the development environment before running the browser harness. It does not affect the deployment dry-run result.
