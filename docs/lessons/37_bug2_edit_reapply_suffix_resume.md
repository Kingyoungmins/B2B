# 37 — Bug2: 마지막 스텝 "수정 적용"이 1단계부터 전체 재실행 [0.5.15]

## 증상
6단계 스킬 입력 중 스킬오류 발생 → "수정 적용"(에러복구) 요청 시 **1단계부터 전체 재실행**으로 돌아가고
그러다 멈춤.

## 근본원인 (코드로 확정)
- "수정 적용" 버튼 → [chat-ui.js] `replaceLogicAt(editTargetId, code, …)`.
- `replaceLogicAt` 이어실행 게이트가:
  ```js
  const lastBeforeIdx = lastLiveStepIndex(beforeReplaceSnapshot);
  if ((idx < lastBeforeIdx || Number.isInteger(getPipelineResumeFromIndex())) &&
      canUsePipelineCheckpointFromIndex(idx, beforeReplaceSnapshot, next)) { …suffix… }
  ```
  → **마지막 스텝(idx == lastBeforeIdx)** 을 수정하면 `idx < lastBeforeIdx` 가 false → 이어실행을 건너뛰고
  `reapplyVbaPipelineToLive`(전체 리셋 + 1..N 재실행)로 떨어짐. 에러난 마지막 스텝도 직전 스냅샷은 보유하는데
  (백엔드가 실패 시 stepSnapshots 첨부 → 클라 wiring) 게이트가 막아서 못 씀.
- "멈춤"은 그 위에서 runPipelineWithAutoRepair 가 MAX_REPAIRS(3)회 전체 재실행 + 매회 LLM 재생성 → 수 분.

## 수정 (본수정 = 스냅샷 이어실행)
`replaceLogicAt` 게이트를 **`canUsePipelineCheckpointFromIndex(idx)` 단독**으로 완화.
스냅샷이 있으면(=그 스텝 직전 상태 보유) **마지막 스텝도** restore(그 스텝 직전) + '그 스텝만' 재실행한다.
스냅샷 없으면 기존 전체 재실행 폴백 유지.
- `restorePipelineCheckpointForSuffix(idx)` 는 idx≥의 첫 스냅샷(파일당)을 복원 → 라이브를 그 스텝 직전으로
  맞춘 뒤 `runPipelineSuffixFromCheckpoint(idx)`(skipReset)로 그 스텝부터만 실행. 마지막 스텝 idx 에서도 정확.

## "멈춤" 동시 완화
[[36]] 백그라운드 전체실행(격리 인스턴스 1개)으로 폴백 전체 재실행 자체가 빨라짐(반복 spawn 제거).
→ 이어실행(이 수정) + 빠른 전체 재실행(36) 둘이 함께 "1단계부터 다시 + 멈춤"을 해소.

## 테스트
`_test_replace_last_step_suffix_resume.js` 4/4:
- 마지막 스텝 수정 + 스냅샷 → 이어실행(idx=5), 전체 재실행 안 함
- 중간 스텝 수정 → 이어실행(회귀)
- 스냅샷 없음 → 전체 재실행 폴백

## 남음(후속 후보, 이번 범위 밖)
- 새 스텝 **append**(insertLogic, idx==total)도 전체 재실행으로 떨어짐 → 현재 라이브 위 마지막 스텝만
  fast-apply(applyLastEnabledStepFast)로 바꾸면 추가 개선 가능. (이번 보고된 건은 replaceLogicAt 라 제외)
