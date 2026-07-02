---
type: endpoint
title: replaceLogicAt
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(stepId, newCode, newDescription, language)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "pipeline.js:1789-1789"

# ── 입출력 ──
inputs:
  - "stepId"
  - "newCode"
  - "newDescription"
  - "language"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: pipeline"
raises: []

# ── 유기적 관계 ──
calls:
  - "canUsePipelineCheckpointFromIndex"
  - "cancelActiveBackendPipeline"
  - "getSkillEngine"
  - "hasBackendOnlyWorkbooks"
  - "normalizeStep"
  - "pipelineUsesPython"
  - "pipelineUsesVba"
  - "pushHistory"
  - "reapplyVbaPipelineToLive"
  - "reconcilePipelineSimulationAfterEdit"
  - "refreshRunButton"
  - "renderPipeline"
  - "reportPipelineError"
  - "requestExcelApplyCancel"
  - "restorePipelineStep"
  - "runFromCheckpointAfterEdit"
  - "runPipeline"
  - "scheduleLogicAutoBackup"
  - "setPipelineRuntimeStatus"
  - "shouldDeferImmediatePipelineRun"
  - "toast"
  - "vbaTargetExcelId"
calls_external:
  - "error"
  - "filter"
  - "find"
  - "findIndex"
  - "lastBeforeIdx"
  - "map"
  - "restore"
  - "slice"
  - "then"
called_by:
  - "addAssistantReply"
  - "runEditApply"
reads:
  - "state.pipeline"
writes:
  - "pipeline"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: pipeline
- 변경 상태 `pipeline` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `canUsePipelineCheckpointFromIndex`, `cancelActiveBackendPipeline`, `getSkillEngine`, `hasBackendOnlyWorkbooks`, `normalizeStep`, `pipelineUsesPython`, `pipelineUsesVba`, `pushHistory`, `reapplyVbaPipelineToLive`, `reconcilePipelineSimulationAfterEdit`, `refreshRunButton`, `renderPipeline`, `reportPipelineError`, `requestExcelApplyCancel`, `restorePipelineStep`, `runFromCheckpointAfterEdit`, `runPipeline`, `scheduleLogicAutoBackup`, `setPipelineRuntimeStatus`, `shouldDeferImmediatePipelineRun`, `toast`, `vbaTargetExcelId`
- 피호출(영향 전파 경로): `addAssistantReply`, `runEditApply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
