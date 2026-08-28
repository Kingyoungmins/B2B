---
type: endpoint
title: restoreHistorySnapshot
module: history.js
lang: js
extraction: regex   # 정규식 근사
signature: "(snapshot)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "history.js:89-89"

# ── 입출력 ──
inputs:
  - "snapshot"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: activeOutputIndex, currentFileId, currentSheet, editingStepId, fuzzyResolution, inputs, inputsOriginal, output, outputOriginal, outputTemplates, pipeline, selectedCell, selectedRange, selectedRanges, selectedSheets, selectionAnchor"
raises: []

# ── 유기적 관계 ──
calls:
  - "cloneFileForHistory"
  - "deepClone"
  - "recomputeAllFormulas"
  - "refreshChatState"
  - "refreshHistoryButtons"
  - "refreshRunButton"
  - "refreshTabs"
  - "renderExcelViewer"
  - "renderInputList"
  - "renderOutputChip"
  - "renderPipeline"
calls_external:
  - "map"
called_by:
  - "redoHistory"
  - "undoHistory"
reads:
  - "state.activeOutputIndex"
  - "state.currentFileId"
  - "state.currentSheet"
  - "state.editingStepId"
  - "state.fuzzyResolution"
  - "state.inputs"
  - "state.inputsOriginal"
  - "state.output"
  - "state.outputOriginal"
  - "state.outputTemplates"
  - "state.pipeline"
  - "state.selectedCell"
  - "state.selectedRange"
  - "state.selectedRanges"
  - "state.selectedSheets"
  - "state.selectionAnchor"
writes:
  - "activeOutputIndex"
  - "currentFileId"
  - "currentSheet"
  - "editingStepId"
  - "fuzzyResolution"
  - "inputs"
  - "inputsOriginal"
  - "output"
  - "outputOriginal"
  - "outputTemplates"
  - "pipeline"
  - "selectedCell"
  - "selectedRange"
  - "selectedRanges"
  - "selectedSheets"
  - "selectionAnchor"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: activeOutputIndex, currentFileId, currentSheet, editingStepId, fuzzyResolution, inputs, inputsOriginal, output, outputOriginal, outputTemplates, pipeline, selectedCell, selectedRange, selectedRanges, selectedSheets, selectionAnchor
- 변경 상태 `activeOutputIndex, currentFileId, currentSheet, editingStepId, fuzzyResolution, inputs, inputsOriginal, output, outputOriginal, outputTemplates, pipeline, selectedCell, selectedRange, selectedRanges, selectedSheets, selectionAnchor` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `cloneFileForHistory`, `deepClone`, `recomputeAllFormulas`, `refreshChatState`, `refreshHistoryButtons`, `refreshRunButton`, `refreshTabs`, `renderExcelViewer`, `renderInputList`, `renderOutputChip`, `renderPipeline`
- 피호출(영향 전파 경로): `redoHistory`, `undoHistory`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
