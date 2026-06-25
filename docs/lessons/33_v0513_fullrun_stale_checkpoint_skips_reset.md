# 33. 전체실행이 '보류 체크포인트'를 물려받아 리셋을 건너뛴 버그 (v0.5.13)

SBAGENT-138 75단계 스킬, 저사양 PC에서만 step1 "시트 Sheet1 못 찾음(사용가능: 06_DAS)"로 실패. 고사양은 정상.

## 검증된 근본 원인
1. **스킬이 비멱등**: step1 `ctx.delete_rows("Sheet1",5,5)` ↔ **step9 `ws.Name "Sheet1"→"06_DAS"`**. 그래서 step9까지 간
   워크북은 step1부터 다시 못 돈다 → 전체실행은 반드시 **원본(Sheet1)부터** 시작해야 함. (DAS 원본 파일 실제 시트=`['Sheet1']` 확인.)
2. **실행 구조**: step별 호출은 `reset:false`(라이브 SaveCopyAs 복사)이고, **pristine 복원은 별도 `reset:true, steps:[]`
   호출**이 `_copy_source_workbook_into_target(app, wb, sourcePath)`로 담당. `sourcePath`는 업로드 원본의 별도 불변
   사본(덮어쓰는 코드 0건)이라, **reset만 돌면 Sheet1 복원이 보장됨.**
3. **결함(핵심)**: 전체실행 버튼(생성기 `btn-run`, 실행기 `runner-run-btn`)이 `runPipelineWithAutoRepair`를
   **`ignoreCheckpoint` 없이** 호출 → 남아있는 resume 체크포인트(`window.__pipelineResumeFromIndex`)가 있으면
   `runPipelineSuffixFromCheckpoint`로 빠지고, 이게 `runIsolatedLivePipelineSteps(..., {skipReset:true})`로
   **per-group pristine reset을 통째로 스킵**. → step1이 직전 실행에서 step9가 만든 **06_DAS 상태** 위에서 돌다 터짐.
4. **왜 저사양만**: 저사양은 timeout/부분실패가 잦음 → ① resume 체크포인트가 더 자주 남고 ② DAS working copy가 06_DAS로
   오염된 채 남음 → 다음 전체실행이 skipReset 경로로 빠짐. 고사양은 한 번에 끝나 체크포인트가 안 남아 정상 reset 경로를 탐.
   (※ "Excel은 끝났는데 UI가 timeout으로 실패 판단"이 **오염 상태의 출처**로 기여 — 단일 실행 내 스텝 재정렬은 아님(클라가
   스텝마다 await 직렬). 오염은 '이전 실행'에서 온 것.)
   sourcePath 오염/폴백(코덱스 #2 후보)은 **배제 확정**(별도 불변 사본).

## 패치
- **Fix A (pipeline.js)** — 명시적 전체실행 = 항상 원본부터. 두 버튼 핸들러에 `clearPipelineResumeFromIndex()` +
  `runPipelineWithAutoRepair({ ..., ignoreCheckpoint: true })`. 보류 체크포인트를 무시·초기화해 skipReset 경로를 안 탄다.
  편집 후 자동 빠른적용(`runFromCheckpointAfterEdit`)은 이 버튼을 안 타므로 무관.
- **Fix B (serve_b2b.py)** — `_copy_source_workbook_into_target` 복사 직후 **원본 시트집합 ⊆ 대상 시트집합** 검증.
  저사양 COM 등으로 일부 시트 복사가 누락되면(=원본 복원 부분실패) 조용히 두지 않고 *"원본 복원 실패 … 전체실행으로
  다시 실행"* 으로 중단. A(reset 스킵)가 못 막는 "reset이 돌았으나 실패"까지 커버(상보적). reset+컴패니언 동기화 공용.

## 검증
- serve_b2b.py `py_compile` OK, pipeline.js `node --check` OK.
- 신규 가드 `_test_fullrun_forces_pristine.js` (8/8): 두 버튼이 clear+ignoreCheckpoint, autoRepair가 !ignoreCheckpoint 일 때만 suffix, 백엔드 subset 검증 존재.
- JS 스모크 전체 28 PASS / 1 stale(auto_reapply).

## 트레이드오프(의도)
전체실행 버튼으로 "보류 단계만 빠르게 이어실행"하던 동작은 사라지고 **항상 원본부터 전체 재실행**한다. 비멱등 스킬에서
중간상태 오염을 원천 차단하는 게 정확성상 맞다고 판단(속도<정확성). 빠른 부분적용은 편집 흐름이 자동 처리.
관련: [[apply-focus-selection-bug]], docs/lessons/32(활성창 복원).
