# -*- coding: utf-8 -*-
"""[사용자 지시 2026-08-12] Python 정적 검사에서 '품질·라우팅' 규칙만 걷어냈다.

무엇을 걷어냈나 — 전부 '돌기는 도는데 더 나은 방법이 있다'는 규칙들이다.
  · 다중 토큰 매칭/합산 → "VBA로 작성하세요"
  · sorted / list.sort → "ctx.sort 를 쓰세요"
  · re.findall 소수점 쪼개기 차단
  · 큰 표를 ctx.read 로 올려 가공 → 차단
  · 루프 안에서 ctx 쓰기 반복 → 차단
잘 도는 코드까지 막아 재생성 루프를 돌렸다. 느릴 수는 있어도 사용자가 감수한다는 결정.

무엇을 남겼나 — 이건 '더 나은 방법'이 아니라 '하면 안 되는 것'이다.
  · 샌드박스: import, os/sys/win32com/openpyxl, open/eval/exec/getattr/__import__ …
  · COM 안정성: Select/Activate/ActiveWorkbook/ActiveSheet/Application/Quit
  · while True, ws["A1"] 관용구, 진입 함수 확인

이 테스트가 잠그는 것
  1. 걷어낸 규칙에 걸리던 코드가 이제 통과한다
  2. 남긴 규칙은 그대로 막는다  ← 여기가 뚫리면 생성 코드가 파일시스템을 만진다
  3. 되살리는 스위치(B2B_PY_QUALITY_GATE=1)가 살아 있다
"""
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = (ROOT / "serve_b2b.py").read_text(encoding="utf-8-sig")
CHAT = (ROOT / "scripts" / "chat-ui.js").read_text(encoding="utf-8-sig")

# 게이트 함수만 떼어 실행한다(서버 전체 임포트 회피).
_i = SRC.index("def _python_com_static_check(")
_j = SRC.index("\ndef ", _i + 10)
_ns = {"re": re, "os": os, "PY_SKILL_ENTRY": "transform"}


class PythonComSkillError(Exception):
    pass


_ns["PythonComSkillError"] = PythonComSkillError
exec(SRC[_i:_j], _ns)
check_code = _ns["_python_com_static_check"]

fails = 0


def check(name, cond, detail=None):
    global fails
    if cond:
        print("  PASS  " + name)
    else:
        fails += 1
        print("  FAIL  " + name + ("  → " + str(detail)[:200] if detail is not None else ""))


def blocked(code):
    """막히면 사유 문자열, 통과하면 None."""
    try:
        check_code(code)
        return None
    except PythonComSkillError as err:
        return str(err)


def wrap(body):
    return "def transform(ctx):\n" + "\n".join("    " + l for l in body.strip().split("\n")) + "\n"


print("[1] 걷어낸 규칙 — 이제 통과해야 한다")

check("루프 안에서 ctx.write 반복", blocked(wrap('''
for i in range(2, 50):
    ctx.write("Sheet1", i, 1, [[i]])
''')) is None, blocked(wrap('for i in range(2, 50):\n    ctx.write("Sheet1", i, 1, [[i]])')))

check("ctx.read → sorted → ctx.write", blocked(wrap('''
rows = ctx.read("Sheet1", "A1:C100")
rows = sorted(rows, key=lambda r: r[0])
ctx.write("Sheet1", 1, 1, rows)
''')) is None)

check("전체 열을 ctx.read 로 올려 가공", blocked(wrap('''
rows = ctx.read("Sheet1", "A:Z")
out = [r for r in rows if r[0]]
ctx.write("결과", 1, 1, out)
''')) is None)

check("다중 토큰 매칭/합산/쓰기", blocked(wrap('''
src = ctx.book("정산.xlsx")
rows = src.read("Sheet1", "A1:BQ100")
total = 0
for r in rows:
    for token in str(r[0]).split(","):
        if token.strip():
            total += 1
ctx.write("Sheet1", 1, 1, [[total]])
''')) is None)

check("re.findall 숫자 + 콤마 join", blocked(wrap('''
vals = re.findall(r"\\d+", "20.0 30.5")
ctx.write("Sheet1", 1, 1, [[", ".join(vals)]])
''')) is None)

print("[2] 남긴 규칙 — 그대로 막아야 한다  ← 뚫리면 생성 코드가 OS/파일을 만진다")

for name, body, must in [
    ("import 금지", "import os\nctx.write('S', 1, 1, [[1]])", "import"),
    ("from import 금지", "from os import remove\nctx.write('S', 1, 1, [[1]])", "import"),
    ("open() 금지", "f = open('C:/x.txt', 'w')", "open"),
    ("eval() 금지", "eval('1+1')", "eval"),
    ("exec() 금지", "exec('x=1')", "exec"),
    ("__import__ 금지", "__import__('os')", "__import__"),
    ("getattr 금지", "getattr(ctx, 'write')", "getattr"),
    ("os 모듈 접근 금지", "os.remove('x')", "os"),
    ("sys 모듈 접근 금지", "sys.exit()", "sys"),
    ("win32com 접근 금지", "win32com.client.Dispatch('Excel.Application')", "win32com"),
    ("openpyxl 접근 금지", "openpyxl.load_workbook('x.xlsx')", "openpyxl"),
    ("ActiveWorkbook 금지", "ctx.ActiveWorkbook()", "ActiveWorkbook"),
    ("Select 금지", "ctx.Select()", "Select"),
    ("Application 금지", "ctx.Application()", "Application"),
    ("Quit 금지", "ctx.Quit()", "Quit"),
    ("while True 금지", "while True:\n    pass", "while True"),
    ('ws["A1"] 관용구 금지', 'ws["A1"] = 1', "openpyxl"),
]:
    reason = blocked(wrap(body))
    check(name, reason is not None and must in reason, reason)

check("진입 함수 없으면 막는다",
      (blocked('x = 1') or "").find("transform") >= 0, blocked("x = 1"))

print("[3] 되살리는 스위치")
os.environ["B2B_PY_QUALITY_GATE"] = "1"
try:
    r = blocked(wrap('for i in range(2, 50):\n    ctx.write("Sheet1", i, 1, [[i]])'))
    check("B2B_PY_QUALITY_GATE=1 이면 루프 쓰기를 다시 막는다", r is not None and "루프 안에서" in (r or ""), r)
finally:
    os.environ.pop("B2B_PY_QUALITY_GATE", None)

print("[4] 클라이언트도 같이 풀렸는가 — 한쪽만 풀면 사용자 눈엔 그대로다")
check("루프 안 ctx 쓰기 규칙이 스위치 뒤로",
      re.search(r"_loopWriteHit && typeof window !== \"undefined\" && window\.B2B_PY_QUALITY_GATE === true", CHAT) is not None)
check("생성 코드 모양으로 VBA 강제하던 판정이 스위치 뒤로",
      re.search(r"codeLooksLikeMultiValueLookup && typeof window !== \"undefined\" && window\.B2B_PY_QUALITY_GATE === true", CHAT) is not None)

print("[5] 백엔드에서 걷어낸 규칙 문구가 실제로 사라졌는가")
for gone in ["다중 토큰 매칭/합산/쓰기 작업은 Python COM으로 실행하지 마세요",
             "ctx.sort(...)를 사용하세요",
             "큰 표를 ctx.read 로 Python 리스트에 올려 가공한 뒤",
             "소수점 값을 '20'과 '0'으로"]:
    check(f"사라짐: {gone[:28]}…", gone not in SRC)

print("")
print("RESULT: ALL PASS" if fails == 0 else "RESULT: %d FAIL" % fails)
sys.exit(0 if fails == 0 else 1)
