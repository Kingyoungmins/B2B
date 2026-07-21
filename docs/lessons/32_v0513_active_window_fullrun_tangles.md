# 32. 활성창 전체실행 꼬임 — 코드 검토(미수정) (v0.5.13)

사용자 보고: "활성창에 대한 전체실행이 많이 꼬인다." 3갈래(pipeline.js 실행흐름 / excel-mirror.js 활성창 / serve_b2b.py 백엔드)
를 매핑하고 핵심 주장을 직접 검증했다. **코드는 안 건드림**(코덱스가 pipeline.js 동시 편집 + 전체실행은 함부로 못 건드림).
근본 원인은 "활성창"이 **세 군데서 따로 추적**되는데 전체실행이 끝날 때 서로 어긋나는 것.

## "활성창" 추적 주체 3개 (서로 diverge)
- `state.currentFileId` — UI 탭. 전체실행 중 안 바뀜.
- `excelMirror.activeExcelId` — 서버 폴(`/api/excel/changes`)이 보고하는 foreground. 폴이 계속 갱신(excel-mirror.js, `activeChanged → activeExcelId = ...`).
- `initialExcelId` — 실행 시작 시 1회 캡처. 에러 복원에만 쓰임.
- **어디에도 "이번 실행이 실제로 마지막에 건드린 파일"을 추적하지 않는다.**

## 검증된 핵심 원인 (직접 코드 확인)
1. **[백엔드/선택 유실] 전체실행 teardown 이 활성 '시트'만 복원하고 '선택(셀)'은 버린다.**
   `_run_vba_pipeline_on_session_impl` finally(serve_b2b.py:7083-7109)는 `view_sheet`/`initial_view.sheet` 로
   `_ws_target.Activate()`(7098)만 한다. `initial_view["address"]`(6895에서 캡처한 선택)는 **안 씀**.
   시트+선택을 둘 다 복원하는 `_restore_live_view_state`(6355)는 **정의만 있고 호출 0회(죽은 코드)**.
   → 메모리 [[apply-focus-selection-bug]] 와 정확히 일치(검증된 8수정이 코드 유실로 사라진 흔적이 이 죽은 함수).
2. **[프런트/복원 대상 미추적] 실행-복원이 "방금 건드린 파일"을 모른다.**
   성공경로 `scheduleRestoreActiveExcelMirror(180)`(pipeline.js:989/1270/2943) 은 대상 파일 인자가 없다.
   `restoreActiveExcelMirrorWindow`(excel-mirror.js)는 `currentExcelMirrorTarget()`(=현재 UI 탭) 또는
   폴백으로 `excelMirror.activeExcelId` 로 창을 고른다 → **실행이 건드린 파일이 아니라 UI 탭/폴 상태를 복원**.
   교차파일 실행이거나 UI 탭이 실행 대상과 다르면 엉뚱한 창이 떠오름.
3. **[프런트/에러 복원이 첫 파일만] `restoreVbaExcelAfterError(initialExcelId)`(pipeline.js:997)** 는
   실행 시작 시점의 첫 파일만 복원. 교차파일 실행에서 2·3번째 파일 단계가 실패하면 **에러난 파일이 아니라 첫 파일**을 복원.
4. **[프런트/폴 오염] 폴이 `activeExcelId` 를 계속 갱신**하므로, 실행 중/직후 폴이 끼면 위 2번 폴백 대상이 오염될 수 있다.

## 에이전트 보고(추정 — 추가 확인 권장, 미검증)
- `_copy_source_workbook_into_target`(serve_b2b.py:~12664)가 source_wb 를 열고 닫은 뒤 **target_wb 를 ActiveWorkbook 으로
  되돌리지 않음** → 컴패니언 동기화 후 oapp 의 ActiveWorkbook 이 잘못 남을 수 있음. (companion 갈래 [[apply-focus-selection-bug]])
