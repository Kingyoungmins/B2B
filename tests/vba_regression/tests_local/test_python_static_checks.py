#!/usr/bin/env python3
"""python_static_checks 단위 테스트 — 네트워크 불필요.

실행: python tests/vba_regression/tests_local/test_python_static_checks.py
"""

from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PKG = HERE.parent
sys.path.insert(0, str(PKG))

import python_static_checks as P  # noqa: E402

PASS = 0
FAIL = 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        print(f"  ✗ {name}  {extra}")


def core(code, intent=""):
    return P.validate_core_python(code, intent_text=intent)


# 1) 정상 openpyxl 코드 → PASS
def test_good():
    code = """
def transform(ctx):
    ws = ctx.sheet("회사별요약")
    ws.column_dimensions['B'].hidden = True
"""
    r = core(code)
    check("good passes", r.status == "PASS", f"{r.status} {r.failures}")


# 2) 진입점 누락 → FAIL
def test_no_entrypoint():
    r = core("def helper(x):\n    return x\n")
    check("missing transform fails", r.status == "FAIL" and any("transform" in f for f in r.failures), str(r.failures))


# 3) 금지 import → FAIL
def test_forbidden_import():
    code = "import os\ndef transform(ctx):\n    pass\n"
    r = core(code)
    check("os import fails", r.status == "FAIL" and any("os" in f for f in r.failures), str(r.failures))


# 4) COM 전용 .Copy() → FAIL
def test_com_copy():
    code = """
def transform(ctx):
    ws = ctx.sheet("회사별요약")
    ws.Range("A1:E1").Copy(ws.Range("G1:K1"))
"""
    r = core(code)
    check("COM .Copy() fails", r.status == "FAIL" and any("Copy" in f for f in r.failures), str(r.failures))


# 5) 전체 시트 순회(의도 없음) → FAIL
def test_all_sheets():
    code = """
def transform(ctx):
    for ws in ctx.workbook.worksheets:
        ws.column_dimensions['A'].hidden = True
"""
    r = core(code, intent="매출 시트만 숨겨줘")
    check("all-sheet loop fails", r.status == "FAIL" and any("순회" in f for f in r.failures), str(r.failures))


# 6) 전체 시트 순회(의도 있음) → 통과
def test_all_sheets_intended():
    code = """
def transform(ctx):
    for ws in ctx.workbook.worksheets:
        ws.column_dimensions['A'].hidden = True
"""
    r = core(code, intent="모든 시트에서 A열을 숨겨줘")
    check("all-sheet loop ok when intended", not any("순회" in f for f in r.failures), str(r.failures))


# 7) eval/exec 금지
def test_eval_exec():
    code = "def transform(ctx):\n    eval('1+1')\n"
    r = core(code)
    check("eval blocked", r.status == "FAIL", str(r.failures))


# 8) risk_rule hide_not_delete — 숨김 정답/오답
def test_rule_hide():
    good = """
def transform(ctx):
    ctx.sheet("매출").column_dimensions['B'].hidden = True
"""
    res = P.CheckResult()
    P.apply_risk_rule("hide_not_delete", good, res)
    check("hide rule passes good", res.status == "PASS", str(res.failures))

    bad = """
def transform(ctx):
    ctx.sheet("매출").delete_cols(2, 3)
"""
    res2 = P.CheckResult()
    P.apply_risk_rule("hide_not_delete", bad, res2)
    check("hide rule fails delete", res2.status == "FAIL", str(res2.failures))


# 9) risk_rule entire_row_insert — openpyxl insert vs COM
def test_rule_insert():
    good = "def transform(ctx):\n    ctx.sheet('회사별요약').insert_rows(4)\n"
    res = P.CheckResult()
    P.apply_risk_rule("entire_row_insert", good, res)
    check("insert rule passes insert_rows", "insert_rows" in " ".join(res.passed), str(res.passed))

    bad = "def transform(ctx):\n    ws=ctx.sheet('s')\n    ws.Range('A4').EntireRow.Insert()\n"
    res2 = P.CheckResult()
    P.apply_risk_rule("entire_row_insert", bad, res2)
    check("insert rule fails EntireRow.Insert", res2.status == "FAIL", str(res2.failures))


# 10) run_expectation_checks 통합 — must_match / must_not_match
def test_expectation_integration():
    code = """
def transform(ctx):
    ctx.sheet("매출").column_dimensions['B'].hidden = True
"""
    case = {"id": "c", "title": "숨김"}
    variant = {
        "id": "v", "prompt": "B열 숨겨줘",
        "checks": {
            "risk_rules": ["hide_not_delete", "single_sheet_scope"],
            "must_match": [r"column_dimensions\['B'\]\.hidden\s*=\s*True"],
            "must_not_match": [r"\.delete_cols"],
        },
    }
    r = P.run_expectation_checks(code, case, variant)
    check("integration passes", r.status in ("PASS", "NEEDS_WINDOWS"), f"{r.status} {r.failures}")
    check("integration matched required", any("Required pattern matched" in p for p in r.passed), str(r.passed))


if __name__ == "__main__":
    for fn in [
        test_good, test_no_entrypoint, test_forbidden_import, test_com_copy,
        test_all_sheets, test_all_sheets_intended, test_eval_exec, test_rule_hide,
        test_rule_insert, test_expectation_integration,
    ]:
        print(f"\n[{fn.__name__}]")
        fn()
    print(f"\n=== {PASS} passed / {FAIL} failed ===")
    sys.exit(1 if FAIL else 0)
