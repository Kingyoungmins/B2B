---
type: endpoint
title: _handlePipelineStepToggleImpl
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(stepId)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "pipeline.js:3764-3764"

# ── 입출력 ──
inputs:
  - "stepId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: pipeline"
raises: []

# ── 유기적 관계 ──
calls:
  - "_diffLiveSignatureParts"
  - "_pipelineCoreBusyReason"
  - "_stepsOnOffMap"
  - "_syncPipelineToggleStatus"
  - "applyMappedSingleStep"
  - "canFastEditLastPipelineStep"
  - "clearPipelineResumeFromIndex"
  - "isStepEnabled"
  - "liveEnabledStepsSignature"
  - "liveEnabledStepsSignatureParts"
  - "markHeld"
  - "markPipelinePendingFromIndex"
  - "noteLivePipelineApplied"
  - "pipelineStepLiveLanguage"
  - "pipelineStepWritesCrossFile"
  - "pipelineSuffixCrossUnresolvedNames"
  - "pipelineSuffixWritesCrossFile"
  - "pushHistory"
  - "reconcilePipelineSimulationAfterEdit"
  - "refreshRunButton"
  - "renderPipeline"
  - "reportPipelineError"
  - "restoreLastStepPreApplySnapshot"
  - "restorePipelineToCheckpointAndHold"
  - "revertAll"
  - "revertOn"
  - "scheduleLogicAutoBackup"
  - "setPipelineRuntimeStatus"
  - "toast"
  - "traceOff"
  - "tracePipelineRun"
  - "traceToggleOnRoute"
calls_external:
  - "String"
  - "enabled"
  - "every"
  - "filter"
  - "findIndex"
  - "map"
  - "path"
  - "reconcile"
  - "slice"
  - "some"
  - "then"
  - "warn"
called_by:
  - "handlePipelineStepToggle"
  - "run"
reads:
  - "state.pipeline"
  - "state.runnerMappingChecked"
  - "state.runnerMappingRunActive"
writes:
  - "pipeline"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: pipeline
- 변경 상태 `pipeline` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_diffLiveSignatureParts`, `_pipelineCoreBusyReason`, `_stepsOnOffMap`, `_syncPipelineToggleStatus`, `applyMappedSingleStep`, `canFastEditLastPipelineStep`, `clearPipelineResumeFromIndex`, `isStepEnabled`, `liveEnabledStepsSignature`, `liveEnabledStepsSignatureParts`, `markHeld`, `markPipelinePendingFromIndex`, `noteLivePipelineApplied`, `pipelineStepLiveLanguage`, `pipelineStepWritesCrossFile`, `pipelineSuffixCrossUnresolvedNames`, `pipelineSuffixWritesCrossFile`, `pushHistory`, `reconcilePipelineSimulationAfterEdit`, `refreshRunButton`, `renderPipeline`, `reportPipelineError`, `restoreLastStepPreApplySnapshot`, `restorePipelineToCheckpointAndHold`, `revertAll`, `revertOn`, `scheduleLogicAutoBackup`, `setPipelineRuntimeStatus`, `toast`, `traceOff`, `tracePipelineRun`, `traceToggleOnRoute`
- 피호출(영향 전파 경로): `handlePipelineStepToggle`, `run`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
