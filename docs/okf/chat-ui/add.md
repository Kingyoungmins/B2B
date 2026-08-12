---
type: endpoint
title: add
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(msg)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "chat-ui.js:1093-1093"

# ── 입출력 ──
inputs:
  - "msg"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
calls_external:
  - "includes"
called_by:
  - "_flashChatMessage"
  - "_highlightCurrent"
  - "_recordedWindowSheetPairs"
  - "_renderViewerInitial"
  - "_toggleSheetSelection"
  - "addCell"
  - "applyBackendPipelineResult"
  - "askUserChoice"
  - "assistHandleUserMessage"
  - "augmentUserPromptWithMentions"
  - "autoRegenerateAsVbaFallback"
  - "autoRegenerateForMissingCode"
  - "autoRegenerateForStaticSafety"
  - "beginUiBusy"
  - "bindChatHistoryEntryToMessage"
  - "captureCurrentViewSnapshot"
  - "chooseBackendRestoreView"
  - "codeHasBroadValueRewrite"
  - "collectPipelineReferencedFileIds"
  - "crossWriteDestinationFileIds"
  - "ensurePipelineStepIds"
  - "exactSheetNamesFromMentions"
  - "finalizeActionButtonFromResult"
  - "flashChangedViewCells"
  - "flashFilled"
  - "loadLogicFiles"
  - "negativeSignLossFailures"
  - "offerMissingDependencySkillCandidate"
  - "onDown"
  - "openDownloadModal"
  - "openInsertPositionDialog"
  - "openMenu"
  - "openRunnerFileEditor"
  - "openRunnerLogicEditor"
  - "openSaveModal"
  - "openSettingsModal"
  - "openUserSettingsModal"
  - "paintViewerSelections"
  - "pipelineCollectWorkbookNames"
  - "pipelineExactSheetNamesFromText"
  - "pipelineKnownFiles"
  - "pipelinePythonMutatedBookNames"
  - "pipelineRuntimeExecutionBlockersForStep"
  - "pipelineSheetLiteralsFromCode"
  - "pipelineTargetSheetNames"
  - "pipelineVbaTargetWorkbookNames"
  - "push"
  - "pythonComStaticSafetyFailures"
  - "renderEditingBanner"
  - "renderPipeline"
  - "renderRunnerWorkflow"
  - "repairPasteCopiedInternalBookNames"
  - "repairStalePromptBookNames"
  - "repairStaleTargetFileIds"
  - "replaceSimulatorWithMirrorShell"
  - "requestErrorRecovery"
  - "requestedExcelColumnLetters"
  - "restorePipelineCheckpointForSuffix"
  - "restorePipelineToCheckpointAndHold"
  - "runIsolatedLivePipelineSteps"
  - "runPipeline"
  - "runSearch"
  - "runnerCanonicalizeRequirementsByEnv"
  - "runnerGeneratedSheetNameSet"
  - "runnerSheetOwnersFromCode"
  - "sendChat"
  - "setActionButtonPending"
  - "setGeneratorRunLoading"
  - "setupDrop"
  - "setupNodeDrop"
  - "setupStreamingAssistantMessage"
  - "showFindBar"
  - "showRecordReviewDialog"
  - "showThinkRetryPrompt"
  - "syncStepPreApplySnapshot"
  - "vbaSheetReferenceLiterals"
  - "vbaStaticSafetyFailures"
  - "verifyPrefixRestoreCoverage"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `_flashChatMessage`, `_highlightCurrent`, `_recordedWindowSheetPairs`, `_renderViewerInitial`, `_toggleSheetSelection`, `addCell`, `applyBackendPipelineResult`, `askUserChoice`, `assistHandleUserMessage`, `augmentUserPromptWithMentions`, `autoRegenerateAsVbaFallback`, `autoRegenerateForMissingCode`, `autoRegenerateForStaticSafety`, `beginUiBusy`, `bindChatHistoryEntryToMessage`, `captureCurrentViewSnapshot`, `chooseBackendRestoreView`, `codeHasBroadValueRewrite`, `collectPipelineReferencedFileIds`, `crossWriteDestinationFileIds`, `ensurePipelineStepIds`, `exactSheetNamesFromMentions`, `finalizeActionButtonFromResult`, `flashChangedViewCells`, `flashFilled`, `loadLogicFiles`, `negativeSignLossFailures`, `offerMissingDependencySkillCandidate`, `onDown`, `openDownloadModal`, `openInsertPositionDialog`, `openMenu`, `openRunnerFileEditor`, `openRunnerLogicEditor`, `openSaveModal`, `openSettingsModal`, `openUserSettingsModal`, `paintViewerSelections`, `pipelineCollectWorkbookNames`, `pipelineExactSheetNamesFromText`, `pipelineKnownFiles`, `pipelinePythonMutatedBookNames`, `pipelineRuntimeExecutionBlockersForStep`, `pipelineSheetLiteralsFromCode`, `pipelineTargetSheetNames`, `pipelineVbaTargetWorkbookNames`, `push`, `pythonComStaticSafetyFailures`, `renderEditingBanner`, `renderPipeline`, `renderRunnerWorkflow`, `repairPasteCopiedInternalBookNames`, `repairStalePromptBookNames`, `repairStaleTargetFileIds`, `replaceSimulatorWithMirrorShell`, `requestErrorRecovery`, `requestedExcelColumnLetters`, `restorePipelineCheckpointForSuffix`, `restorePipelineToCheckpointAndHold`, `runIsolatedLivePipelineSteps`, `runPipeline`, `runSearch`, `runnerCanonicalizeRequirementsByEnv`, `runnerGeneratedSheetNameSet`, `runnerSheetOwnersFromCode`, `sendChat`, `setActionButtonPending`, `setGeneratorRunLoading`, `setupDrop`, `setupNodeDrop`, `setupStreamingAssistantMessage`, `showFindBar`, `showRecordReviewDialog`, `showThinkRetryPrompt`, `syncStepPreApplySnapshot`, `vbaSheetReferenceLiterals`, `vbaStaticSafetyFailures`, `verifyPrefixRestoreCoverage`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
