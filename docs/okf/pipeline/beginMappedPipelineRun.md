---
type: endpoint
title: beginMappedPipelineRun
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[매핑 보존] 실행기에서 사용자가 확정한 파일·시트 매핑을 '생성기 재실행'에도 적용한다."
role_source: banner
version: "0.8.0"
loc: "pipeline.js:5543-5543"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: pipeline, pipelineMappedDuringRun, pipelineOriginalDuringRun, runnerMappingRunActive"
raises: []

# ── 유기적 관계 ──
calls:
  - "restore"
calls_external:
  - "Map"
  - "buildRunnerMappedPipeline"
  - "find"
  - "get"
  - "isArray"
  - "map"
called_by:
  - "applyMappedSingleStep"
  - "attemptRunnerAutoRecovery"
  - "reapplyVbaPipelineToLive"
  - "reconcilePipelineSimulationAfterEdit"
  - "restoreSoftRefreshSnapshot"
  - "runPipelineSuffixFromCheckpoint"
reads:
  - "state.pipeline"
  - "state.pipelineMappedDuringRun"
  - "state.pipelineOriginalDuringRun"
  - "state.runnerMappingRunActive"
writes:
  - "pipeline"
  - "pipelineMappedDuringRun"
  - "pipelineOriginalDuringRun"
  - "runnerMappingRunActive"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[매핑 보존] 실행기에서 사용자가 확정한 파일·시트 매핑을 '생성기 재실행'에도 적용한다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: pipeline, pipelineMappedDuringRun, pipelineOriginalDuringRun, runnerMappingRunActive
- 변경 상태 `pipeline, pipelineMappedDuringRun, pipelineOriginalDuringRun, runnerMappingRunActive` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `restore`
- 피호출(영향 전파 경로): `applyMappedSingleStep`, `attemptRunnerAutoRecovery`, `reapplyVbaPipelineToLive`, `reconcilePipelineSimulationAfterEdit`, `restoreSoftRefreshSnapshot`, `runPipelineSuffixFromCheckpoint`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
