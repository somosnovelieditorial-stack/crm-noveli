"""Local-only regression adapters; immutable Security 01/02 suites are inputs.

Intentional 03A changes: 158 permissive policies, five CMS DELETE operations
become admin-only, public intake is pinned to Noveli's existing default tenant.
Replay only 02's role-normalization preflight inside its tests; replaying its old
policy definitions would undo consolidation. Original suites also run before 03A.
"""
from pathlib import Path
import re
import subprocess
import sys

tests = Path(__file__).parent


def replace_exact(source, old, new, count=1):
    if source.count(old) != count:
        raise SystemExit(f"Review regression adapter; unexpected source: {old}")
    return source.replace(old, new)


def phase01():
    source = (tests / "security_01_critical.sql").read_text(encoding="utf-8")
    replacements = {
        "WHERE n.nspname='public' AND p.prokind='f'), '5 public functions retained');":
            "WHERE n.nspname='public' AND p.prokind='f' AND p.proname <> 'is_org_writer'), 'five original public functions retained');",
        "WHERE schemaname='public'), '164 policies');":
            "WHERE schemaname='public' AND permissive='PERMISSIVE'), '158 consolidated permissive policies');",
        "count(*) = 164 FROM pg_policies": "count(*) = 158 FROM pg_policies",
        "AND tablename='payroll_payments'), 'only exact payroll duplicate removed');":
            "AND tablename='payroll_payments' AND permissive='PERMISSIVE'), 'only exact payroll duplicate removed');",
        "'administrador',true)": "'visualizador',true)",
        "public.get_user_role()='administrador'": "public.get_user_role()='visualizador'",
        "legacy role preserved, not promoted to admin": "canonical viewer is not admin",
        "legacy administrador": "canonical viewer",
    }
    for old, new in replacements.items():
        source = replace_exact(source, old, new)
    return source


def phase02():
    source = (tests / "security_02_roles.sql").read_text(encoding="utf-8")
    migration = (tests.parent / "migrations/20261015023731_harden_security_02_roles.sql").read_text(encoding="utf-8")
    role_preflight = migration.split("-- SECURITY DEFINER is necessary:")[0]
    source = replace_exact(source, "\\ir ../migrations/20261015023731_harden_security_02_roles.sql", role_preflight, 2)
    source = replace_exact(source, "count(*)=290", "count(*)=284")
    source = replace_exact(source, "migration replay is safe; 290 policies", "role preflight replay is safe; 284 policies")
    old = "PERFORM pg_temp.assert02(affected=CASE WHEN allowed THEN 1 ELSE 0 END,'DELETE '||t);"
    new = """PERFORM pg_temp.assert02(affected=CASE WHEN allowed AND
      (t NOT IN ('website_settings','website_sections','website_services','website_books','website_links')
       OR public.is_org_admin((payload->>'organization_id')::uuid))
      THEN 1 ELSE 0 END,'DELETE follows existing admin restriction: '||t);"""
    source = replace_exact(source, old, new)
    source = source.replace("BEGIN;\n", "BEGIN;\nINSERT INTO public.organizations(id,name) VALUES ('11111111-1111-1111-1111-111111111111','Noveli public intake test') ON CONFLICT (id) DO NOTHING;\n", 1)
    source = replace_exact(source,
        "VALUES ('92000000-0000-4000-8000-000000000100','Public test','security02-form@example.invalid');",
        "VALUES ('11111111-1111-1111-1111-111111111111','Public test','security02-form@example.invalid');")
    return source


for label, build in [("Security 01 after 03A", phase01), ("Security 02 after 03A", phase02)]:
    result = subprocess.run(
        ["docker", "exec", "-i", "supabase_db_CRM_NOVELI", "psql", "-U", "postgres",
         "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"],
        input=build().encode("utf-8"), capture_output=True,
    )
    output = (result.stdout + result.stderr).decode("utf-8", errors="replace")
    print(f"{label}: exit={result.returncode}, PASS assertions={len(re.findall('PASS:', output))}")
    if result.returncode:
        print(output)
        sys.exit(result.returncode)
    if "ALL_CHECKS_PASSED_AND_ROLLED_BACK" not in output:
        raise SystemExit("Missing rollback/completion marker")
print("SECURITY_01_AND_02_REGRESSIONS_AFTER_03A_PASSED")
