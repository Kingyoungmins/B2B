---
type: endpoint
title: _runHeldStepsBatchImpl
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(checkedIds, fingerprint)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "pipeline.js:5081-5081"

# ── 입출력 ──
inputs:
  - "checkedIds"
  - "fingerprint"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_pipelineCoreBusyReason"
  - "_syncPipelineToggleStatus"
  - "clearPipelineResumeFromIndex"
  - "currentExcelId"
  - "excelIdForPipelineFileId"
  - "getPipelineRuntimeStatus"
  - "isStepEnabled"
  - "noteLivePipelineApplied"
  - "pipelineFailedStepIdFromError"
  - "pipelineHeldBatchInfo"
  - "preferredVbaRunFileId"
  - "push"
  - "pushHistory"
  - "reapplyVbaPipelineToLive"
  - "refreshBatchResumeButton"
  - "refreshRunButton"
  - "renderPipeline"
  - "reportPipelineError"
  - "runPipelineSuffixFromCheckpoint"
  - "scheduleLogicAutoBackup"
  - "setPipelineResumeFromIndex"
  - "setPipelineRuntimeStatus"
  - "toast"
  - "vbaTargetExcelId"
calls_external:
  - "Error"
  - "OFF"
  - "Set"
  - "String"
  - "error"
  - "every"
  - "filter"
  - "findIndex"
  - "has"
  - "id"
  - "isArray"
  - "map"
  - "slice"
called_by:
  - "run"
  - "runHeldStepsBatch"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_pipelineCoreBusyReason`, `_syncPipelineToggleStatus`, `clearPipelineResumeFromIndex`, `currentExcelId`, `excelIdForPipelineFileId`, `getPipelineRuntimeStatus`, `isStepEnabled`, `noteLivePipelineApplied`, `pipelineFailedStepIdFromError`, `pipelineHeldBatchInfo`, `preferredVbaRunFileId`, `push`, `pushHistory`, `reapplyVbaPipelineToLive`, `refreshBatchResumeButton`, `refreshRunButton`, `renderPipeline`, `reportPipelineError`, `runPipelineSuffixFromCheckpoint`, `scheduleLogicAutoBackup`, `setPipelineResumeFromIndex`, `setPipelineRuntimeStatus`, `toast`, `vbaTargetExcelId`
- 피호출(영향 전파 경로): `run`, `runHeldStepsBatch`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
