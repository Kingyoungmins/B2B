---
type: endpoint
title: push
module: click-recovery.js
lang: js
extraction: regex   # 정규식 근사
signature: "(arr, target)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "click-recovery.js:69-69"

# ── 입출력 ──
inputs:
  - "arr"
  - "target"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "shift"
called_by:
  - "_appendRows"
  - "_assistFileList"
  - "_assistGateReplacementCode"
  - "_buildDefaultTargetHint"
  - "_buildLogicZipEntriesImpl"
  - "_buildSchemaSummaryAtLevel"
  - "_clarifySeparatorWhitespaceQuestion"
  - "_describeFile"
  - "_diffLiveSignatureParts"
  - "_evalAst"
  - "_offStepsAmongSent"
  - "_parser"
  - "_pushAssistant"
  - "_reapplyVbaPipelineToLiveImpl"
  - "_reconcilePipelineSimulationAfterEditImpl"
  - "_recordedAssignRhsMultiset"
  - "_renderViewerInitial"
  - "_resolveFileForOps"
  - "_runHeldStepsBatchImpl"
  - "_showBatchResumeChecklist"
  - "_softRefreshResolveInstantRestore"
  - "_stripSynthesizedSheetSelects"
  - "_syncPipelineToggleStatus"
  - "_tokenize"
  - "_validRegroup"
  - "adaptInputSheetStringLiterals"
  - "add"
  - "addCell"
  - "addField"
  - "addFileMentions"
  - "applyLogic"
  - "applyVbaStepToLiveExcel"
  - "assistBuildDiagnosticsText"
  - "assistBuildDiffHtml"
  - "assistBuildProposal"
  - "assistCloseOut"
  - "assistCommitProposal"
  - "assistEnsureDom"
  - "assistHandleUserMessage"
  - "assistHistoryMessages"
  - "assistPrepareReportBundle"
  - "assistPushAssistant"
  - "assistReportResultHtml"
  - "assistUploadAttachments"
  - "augmentUserPromptWithMentions"
  - "beginExcelMirrorApplyLoading"
  - "buildDiffHtml"
  - "buildEditingContext"
  - "buildMentionHardRules"
  - "buildSheetStructureDigest"
  - "callAnthropic"
  - "callAssistLLM"
  - "callLLM"
  - "callOpenAICompatOnce"
  - "captureCrossFileDestinationSnapshots"
  - "captureCurrentViewSnapshot"
  - "clkClassify"
  - "colIdx"
  - "collectAllDownloadFiles"
  - "collectPipelineReferencedFileIds"
  - "computeSheetDiff"
  - "copyColumns"
  - "createZipBlob"
  - "crossOutputFileIdsReferencedInCode"
  - "crossWriteDestinationScan"
  - "deepClone"
  - "detectTables"
  - "dump"
  - "exactReferenceFailures"
  - "explainPipelineErrorForUser"
  - "extractCellStyle"
  - "fetchOpenAICompat"
  - "findColumnGlobal"
  - "findInputBySheet"
  - "getLLMChatHistory"
  - "insertColumns"
  - "ixiFailoverUpstreams"
  - "listAllWorkbookFileIds"
  - "llmApplyIntentToStep"
  - "llmRegroupRecordedSteps"
  - "llmSplitRecordedVba"
  - "loadInputFiles"
  - "loadOutputTemplates"
  - "looksLikeRepeatedReasoning"
  - "markPipelineRunFailureStatus"
  - "mergeForcedCellsIntoDiff"
  - "mergeInvariantSignature"
  - "negativeSignLossFailures"
  - "normalizeLoadedFiles"
  - "normalizeLoadedLogicCode"
  - "noteExcelComTimeout"
  - "onDown"
  - "onReportResult"
  - "parsePrimary"
  - "pipelineCollectWorkbookNames"
  - "pipelineExactSheetNamesFromText"
  - "pipelineHeldBatchInfo"
  - "pipelineKnownFiles"
  - "pipelinePythonMutatedBookNames"
  - "pipelinePythonSourceWorkbookNames"
  - "pipelineRuntimeExecutionBlockersForStep"
  - "pipelineTargetSheetNames"
  - "pipelineUnique"
  - "pipelineVbaTargetWorkbookNames"
  - "preopenAllExcelMirrors"
  - "prepareRun"
  - "previewSheets"
  - "protectLargeGridLiterals"
  - "publishNativeFileTabs"
  - "pushHistory"
  - "pythonComStaticSafetyFailures"
  - "readStoredZip"
  - "recomputeAllFormulas"
  - "redoHistory"
  - "refreshTabs"
  - "restorePipelineCheckpointForSuffix"
  - "restoreSoftRefreshSnapshot"
  - "run"
  - "runIsolatedLivePipelineSteps"
  - "runPipeline"
  - "runPipelineRealtime"
  - "runSearch"
  - "runVbaPipelinePreferLive"
  - "runnerAddGeneratedSheet"
  - "runnerApplyEnvConfigFilter"
  - "runnerCanonicalizeRequirementsByEnv"
  - "runnerExtractGeneratedSheetsFromCode"
  - "runnerExtractMappingRequirements"
  - "runnerGroupMappingRowsByFile"
  - "runnerMappingKnownFiles"
  - "runnerRecordedActivatePairs"
  - "runnerSheetOwnersFromCode"
  - "runnerSplitTopLevelArgs"
  - "snapExcel"
  - "syncStepPreApplySnapshot"
  - "undoHistory"
  - "uploadAttachments"
  - "vbaExactSheetReferenceFailures"
  - "vbaStaticSafetyFailures"
  - "wholeColumnCountRowTwoFailures"
  - "wirePipelineStepCrossEvidence"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_appendRows`, `_assistFileList`, `_assistGateReplacementCode`, `_buildDefaultTargetHint`, `_buildLogicZipEntriesImpl`, `_buildSchemaSummaryAtLevel`, `_clarifySeparatorWhitespaceQuestion`, `_describeFile`, `_diffLiveSignatureParts`, `_evalAst`, `_offStepsAmongSent`, `_parser`, `_pushAssistant`, `_reapplyVbaPipelineToLiveImpl`, `_reconcilePipelineSimulationAfterEditImpl`, `_recordedAssignRhsMultiset`, `_renderViewerInitial`, `_resolveFileForOps`, `_runHeldStepsBatchImpl`, `_showBatchResumeChecklist`, `_softRefreshResolveInstantRestore`, `_stripSynthesizedSheetSelects`, `_syncPipelineToggleStatus`, `_tokenize`, `_validRegroup`, `adaptInputSheetStringLiterals`, `add`, `addCell`, `addField`, `addFileMentions`, `applyLogic`, `applyVbaStepToLiveExcel`, `assistBuildDiagnosticsText`, `assistBuildDiffHtml`, `assistBuildProposal`, `assistCloseOut`, `assistCommitProposal`, `assistEnsureDom`, `assistHandleUserMessage`, `assistHistoryMessages`, `assistPrepareReportBundle`, `assistPushAssistant`, `assistReportResultHtml`, `assistUploadAttachments`, `augmentUserPromptWithMentions`, `beginExcelMirrorApplyLoading`, `buildDiffHtml`, `buildEditingContext`, `buildMentionHardRules`, `buildSheetStructureDigest`, `callAnthropic`, `callAssistLLM`, `callLLM`, `callOpenAICompatOnce`, `captureCrossFileDestinationSnapshots`, `captureCurrentViewSnapshot`, `clkClassify`, `colIdx`, `collectAllDownloadFiles`, `collectPipelineReferencedFileIds`, `computeSheetDiff`, `copyColumns`, `createZipBlob`, `crossOutputFileIdsReferencedInCode`, `crossWriteDestinationScan`, `deepClone`, `detectTables`, `dump`, `exactReferenceFailures`, `explainPipelineErrorForUser`, `extractCellStyle`, `fetchOpenAICompat`, `findColumnGlobal`, `findInputBySheet`, `getLLMChatHistory`, `insertColumns`, `ixiFailoverUpstreams`, `listAllWorkbookFileIds`, `llmApplyIntentToStep`, `llmRegroupRecordedSteps`, `llmSplitRecordedVba`, `loadInputFiles`, `loadOutputTemplates`, `looksLikeRepeatedReasoning`, `markPipelineRunFailureStatus`, `mergeForcedCellsIntoDiff`, `mergeInvariantSignature`, `negativeSignLossFailures`, `normalizeLoadedFiles`, `normalizeLoadedLogicCode`, `noteExcelComTimeout`, `onDown`, `onReportResult`, `parsePrimary`, `pipelineCollectWorkbookNames`, `pipelineExactSheetNamesFromText`, `pipelineHeldBatchInfo`, `pipelineKnownFiles`, `pipelinePythonMutatedBookNames`, `pipelinePythonSourceWorkbookNames`, `pipelineRuntimeExecutionBlockersForStep`, `pipelineTargetSheetNames`, `pipelineUnique`, `pipelineVbaTargetWorkbookNames`, `preopenAllExcelMirrors`, `prepareRun`, `previewSheets`, `protectLargeGridLiterals`, `publishNativeFileTabs`, `pushHistory`, `pythonComStaticSafetyFailures`, `readStoredZip`, `recomputeAllFormulas`, `redoHistory`, `refreshTabs`, `restorePipelineCheckpointForSuffix`, `restoreSoftRefreshSnapshot`, `run`, `runIsolatedLivePipelineSteps`, `runPipeline`, `runPipelineRealtime`, `runSearch`, `runVbaPipelinePreferLive`, `runnerAddGeneratedSheet`, `runnerApplyEnvConfigFilter`, `runnerCanonicalizeRequirementsByEnv`, `runnerExtractGeneratedSheetsFromCode`, `runnerExtractMappingRequirements`, `runnerGroupMappingRowsByFile`, `runnerMappingKnownFiles`, `runnerRecordedActivatePairs`, `runnerSheetOwnersFromCode`, `runnerSplitTopLevelArgs`, `snapExcel`, `syncStepPreApplySnapshot`, `undoHistory`, `uploadAttachments`, `vbaExactSheetReferenceFailures`, `vbaStaticSafetyFailures`, `wholeColumnCountRowTwoFailures`, `wirePipelineStepCrossEvidence`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