- `_capture_live_view_state` 가 `app.Selection`(전역)을 읽음 → 오버레이/프레임 모드에서 컴패니언을 가리킬 수 있음(시트명 일치 검사로 일부만 방어).
- 대상파일 선택 사슬(`pipelinePinnedTargetFileId` 추론 vs 저장된 `targetFileId` vs `state.currentFileId` 폴백)이 어긋날 수 있음.
- resume(`runPipelineSuffixFromCheckpoint`)는 prefix 가 라이브에 이미 적용돼 있다고 가정 → 중간에 Excel 재시작 시 pristine 위에 suffix 적용.
- 미러 active-sync/foreground 는 메모리 [[mirror-active-sync-foreground]] 가 "미해결, 구조 재설계 필요"로 이미 기록.

## 권고 (승인 시 최소수정 방향 — 코덱스와 조율 필요)
- **실행이 마지막에 건드린 fileId 를 추적**해서 성공/에러 복원에 명시적으로 넘긴다:
  `runIsolatedLivePipelineSteps` 가 `lastTouchedFileId` 를 들고, `scheduleRestoreActiveExcelMirror(180, { restoreFileId })` /
  `restoreVbaExcelAfterError(lastTouchedExcelId)` 로 전달. `restoreActiveExcelMirrorWindow` 가 `options.restoreFileId` 우선.
- **백엔드 선택 복원 재연결**: teardown 에서 시트 Activate 뒤 `_restore_live_view_state(app, wb, initial_view, session)` 호출
  (죽은 함수를 되살림) → 선택 셀까지 복원. 단 companion 의 ActiveWorkbook 보장(owb.Activate)도 같이.
- 둘 다 [[apply-focus-selection-bug]] 의 "검증된 8수정" 재적용 성격 — 그 메모/문서의 수정 목록과 대조 후 적용 권장.

## 검증 메모
- 직접 확인: `_restore_live_view_state` 호출 0회(grep), teardown 7083-7109 시트만 Activate, 복원 호출들 대상파일 인자 없음, 폴 activeExcelId 갱신.
- 미수정. 스모크 영향 없음(읽기 전용 검토).

## 2026-06-25 재검토 — 코덱스 패치 결과 (검증 완료)
코덱스가 핵심 4건을 모두 고침. 직접 코드 확인:
- **[#1 백엔드 선택 유실] 해결**: teardown(serve_b2b.py:7088-7095)이 `_restore_live_view_state(app, wb, initial_view|view_state, session)` 호출. 그 함수(6355)는 시트+선택(`ws.Range(address).Select()`)+`session["lastSelectionSheet/Address"]` 동기화까지 함. 주석에 옛 버그 명시.
- **[#2 복원 대상 미추적] 해결**: `runIsolatedLivePipelineSteps`가 `lastTouchedFileId/ExcelId`(pipeline.js:894-931, 리셋+그룹 시작 시 갱신) 추적 → 성공경로 `scheduleRestoreActiveExcelMirror(180, {restoreExcelId, restoreFileId})`(996). `restoreActiveExcelMirrorWindow`가 `restoreExcelMirrorIdFromOptions`로 명시 대상 우선 + `excelMirror.activeExcelId` 동기화(#4 폴 오염도 해소).
- **[#3 에러 복원 첫 파일] 해결**: `restoreVbaExcelAfterError(lastTouchedExcelId||initialExcelId, {restoreFileId})`(1014). 소비자가 옵션 사용.
- 컴파일 OK, JS 스모크 27 PASS / 1 stale.

**남은 갭(코덱스 미적용, 우선순위 낮음/추정)**:
- 컴패니언 ActiveWorkbook 3회검증(`_ensure_workbook_active`, [[apply-focus-selection-bug]] 수정#1) 여전히 없음 — `_restore_live_window` 단일 무검증 `wb.Activate()`. 컴패니언 writeback(`_copy_source_workbook_into_target`) 잔존 리스크. 컴패니언은 선택 복원 안 됨(창만).
- **watch-point(미세 회귀 가능)**: 실행 직후 180ms 내 앱 '탭' 전환을 강제 복원이 덮어씀 — 가드 `uiClickGuardUntil`(excel-mirror.js:1740)은 엑셀창 클릭만 커버하고 탭전환(`lastUserSwitchAt`, 1648-49)은 미반영. 보통 "방금 실행한 파일 보여주기"가 맞아 저심각.
