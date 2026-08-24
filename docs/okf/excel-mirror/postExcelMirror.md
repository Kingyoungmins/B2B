---
type: endpoint
title: postExcelMirror
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(path, body, attempt = 0, options = {})"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "excel-mirror.js:2067-2067"

# ── 입출력 ──
inputs:
  - "path"
  - "body"
  - "attempt = 0"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "noteExcelComTimeout"
calls_external:
  - "AbortController"
  - "Error"
  - "Number"
  - "Promise"
  - "abort"
  - "bit"
  - "clearTimeout"
  - "fetch"
  - "json"
  - "max"
  - "min"
  - "setTimeout"
  - "stringify"
called_by:
  - "_assistRefreshLiveFile"
  - "_reapplyVbaPipelineToLiveImpl"
  - "_restoreSnapshotByIds"
  - "activateCurrentSelectionInExcel"
  - "applyVbaStepToLiveExcel"
  - "assistVerifyProposal"
  - "captureCrossFileDestinationSnapshots"
  - "captureStepPreApplySnapshot"
  - "closeAllExcelMirrorSessions"
  - "closeCurrentExcelMirror"
  - "closeExcelMirrorForFileId"
  - "downloadCurrentWorkbookFile"
  - "ensureExcelMirrorSession"
  - "forceCloseAllExcelMirrorSessions"
  - "hideAllExcelMirrorWindows"
  - "hideInactive"
  - "hideInactiveExcelMirrorSessions"
  - "installOverlayAutoHide"
  - "llmConsolidateEntries"
  - "openCurrentWorkbookInExcel"
  - "openExcelMirrorResultForFileId"
  - "pollExcelFormulaInfo"
  - "pollExcelMirrorChanges"
  - "pollExcelSelection"
  - "refreshExcelMirrorForFileId"
  - "runIsolatedLivePipelineSteps"
  - "runLivePipelineStepSequentially"
  - "saveCurrentExcelMirror"
  - "setPage"
  - "snapExcel"
  - "trimExcelMirrorSessionCache"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 네트워크/서버 호출
- 타이머

## 관계
- 호출: `noteExcelComTimeout`
- 피호출(영향 전파 경로): `_assistRefreshLiveFile`, `_reapplyVbaPipelineToLiveImpl`, `_restoreSnapshotByIds`, `activateCurrentSelectionInExcel`, `applyVbaStepToLiveExcel`, `assistVerifyProposal`, `captureCrossFileDestinationSnapshots`, `captureStepPreApplySnapshot`, `closeAllExcelMirrorSessions`, `closeCurrentExcelMirror`, `closeExcelMirrorForFileId`, `downloadCurrentWorkbookFile`, `ensureExcelMirrorSession`, `forceCloseAllExcelMirrorSessions`, `hideAllExcelMirrorWindows`, `hideInactive`, `hideInactiveExcelMirrorSessions`, `installOverlayAutoHide`, `llmConsolidateEntries`, `openCurrentWorkbookInExcel`, `openExcelMirrorResultForFileId`, `pollExcelFormulaInfo`, `pollExcelMirrorChanges`, `pollExcelSelection`, `refreshExcelMirrorForFileId`, `runIsolatedLivePipelineSteps`, `runLivePipelineStepSequentially`, `saveCurrentExcelMirror`, `setPage`, `snapExcel`, `trimExcelMirrorSessionCache`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
