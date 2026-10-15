"""Replay Security 01 behavioral checks against Security 02, local Docker only.

The original SQL file is immutable. Its phase-specific assertions (five total
functions, 164 total policies and legacy role fixture) are not valid after 02.
Adapt only those expectations in memory; retain every behavioral access check.
Run the original unmodified SQL separately against schema 01 as well.
"""
from pathlib import Path
import subprocess
import sys

source = Path(__file__).with_name("security_01_critical.sql").read_text(encoding="utf-8")
replacements = {
    "WHERE n.nspname='public' AND p.prokind='f'), '5 public functions retained');":
        "WHERE n.nspname='public' AND p.prokind='f' AND p.proname <> 'is_org_writer'), 'five original public functions retained');",
    "WHERE schemaname='public'), '164 policies');":
        "WHERE schemaname='public' AND permissive='PERMISSIVE'), '164 original permissive policies retained');",
    "AND tablename='payroll_payments'), 'only exact payroll duplicate removed');":
        "AND tablename='payroll_payments' AND permissive='PERMISSIVE'), 'only exact payroll duplicate removed');",
    "'administrador',true)": "'visualizador',true)",
    "public.get_user_role()='administrador'": "public.get_user_role()='visualizador'",
    "legacy role preserved, not promoted to admin": "canonical viewer is not admin",
    "legacy administrador": "canonical viewer",
}
for old, new in replacements.items():
    if source.count(old) != 1:
        raise SystemExit(f"Unexpected Security 01 source; review adapter: {old}")
    source = source.replace(old, new)

result = subprocess.run(
    ["docker", "exec", "-i", "supabase_db_CRM_NOVELI", "psql", "-U", "postgres",
     "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"],
    input=source.encode("utf-8"),
)
sys.exit(result.returncode)
