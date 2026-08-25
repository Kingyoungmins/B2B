# -*- coding: utf-8 -*-
# [SBAGENT-296] 두 가지를 잠근다(COM 불필요 — 정적 게이트·__getattr__·__import__ 만).
#  1. 제공 모듈(re/datetime/math)의 '단순' import 는 정적 게이트 통과 + 샌드박스에서 실제 동작.
#     (예전: 'import datetime' 한 줄이 95초 리셋 사이클을 통째로 실패시키고 전 단계 OFF 연쇄)
#  2. ctx.Sheets 같은 VBA/COM 식 접근은 원문 AttributeError 대신 '무엇을 쓰라'는 안내가 나간다.
import sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import serve_b2b as S

fails = 0
def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:160]) if (not cond and detail) else ""))
    if not cond:
        fails += 1

def gate(code):
    try:
        S._python_com_static_check(code)
        return None
    except Exception as e:
        return str(e)

print("[1] 정적 게이트 — 제공 모듈 단순 import 만 통과")
check("import datetime 통과", gate("import datetime\ndef transform(ctx):\n    return 1") is None, gate("import datetime\ndef transform(ctx):\n    return 1"))
check("import re, math 통과", gate("import re, math\ndef transform(ctx):\n    return 1") is None)
check("import os 차단", "import" in (gate("import os\ndef transform(ctx):\n    return 1") or ""))
check("import datetime as dt 차단", "import" in (gate("import datetime as dt\ndef transform(ctx):\n    return 1") or ""))
check("from datetime import date 차단", "from-import" in (gate("from datetime import date\ndef transform(ctx):\n    return 1") or ""))

print("[2] 샌드박스 __import__ — 게이트를 통과한 import 가 런타임에서도 산다")
g = {"__builtins__": dict(S._PY_SAFE_BUILTINS), "re": S.re, "datetime": S.datetime, "math": S.math}
try:
    exec(compile("import datetime\nX = datetime.date(2026, 8, 25).year", "<t>", "exec"), g)
    check("import datetime 실행 OK", g.get("X") == 2026, g.get("X"))
except Exception as e:
    check("import datetime 실행 OK", False, e)
try:
    exec(compile("import os", "<t>", "exec"), g)
    check("import os 는 런타임에서도 차단", False)
except Exception as e:
    check("import os 는 런타임에서도 차단", "사용할 수 없습니다" in str(e), e)

print("[3] ctx COM 식 접근 — 안내형 AttributeError")
ctx = object.__new__(S.PythonComSkillContext)
try:
    ctx.Sheets
    check("ctx.Sheets 안내", False)
except AttributeError as e:
    check("ctx.Sheets 안내(move_sheet 등 헬퍼 언급)", "move_sheet" in str(e), e)
try:
    ctx.Range
    check("ctx.Range 안내", False)
except AttributeError as e:
    check("ctx.Range 안내(read/write 언급)", "ctx.read" in str(e), e)
check("hasattr 의미 보존(False 반환, 예외 전파 없음)", hasattr(ctx, "NopeAttr") is False)
check("getattr 기본값 의미 보존", getattr(ctx, "NopeAttr", "기본") == "기본")
# 실제 헬퍼는 정상 접근(클래스 속성이라 __getattr__ 미개입)
check("실제 헬퍼는 그대로", callable(getattr(ctx, "move_sheet", None)))

print("")
print("RESULT: ALL PASS" if fails == 0 else "RESULT: %d FAIL" % fails)
sys.exit(0 if fails == 0 else 1)
