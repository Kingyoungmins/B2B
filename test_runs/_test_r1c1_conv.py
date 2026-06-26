#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""serve_b2b._r1c1_to_a1 (실제 함수) 를 모든 R1C1 형태에 대해 검증."""
import sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import serve_b2b as s

cases = {
    "R1C1:R6C5": "A1:E6",        # 일반 사각
    "R2C2": "B2",                # 단일 셀
    "C1:C5": "A:E",              # 전체 열 다중
    "C3": "C:C",                 # 전체 열 단일
    "R1:R6": "1:6",              # 전체 행 다중
    "R3": "3:3",                 # 전체 행 단일
    "R5C3": "C5",                # 단일 셀(열>행)
    "R1C1:R1048576C5": "A1:E1048576",  # 전체열을 풀범위로 준 변형
    "C28": "AB:AB",              # 2글자 열
    "R10C27:R20C28": "AA10:AB20",
    # --- 비연속 다중영역(Ctrl-클릭) : 각 영역 개별 변환 후 콤마로 합침 ---
    "C1:C5,C8:C10": "A:E,H:J",            # 전체 열 두 묶음
    "R1:R6,R10:R12": "1:6,10:12",         # 전체 행 두 묶음
    "R1C1:R6C5,C8:C10": "A1:E6,H:J",      # 일반 + 전체열 혼합
    "R1C1:R2C2,R5C1:R6C2": "A1:B2,A5:B6", # 셀 다중영역
    "C3,C5": "C:C,E:E",                   # 단일 전체열 두 개
}
allok = True
for r1c1, want in cases.items():
    got = s._r1c1_to_a1(r1c1)
    ok = (got == want)
    allok = allok and ok
    print(("OK " if ok else "BAD"), repr(r1c1), "->", repr(got), ("" if ok else "want " + repr(want)))
print("ALL", "OK" if allok else "FAIL")
sys.exit(0 if allok else 2)
