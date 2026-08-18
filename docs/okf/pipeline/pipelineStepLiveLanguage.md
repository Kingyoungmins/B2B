---
type: endpoint
title: pipelineStepLiveLanguage
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(s)"
role: "[혼합 호환] 스텝의 라이브 실행 언어 — vba/python(COM bulk)이면 라이브 Excel 에서 실행 가능."
role_source: banner
version: "0.7.4"
loc: "pipeline.js:96-96"

# ── 입출력 ──
inputs:
  - "s"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "inferPipelineStepLanguage"
  - "pythonStepUsesLegacyDialect"
calls_external: []
called_by:
  - "_handlePipelineStepToggleImpl"
  - "_reapplyVbaPipelineToLiveImpl"
  - "_reconcilePipelineSimulationAfterEditImpl"
  - "applyLastEnabledStepFast"
  - "applyLogic"
  - "canFastEditLastPipelineStep"
  - "insertLogic"
  - "isLastLivePipelineStep"
  - "lastLiveStepIndex"
  - "liveEnabledStepsSignature"
  - "liveEnabledStepsSignatureParts"
  - "pipelineHasBackendOnlyStep"
  - "pipelinePinnedAnyTargetFileId"
  - "pipelinePinnedTargetFileId"
  - "pipelineUsesLiveSkill"
  - "renderPipeline"
  - "replaceLogicAt"
  - "runIsolatedLivePipelineSteps"
  - "runLivePipelineStepSequentially"
  - "runPipelineWithAutoRepair"
  - "runVbaPipelinePreferLive"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[혼합 호환] 스텝의 라이브 실행 언어 — vba/python(COM bulk)이면 라이브 Excel 에서 실행 가능.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `inferPipelineStepLanguage`, `pythonStepUsesLegacyDialect`
- 피호출(영향 전파 경로): `_handlePipelineStepToggleImpl`, `_reapplyVbaPipelineToLiveImpl`, `_reconcilePipelineSimulationAfterEditImpl`, `applyLastEnabledStepFast`, `applyLogic`, `canFastEditLastPipelineStep`, `insertLogic`, `isLastLivePipelineStep`, `lastLiveStepIndex`, `liveEnabledStepsSignature`, `liveEnabledStepsSignatureParts`, `pipelineHasBackendOnlyStep`, `pipelinePinnedAnyTargetFileId`, `pipelinePinnedTargetFileId`, `pipelineUsesLiveSkill`, `renderPipeline`, `replaceLogicAt`, `runIsolatedLivePipelineSteps`, `runLivePipelineStepSequentially`, `runPipelineWithAutoRepair`, `runVbaPipelinePreferLive`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
