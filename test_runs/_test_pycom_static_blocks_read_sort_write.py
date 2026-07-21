import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import serve_b2b as s


def check(name, cond, detail=""):
    if not cond:
        raise AssertionError(f"{name}: {detail}")
    print(" OK ", name)


bad = """
def transform(ctx):
    data = ctx.read("안전제일_추출", "A1:T100")
    header = data[:1]
    body = data[1:]
    body.sort(key=lambda r: (r[19], r[3], r[12], r[13]))
    ctx.write("안전제일_추출", "A1", header + body, overwrite_formulas=True)
"""

try:
    s._python_com_static_check(bad)
    raised = False
    message = ""
except Exception as err:
    raised = True
    message = str(err)

check("read-sort-write is blocked", raised, message)
check("block message mentions ctx.sort", "ctx.sort" in message, message)

print("\n=== RESULT: PASS ===")
