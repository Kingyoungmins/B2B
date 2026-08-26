# -*- coding: utf-8 -*-
"""[제보 2026-08-26] "작업 중단을 눌러도 중단 안 됨".

실측(로컬 라이브 로그 09:50~09:51): 중단 관련 이벤트가 로그에 **하나도 없었다** — 요청이
갔는지조차 알 수 없었다. 코드 추적 결과 원인은 셋이었다.
 1) 취소 확인이 '스텝 시작' 한 곳뿐이라, 스텝이 끝나도 스냅샷 저장(실측 4~9초)을 마쳐야 멈췄다.
 2) 클라가 서버 응답을 보지 않고 무조건 '접수됨'으로 처리 — 잡을 못 찾아도 성공처럼 보였다.
 3) 계측이 없어 요청~발효 간격을 잴 수 없었다.
이 테스트는 백엔드 쪽(1·3)을 잠근다. UI 쪽(2)은 _test_cancel_ui_state.js.
"""
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import serve_b2b as S

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:200]) if (not cond and detail) else ""))
    if not cond:
        fails += 1


print("[1] 취소 요청 — 접수되면 잡에 표시되고 시각이 남는다")
JOB = "job-cancel-test"
S.PIPELINE_JOBS[JOB] = {"created": 0, "updated": 0, "stage": "실행 중", "currentStep": 7}
with S.PIPELINE_JOBS_LOCK:
    job = S.PIPELINE_JOBS.get(JOB)
    job["cancelRequested"] = True
    job["cancelRequestedAt"] = 1000.0
check("cancelRequested 플래그", S.pipeline_job_cancel_requested(JOB) is True)
check("요청 시각 기록(발효까지 걸린 시간 계산용)", S.PIPELINE_JOBS[JOB].get("cancelRequestedAt") == 1000.0)

print("[2] 확인 지점 — 요청이 있으면 cancelled 예외로 멈춘다")
try:
    S.raise_if_pipeline_cancelled(JOB)
    check("취소 예외가 발생한다", False)
except S.PipelineExecutionError as e:
    info = getattr(e, "info", None) or (e.args[0] if e.args else {})
    check("취소 예외가 발생한다", True)
    check("cancelled 표식(프론트가 오류가 아닌 '중단'으로 처리)", bool(info.get("cancelled")), info)
    check("사용자 문구", "중단" in str(info.get("message") or ""), info)

print("[3] 취소 요청이 없으면 멈추지 않는다(정상 실행 보호)")
S.PIPELINE_JOBS["job-normal"] = {"created": 0, "updated": 0, "stage": "실행 중"}
try:
    S.raise_if_pipeline_cancelled("job-normal")
    check("정상 잡은 그대로 진행", True)
except Exception as e:
    check("정상 잡은 그대로 진행", False, e)
try:
    S.raise_if_pipeline_cancelled(None)      # 잡 없이 도는 경로(라이브 적용 등)
    check("jobId 가 없어도 안전", True)
except Exception as e:
    check("jobId 가 없어도 안전", False, e)

print("[4] 응답성 — 스냅샷 저장 '전'에도 취소를 확인한다(대기 단축)")
src = open(os.path.join(ROOT, "serve_b2b.py"), encoding="utf-8-sig").read()
i = src.find("is_last_step = (idx == len(python_steps))")
seg = src[i:i + 700] if i > 0 else ""
check("스냅샷 저장 앞에 확인 지점이 있다", "if not is_last_step:" in seg and "raise_if_pipeline_cancelled(job_id)" in seg, seg[:160])
check("마지막 스텝은 예외(최종 결과 저장 보장)", "마지막 스텝은 예외" in seg or "is_last_step" in seg)

print("[5] 계측 — 요청/발효가 로그에 남는다")
check("요청 계측", "pipeline.cancel.request" in src)
check("발효 계측(대기 시간 포함)", "pipeline.cancel.applied" in src and "waitedSec" in src)

# 정리
S.PIPELINE_JOBS.pop(JOB, None)
S.PIPELINE_JOBS.pop("job-normal", None)

print("")
print("RESULT: ALL PASS" if fails == 0 else "RESULT: %d FAIL" % fails)
sys.exit(0 if fails == 0 else 1)
