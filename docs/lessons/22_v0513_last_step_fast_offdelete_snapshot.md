# 22. 마지막 단계 OFF/삭제가 전체 재실행되던 비대칭 (SBAGENT-138, v0.5.13)

## 증상
스킬 로드 → 전체실행 후, **마지막 단계 OFF 또는 삭제** 시 전체 파이프라인이 다시 돈다(full reconcile).
그런데 같은 마지막 단계를 **OFF→ON** 하면 'ON 은 마지막만' 빠르게 처리된다 → ON 은 fast, OFF/삭제는 full = 비대칭.
사용자: "마지막꺼 off 나 스킬 삭제 시에도 마지막만 돌아야함".

## 근본 원인
마지막 단계 빠른 처리가 ON/OFF 서로 **다른 재료**에 의존:
- **ON**(`applyLastEnabledStepFast`): `_lastLiveAppliedSignature`(시그니처) 일치만 필요 → 어느 실행 경로든 항상 set → 항상 fast.
- **OFF/삭제**(`restoreLastStepPreApplySnapshot`): 그 단계의 `step._preApplySnapshot`(적용 직전 = 1..N-1 상태 SaveCopyAs)이 필요. 없으면 false → `reconcilePipelineSimulationAfterEdit`(전체 재적용)로 떨어짐.

`_preApplySnapshot` 캡처는 경로마다 다름:
- 격리 경로(`runIsolatedLivePipelineSteps`, VBA/교차파일): per-step 캡처 O.
- **순수 Python 전체실행**(`runVbaPipelinePreferLive` for-loop): `applyVbaStepToLiveExcel`을 `appendToPipeline:false`로 호출 → 내부 캡처가 그 가드에 막혀 **스냅샷 안 남김**.
- ON 빠른적용(`applyLastEnabledStepFast`): 스냅샷 안 남김.

→ 순수 Python 스킬은 마지막 단계 스냅샷이 없어 OFF/삭제가 매번 full. (VBA/교차파일은 격리 경로라 정상.)

## 수정 (백엔드 무관, 클라이언트 pipeline.js)
각 live 단계 **적용 직전** 상태를 스냅샷하도록 두 경로 보완:
- `runVbaPipelinePreferLive` for-loop: **모든 live 스텝**을 각자 적용 직전에 `captureStepPreApplySnapshot`(격리 경로의 per-step 캡처와 동형). 마지막부터 하나씩 **연속 OFF/삭제해도 전부 fast**(처음엔 마지막 1개만 캡처했다가, 사용자 요청으로 per-step 으로 확장).
- `applyLastEnabledStepFast`: `runLivePipelineStepSequentially`(적용) **직전**에 `captureStepPreApplySnapshot`.

### 결정적 함정 (적대적 검증이 잡음)
ON 경로 캡처는 반드시 **적용 전**에 해야 한다. 적용 **후**에 잡으면 N 단계까지 반영된 상태가 스냅샷돼,
이후 그 단계 OFF 가 1..N 으로 "되돌아가" 아무것도 안 되돌린다(되돌렸는데 그대로).

## 검증
- `test_runs/_test_pipeline_last_step_snapshot_paths.js`(신규): for-loop 가 마지막 스텝만 적용 직전 캡처하는지,
  ON 이 적용 직전에 캡처하는지(순서) 단언. 4/4 PASS.
- 기존 `_test_pipeline_last_step_fast_edit.js`/`_repair_language`/`_failure_status`/`_isolated_pipeline_sequential_apply` 회귀 PASS.

## 한계 / 후속
- **남긴 부분(의도)**: `reapplyVbaPipelineToLive` 의 Python-only 번들 경로(singleFileFlow/multi-group)는
  reset+steps 를 서버에서 원샷 처리해 클라가 '직전(1..N-1)' 상태를 중간에 못 잡는다. 여기서 fast OFF 를
  지원하려면 서버 호출을 쪼개야 하는데(reset+0..N-2 → 캡처 → 마지막), 호출 수↑로 apply-speed 에 민감 →
  미적용. 단 전체실행 '버튼'은 이 경로를 안 타므로 사용자 주 시나리오는 해결됨.
- for-loop 는 **per-step 캡처**라 연속 OFF/삭제가 전부 fast(격리=VBA 와 동일 동작). 대가로 전체실행이
  단계 수만큼 SaveCopyAs 를 하므로 큰 파일에서 약간 느려질 수 있음(사용자가 속도보다 일관성을 택함).
- pipeline.js 전체실행 라우팅/적용은 코덱스 공유 영역 — 이 변경은 가산적(스냅샷 1회 추가)이며 적용 순서/로직 불변.
