---
type: endpoint
title: pipelineHasBackendOnlyStep
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps = state.pipeline)"
role: "켜진 스텝 중 라이브 실행 불가(레거시 python/기타) 스텝이 있는가 — 있으면 전체 백엔드 라우팅."
role_source: banner
version: "0.8.1"
loc: "pipeline.js:105-105"

# ── 입출력 ──
inputs:
  - "steps = state.pipeline"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "isStepEnabled"
  - "pipelineStepLiveLanguage"
calls_external:
  - "some"
called_by:
  - "_reconcilePipelineSimulationAfterEditImpl"
  - "_runPipelineSuffixFromCheckpointImpl"
  - "applyLogic"
  - "canUsePipelineCheckpointFromIndex"
  - "insertLogic"
  - "pipelineHeldBatchInfo"
  - "replaceLogicAt"
  - "shouldRunPipelineAsVba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
켜진 스텝 중 라이브 실행 불가(레거시 python/기타) 스텝이 있는가 — 있으면 전체 백엔드 라우팅.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `isStepEnabled`, `pipelineStepLiveLanguage`
- 피호출(영향 전파 경로): `_reconcilePipelineSimulationAfterEditImpl`, `_runPipelineSuffixFromCheckpointImpl`, `applyLogic`, `canUsePipelineCheckpointFromIndex`, `insertLogic`, `pipelineHeldBatchInfo`, `replaceLogicAt`, `shouldRunPipelineAsVba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
