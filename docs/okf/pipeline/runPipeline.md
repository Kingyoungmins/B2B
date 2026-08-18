---
type: endpoint
title: runPipeline
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps, options = {})"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "pipeline.js:3091-3091"

# ── 입출력 ──
inputs:
  - "steps"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: activeOutputIndex, currentSheet, inputs, lastError, output, outputOriginal"
raises: []

# ── 유기적 관계 ──
calls:
  - "_stepError"
  - "adaptPipelineForRun"
  - "applyManualEditForPipeline"
  - "clearFormulaCellMetadataForFileId"
  - "clearThenSetKey"
  - "cloneFileRecord"
  - "col"
  - "deepClone"
  - "flashFilled"
  - "fuzzyGetKey"
  - "fuzzyProxy"
  - "getFile"
  - "isStepEnabled"
  - "push"
  - "recomputeAllFormulas"
  - "refreshTabs"
  - "renderExcelViewer"
  - "renderInputList"
  - "renderOutputChip"
  - "syncFileMetadata"
  - "syncRuntimeFileRecords"
  - "trackClearThenSet"
  - "trackedRowProxy"
  - "trackedSheetRowsProxy"
  - "trackedSheetsProxy"
  - "wrapSheets"
calls_external:
  - "Error"
  - "Function"
  - "Number"
  - "Proxy"
  - "String"
  - "WeakMap"
  - "assign"
  - "call"
  - "fn"
  - "forEach"
  - "get"
  - "getOwnPropertyDescriptor"
  - "includes"
  - "isArray"
  - "isInteger"
  - "keys"
  - "max"
  - "onBeforeStep"
  - "onStepApplied"
  - "ownKeys"
  - "replace"
  - "set"
  - "toLowerCase"
  - "transform"
  - "trim"
called_by:
  - "_reconcilePipelineSimulationAfterEditImpl"
  - "applyLogic"
  - "commitCellEdit"
  - "handleCommand"
  - "insertLogic"
  - "replaceLogicAt"
  - "runPipelineRealtime"
reads:
  - "state.activeOutputIndex"
  - "state.currentFileId"
  - "state.currentSheet"
  - "state.fuzzyResolution"
  - "state.inputs"
  - "state.inputsOriginal"
  - "state.lastError"
  - "state.output"
  - "state.outputOriginal"
  - "state.outputTemplates"
  - "state.pipeline"
writes:
  - "activeOutputIndex"
  - "currentSheet"
  - "inputs"
  - "lastError"
  - "output"
  - "outputOriginal"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: activeOutputIndex, currentSheet, inputs, lastError, output, outputOriginal
- 변경 상태 `activeOutputIndex, currentSheet, inputs, lastError, output, outputOriginal` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_stepError`, `adaptPipelineForRun`, `applyManualEditForPipeline`, `clearFormulaCellMetadataForFileId`, `clearThenSetKey`, `cloneFileRecord`, `col`, `deepClone`, `flashFilled`, `fuzzyGetKey`, `fuzzyProxy`, `getFile`, `isStepEnabled`, `push`, `recomputeAllFormulas`, `refreshTabs`, `renderExcelViewer`, `renderInputList`, `renderOutputChip`, `syncFileMetadata`, `syncRuntimeFileRecords`, `trackClearThenSet`, `trackedRowProxy`, `trackedSheetRowsProxy`, `trackedSheetsProxy`, `wrapSheets`
- 피호출(영향 전파 경로): `_reconcilePipelineSimulationAfterEditImpl`, `applyLogic`, `commitCellEdit`, `handleCommand`, `insertLogic`, `replaceLogicAt`, `runPipelineRealtime`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
