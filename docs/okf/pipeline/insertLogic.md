---
type: endpoint
title: insertLogic
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step, position)"
role: "1-based position. position=1 → 맨 앞, position=N+1 → 맨 뒤(append와 동일)"
role_source: banner
version: "0.7.5"
loc: "pipeline.js:2460-2460"

# ── 입출력 ──
inputs:
  - "step"
  - "position"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: pipeline"
raises: []

# ── 유기적 관계 ──
calls:
  - "_demoteHeld"
  - "applyMappedSingleStep"
  - "bindPipelineStepTargetContext"
  - "canUsePipelineCheckpointFromIndex"
  - "cancelActiveBackendPipeline"
  - "clearPipelineResumeFromIndex"
  - "getPipelineResumeFromIndex"
  - "hasBackendOnlyWorkbooks"
  - "isStepEnabled"
  - "normalizeStep"
  - "pipelineHasBackendOnlyStep"
  - "pipelineStepLiveLanguage"
  - "pipelineStepWritesCrossFile"
  - "pipelineUsesPython"
  - "pushHistory"
  - "reapplyVbaPipelineToLive"
  - "reconcilePipelineSimulationAfterEdit"
  - "refreshRunButton"
  - "renderPipeline"
  - "reportPipelineError"
  - "requestExcelApplyCancel"
  - "rollbackAddedPipelineStep"
  - "runFromCheckpointAfterEdit"
  - "runPipeline"
  - "scheduleLogicAutoBackup"
  - "setPipelineResumeFromIndex"
  - "setPipelineRuntimeStatus"
  - "shouldDeferImmediatePipelineRun"
  - "toast"
  - "vbaTargetExcelId"
calls_external:
  - "OFF"
  - "async"
  - "error"
  - "filter"
  - "findIndex"
  - "isInteger"
  - "map"
  - "max"
  - "min"
  - "slice"
  - "splice"
  - "then"
called_by:
  - "addAssistantReply"
  - "applyLogic"
  - "runInsert"
reads:
  - "state.pipeline"
writes:
  - "pipeline"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
1-based position. position=1 → 맨 앞, position=N+1 → 맨 뒤(append와 동일)

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: pipeline
- 변경 상태 `pipeline` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_demoteHeld`, `applyMappedSingleStep`, `bindPipelineStepTargetContext`, `canUsePipelineCheckpointFromIndex`, `cancelActiveBackendPipeline`, `clearPipelineResumeFromIndex`, `getPipelineResumeFromIndex`, `hasBackendOnlyWorkbooks`, `isStepEnabled`, `normalizeStep`, `pipelineHasBackendOnlyStep`, `pipelineStepLiveLanguage`, `pipelineStepWritesCrossFile`, `pipelineUsesPython`, `pushHistory`, `reapplyVbaPipelineToLive`, `reconcilePipelineSimulationAfterEdit`, `refreshRunButton`, `renderPipeline`, `reportPipelineError`, `requestExcelApplyCancel`, `rollbackAddedPipelineStep`, `runFromCheckpointAfterEdit`, `runPipeline`, `scheduleLogicAutoBackup`, `setPipelineResumeFromIndex`, `setPipelineRuntimeStatus`, `shouldDeferImmediatePipelineRun`, `toast`, `vbaTargetExcelId`
- 피호출(영향 전파 경로): `addAssistantReply`, `applyLogic`, `runInsert`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
