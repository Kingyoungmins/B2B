# -*- coding: utf-8 -*-
"""[호출 경로 추적기] tools/callpath/trace.py 가 '거짓 OK'를 내지 않는지 잠근다.

왜(2026-08-26):
  나는 "실행기 [전체실행]을 다시 누르면 앞 단계를 건너뜁니다"라고 안내했는데, 그 이어실행은
  /api/pipeline/start 경로에만 있었고 실행기 [전체실행]에는 아예 없었다. 함수 단위 검증만 하고
  '버튼에서 거기까지 닿는지'를 안 봤다. 그 확인을 명령 한 줄로 만든 게 이 도구다.

  그런데 도구 첫 판이 그 거짓 주장을 OK 라고 했다 — worker 가 4번 정의되는데 이름으로 합쳐서
  'excel_call → worker → (아무 함수)'라는 없는 경로가 생겼기 때문이다. 도구가 거짓을 세탁하면
  없느니만 못하다. 그래서 그 케이스 자체를 회귀 테스트로 박는다.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRACE = ROOT / "tools" / "callpath" / "trace.py"

fails = []


def run(expr):
    r = subprocess.run([sys.executable, str(TRACE), "--assert", expr],
                       capture_output=True, text=True, encoding="utf-8",
                       errors="replace", cwd=str(ROOT))
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:400]) if not cond else ""))
    if not cond:
        fails.append(name)


print("[1] 참인 경로는 OK 로 잡는다")
for expr, why in [
    ("runner-run-btn -> _run_full_pipeline_single_instance_impl", "실행기 전체실행이 실제로 도는 함수"),
    ("runner-run-btn -> _find_best_fullrun_snapshot", "실행기 이어실행(경계 스냅샷)"),
    ("/api/pipeline/start -> _find_best_pipeline_snapshot", "백그라운드 이어실행"),
    ("/api/excel/run-full-pipeline -> _save_fullrun_boundary", "경계 저장기"),
]:
    code, out = run(expr)
    check("%s  (%s)" % (expr, why), code == 0, out)

print("[2] 거짓 주장은 반드시 실패로 잡는다 — 이게 이 도구의 존재 이유")
# 실행기 [전체실행]에서 백그라운드 전용 resume 에 닿는다는 주장 = 내가 실제로 한 거짓말.
code, out = run("runner-run-btn -> _find_best_pipeline_snapshot")
check("실행기 버튼 → 백그라운드 전용 resume 은 '경로 없음'", code == 1, out)
check("이유를 보여준다(확인한 엔드포인트 목록)", "확인한 엔드포인트" in out, out[:200])

print("[3] 없는 이름은 조용히 통과시키지 않는다")
code, out = run("runner-run-btn -> _이런함수는없다")
check("모르는 함수는 exit 2", code == 2, out)

print("[4] 스코프 해석 — 같은 이름의 다른 함수를 섞지 않는다")
r = subprocess.run([sys.executable, str(TRACE), "--reaches", "_run_full_pipeline_single_instance_impl"],
                   capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=str(ROOT))
out = r.stdout or ""
check("실행기 impl 에 닿는 엔드포인트는 run-full-pipeline 뿐",
      out.count("/api/") >= 1 and "/api/excel/run-full-pipeline" in out
      and "/api/excel/capture-copypaste" not in out, out[:400])

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)
