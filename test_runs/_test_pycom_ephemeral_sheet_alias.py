import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import serve_b2b as s


def check(name, cond):
    if not cond:
        raise AssertionError(name)
    print(" OK ", name)


check(
    "excel_open generated sheet name detected",
    s._is_ephemeral_excel_open_sheet_name("excel_open_deadbeefcafebabe"),
)
check(
    "excel_open generated sheet name with extension detected",
    s._is_ephemeral_excel_open_sheet_name("excel_open_deadbeefcafebabe.html"),
)
check(
    "normal sheet name is not generated",
    not s._is_ephemeral_excel_open_sheet_name("Network 이용현황(26년4월)"),
)
check(
    "stale excel_open sheet maps to only current sheet",
    s._resolve_ephemeral_excel_open_sheet_alias("excel_open_deadbeef11111111", ["500255622398_500127886611_50025"])
    == "500255622398_500127886611_50025",
)
check(
    "stale excel_open sheet does not map when ambiguous",
    s._resolve_ephemeral_excel_open_sheet_alias("excel_open_deadbeef11111111", ["A", "B"]) is None,
)

print("\n=== RESULT: PASS ===")
