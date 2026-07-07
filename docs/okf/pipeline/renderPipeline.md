---
type: endpoint
title: renderPipeline
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "pipeline.js:2570-2570"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: editingStepId, pipeline"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
  - "add"
  - "applyLastEnabledStepFast"
  - "canFastEditLastPipelineStep"
  - "clearPipelineResumeFromIndex"
  - "ensurePipelineStepIds"
  - "escapeHtml"
  - "getPipelineResumeFromIndex"
  - "getPipelineRuntimeStatus"
  - "isLastLivePipelineStep"
  - "isStepEnabled"
  - "liveEnabledStepsSignature"
  - "markPipelinePendingFromIndex"
  - "noteLivePipelineApplied"
  - "pipelineEditBusyReason"
  - "pipelineStepLabel"
  - "pipelineStepLiveLanguage"
  - "pushHistory"
  - "reconcilePipelineSimulationAfterEdit"
  - "refreshRunButton"
  - "renderEditingBanner"
  - "renderRunnerWorkflow"
  - "reportPipelineError"
  - "restoreLastStepPreApplySnapshot"
  - "restorePipelineToCheckpointAndHold"
  - "runFromCheckpointAfterEdit"
  - "scheduleLogicAutoBackup"
  - "toast"
  - "toggleEditStep"
calls_external:
  - "appendChild"
  - "async"
  - "createDocumentFragment"
  - "createElement"
  - "findIndex"
  - "forEach"
  - "isInteger"
  - "map"
  - "max"
  - "min"
  - "querySelector"
  - "reconcile"
  - "some"
  - "splice"
  - "stopPropagation"
  - "warn"
called_by:
  - "applyLogic"
  - "applyVbaStepToLiveExcel"
  - "attemptRunnerAutoRecovery"
  - "autoRepairPipelineStep"
  - "commitCellEdit"
  - "insertLogic"
  - "loadLogic"
  - "replaceLogicAt"
  - "requestExcelApplyCancel"
  - "restoreHistorySnapshot"
  - "restorePipelineStep"
  - "rollbackAddedPipelineStep"
  - "setPipelineRuntimeStatus"
  - "toggleEditStep"
reads:
  - "state.editingStepId"
  - "state.pipeline"
writes:
  - "editingStepId"
  - "pipeline"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: editingStepId, pipeline
- 변경 상태 `editingStepId, pipeline` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `$`, `add`, `applyLastEnabledStepFast`, `canFastEditLastPipelineStep`, `clearPipelineResumeFromIndex`, `ensurePipelineStepIds`, `escapeHtml`, `getPipelineResumeFromIndex`, `getPipelineRuntimeStatus`, `isLastLivePipelineStep`, `isStepEnabled`, `liveEnabledStepsSignature`, `markPipelinePendingFromIndex`, `noteLivePipelineApplied`, `pipelineEditBusyReason`, `pipelineStepLabel`, `pipelineStepLiveLanguage`, `pushHistory`, `reconcilePipelineSimulationAfterEdit`, `refreshRunButton`, `renderEditingBanner`, `renderRunnerWorkflow`, `reportPipelineError`, `restoreLastStepPreApplySnapshot`, `restorePipelineToCheckpointAndHold`, `runFromCheckpointAfterEdit`, `scheduleLogicAutoBackup`, `toast`, `toggleEditStep`
- 피호출(영향 전파 경로): `applyLogic`, `applyVbaStepToLiveExcel`, `attemptRunnerAutoRecovery`, `autoRepairPipelineStep`, `commitCellEdit`, `insertLogic`, `loadLogic`, `replaceLogicAt`, `requestExcelApplyCancel`, `restoreHistorySnapshot`, `restorePipelineStep`, `rollbackAddedPipelineStep`, `setPipelineRuntimeStatus`, `toggleEditStep`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
