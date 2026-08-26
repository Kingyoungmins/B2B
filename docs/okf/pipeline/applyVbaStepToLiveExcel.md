---
type: endpoint
title: applyVbaStepToLiveExcel
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step, excelId, options = {})"
role: "0.4.9 리모콘 모델: 생성된 VBA를 라이브 워크북에 즉시 주입 실행한다."
role_source: banner
version: "0.8.0"
loc: "pipeline.js:2069-2069"

# ── 입출력 ──
inputs:
  - "step"
  - "excelId"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "_restoreSnapshotByIds"
  - "applyLiveSchemaToFileCache"
  - "attachPipelineStepError"
  - "beginExcelMirrorApplyLoading"
  - "captureStepPreApplySnapshot"
  - "endExcelMirrorApplyLoading"
  - "fileIdForExcelMirrorId"
  - "hideAllExcelMirrorWindows"
  - "inferPipelineStepLanguage"
  - "isolatedPipelineStepPayload"
  - "landAppTabOnExcelSession"
  - "muteExcelMirrorForPipeline"
  - "noteLivePipelineApplied"
  - "pipelineErrorMayHaveAppliedInExcel"
  - "postExcelMirror"
  - "push"
  - "pushHistory"
  - "recordVbaDebugTiming"
  - "refreshRunButton"
  - "releaseExcelMirrorPipelineMute"
  - "renderPipeline"
  - "reportPipelineError"
  - "requestExcelApplyCancel"
  - "restoreVbaExcelAfterError"
  - "rollbackAddedPipelineStep"
  - "scheduleLogicAutoBackup"
  - "scheduleRestoreActiveExcelMirror"
  - "setPipelineRuntimeStatus"
  - "toast"
  - "traceClientUiEvent"
  - "wireStepCrossFromResponse"
calls_external:
  - "Python"
  - "String"
  - "async"
  - "false"
  - "findIndex"
  - "indexOf"
  - "isArray"
  - "now"
  - "python"
  - "resolve"
  - "round"
  - "slice"
  - "then"
  - "transform"
called_by:
  - "applyLogic"
  - "runVbaPipelinePreferLive"
reads:
  - "state.currentFileId"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
0.4.9 리모콘 모델: 생성된 VBA를 라이브 워크북에 즉시 주입 실행한다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 네트워크/서버 호출

## 관계
- 호출: `_restoreSnapshotByIds`, `applyLiveSchemaToFileCache`, `attachPipelineStepError`, `beginExcelMirrorApplyLoading`, `captureStepPreApplySnapshot`, `endExcelMirrorApplyLoading`, `fileIdForExcelMirrorId`, `hideAllExcelMirrorWindows`, `inferPipelineStepLanguage`, `isolatedPipelineStepPayload`, `landAppTabOnExcelSession`, `muteExcelMirrorForPipeline`, `noteLivePipelineApplied`, `pipelineErrorMayHaveAppliedInExcel`, `postExcelMirror`, `push`, `pushHistory`, `recordVbaDebugTiming`, `refreshRunButton`, `releaseExcelMirrorPipelineMute`, `renderPipeline`, `reportPipelineError`, `requestExcelApplyCancel`, `restoreVbaExcelAfterError`, `rollbackAddedPipelineStep`, `scheduleLogicAutoBackup`, `scheduleRestoreActiveExcelMirror`, `setPipelineRuntimeStatus`, `toast`, `traceClientUiEvent`, `wireStepCrossFromResponse`
- 피호출(영향 전파 경로): `applyLogic`, `runVbaPipelinePreferLive`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
