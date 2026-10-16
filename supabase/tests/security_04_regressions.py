"""LOCAL only; preserve historical suites and their bounded compatibility adapters."""
from pathlib import Path
import ast
import sys

tests = Path(__file__).parent
tree = ast.parse((tests / 'security_03c_regressions.py').read_text(encoding='utf-8'))
# Build prior suites without executing the historical module's top-level runner.
tree.body = [node for node in tree.body if not isinstance(node, ast.For)
             and not (isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
                      and isinstance(node.value.func, ast.Name) and node.value.func.id == 'print')]
exec(compile(tree, 'security_03c_regressions.py', 'exec'))

one = replace_exact(one, "'get_org_branding')", "'get_org_branding','storage04_org','storage04_can_read','storage04_can_write','security04_asset_reference_inventory')")
two = replace_exact(two, 'count(*)=9 FROM pg_proc', 'count(*)=13 FROM pg_proc')
four = replace_exact(four, 'count(*)=9 FROM pg_proc', 'count(*)=13 FROM pg_proc')
five = replace_exact(five, 'count(*)=9 FROM pg_proc', 'count(*)=13 FROM pg_proc')
six = (tests / 'security_04_storage.sql').read_text(encoding='utf-8')
if '--prepare' in sys.argv:
    six = replace_exact(six, "public=false FROM storage.buckets WHERE id='documents'", "public=true FROM storage.buckets WHERE id='documents'")
    six = replace_exact(six, 'private/public bucket flags', 'PREPARE retains public documents; final RLS is ready')

for label, source in [('Security 01 after 04', one), ('Security 02 after 04', two),
                      ('Security 03A after 04', three), ('Security 03B after 04', four),
                      ('Security 03C after 04', five), ('Security 04 SQL', six)]:
    run(label, source)
print('SECURITY_01_02_03A_03B_03C_04_REGRESSIONS_PASSED')
