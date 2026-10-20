"""Run unchanged Security 01-04 suites scoped to their legacy catalog.
Only catalog counts exclude Phase1A names; authorization assertions are unchanged.
"""
from pathlib import Path
import ast
import subprocess
import json
import re

tests = Path(__file__).parent
ns = {"__file__": str(tests / "security_04_regressions.py")}
tree = ast.parse((tests / "security_04_regressions.py").read_text(encoding="utf-8"))
tree.body = [n for n in tree.body if not isinstance(n, ast.For) and not (
 isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Name) and n.value.func.id=="print")]
exec(compile(tree,str(tests/"security_04_regressions.py"),"exec"),ns)
prefix = """
CREATE TEMP VIEW phase1a_legacy_policies AS SELECT * FROM pg_catalog.pg_policies WHERE policyname NOT LIKE 'phase1a_%' AND policyname NOT LIKE 'p1b_%';
CREATE TEMP VIEW phase1a_legacy_proc AS SELECT * FROM pg_catalog.pg_proc WHERE proname NOT LIKE 'phase1a_%' AND proname NOT LIKE 'phase1b_%' AND proname NOT LIKE 'p1b_%' AND proname NOT IN('payment_schedule_guard','save_payment_schedule_draft','publish_payment_schedule_plan');
CREATE TEMP VIEW phase1a_legacy_class AS SELECT * FROM pg_catalog.pg_class WHERE relname NOT IN('orders','order_items','payment_schedules','payments','payment_refunds','payment_allocations');
CREATE TEMP VIEW phase1a_legacy_tables AS SELECT * FROM pg_catalog.pg_tables WHERE tablename NOT IN('orders','order_items','payment_schedules','payments','payment_refunds','payment_allocations');
CREATE TEMP VIEW phase1a_legacy_information_tables AS SELECT * FROM information_schema.tables WHERE table_name NOT IN('orders','order_items','payment_schedules','payments','payment_refunds','payment_allocations');
CREATE TEMP VIEW phase1a_legacy_information_columns AS SELECT * FROM information_schema.columns WHERE table_name NOT IN('orders','order_items','payment_schedules','payments','payment_refunds','payment_allocations');
GRANT SELECT ON pg_temp.phase1a_legacy_policies,pg_temp.phase1a_legacy_proc,pg_temp.phase1a_legacy_class,pg_temp.phase1a_legacy_tables,pg_temp.phase1a_legacy_information_tables TO authenticated,anon;
GRANT SELECT ON pg_temp.phase1a_legacy_information_columns TO authenticated,anon;
"""
results=[]
for label,key in [("Security01","one"),("Security02","two"),("Security03A","three"),("Security03B","four"),("Security03C","five"),("Security04","six")]:
    source=ns[key]
    for old,new in [("pg_policies","pg_temp.phase1a_legacy_policies"),("pg_proc","pg_temp.phase1a_legacy_proc"),("pg_class","pg_temp.phase1a_legacy_class"),("pg_tables","pg_temp.phase1a_legacy_tables"),("information_schema.tables","pg_temp.phase1a_legacy_information_tables"),("information_schema.columns","pg_temp.phase1a_legacy_information_columns")]:
        source=re.sub(r"(?<![\w.])"+re.escape(old)+r"\b",new,source)
    r=subprocess.run(["docker","exec","-i","supabase_db_CRM_NOVELI","psql","-X","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-qAt"],input=(prefix+source).encode(),capture_output=True)
    output=(r.stdout+r.stderr).decode(errors="replace")
    result={"suite":label,"exit_code":r.returncode,"pass_assertions":output.count("PASS:")}
    results.append(result)
    print(result,flush=True)
    if r.returncode or "ALL_CHECKS_PASSED_AND_ROLLED_BACK" not in output:
        print(output);raise SystemExit(1)
(tests.parents[1]/"docs/noveli-2/phase-1/phase-1a-security-results.json").write_text(json.dumps(results,indent=2),encoding="utf-8")
print("SECURITY01_04_UNCHANGED_BEHAVIOR_PASS")
