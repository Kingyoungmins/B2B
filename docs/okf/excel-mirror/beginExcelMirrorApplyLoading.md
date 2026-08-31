---
type: endpoint
title: beginExcelMirrorApplyLoading
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(message, options = {})"
role: "적용 시작: 모든 미러 창을 숨기고(park) 네이티브 패널의 로딩 애니메이션을 돌린다."
role_source: banner
version: "0.8.2"
loc: "excel-mirror.js:1427-1427"

# ── 입출력 ──
inputs:
  - "message"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: excelMirror.applyBusyToken, excelMirror.applyDepth, excelMirror.applyDepthTouchedAt, excelMirror.applyLoadingBaseLabel, excelMirror.applyLoadingProgress, excelMirror.applyLoadingTimer, excelMirror.applyOpenLabels, excelMirror.applying"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "beginUiBusy"
  - "cancelActiveBackendPipeline"
  - "hideAllExcelMirrorWindows"
  - "isNativeExcelShell"
  - "publishNativeExcelLoading"
  - "push"
  - "requestExcelApplyCancel"
  - "setExcelMirrorApplyLoadingProgress"
  - "showExcelApplyCancelButton"
  - "tick"
  - "traceClientUiEvent"
  - "updateMirrorShellStatus"
calls_external:
  - "Number"
  - "String"
  - "async"
  - "clearInterval"
  - "filter"
  - "forceRestart"
  - "join"
  - "map"
  - "max"
  - "now"
  - "setInterval"
  - "slice"
called_by:
  - "_reapplyVbaPipelineToLiveImpl"
  - "_restoreSnapshotByIds"
  - "applyMappedSingleStep"
  - "applyVbaStepToLiveExcel"
  - "runIsolatedLivePipelineSteps"
  - "runPipelineOnBackend"
reads: []
writes:
  - "excelMirror.applyBusyToken"
  - "excelMirror.applyDepth"
  - "excelMirror.applyDepthTouchedAt"
  - "excelMirror.applyLoadingBaseLabel"
  - "excelMirror.applyLoadingProgress"
  - "excelMirror.applyLoadingTimer"
  - "excelMirror.applyOpenLabels"
  - "excelMirror.applying"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
적용 시작: 모든 미러 창을 숨기고(park) 네이티브 패널의 로딩 애니메이션을 돌린다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: excelMirror.applyBusyToken, excelMirror.applyDepth, excelMirror.applyDepthTouchedAt, excelMirror.applyLoadingBaseLabel, excelMirror.applyLoadingProgress, excelMirror.applyLoadingTimer, excelMirror.applyOpenLabels, excelMirror.applying
- 타이머
- 변경 상태 `excelMirror.applyBusyToken, excelMirror.applyDepth, excelMirror.applyDepthTouchedAt, excelMirror.applyLoadingBaseLabel, excelMirror.applyLoadingProgress, excelMirror.applyLoadingTimer, excelMirror.applyOpenLabels, excelMirror.applying` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `beginUiBusy`, `cancelActiveBackendPipeline`, `hideAllExcelMirrorWindows`, `isNativeExcelShell`, `publishNativeExcelLoading`, `push`, `requestExcelApplyCancel`, `setExcelMirrorApplyLoadingProgress`, `showExcelApplyCancelButton`, `tick`, `traceClientUiEvent`, `updateMirrorShellStatus`
- 피호출(영향 전파 경로): `_reapplyVbaPipelineToLiveImpl`, `_restoreSnapshotByIds`, `applyMappedSingleStep`, `applyVbaStepToLiveExcel`, `runIsolatedLivePipelineSteps`, `runPipelineOnBackend`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
