---
type: endpoint
title: pipelineSuffixWritesCrossFile
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps, startIdx)"
role: "체크포인트 빠른경로는 startIdx '이후 전 스텝'을 되돌린다. 그런데 스텝별 _preApplySnapshot 은"
role_source: banner
version: "0.8.1"
loc: "pipeline.js:1108-1108"

# ── 입출력 ──
inputs:
  - "steps"
  - "startIdx"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "pipelineStepWritesCrossFile"
calls_external:
  - "max"
  - "slice"
  - "some"
called_by:
  - "_handlePipelineStepToggleImpl"
  - "canUsePipelineCheckpointFromIndex"
  - "pipelineHeldBatchInfo"
  - "promise"
  - "renderPipeline"
  - "replaceLogicAt"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
체크포인트 빠른경로는 startIdx '이후 전 스텝'을 되돌린다. 그런데 스텝별 _preApplySnapshot 은

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `pipelineStepWritesCrossFile`
- 피호출(영향 전파 경로): `_handlePipelineStepToggleImpl`, `canUsePipelineCheckpointFromIndex`, `pipelineHeldBatchInfo`, `promise`, `renderPipeline`, `replaceLogicAt`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
