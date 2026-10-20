# NOVELI 2.0 — P1-05 Payments Ledger Foundation Deployment Review

**Status:** DEPLOYED / VERIFIED — 2026-10-20
**Project:** `bdxlzhpmifxwmqjnnmxa` (`crm-noveli`)
**Production health:** `ACTIVE_HEALTHY`
**Functional commit:** `70511f490c6cbbc1c4b415ef18a316a819ddb14f` (local; not yet pushed)
**P1-06 / P1-07:** NOT STARTED

## Recovery

Immediate pre-deployment recovery: `C:\Users\xavie\Desktop\backup\pre-p1-05-production\20261020T211445Z`.

Classification: `POST_P1_04_PRE_P1_05_PRODUCTION`. Database, Auth, Storage (55/55), manifest and hashes were verified. Restore rehearsal: **NOT PERFORMED**. The checkpoint was not modified.

## Pre-deployment gates

- Production baseline passed read-only: 49 public tables / 49 with RLS; `payment_schedules` present and empty; P1-05 tables absent; Orders empty; six quotations all `borrador`; accounting counts matched the approved baseline; Phase 1A capabilities enabled.
- Remote migration history ended at P1-04 (`20261019045900`) and did not contain P1-05.
- Frozen migration SHA-256 matched `ce32ff184ec52305be8290722f9c215945defa4044c97efcd654bf40a45f34d0`. Superseded hash `7c13b31b93d02d0df1e12f873b5c95a9434cf9e79bb07831754a94598495f653` was not used.
- `supabase db push --dry-run` exited successfully and proposed exactly `20261019070000_phase_1b_p1_05_payments_ledger.sql`.
- The approved functional commit was unchanged and was the only local commit ahead of `origin/main` at deployment time.

## Deployment and production verification

The P1-05 migration `20261019070000_phase_1b_p1_05_payments_ledger.sql` is present in remote migration history. Post-deployment checks confirm:

- Project `ACTIVE_HEALTHY`; public tables / tables with RLS: **52 / 52**.
- `payments`, `payment_refunds`, and `payment_allocations` present with RLS and **0 rows** each.
- `payment_schedules`, orders and order_items remain present with **0 rows** each.
- Quotations remain **6**, all `borrador`.
- Accounting remains `incomes=4`, `income_allocations=10`, `income_distributions=0`, `expenses=13`; `incomes.payment_id` is absent.
- Catalog reports `payments.net_amount` as `numeric(18,2)`, generated stored, NOT NULL, expression `(gross_amount - provider_fee)`.
- `documents(organization_id,id)` auxiliary unique index is present; document rows remain 7, Storage buckets remain brand-assets public/19 and documents private/36.
- Five P1-05 helpers are SECURITY INVOKER with empty `search_path`; **0 SECURITY DEFINER**. Public P1-06 payment command RPCs are absent. `noveli_payments_executor` is NOLOGIN, NOINHERIT, NOBYPASSRLS; anon and service_role have no direct SELECT on the ledger tables.
- Ledger foreign keys use RESTRICT on delete and NO ACTION on update; no financial FK uses CASCADE.
- Phase 1A capabilities remain enabled. No payment, refund, allocation, schedule, order or quotation was created or changed by this deployment.

An authenticated browser smoke was not performed in this run. No production rows were inserted to exercise the new tables. The migration introduces no frontend, Vercel, capability or feature-flag changes.

## Result

**P1-05 production deployment: PASS.** Production is HEALTHY. No manual SQL, migration repair, or destructive rollback was used. The functional commit remains local pending the approved Git synchronization. P1-06 and P1-07 remain unstarted.

## Git / Vercel synchronization

The separate documentation closure commit is being prepared. The approved functional commit and documentation commit have not yet been pushed. No Vercel configuration or manual deployment was changed. Any automatic deployment created by the later Git push should be recorded in the final deployment report.
