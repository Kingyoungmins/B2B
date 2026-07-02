---
type: endpoint
title: push
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(id, file, fallback)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "pipeline.js:359-359"

# ── 입출력 ──
inputs:
  - "id"
  - "file"
  - "fallback"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "workbookDisplayName"
calls_external:
  - "has"
called_by:
  - "_appendRows"
  - "_buildDefaultTargetHint"
  - "_buildSchemaSummaryAtLevel"
  - "_describeFile"
  - "_evalAst"
  - "_parser"
  - "_renderViewerInitial"
  - "_resolveFileForOps"
  - "_tokenize"
  - "adaptInputSheetStringLiterals"
  - "add"
  - "addCell"
  - "addFileMentions"
  - "applyLogic"
  - "applyVbaStepToLiveExcel"
  - "augmentUserPromptWithMentions"
  - "buildEditingContext"
  - "buildLogicZipEntries"
  - "buildMentionHardRules"
  - "callAnthropic"
  - "callLLM"
  - "callOpenAICompatOnce"
  - "captureCurrentViewSnapshot"
  - "collectAllDownloadFiles"
  - "collectPipelineReferencedFileIds"
  - "computeSheetDiff"
  - "copyColumns"
  - "createZipBlob"
  - "crossOutputFileIdsReferencedInCode"
  - "deepClone"
  - "detectTables"
  - "exactReferenceFailures"
  - "extractCellStyle"
  - "fetchOpenAICompat"
  - "findColumnGlobal"
  - "findInputBySheet"
  - "getLLMChatHistory"
  - "insertColumns"
  - "listAllWorkbookFileIds"
  - "loadInputFiles"
  - "loadOutputTemplates"
  - "looksLikeRepeatedReasoning"
  - "markPipelineRunFailureStatus"
  - "mergeForcedCellsIntoDiff"
  - "negativeSignLossFailures"
  - "normalizeLoadedFiles"
  - "normalizeLoadedLogicCode"
  - "noteExcelComTimeout"
  - "parsePrimary"
  - "pipelineCollectWorkbookNames"
  - "pipelineExactSheetNamesFromText"
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
  - "publishNativeFileTabs"
  - "pushHistory"
  - "pythonComStaticSafetyFailures"
  - "readStoredZip"
  - "reapplyVbaPipelineToLive"
  - "recomputeAllFormulas"
  - "redoHistory"
  - "refreshTabs"
  - "restorePipelineCheckpointForSuffix"
  - "runIsolatedLivePipelineSteps"
  - "runPipeline"
  - "runPipelineRealtime"
  - "runSearch"
  - "syncStepPreApplySnapshot"
  - "undoHistory"
  - "vbaExactSheetReferenceFailures"
  - "vbaStaticSafetyFailures"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `workbookDisplayName`
- 피호출(영향 전파 경로): `_appendRows`, `_buildDefaultTargetHint`, `_buildSchemaSummaryAtLevel`, `_describeFile`, `_evalAst`, `_parser`, `_renderViewerInitial`, `_resolveFileForOps`, `_tokenize`, `adaptInputSheetStringLiterals`, `add`, `addCell`, `addFileMentions`, `applyLogic`, `applyVbaStepToLiveExcel`, `augmentUserPromptWithMentions`, `buildEditingContext`, `buildLogicZipEntries`, `buildMentionHardRules`, `callAnthropic`, `callLLM`, `callOpenAICompatOnce`, `captureCurrentViewSnapshot`, `collectAllDownloadFiles`, `collectPipelineReferencedFileIds`, `computeSheetDiff`, `copyColumns`, `createZipBlob`, `crossOutputFileIdsReferencedInCode`, `deepClone`, `detectTables`, `exactReferenceFailures`, `extractCellStyle`, `fetchOpenAICompat`, `findColumnGlobal`, `findInputBySheet`, `getLLMChatHistory`, `insertColumns`, `listAllWorkbookFileIds`, `loadInputFiles`, `loadOutputTemplates`, `looksLikeRepeatedReasoning`, `markPipelineRunFailureStatus`, `mergeForcedCellsIntoDiff`, `negativeSignLossFailures`, `normalizeLoadedFiles`, `normalizeLoadedLogicCode`, `noteExcelComTimeout`, `parsePrimary`, `pipelineCollectWorkbookNames`, `pipelineExactSheetNamesFromText`, `pipelineKnownFiles`, `pipelinePythonMutatedBookNames`, `pipelinePythonSourceWorkbookNames`, `pipelineRuntimeExecutionBlockersForStep`, `pipelineTargetSheetNames`, `pipelineUnique`, `pipelineVbaTargetWorkbookNames`, `preopenAllExcelMirrors`, `prepareRun`, `previewSheets`, `publishNativeFileTabs`, `pushHistory`, `pythonComStaticSafetyFailures`, `readStoredZip`, `reapplyVbaPipelineToLive`, `recomputeAllFormulas`, `redoHistory`, `refreshTabs`, `restorePipelineCheckpointForSuffix`, `runIsolatedLivePipelineSteps`, `runPipeline`, `runPipelineRealtime`, `runSearch`, `syncStepPreApplySnapshot`, `undoHistory`, `vbaExactSheetReferenceFailures`, `vbaStaticSafetyFailures`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
