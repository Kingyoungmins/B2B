---
type: endpoint
title: _reapplyVbaPipelineToLiveImpl
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(excelId, options = {})"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "pipeline.js:5517-5517"

# ── 입출력 ──
inputs:
  - "excelId"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "_offStepsAmongSent"
  - "_stepsOnOffMap"
  - "attachPipelineStepError"
  - "beginExcelMirrorApplyLoading"
  - "canUsePipelineCheckpointFromIndex"
  - "clearPipelineResumeFromIndex"
  - "crossOutputFileIdsReferencedInCode"
  - "crossWriteDestinationFileIds"
  - "currentExcelId"
  - "endExcelMirrorApplyLoading"
  - "ensurePinnedVbaTargetExcelId"
  - "excelIdForPipelineFileId"
  - "fileIdForExcelMirrorId"
  - "getFile"
  - "hideAllExcelMirrorWindows"
  - "inferPipelineStepTargetFileId"
  - "inferPipelineStepTargetSheetName"
  - "invalidateLivePipelineApplied"
  - "muteExcelMirrorForPipeline"
  - "noteLivePipelineApplied"
  - "pipelineHasUnresolvedTarget"
  - "pipelinePinnedTargetFileId"
  - "pipelineStepLiveLanguage"
  - "pipelineTimeoutMs"
  - "positionExcelMirrorWindow"
  - "postExcelMirror"
  - "push"
  - "recordVbaDebugTiming"
  - "releaseExcelMirrorPipelineMute"
  - "requirePipelineSessionExcelId"
  - "restoreVbaExcelAfterError"
  - "runIsolatedLivePipelineSteps"
  - "scheduleRestoreActiveExcelMirror"
  - "showOnlyExcelMirrorWindow"
  - "stabilizeExcelMirrorZOrder"
  - "tracePipelineRun"
  - "warnUnresolvedPipelineTarget"
  - "wirePipelineStepCrossEvidence"
calls_external:
  - "Error"
  - "Number"
  - "Set"
  - "String"
  - "addResetTarget"
  - "excelId"
  - "filter"
  - "forEach"
  - "from"
  - "includes"
  - "indexOf"
  - "isArray"
  - "isInteger"
  - "join"
  - "liveLangOf"
  - "map"
  - "max"
  - "min"
  - "now"
  - "runnerSetDone"
  - "runnerSetRunning"
  - "showOnly"
  - "slice"
  - "some"
  - "stepTargetFileId"
  - "targetFileId"
  - "toLowerCase"
called_by:
  - "reapplyVbaPipelineToLive"
reads:
  - "state.currentFileId"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 네트워크/서버 호출

## 관계
- 호출: `_offStepsAmongSent`, `_stepsOnOffMap`, `attachPipelineStepError`, `beginExcelMirrorApplyLoading`, `canUsePipelineCheckpointFromIndex`, `clearPipelineResumeFromIndex`, `crossOutputFileIdsReferencedInCode`, `crossWriteDestinationFileIds`, `currentExcelId`, `endExcelMirrorApplyLoading`, `ensurePinnedVbaTargetExcelId`, `excelIdForPipelineFileId`, `fileIdForExcelMirrorId`, `getFile`, `hideAllExcelMirrorWindows`, `inferPipelineStepTargetFileId`, `inferPipelineStepTargetSheetName`, `invalidateLivePipelineApplied`, `muteExcelMirrorForPipeline`, `noteLivePipelineApplied`, `pipelineHasUnresolvedTarget`, `pipelinePinnedTargetFileId`, `pipelineStepLiveLanguage`, `pipelineTimeoutMs`, `positionExcelMirrorWindow`, `postExcelMirror`, `push`, `recordVbaDebugTiming`, `releaseExcelMirrorPipelineMute`, `requirePipelineSessionExcelId`, `restoreVbaExcelAfterError`, `runIsolatedLivePipelineSteps`, `scheduleRestoreActiveExcelMirror`, `showOnlyExcelMirrorWindow`, `stabilizeExcelMirrorZOrder`, `tracePipelineRun`, `warnUnresolvedPipelineTarget`, `wirePipelineStepCrossEvidence`
- 피호출(영향 전파 경로): `reapplyVbaPipelineToLive`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
