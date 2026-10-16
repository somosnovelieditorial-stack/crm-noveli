"""Run all five security suites against LOCAL Docker only.

Historical sources stay immutable. Bounded replacements adapt policy/function
counts and intentional DELETE consolidations; old policies are never replayed.
"""
from pathlib import Path
import ast
import re
import subprocess
import sys

tests = Path(__file__).parent
tree = ast.parse((tests / "security_03a_regressions.py").read_text(encoding="utf-8"))
definitions = ast.Module(body=[node for node in tree.body if isinstance(node, ast.FunctionDef)], type_ignores=[])
exec(compile(definitions, "security_03a_regressions.py", "exec"))


def run(label, source):
    result = subprocess.run(
        ["docker", "exec", "-i", "supabase_db_CRM_NOVELI", "psql", "-U", "postgres",
         "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"],
        input=source.encode("utf-8"), capture_output=True,
    )
    output = (result.stdout + result.stderr).decode("utf-8", errors="replace")
    print(f"{label}: exit={result.returncode}, PASS assertions={len(re.findall('PASS:', output))}")
    if result.returncode or "ALL_CHECKS_PASSED_AND_ROLLED_BACK" not in output:
        print(output)
        sys.exit(result.returncode or 1)


one = phase01()
one = replace_exact(one, "p.proname <> 'is_org_writer'", "p.proname NOT IN ('is_org_writer','security03b_preserve_tenant','is_org_finance','get_org_branding')")
one = replace_exact(one, "count(*) = 158", "count(*) = 180")
one = replace_exact(one, "158 consolidated permissive policies", "180 consolidated permissive policies")
one = replace_exact(one, "policyname='Payroll org access'", "policyname='security03c_select'")
one = replace_exact(one, "count(*)=5 FROM pg_policies", "count(*)=4 FROM pg_policies")
one = replace_exact(one, "only exact payroll duplicate removed", "payroll duplicate stays removed; four consolidated finance policies")
two = phase02()
two = replace_exact(two, "count(*)=284", "count(*)=306")
two = replace_exact(two, "284 policies", "306 policies")
two = replace_exact(two, "count(*)=6 FROM pg_proc", "count(*)=9 FROM pg_proc")
two = replace_exact(two, "six public functions", "nine public functions after finance/branding")
two = replace_exact(two, "t NOT IN ('website_settings'", "t NOT IN ('clients','website_settings'")
three = (tests / "security_03a_rls_web.sql").read_text(encoding="utf-8")
three = replace_exact(three, "count(*)=284", "count(*)=306")
three = replace_exact(three, "284 total policies", "306 total policies")
four = (tests / "security_03b_rls_crm_editorial.sql").read_text(encoding="utf-8")
four = replace_exact(four, "count(*)=291", "count(*)=306")
four = replace_exact(four, "291 policies", "306 policies")
four = replace_exact(four, "count(*)=7 FROM pg_proc", "count(*)=9 FROM pg_proc")
four = replace_exact(four, "six helpers plus trigger function", "nine functions after finance/branding")
five = (tests / "security_03c_finance_sensitive.sql").read_text(encoding="utf-8")
for label, source in [("Security 01 after 03C", one), ("Security 02 after 03C", two),
                      ("Security 03A after 03C", three), ("Security 03B after 03C", four),
                      ("Security 03C", five)]:
    run(label, source)
print("SECURITY_01_02_03A_03B_03C_REGRESSIONS_PASSED")
