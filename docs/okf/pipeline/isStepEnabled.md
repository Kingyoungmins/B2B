---
type: endpoint
title: isStepEnabled
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step)"
role: "==================================================================="
role_source: banner
version: "0.8.2"
loc: "pipeline.js:4-4"

# ── 입출력 ──
inputs:
  - "step"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "_buildLogicZipEntriesImpl"
  - "_handlePipelineStepToggleImpl"
  - "_offStepsAmongSent"
  - "_reconcilePipelineSimulationAfterEditImpl"
  - "_runHeldStepsBatchImpl"
  - "_stepsOnOffMap"
  - "_syncPipelineToggleStatus"
  - "activePipelineSteps"
  - "applyLogic"
  - "assistBuildProposal"
  - "assistCommitProposal"
  - "canUsePipelineCheckpointFromIndex"
  - "computeStateBeforeStep"
  - "findPipelineRuntimeExecutionBlocker"
  - "findPipelineStaticPreflightFailure"
  - "getPipelineExecutionStepIds"
  - "insertLogic"
  - "liveEnabledStepsSignature"
  - "liveEnabledStepsSignatureParts"
  - "noteLivePipelineApplied"
  - "pipelineHasBackendOnlyStep"
  - "pipelineHeaderMismatchReport"
  - "pipelineHeldBatchInfo"
  - "pipelineUsesPython"
  - "pipelineUsesVba"
  - "renderPipeline"
  - "renderRunnerWorkflow"
  - "replaceLogicAt"
  - "runPipeline"
  - "stepRequiresFullWorkbookExecution"
  - "verifyPrefixRestoreCoverage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
===================================================================

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_buildLogicZipEntriesImpl`, `_handlePipelineStepToggleImpl`, `_offStepsAmongSent`, `_reconcilePipelineSimulationAfterEditImpl`, `_runHeldStepsBatchImpl`, `_stepsOnOffMap`, `_syncPipelineToggleStatus`, `activePipelineSteps`, `applyLogic`, `assistBuildProposal`, `assistCommitProposal`, `canUsePipelineCheckpointFromIndex`, `computeStateBeforeStep`, `findPipelineRuntimeExecutionBlocker`, `findPipelineStaticPreflightFailure`, `getPipelineExecutionStepIds`, `insertLogic`, `liveEnabledStepsSignature`, `liveEnabledStepsSignatureParts`, `noteLivePipelineApplied`, `pipelineHasBackendOnlyStep`, `pipelineHeaderMismatchReport`, `pipelineHeldBatchInfo`, `pipelineUsesPython`, `pipelineUsesVba`, `renderPipeline`, `renderRunnerWorkflow`, `replaceLogicAt`, `runPipeline`, `stepRequiresFullWorkbookExecution`, `verifyPrefixRestoreCoverage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
