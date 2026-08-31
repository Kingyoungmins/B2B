---
type: endpoint
title: restoreSoftRefreshSnapshot
module: soft-refresh.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "soft-refresh.js:157-157"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "localStorage/세션스토리지 접근"
  - "상태 변경: excelMirror.restoreFromStateSig, fuzzyResolution, runnerMappingChecked, runnerMappingSignature, runnerMappings"
raises: []

# ── 유기적 관계 ──
calls:
  - "_softRefreshRebuildFile"
  - "_softRefreshResolveInstantRestore"
  - "activateOutputTemplate"
  - "activePipelineSteps"
  - "beginMappedPipelineRun"
  - "beginUiBusy"
  - "cloneFileRecord"
  - "endUiBusy"
  - "ensureWorkbookDisplayName"
  - "getFile"
  - "loadLogic"
  - "makeOutputTemplate"
  - "noteLivePipelineApplied"
  - "preopenAllExcelMirrors"
  - "push"
  - "refreshChatState"
  - "refreshTabs"
  - "removeItem"
  - "renderInputList"
  - "renderOutputChip"
  - "renderRunnerWorkflow"
  - "reportPipelineError"
  - "restore"
  - "runPipelineWithAutoRepair"
  - "runnerCurrentMappingSignature"
  - "setGeneratorRunLoading"
  - "setPipelineRuntimeStatus"
  - "toast"
calls_external:
  - "filter"
  - "getItem"
  - "isArray"
  - "join"
  - "map"
  - "max"
  - "min"
  - "parse"
  - "slice"
  - "some"
  - "warn"
called_by:
  - "boot"
reads:
  - "state.fuzzyResolution"
  - "state.inputs"
  - "state.inputsOriginal"
  - "state.outputTemplates"
  - "state.pipeline"
  - "state.runnerMappingChecked"
  - "state.runnerMappingSignature"
  - "state.runnerMappings"
writes:
  - "excelMirror.restoreFromStateSig"
  - "fuzzyResolution"
  - "runnerMappingChecked"
  - "runnerMappingSignature"
  - "runnerMappings"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- localStorage/세션스토리지 접근
- 상태 변경: excelMirror.restoreFromStateSig, fuzzyResolution, runnerMappingChecked, runnerMappingSignature, runnerMappings
- 변경 상태 `excelMirror.restoreFromStateSig, fuzzyResolution, runnerMappingChecked, runnerMappingSignature, runnerMappings` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_softRefreshRebuildFile`, `_softRefreshResolveInstantRestore`, `activateOutputTemplate`, `activePipelineSteps`, `beginMappedPipelineRun`, `beginUiBusy`, `cloneFileRecord`, `endUiBusy`, `ensureWorkbookDisplayName`, `getFile`, `loadLogic`, `makeOutputTemplate`, `noteLivePipelineApplied`, `preopenAllExcelMirrors`, `push`, `refreshChatState`, `refreshTabs`, `removeItem`, `renderInputList`, `renderOutputChip`, `renderRunnerWorkflow`, `reportPipelineError`, `restore`, `runPipelineWithAutoRepair`, `runnerCurrentMappingSignature`, `setGeneratorRunLoading`, `setPipelineRuntimeStatus`, `toast`
- 피호출(영향 전파 경로): `boot`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
