# -*- coding: utf-8 -*-
# [실측][SBAGENT-151] 무한루프 방어 2겹 — 정적 게이트(while True 금지) + 런타임 트레이서 데드라인.
# Excel 불필요(루프는 ctx 를 건드리기 전에 트레이서가 끊는다). 재현 스킬(무한 루프.zip)의
# 저장 스텝들이 정적 게이트를 통과하는지(오탐 없음)도 함께 확인한다.
import io
import json
import sys
import time
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.1")
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import serve_b2b as S

fails = 0
def ck(n, c, g=None):
    global fails
    print((" OK  " if c else "FAIL ") + n + ("" if c else " got=" + repr(g)))
    if not c: fails += 1

# (1) 정적 게이트: while True 금지
try:
    S._python_com_static_check("def transform(ctx):\n    while True:\n        pass\n")
    ck("(1) while True 정적 거부", False, "no raise")
except S.PythonComSkillError as e:
    ck("(1) while True 정적 거부", "무한 루프" in str(e), str(e))

# (2) 런타임 트레이서: 정적 게이트를 통과하는 폭주 루프를 데드라인이 끊는다
code = "def transform(ctx):\n    i = 0\n    while i < 10**15:\n        i += 1\n"
t0 = time.monotonic()
try:
    S._exec_python_com_skill(None, None, None, code, timeout_s=2)
    ck("(2) 폭주 루프 데드라인 차단", False, "no raise")
except S.PythonComSkillError as e:
    took = time.monotonic() - t0
    ck("(2) 폭주 루프 데드라인 차단", ("시간" in str(e) or "초과" in str(e)) and took < 30, f"{e} ({took:.1f}s)")
except Exception as e:
    ck("(2) 폭주 루프 데드라인 차단", False, repr(e))

# (3) 재현 스킬(무한 루프.zip)의 Python 스텝들은 정적 게이트를 통과(오탐 없음)
repro = json.load(open(r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.1\test_data\issue_repro\sbagent151_infinite_loop.logic.json", encoding="utf-8"))
py_steps = [s for s in repro["pipeline"] if str(s.get("language", "")).lower() == "python"]
ok = True
for s in py_steps:
    try:
        S._python_com_static_check(s["code"])
    except Exception as e:
        ok = False
        print("   정적 오탐:", str(e)[:80])
ck(f"(3) 재현 스킬 Python 스텝 {len(py_steps)}개 정적 통과(오탐 0)", ok)

print()
print("=== RESULT: " + ("ALL PASS" if fails == 0 else f"{fails} FAIL") + " ===")
sys.exit(1 if fails else 0)
