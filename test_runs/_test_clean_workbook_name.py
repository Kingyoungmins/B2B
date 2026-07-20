# -*- coding: utf-8 -*-
# [회귀] _clean_session_workbook_name 이 스냅샷/결과 파일명의 prestep_/uuid 접두사(복리 포함)를 벗겨
# 원본 표시명을 복원하는지. 이게 깨지면 워크북을 '이름'으로 비교하는 VBA(wbIter.Name = "원본")가
# 복원 후 "파일 못 찾음"으로 터진다(lesson 35 §3). 실제 serve_b2b 함수를 추출해 검증한다(Excel 불필요).
import re, sys
from pathlib import Path

SERVE = Path(__file__).resolve().parent.parent / "serve_b2b.py"
SRC = SERVE.read_text(encoding="utf-8")
a = SRC.index("def _clean_session_workbook_name(name):")
b = SRC.index("\ndef _replace_excel_session_workbook_impl")
g = {"re": re, "Path": Path}
exec(SRC[a:b], g)
clean = g["_clean_session_workbook_name"]

CLEAN = "571601213953_한화테크윈_판교_26년06월_DSMC_260604.xlsx"
cases = [
    # (입력, 기대) — 트레이스에서 실제로 나온 오염 패턴들
    ("prestep_211c7c021c884065aeb3fe22eef13ce4_" + CLEAN, CLEAN),                                  # 1회 접두사
    ("prestep_bb338a790ebf452fbbd771daf4b5cb31_prestep_211c7c021c884065aeb3fe22eef13ce4_" + CLEAN, CLEAN),  # 복리(2중)
    ("98fa291017ca404287efe44d695d13f7_" + CLEAN, CLEAN),                                          # /api/excel/save·업로드식 uuid_
    (CLEAN, CLEAN),                                                                                  # 이미 깨끗하면 그대로
    ("결과파일.xlsx", "결과파일.xlsx"),                                                              # 접두사 없는 임의 이름 보존
    ("/tmp/dir/prestep_" + "a"*32 + "_" + CLEAN, CLEAN),                                            # 경로 포함도 basename 처리
]
fails = 0
for inp, exp in cases:
    got = clean(inp)
    if got != exp:
        fails += 1
        print("FAIL: %r -> %r (expected %r)" % (inp, got, exp))
    else:
        print(" OK : %r -> %r" % (inp[:40], got))

print("\n=== RESULT: %d/%d PASS ===" % (len(cases) - fails, len(cases)))
sys.exit(1 if fails else 0)
