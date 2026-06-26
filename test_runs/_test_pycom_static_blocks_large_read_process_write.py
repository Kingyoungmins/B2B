import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import serve_b2b as s


def check(name, cond, detail=""):
    if not cond:
        raise AssertionError(f"{name}: {detail}")
    print(" OK ", name)


def blocked(code):
    try:
        s._python_com_static_check(code)
        return False, ""
    except Exception as err:
        return True, str(err)


bad_large_read_write = """
def transform(ctx):
    data = ctx.read("Sheet1", "A1:U300000")
    out = []
    for row in data:
        out.append(row)
    ctx.write("Result", "A1", out)
"""

raised, msg = blocked(bad_large_read_write)
check("large read/process/write is blocked", raised, msg)
check("large block points to native helpers", "ctx.copy" in msg and "ctx.sort" in msg, msg)


bad_dynamic_read_copy = """
def transform(ctx):
    b = ctx.book("source.xlsx")
    last_row = b.last_row("sheet", col=1)
    last_col = b.last_col("sheet", row=1)
    rng = f"A1:U{last_row}"
    data = b.read("sheet", rng)
    best = 0
    for row in data:
        best = max(best, sum(1 for v in row if v))
    ctx.copy("source.xlsx!sheet", f"A1:U{last_row}", "통합", "A1")
"""

raised, msg = blocked(bad_dynamic_read_copy)
check("dynamic full-table read before copy is blocked", raised, msg)
check("dynamic block mentions append helper", "append_same_format_sheets" in msg, msg)


good_small_range_arithmetic = """
def transform(ctx):
    rows = ctx.read("2026년", "E6:E16")
    out = []
    for row in rows:
        v = row[0]
        out.append([v / 1000000 if isinstance(v, (int, float)) else ""])
    ctx.write("2026년", "D6", out, overwrite_formulas=True)
"""

raised, msg = blocked(good_small_range_arithmetic)
check("small read/process/write remains allowed", not raised, msg)


good_native_append_helper = """
def transform(ctx):
    ctx.book("output.xlsx").append_same_format_sheets([
        "a.xlsx",
        "b.xlsx",
    ], dest_sheet="통합", src_sheet="sheet")
"""

raised, msg = blocked(good_native_append_helper)
check("native append helper remains allowed", not raised, msg)

print("\\n=== RESULT: PASS ===")
