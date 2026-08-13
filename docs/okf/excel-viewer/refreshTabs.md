---
type: endpoint
title: refreshTabs
module: excel-viewer.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "excel-viewer.js:209-209"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: currentFileId, currentSheet, selectedCell, selectedRange, selectedRanges, selectedSheets, selectionAnchor"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
  - "_toggleSheetSelection"
  - "escapeHtml"
  - "getFile"
  - "getSheetDimension"
  - "outputTemplateFileId"
  - "push"
  - "renderExcelViewer"
  - "switchWorkbookFileFromUserTab"
calls_external:
  - "Number"
  - "Set"
  - "appendChild"
  - "createElement"
  - "filter"
  - "forEach"
  - "has"
  - "includes"
  - "join"
  - "map"
  - "some"
  - "toLocaleString"
called_by:
  - "_reconcilePipelineSimulationAfterEditImpl"
  - "applyBackendPipelineResult"
  - "commitCellEdit"
  - "installMirrorRenderOverride"
  - "loadInputFiles"
  - "loadOutputTemplates"
  - "removeInputFileAt"
  - "removeOutputTemplateAt"
  - "restoreHistorySnapshot"
  - "restoreSoftRefreshSnapshot"
  - "runPipeline"
  - "setCurrentView"
  - "setPage"
  - "syncSelectionFromExcel"
reads:
  - "state.activeOutputIndex"
  - "state.currentFileId"
  - "state.currentSheet"
  - "state.inputs"
  - "state.output"
  - "state.outputTemplates"
  - "state.selectedCell"
  - "state.selectedRange"
  - "state.selectedRanges"
  - "state.selectedSheets"
  - "state.selectionAnchor"
writes:
  - "currentFileId"
  - "currentSheet"
  - "selectedCell"
  - "selectedRange"
  - "selectedRanges"
  - "selectedSheets"
  - "selectionAnchor"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: currentFileId, currentSheet, selectedCell, selectedRange, selectedRanges, selectedSheets, selectionAnchor
- 변경 상태 `currentFileId, currentSheet, selectedCell, selectedRange, selectedRanges, selectedSheets, selectionAnchor` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `$`, `_toggleSheetSelection`, `escapeHtml`, `getFile`, `getSheetDimension`, `outputTemplateFileId`, `push`, `renderExcelViewer`, `switchWorkbookFileFromUserTab`
- 피호출(영향 전파 경로): `_reconcilePipelineSimulationAfterEditImpl`, `applyBackendPipelineResult`, `commitCellEdit`, `installMirrorRenderOverride`, `loadInputFiles`, `loadOutputTemplates`, `removeInputFileAt`, `removeOutputTemplateAt`, `restoreHistorySnapshot`, `restoreSoftRefreshSnapshot`, `runPipeline`, `setCurrentView`, `setPage`, `syncSelectionFromExcel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
