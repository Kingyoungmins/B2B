---
type: endpoint
title: pipelineHeldBatchInfo
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "보류 구간 정보. ok=false 면 버튼을 숨긴다."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:4689-4689"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "getPipelineResumeFromIndex"
  - "pipelineHasBackendOnlyStep"
  - "pipelineSuffixWritesCrossFile"
  - "push"
calls_external:
  - "isInteger"
  - "slice"
called_by:
  - "_runHeldStepsBatchImpl"
  - "openBatchResumeModal"
  - "refreshBatchResumeButton"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
보류 구간 정보. ok=false 면 버튼을 숨긴다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `getPipelineResumeFromIndex`, `pipelineHasBackendOnlyStep`, `pipelineSuffixWritesCrossFile`, `push`
- 피호출(영향 전파 경로): `_runHeldStepsBatchImpl`, `openBatchResumeModal`, `refreshBatchResumeButton`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
