---
type: endpoint
title: autoRepairPipelineStep
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(stepIdx, reason, repairCount)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "pipeline.js:6500-6500"

# ── 입출력 ──
inputs:
  - "stepIdx"
  - "reason"
  - "repairCount"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "addMessage"
  - "buildPipelineAutoRepairPrompt"
  - "callLLM"
  - "callLLMOneShot"
  - "choosePipelineRepairLanguage"
  - "createPipelineStepError"
  - "extractDescription"
  - "extractPipelineRepairCode"
  - "inferCodeLanguage"
  - "localRepairPipelineStep"
  - "normalizeStep"
  - "pipelineRepairSystemPrompt"
  - "pipelineStaticFailuresForCode"
  - "pipelineStepRepairSourceMessage"
  - "pushHistory"
  - "refreshRunButton"
  - "renderPipeline"
  - "renderRunnerWorkflow"
  - "scheduleLogicAutoBackup"
  - "setPipelineRuntimeStatus"
  - "toast"
calls_external:
  - "Date"
  - "Number"
  - "String"
  - "generatorSetProgress"
  - "getElementById"
  - "join"
  - "slice"
  - "toISOString"
called_by:
  - "attemptRunnerAutoRecovery"
  - "runPipelineWithAutoRepair"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `addMessage`, `buildPipelineAutoRepairPrompt`, `callLLM`, `callLLMOneShot`, `choosePipelineRepairLanguage`, `createPipelineStepError`, `extractDescription`, `extractPipelineRepairCode`, `inferCodeLanguage`, `localRepairPipelineStep`, `normalizeStep`, `pipelineRepairSystemPrompt`, `pipelineStaticFailuresForCode`, `pipelineStepRepairSourceMessage`, `pushHistory`, `refreshRunButton`, `renderPipeline`, `renderRunnerWorkflow`, `scheduleLogicAutoBackup`, `setPipelineRuntimeStatus`, `toast`
- 피호출(영향 전파 경로): `attemptRunnerAutoRecovery`, `runPipelineWithAutoRepair`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
