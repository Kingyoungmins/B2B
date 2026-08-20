---
type: endpoint
title: renderPipeline
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "pipeline.js:3638-3638"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: editingStepId, pipeline, renamingDraft, renamingSelectAll, renamingStepId"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
  - "add"
  - "canFastEditLastPipelineStep"
  - "commit"
  - "ensurePipelineStepIds"
  - "escapeHtml"
  - "getPipelineResumeFromIndex"
  - "getPipelineRuntimeStatus"
  - "handlePipelineStepToggle"
  - "isLastLivePipelineStep"
  - "isStepEnabled"
  - "markPipelinePendingFromIndex"
  - "noteLivePipelineApplied"
  - "openLabelRename"
  - "pipelineEditBusyReason"
  - "pipelineStepLabel"
  - "pipelineStepLiveLanguage"
  - "pipelineSuffixWritesCrossFile"
  - "pushHistory"
  - "reconcilePipelineSimulationAfterEdit"
  - "refreshRunButton"
  - "renderEditingBanner"
  - "renderRunnerWorkflow"
  - "reportPipelineError"
  - "restoreLastStepPreApplySnapshot"
  - "restorePipelineToCheckpointAndHold"
  - "scheduleLogicAutoBackup"
  - "toast"
  - "toggleEditStep"
calls_external:
  - "String"
  - "appendChild"
  - "async"
  - "createDocumentFragment"
  - "createElement"
  - "enabled"
  - "findIndex"
  - "focus"
  - "forEach"
  - "isInteger"
  - "map"
  - "max"
  - "min"
  - "null"
  - "preventDefault"
  - "querySelector"
  - "select"
  - "setSelectionRange"
  - "some"
  - "splice"
  - "stopPropagation"
  - "trim"
  - "warn"
called_by:
  - "_demoteHeld"
  - "_handlePipelineStepToggleImpl"
  - "_runHeldStepsBatchImpl"
  - "applyLogic"
  - "applyVbaStepToLiveExcel"
  - "assistCommitProposal"
  - "attemptRunnerAutoRecovery"
  - "autoRepairPipelineStep"
  - "clearRunnerLogic"
  - "commit"
  - "commitCellEdit"
  - "insertLogic"
  - "loadLogic"
  - "markLivePipelineOutOfSync"
  - "openLabelRename"
  - "promise"
  - "replaceLogicAt"
  - "requestExcelApplyCancel"
  - "restoreHistorySnapshot"
  - "restorePipelineStep"
  - "revertAll"
  - "revertOn"
  - "rollbackAddedPipelineStep"
  - "setPipelineRuntimeStatus"
  - "toggleEditStep"
reads:
  - "state.editingStepId"
  - "state.pipeline"
  - "state.renamingDraft"
  - "state.renamingSelectAll"
  - "state.renamingStepId"
writes:
  - "editingStepId"
  - "pipeline"
  - "renamingDraft"
  - "renamingSelectAll"
  - "renamingStepId"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: editingStepId, pipeline, renamingDraft, renamingSelectAll, renamingStepId
- 변경 상태 `editingStepId, pipeline, renamingDraft, renamingSelectAll, renamingStepId` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `$`, `add`, `canFastEditLastPipelineStep`, `commit`, `ensurePipelineStepIds`, `escapeHtml`, `getPipelineResumeFromIndex`, `getPipelineRuntimeStatus`, `handlePipelineStepToggle`, `isLastLivePipelineStep`, `isStepEnabled`, `markPipelinePendingFromIndex`, `noteLivePipelineApplied`, `openLabelRename`, `pipelineEditBusyReason`, `pipelineStepLabel`, `pipelineStepLiveLanguage`, `pipelineSuffixWritesCrossFile`, `pushHistory`, `reconcilePipelineSimulationAfterEdit`, `refreshRunButton`, `renderEditingBanner`, `renderRunnerWorkflow`, `reportPipelineError`, `restoreLastStepPreApplySnapshot`, `restorePipelineToCheckpointAndHold`, `scheduleLogicAutoBackup`, `toast`, `toggleEditStep`
- 피호출(영향 전파 경로): `_demoteHeld`, `_handlePipelineStepToggleImpl`, `_runHeldStepsBatchImpl`, `applyLogic`, `applyVbaStepToLiveExcel`, `assistCommitProposal`, `attemptRunnerAutoRecovery`, `autoRepairPipelineStep`, `clearRunnerLogic`, `commit`, `commitCellEdit`, `insertLogic`, `loadLogic`, `markLivePipelineOutOfSync`, `openLabelRename`, `promise`, `replaceLogicAt`, `requestExcelApplyCancel`, `restoreHistorySnapshot`, `restorePipelineStep`, `revertAll`, `revertOn`, `rollbackAddedPipelineStep`, `setPipelineRuntimeStatus`, `toggleEditStep`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
