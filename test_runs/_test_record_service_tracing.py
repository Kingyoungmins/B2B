# -*- coding: utf-8 -*-
"""[계측 2026-08-31] 녹화의 '시작과 정지 사이'가 로그에 남는가.

배경: serve_b2b 는 record.native.start / record.native.stop 두 시점만 남겼다. 그런데 녹화가
      통째로 유실되는 자리는 그 사이다.
        · 펌프 루프가 Excel 사망을 감지해 break        → 그 뒤 수확은 전부 빈손
        · 정지 시퀀스 7단계가 각각 try/except pass     → 하나가 죽어도 결과만 조용히 빔
        · distill→그룹핑→스텝 변환에서 개수가 0으로     → 어디서 사라졌는지 알 수 없음
      화면에는 "캡처 0건"만 뜨고 로그엔 단서가 없었다(실측 이력 다수).

이 테스트가 잠그는 것
  1) 녹화 모듈이 본체와 같은 로그 파일에 쓸 수 있다(순환 import 없이)
  2) 계측이 녹화를 죽이지 않는다 — 로그를 못 써도 조용히 넘어간다
  3) 사각지대 5곳에 실제로 계측이 들어가 있다
  4) '캡처 0건'을 가를 수 있는 숫자가 한 줄에 모여 나온다
"""
import io
import json
import sys
import time
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import record_service as R
import native_macro_recorder as N
import serve_b2b as S

fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:250]) if not cond else ""))
    if not cond:
        fails.append(name)


print("[1] 녹화 모듈이 본체 로그에 쓸 수 있다 (순환 import 없이)")
check("record_service 는 serve_b2b 를 최상위에서 import 하지 않는다",
      not any(l.startswith(("import serve_b2b", "from serve_b2b"))
              for l in (ROOT / "record_service.py").read_text(encoding="utf-8").splitlines()))
check("_trace 가 있다", callable(getattr(R, "_trace", None)))
check("훅 자리가 있다(본체가 주입 가능)", hasattr(R, "TRACE_HOOK"))

log = S._vba_trace_path()
before = len(log.read_text(encoding="utf-8", errors="replace").splitlines()) if log.exists() else 0
R._trace("record.svc.selftest", via="lazy")          # 훅 없이 — 늦은 import 로 찾아간다
R.TRACE_HOOK = S._vba_trace
R._trace("record.svc.selftest", via="hook")          # 훅 주입 상태
R.TRACE_HOOK = None
time.sleep(0.2)
rows = [json.loads(l) for l in log.read_text(encoding="utf-8", errors="replace").splitlines()[before:] if l.strip()]
got = [r for r in rows if r.get("event") == "record.svc.selftest"]
check("두 경로 모두 같은 파일에 남는다", len(got) >= 2, len(got))
check("본체 트레이스와 같은 형식(pid·event)", all("pid" in r and "event" in r for r in got), got[:1])

print("[2] 계측이 녹화를 죽이지 않는다")


class _Boom:
    def __call__(self, *a, **k):
        raise RuntimeError("로그 장치 고장")


R.TRACE_HOOK = _Boom()
try:
    R._trace("record.svc.selftest", via="broken")
    check("로그가 터져도 예외가 새지 않는다", True)
except Exception as e:
    check("로그가 터져도 예외가 새지 않는다", False, e)
finally:
    R.TRACE_HOOK = None

print("[3] 사각지대에 계측이 들어갔다")
svc = (ROOT / "record_service.py").read_text(encoding="utf-8")
for ev, why in [
    ("record.svc.begin", "어떤 경로로 Excel 을 잡았나(marshal/getactive)"),
    ("record.svc.excel_gone", "펌프 루프가 Excel 사망으로 빠져나감 ← '캡처 0건'의 주범"),
    ("record.svc.stop_phase_failed", "정지 시퀀스 7단계 중 죽은 것"),
    ("record.svc.harvest", "액션→스텝 개수 변화"),
    ("record.svc.error", "녹화 스레드가 통째로 죽은 경우"),
]:
    check("%-32s %s" % (ev, why), ('"%s"' % ev) in svc)
check("expected 실패도 남긴다(재현 자동대조가 꺼지는 것)", '"record.svc.expected_failed"' in svc)

print("[4] '캡처 0건'을 가를 수 있는 숫자가 한 줄에 모인다")
for field in ("rawActions", "distilled", "afterLiteralMerge", "afterFormatMerge",
              "groups", "entries", "droppedNoop", "finalSteps"):
    check("harvest 에 %s" % field, field + "=" in svc)

print("[5] F10 매크로 녹화 쪽 진단도 보강됐다")
nat = (ROOT / "native_macro_recorder.py").read_text(encoding="utf-8")
check("모듈 순회 중 삼킨 예외 개수", '"moduleErrors"' in nat)
check("그 첫 사유(대개 VBProject 접근 거부)", '"moduleError1"' in nat)
check("정제 후 줄 수", '"combinedLines"' in nat)
check("수확은 됐는데 정제 후 빈손인 경우 표시", '"emptyAfterSanitize"' in nat)
check("이 값들은 기존 RECORD_DIAG 로 나간다(새 채널을 만들지 않았다)",
      'RECORD_DIAG["moduleErrors"]' in nat and "RECORD_DIAG = {}" in nat)

print("[6] 동작은 그대로 — 계측만 넣었다")
check("정지 시퀀스 순서가 그대로",
      'for fn in ("flush_dirty_formats", "resolve_deferred", "capture_sort_diffs",' in svc)
check("no-op 그룹 제거 규칙 그대로", 'if "ctx." in (e.get("code") or "")' in svc)
check("결과 형태 그대로(steps/raw_actions/distilled/groups/expected)",
      all(('"%s"' % k) in svc for k in ("steps", "raw_actions", "distilled", "groups", "expected")))

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)
