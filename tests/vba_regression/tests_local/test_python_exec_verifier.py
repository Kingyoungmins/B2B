#!/usr/bin/env python3
"""python_exec_verifier 단위 테스트 — Qwen/Anthropic 없이 Mac 로컬에서 동작.

손으로 쓴 transform(ctx) 스니펫으로 각 assert 종류(숨김열/행, 병합/해제, 수식보존,
값기입, 시트추가, 불변, expect_raises, 샌드박스 import 차단)를 검증한다.

실행: python tests/vba_regression/tests_local/test_python_exec_verifier.py
"""

from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PKG = HERE.parent  # tests/vba_regression
sys.path.insert(0, str(PKG))

import python_exec_verifier as V  # noqa: E402

PASS = 0
FAIL = 0


def check(name: str, cond: bool, extra: str = ""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        print(f"  ✗ {name}  {extra}")


def run(code: str, assert_spec: dict, case_assert: dict | None = None) -> dict:
    case = {"id": "t", "assert": case_assert or {}}
    variant = {"id": "v", "assert": assert_spec}
    return V.verify(code, case, variant)


# 1) 값 기입(건수 합계 31139, 금액 합계 3797128000)
def test_value_write():
    code = """
def transform(ctx):
    rows = ctx.rows(ctx.input("매출").sheet("매출"))
    ws = ctx.sheet("월별실적")
    ws.Range("B4").Value = sum(r[2] for r in rows[1:] if isinstance(r[2],(int,float)))
    ws.Range("C4").Value = sum(r[3] for r in rows[1:] if isinstance(r[3],(int,float)))
"""
    r = run(code, {"expect_cells": {
        "월별실적!B4": {"value": 31139},
        "월별실적!C4": {"value": 3797128000},
    }})
    check("value_write ran", r["ran"], str(r.get("error")))
    check("value_write matches", r["matches_expected"] is True, str(r.get("asserts")))


# 2) 숨김 열 — openpyxl column_dimensions.hidden, 데이터 불변
def test_hidden_cols():
    code = """
def transform(ctx):
    ws = ctx.input("매출").sheet("매출")
    for col in ("B","C","D"):
        ws.column_dimensions[col].hidden = True
"""
    # 입력 워크북에 숨김을 걸어도 검증은 출력 기준이므로, 출력 시트에 적용하는 케이스로 변경.
    code_out = """
def transform(ctx):
    ws = ctx.sheet("회사별요약")
    for col in ("B","C","D"):
        ws.column_dimensions[col].hidden = True
"""
    r = run(code_out, {"assert_sheet": "회사별요약", "expect_hidden_cols": ["B", "C", "D"]})
    check("hidden_cols ran", r["ran"], str(r.get("error")))
    check("hidden_cols matches", r["matches_expected"] is True, str(r.get("asserts")))


# 3) 숨김 행
def test_hidden_rows():
    code = """
def transform(ctx):
    ws = ctx.sheet("회사별요약")
    ws.row_dimensions[4].hidden = True
    ws.row_dimensions[5].hidden = True
"""
    r = run(code, {"assert_sheet": "회사별요약", "expect_hidden_rows": [4, 5]})
    check("hidden_rows ran", r["ran"], str(r.get("error")))
    check("hidden_rows matches", r["matches_expected"] is True, str(r.get("asserts")))


# 4) 수식 보존 — D4 가 여전히 '=B4-C4' 문자열인지(덮어쓰지 않음)
def test_formula_preserved():
    code = """
def transform(ctx):
    ws = ctx.sheet("회사별요약")
    ws.Range("B4").Value = 1000  # 입력 셀만 채움
"""
    r = run(code, {"expect_formula_preserved": ["회사별요약!D4", "회사별요약!E4"]})
    check("formula_preserved ran", r["ran"], str(r.get("error")))
    check("formula_preserved matches", r["matches_expected"] is True, str(r.get("asserts")))


# 5) 수식 보존 위반 탐지 — D4 를 값으로 덮으면 실패해야 함
def test_formula_overwrite_detected():
    code = """
def transform(ctx):
    ws = ctx.sheet("회사별요약")
    ws.Range("D4").Value = 0  # 수식 셀을 값으로 덮어씀(나쁨)
"""
    r = run(code, {"expect_formula_preserved": ["회사별요약!D4"]})
    check("formula_overwrite detected as fail", r["matches_expected"] is False, str(r.get("asserts")))


# 6) 병합 보존 / 해제
def test_merge():
    keep = """
def transform(ctx):
    ws = ctx.sheet("회사별요약")
    ws.Range("A1").Value = "2026년 4월 청구 요약"  # 병합은 유지한 채 텍스트만
"""
    r1 = run(keep, {"assert_sheet": "회사별요약", "expect_merged": ["A1:E1"]})
    check("merge kept", r1["matches_expected"] is True, str(r1.get("asserts")))

    unmerge = """
def transform(ctx):
    ws = ctx.sheet("회사별요약")
    ws.unmerge_cells("A1:E1")
"""
    r2 = run(unmerge, {"assert_sheet": "회사별요약", "expect_unmerged": ["A1:E1"]})
    check("merge removed", r2["matches_expected"] is True, str(r2.get("asserts")))


# 7) 시트 추가
def test_sheet_added():
    code = """
def transform(ctx):
    dest = ctx.add_sheet("완료건")
    dest.Range("A1").Value = "회사명"
"""
    r = run(code, {"expect_sheet_added": "완료건"})
    check("sheet_added ran", r["ran"], str(r.get("error")))
    check("sheet_added matches", r["matches_expected"] is True, str(r.get("asserts")))


# 8) 불변(expect_no_change_to) — 손대지 않은 셀
def test_no_change():
    code = """
def transform(ctx):
    ctx.sheet("회사별요약").Range("B4").Value = 123
"""
    # D4 수식은 건드리지 않았으니 불변이어야 함
    r = run(code, {"expect_no_change_to": ["회사별요약!D4"]})
    check("no_change ran", r["ran"], str(r.get("error")))
    check("no_change matches", r["matches_expected"] is True, str(r.get("asserts")))


# 9) expect_raises — 대상 없으면 raise 해야 통과
def test_expect_raises():
    code = """
def transform(ctx):
    raise RuntimeError("대상을 찾지 못함")
"""
    r = run(code, {"expect_raises": True})
    check("expect_raises ok", r["ok"] is True, str(r.get("asserts")))

    code_noraise = """
def transform(ctx):
    pass
"""
    r2 = run(code_noraise, {"expect_raises": True})
    check("expect_raises fails when no raise", r2["ok"] is False, str(r2.get("asserts")))


# 10) 샌드박스 — 금지 import 는 실행 자체가 ImportError
def test_sandbox_blocks_import():
    code = """
import os
def transform(ctx):
    os.system("echo hi")
"""
    r = run(code, {"expect_cells": {"회사별요약!A1": {"text": "x"}}})
    check("sandbox blocks os import", (not r["ran"]) and ("import" in (r.get("error") or "").lower()),
          str(r.get("error")))


# 11) assert 없으면 실행만 성공으로 ok=True
def test_no_assert_runs():
    code = """
def transform(ctx):
    ctx.sheet("회사별요약").Range("B4").Value = 1
"""
    r = run(code, {})
    check("no-assert ok when runs", r["ok"] is True and r["has_asserts"] is False, str(r))


if __name__ == "__main__":
    if not V._OPENPYXL_OK:
        print("openpyxl 미설치 — 테스트 skip")
        sys.exit(0)
    for fn in [
        test_value_write, test_hidden_cols, test_hidden_rows, test_formula_preserved,
        test_formula_overwrite_detected, test_merge, test_sheet_added, test_no_change,
        test_expect_raises, test_sandbox_blocks_import, test_no_assert_runs,
    ]:
        print(f"\n[{fn.__name__}]")
        fn()
    print(f"\n=== {PASS} passed / {FAIL} failed ===")
    sys.exit(1 if FAIL else 0)
