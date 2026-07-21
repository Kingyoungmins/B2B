# 23. 교차파일 전체실행이 느린 PC에서만 step8 "시트 못찾음" — 참조 파일 세션 레이스 (SBAGENT-138, v0.5.13)

## 증상
교차파일 37단계 스킬 전체실행이 **어떤 PC는 끝까지 되고, 어떤 PC는 8번에서 "시트 못찾음(05_DAS)"** 으로 실패.
사용자 직감: "엑셀 전환 구간이라 파일이 실제로 뜨고 안 뜨고가 사양차".

## 근본 원인 (적대적 검증으로 확정)
- step8(VBA)은 **한전 파일의 05_DAS 를 '읽어'** 파워빌DAS 에 쓴다(교차파일). 격리 실행에서 한전은 ftarget 이 아니라
  **companion**(다른 라이브 세션의 SaveCopyAs 스냅샷)으로 떠야 읽을 수 있다(`_setup_isolated_pipeline_instance`).
- companion 은 **EXCEL_SESSIONS 에 이미 열려 있는 세션**만 대상으로 만든다. 한전 세션이 없으면 companion 미생성.
- 업로드 시 `preopenAllExcelMirrors`(excel-mirror.js)는 **선택 파일만 즉시, 나머지는 백그라운드 순차 오픈**. 전체실행은
  이 완료를 기다리지 않는다.
- **전체실행 버튼 경로**(`runVbaPipelinePreferLive`→`runIsolatedLivePipelineSteps`, resetFileIds 미전달)는
  '참조 파일'을 미리 안 연다(그룹별 쓰기 대상만 lazy 오픈).
- **결정적 구멍**: 기존 라우팅/리셋 계산(`crossOutputFileIdsReferencedInCode`=출력만, target 추론=쓰기 대상만)은
  **읽기 소스 입력 파일(한전)을 절대 안 잡는다.** 그래서 reconcile 경로조차 한전을 resetFileIds 에 안 넣고,
  단지 preopen 이 우연히 다 열어줘서 동작했을 뿐.
- 종합: 느린 PC에서 preopen 이 step8 전에 한전을 못 열면 → companion 부재 → `Workbooks("한전")`/05_DAS 읽기 실패 →
  "시트 못찾음". 빠른 PC는 preopen 완료라 통과 = 비결정.
- (반증된 가설) "companion 이 열렸는데 시트가 미완성" 설은 코드 근거 없음 — `Workbooks.Open` 은 동기라 세션만
  있으면 시트는 로드됨. 진짜 결함은 **companion 부재**.

## 수정 (클라이언트, 백엔드 무관)
실행 직전에 **스킬이 참조하는 모든 파일 세션을 강제로 열고 대기**:
- `collectPipelineReferencedFileIds(steps)`(신규): 쓰기 대상 + 교차 출력 + **읽기 소스**(VBA `Workbooks("X")`/일반
  파일명 = `pipelineCollectWorkbookNames`, Python `ctx.book("X")` = `pipelinePythonSourceWorkbookNames`) → fileId.
- `ensurePipelineReferencedSessionsOpen(steps)`(신규): 위 fileId 들을 `excelIdForPipelineFileId`(동기 오픈)로 전부 연다.
  **읽기 소스는 reset 없이 '열기만'**(쓰기 대상 reset 은 기존 reset 루프가 담당).
- `runIsolatedLivePipelineSteps` 초입에서 `await ensurePipelineReferencedSessionsOpen(sourceSteps)` 호출 →
  전체실행 버튼·reconcile **양쪽** 모두 보장. PC 속도와 무관하게 companion 항상 준비됨.

## 검증
- `test_runs/_test_pipeline_crossfile_reference_open.js`(신규): 한전을 '입력(읽기 소스)'으로만 둔 채 step8 코드에서
  collect 가 **한전 fileId 를 포함**하는지(쓰기 대상 DAS 도) + 단일파일 스텝은 안 끌어오는지. 4/4 PASS.
- 회귀: `_test_isolated_pipeline_sequential_apply.js`(prelude 에 ensure... no-op 스텁 추가), last-step/repair/
  failure/routing 전부 PASS.

## 한계 / 후속
- 임시 회피(코드 수정 전): 업로드 후 상태줄 "다른 파일 Excel 준비 중..." 이 사라진 뒤 전체실행하면 회피됨.
- 동적/조립된 워크북명은 정적 추출이 못 잡음(`pipelineFileIdByWorkbookName` 모호=null 제외). 극소수 edge.
- 백엔드 방어(참조 워크북 미오픈 시 WORKBOOKS 경로에서 직접 열기/검증)는 hard-fail 위험으로 미채택 — 필요 시
  warning/trace 로 먼저 도입.
- 전체실행 라우팅은 코덱스 공유 영역 — 이 변경은 가산적(실행 전 세션 보장)이며 적용 순서/로직 불변.
