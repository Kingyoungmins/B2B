---
type: endpoint
title: applyBackendPipelineResult
module: backend-workbooks.js
lang: js
extraction: regex   # 정규식 근사
signature: "(result)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "backend-workbooks.js:371-371"

# ── 입출력 ──
inputs:
  - "result"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: currentFileId, currentSheet, excelMirror.staleByFileId, selectedCell, selectedRange, selectedRanges, selectedSheets, selectionAnchor"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "applyForcedValueCellsToFile"
  - "captureBackendCurrentViewForApply"
  - "chooseBackendRestoreView"
  - "clearFormulaMetadataForBackendChanges"
  - "endExcelMirrorApplyLoading"
  - "flashBackendDiff"
  - "flashFilled"
  - "forceShowBackendResultMirror"
  - "getFile"
  - "recomputeAllFormulas"
  - "refreshTabs"
  - "renderExcelViewer"
  - "syncFileMetadata"
calls_external:
  - "Set"
  - "async"
  - "filter"
  - "forEach"
  - "has"
  - "includes"
  - "isArray"
  - "keys"
  - "map"
  - "max"
  - "sameSheet"
  - "setTimeout"
  - "slice"
  - "startsWith"
called_by:
  - "runPipelineOnBackend"
reads:
  - "state.currentFileId"
  - "state.currentSheet"
  - "state.output"
  - "state.selectedCell"
  - "state.selectedRange"
  - "state.selectedRanges"
  - "state.selectedSheets"
  - "state.selectionAnchor"
writes:
  - "currentFileId"
  - "currentSheet"
  - "excelMirror.staleByFileId"
  - "selectedCell"
  - "selectedRange"
  - "selectedRanges"
  - "selectedSheets"
  - "selectionAnchor"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: currentFileId, currentSheet, excelMirror.staleByFileId, selectedCell, selectedRange, selectedRanges, selectedSheets, selectionAnchor
- 타이머
- 변경 상태 `currentFileId, currentSheet, excelMirror.staleByFileId, selectedCell, selectedRange, selectedRanges, selectedSheets, selectionAnchor` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `add`, `applyForcedValueCellsToFile`, `captureBackendCurrentViewForApply`, `chooseBackendRestoreView`, `clearFormulaMetadataForBackendChanges`, `endExcelMirrorApplyLoading`, `flashBackendDiff`, `flashFilled`, `forceShowBackendResultMirror`, `getFile`, `recomputeAllFormulas`, `refreshTabs`, `renderExcelViewer`, `syncFileMetadata`
- 피호출(영향 전파 경로): `runPipelineOnBackend`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
