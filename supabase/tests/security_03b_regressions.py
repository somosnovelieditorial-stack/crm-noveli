"""Local-only regressions. Historical suites remain unchanged.

Reuse 03A's bounded adapters without executing its module-level runner, then
adapt only 03B's counts, trigger-function inventory and admin-only client DELETE.
No historical migration/policy replay can undo the schema under test.
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
one = replace_exact(one, "p.proname <> 'is_org_writer'", "p.proname NOT IN ('is_org_writer','security03b_preserve_tenant')")
one = replace_exact(one, "count(*) = 158", "count(*) = 165")
one = replace_exact(one, "158 consolidated permissive policies", "165 consolidated permissive policies")
two = phase02()
two = replace_exact(two, "count(*)=284", "count(*)=291")
two = replace_exact(two, "284 policies", "291 policies")
two = replace_exact(two, "count(*)=6 FROM pg_proc", "count(*)=7 FROM pg_proc")
two = replace_exact(two, "six public functions", "six public functions plus tenant trigger function")
two = replace_exact(two, "t NOT IN ('website_settings'", "t NOT IN ('clients','website_settings'")
three = (tests / "security_03a_rls_web.sql").read_text(encoding="utf-8")
three = replace_exact(three, "count(*)=284", "count(*)=291")
three = replace_exact(three, "284 total policies", "291 total policies")
four = (tests / "security_03b_rls_crm_editorial.sql").read_text(encoding="utf-8")
for label, source in [("Security 01 after 03B", one), ("Security 02 after 03B", two),
                      ("Security 03A after 03B", three), ("Security 03B", four)]:
    run(label, source)
print("SECURITY_01_02_03A_03B_REGRESSIONS_PASSED")
