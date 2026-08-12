---
type: endpoint
title: runIsolatedLivePipelineSteps
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(sourceSteps, initialExcelId, options = {})"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "pipeline.js:1262-1262"

# ── 입출력 ──
inputs:
  - "sourceSteps"
  - "initialExcelId"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "네트워크/서버 호출"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "_offStepsAmongSent"
  - "_stepsOnOffMap"
  - "_throwIfAbandoned"
  - "activePipelineSteps"
  - "add"
  - "applyLiveSchemaToFileCache"
  - "beginExcelMirrorApplyLoading"
  - "createPipelineRuntimeExecutionBlockError"
  - "endExcelMirrorApplyLoading"
  - "ensurePipelineReferencedSessionsOpen"
  - "fileIdForExcelMirrorId"
  - "findPipelineRuntimeExecutionBlocker"
  - "invalidateLivePipelineApplied"
  - "isolatedPipelineStepPayload"
  - "muteExcelMirrorForPipeline"
  - "noteLivePipelineApplied"
  - "pipelineFullRunStateSig"
  - "pipelinePinnedTargetFileId"
  - "pipelineStepLiveLanguage"
  - "pipelineStepMutationFileId"
  - "pipelineTimeoutMs"
  - "postExcelMirror"
  - "preferredVbaRunFileId"
  - "push"
  - "recordVbaDebugTiming"
  - "releaseExcelMirrorPipelineMute"
  - "requirePipelineSessionExcelId"
  - "restoreVbaExcelAfterError"
  - "scheduleRestoreActiveExcelMirror"
  - "setPipelineRuntimeStatus"
  - "sync"
  - "toast"
  - "tracePipelineRun"
  - "wirePipelineStepCrossEvidence"
  - "wirePipelineStepSnapshots"
calls_external:
  - "Error"
  - "Number"
  - "Set"
  - "addReset"
  - "clearInterval"
  - "concat"
  - "encodeURIComponent"
  - "excel_call"
  - "fetch"
  - "filter"
  - "find"
  - "forEach"
  - "from"
  - "has"
  - "includes"
  - "indexOf"
  - "isArray"
  - "isInteger"
  - "join"
  - "json"
  - "keys"
  - "map"
  - "max"
  - "min"
  - "now"
  - "reduce"
  - "round"
  - "runnerSetProgress"
  - "setInterval"
  - "skipReset"
  - "slice"
  - "some"
  - "then"
  - "through"
  - "wiring"
called_by:
  - "_reapplyVbaPipelineToLiveImpl"
  - "_runPipelineSuffixFromCheckpointImpl"
  - "runVbaPipelinePreferLive"
reads:
  - "state.currentFileId"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 네트워크/서버 호출
- 타이머

## 관계
- 호출: `_offStepsAmongSent`, `_stepsOnOffMap`, `_throwIfAbandoned`, `activePipelineSteps`, `add`, `applyLiveSchemaToFileCache`, `beginExcelMirrorApplyLoading`, `createPipelineRuntimeExecutionBlockError`, `endExcelMirrorApplyLoading`, `ensurePipelineReferencedSessionsOpen`, `fileIdForExcelMirrorId`, `findPipelineRuntimeExecutionBlocker`, `invalidateLivePipelineApplied`, `isolatedPipelineStepPayload`, `muteExcelMirrorForPipeline`, `noteLivePipelineApplied`, `pipelineFullRunStateSig`, `pipelinePinnedTargetFileId`, `pipelineStepLiveLanguage`, `pipelineStepMutationFileId`, `pipelineTimeoutMs`, `postExcelMirror`, `preferredVbaRunFileId`, `push`, `recordVbaDebugTiming`, `releaseExcelMirrorPipelineMute`, `requirePipelineSessionExcelId`, `restoreVbaExcelAfterError`, `scheduleRestoreActiveExcelMirror`, `setPipelineRuntimeStatus`, `sync`, `toast`, `tracePipelineRun`, `wirePipelineStepCrossEvidence`, `wirePipelineStepSnapshots`
- 피호출(영향 전파 경로): `_reapplyVbaPipelineToLiveImpl`, `_runPipelineSuffixFromCheckpointImpl`, `runVbaPipelinePreferLive`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
