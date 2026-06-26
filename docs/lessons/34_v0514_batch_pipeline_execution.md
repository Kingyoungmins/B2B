# 34. 전체실행 batch 재설계 (v0.5.14)

0.5.13까지: 전체실행이 **스텝당 백엔드 1콜** → 콜마다 격리 Excel 인스턴스를 새로 띄웠다 닫음(75단계=75번).
저사양에서 "수분 뒤에야 1스텝", timeout 경계 75개 → "엑셀은 했는데 UI는 실패 판단" divergence + 상태 오염의 근원.

## 핵심 발견 (왜 작은 변경으로 됐나)
백엔드 `_run_vba_pipeline_on_session_impl`은 **이미** 한 격리 인스턴스에서 **여러 스텝을 순서대로, 혼합엔진으로** 돌리고
끝에 1회 동기화하는 능력이 있었다(serve_b2b.py:7121 `for st in steps` → python이면 `_exec_python_com_skill`, 아니면
`_inject_and_run_vba`; 7177~7196에서 1회 SaveCopyAs+동기화+컴패니언 반영). **문제는 클라가 스텝당 1콜씩 보낸 것뿐.**

## 변경 (pipeline.js `runIsolatedLivePipelineSteps`)
그룹 빌드는 원래도 **연속 같은-파일 스텝**을 한 그룹으로 묶음(순서보존). 0.5.14는 그 **그룹의 모든 스텝을 한 콜**로 보낸다:
- 기존: 그룹마다 reset-only 콜 1 + 스텝마다 콜 N (+ 스텝마다 클라 스냅샷).
- 변경: 그룹당 **1콜** `{steps: group.steps(전부), reset: 첫그룹?true:false}`. 백엔드가 한 인스턴스에서 순서대로 실행.
- **첫 그룹 reset:true** → 백엔드가 격리 인스턴스를 **pristine sourcePath**에서 오픈(라이브 현재상태 무관) → 전체실행은
  **항상 원본부터**. 같은 파일 후속 그룹은 reset:false(직전 동기화 결과 위에 이어서). 다른 파일 그룹은 그 파일 기준.
- timeout은 그룹당 `max(600000, pipelineTimeoutMs(스텝수))` = 백엔드 600s와 정렬.
- 하드블록(저사양 멈춤 패턴)은 그룹 스텝 전체를 클라에서 사전 검사.

## 효과
- **혼합 python COM + VBA 파이프라인**: 한 그룹 안에서 백엔드가 스텝별 엔진 분기로 순서대로 실행(검증 테스트 vba+python+vba).
- N콜=N인스턴스 → **그룹수 콜**(연속 구간당 1). 저사양 속도·timeout 경계 대폭↓.
- **SBAGENT-138(Sheet1→06_DAS) 버그 구조적 소멸**: 첫 그룹 reset:true가 항상 pristine sourcePath에서 시작 → step1이
  "06_DAS 오염 상태" 위에서 도는 일이 불가능. (0.5.13의 Fix A/B도 포함되어 있음.)
- **실패 그룹은 원자적 미반영**: 그룹 콜이 중간 스텝에서 실패하면 백엔드가 동기화 전에 PipelineExecutionError → 라이브
  미반영. 실패 스텝은 errorInfo(stepIdx/stepId)로 전파. (예전 per-step은 실패 직전까지 라이브에 절반 적용됐음.)

## 트레이드오프 / 후속 (꼭 확인할 것)
- **per-step 스냅샷이 batch에선 안 뜬다.** 0.5.13은 스텝마다 클라가 `/api/excel/save`로 스냅샷을 떠 OFF/삭제 빠른복구에
  썼다. batch는 그룹 1콜이라 스텝 사이 스냅샷이 없다. 전체실행 자체는 "항상 원본부터 1회"라 복구=재실행이라 무방하지만,
  **전체실행 이후 스텝을 OFF/삭제하는 빠른복구는 `step._preApplySnapshot`이 없어** 재실행으로 폴백해야 한다.
  → **확인됨(회귀 없음)**: `restoreLastStepPreApplySnapshot`은 `step._preApplySnapshot` 없으면 `return false`(에러 X)이고,
  토글/삭제 핸들러는 `if (await restore...) {빠른복구} else {일반 재적용}` 구조라 스냅샷 부재 시 **일반 재적용으로 graceful
  폴백**한다. 즉 batch 이후 OFF/삭제는 빠른복구만 못 쓰고 정상 재실행으로 동작(느릴 뿐 정확).
  → 후속(선택): 백엔드가 스텝 사이 SaveCopyAs로 스냅샷을 떠 반환하면 batch 이후에도 빠른복구 복원 가능.
- 긴 단일 그룹 콜: 현재 동기 HTTP(타임아웃 600s). 아주 큰 그룹/저사양이면 "작업시작→폴링" 비동기로 가는 게 다음 단계.

## 검증
- 재작성 `_test_isolated_pipeline_sequential_apply.js` (10/10): 그룹 1콜, 첫 reset:true/후속 false, 혼합엔진 한 콜,
  실패 전파+원자적 미반영, suffix(skipReset) 한 콜.
- serve_b2b.py py_compile OK, pipeline.js node --check OK, JS 스모크 29 PASS / 1 stale(auto_reapply, 기존).
- APP_BUILD_STAMP/B2B_BUILD_STAMP="b2b-0.5.14-20260625-batch", build_*.bat APP_VERSION=0.5.14.
