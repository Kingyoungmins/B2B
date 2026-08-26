---
type: endpoint
title: toast
module: util.js
lang: js
extraction: regex   # 정규식 근사
signature: "(msg, type)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "util.js:5-5"

# ── 입출력 ──
inputs:
  - "msg"
  - "type"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
calls_external:
  - "clearTimeout"
  - "remove"
  - "setTimeout"
called_by:
  - "_fail"
  - "_handlePipelineStepToggleImpl"
  - "_lazyFail"
  - "_reconcilePipelineSimulationAfterEditImpl"
  - "_runHeldStepsBatchImpl"
  - "_runPipelineSuffixFromCheckpointImpl"
  - "addAssistantReply"
  - "applyForcedPythonFallback"
  - "applyLogic"
  - "applyUiTheme"
  - "applyVbaStepToLiveExcel"
  - "assistCommitProposal"
  - "attachChatMessageDeleteButton"
  - "attemptRunnerAutoRecovery"
  - "autoRegenerateAsVbaFallback"
  - "autoRegenerateForMissingCode"
  - "autoRegenerateForStaticSafety"
  - "autoRepairPipelineStep"
  - "beginUiBusy"
  - "chooseLogicAutoBackupDir"
  - "clearRunnerLogic"
  - "closeCurrentExcelMirror"
  - "commitCellEdit"
  - "confirm"
  - "downloadAllFilesZip"
  - "downloadCurrentWorkbookFile"
  - "downloadWorkbookFileFromList"
  - "endUiBusy"
  - "forceRestartExcelMirrors"
  - "forceShowBackendResultMirror"
  - "insertLogic"
  - "loadInputFiles"
  - "loadLogic"
  - "loadOutputTemplates"
  - "markLivePipelineOutOfSync"
  - "maybeAutoReapplyAfterRecover"
  - "onReconnected"
  - "openBatchResumeModal"
  - "openCurrentWorkbookInExcel"
  - "openDownloadModal"
  - "openInsertPositionDialog"
  - "openLoadDialog"
  - "openSaveModal"
  - "openSettingsModal"
  - "openUserSettingsModal"
  - "preopenAllExcelMirrors"
  - "promise"
  - "redoHistory"
  - "registerWorkbookBackend"
  - "renderPipeline"
  - "replaceLogicAt"
  - "reportPipelineError"
  - "requestErrorRecovery"
  - "requestExcelApplyCancel"
  - "restorePipelineToCheckpointAndHold"
  - "restoreSoftRefreshSnapshot"
  - "runEditApply"
  - "runFromCheckpointAfterEdit"
  - "runIsolatedLivePipelineSteps"
  - "runPipelineOnBackend"
  - "runPipelinePreferBackend"
  - "saveCurrentExcelMirror"
  - "saveLogicAutoBackup"
  - "scrollChatToStepRequest"
  - "secureDocSaveBlob"
  - "secureDownloadUrl"
  - "sendChat"
  - "setSkillEngine"
  - "setupThinkToggle"
  - "shouldSkipHeavyHistory"
  - "showCodeGuardBlock"
  - "showRunnerPreflightNotice"
  - "showTopTabSwitchHint"
  - "softRefreshApp"
  - "switchVisibleExcelMirrorToFileId"
  - "toggleEditStep"
  - "undoHistory"
  - "warnUnresolvedPipelineTarget"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 타이머

## 관계
- 호출: `$`
- 피호출(영향 전파 경로): `_fail`, `_handlePipelineStepToggleImpl`, `_lazyFail`, `_reconcilePipelineSimulationAfterEditImpl`, `_runHeldStepsBatchImpl`, `_runPipelineSuffixFromCheckpointImpl`, `addAssistantReply`, `applyForcedPythonFallback`, `applyLogic`, `applyUiTheme`, `applyVbaStepToLiveExcel`, `assistCommitProposal`, `attachChatMessageDeleteButton`, `attemptRunnerAutoRecovery`, `autoRegenerateAsVbaFallback`, `autoRegenerateForMissingCode`, `autoRegenerateForStaticSafety`, `autoRepairPipelineStep`, `beginUiBusy`, `chooseLogicAutoBackupDir`, `clearRunnerLogic`, `closeCurrentExcelMirror`, `commitCellEdit`, `confirm`, `downloadAllFilesZip`, `downloadCurrentWorkbookFile`, `downloadWorkbookFileFromList`, `endUiBusy`, `forceRestartExcelMirrors`, `forceShowBackendResultMirror`, `insertLogic`, `loadInputFiles`, `loadLogic`, `loadOutputTemplates`, `markLivePipelineOutOfSync`, `maybeAutoReapplyAfterRecover`, `onReconnected`, `openBatchResumeModal`, `openCurrentWorkbookInExcel`, `openDownloadModal`, `openInsertPositionDialog`, `openLoadDialog`, `openSaveModal`, `openSettingsModal`, `openUserSettingsModal`, `preopenAllExcelMirrors`, `promise`, `redoHistory`, `registerWorkbookBackend`, `renderPipeline`, `replaceLogicAt`, `reportPipelineError`, `requestErrorRecovery`, `requestExcelApplyCancel`, `restorePipelineToCheckpointAndHold`, `restoreSoftRefreshSnapshot`, `runEditApply`, `runFromCheckpointAfterEdit`, `runIsolatedLivePipelineSteps`, `runPipelineOnBackend`, `runPipelinePreferBackend`, `saveCurrentExcelMirror`, `saveLogicAutoBackup`, `scrollChatToStepRequest`, `secureDocSaveBlob`, `secureDownloadUrl`, `sendChat`, `setSkillEngine`, `setupThinkToggle`, `shouldSkipHeavyHistory`, `showCodeGuardBlock`, `showRunnerPreflightNotice`, `showTopTabSwitchHint`, `softRefreshApp`, `switchVisibleExcelMirrorToFileId`, `toggleEditStep`, `undoHistory`, `warnUnresolvedPipelineTarget`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
