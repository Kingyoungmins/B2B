---
type: endpoint
title: _stepsOnOffMap
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps, limit)"
role: "스텝이 많아도 로그가 터지지 않게 앞 40개까지만 남긴다."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:4041-4041"

# ── 입출력 ──
inputs:
  - "steps"
  - "limit"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "isStepEnabled"
calls_external:
  - "isInteger"
  - "join"
  - "map"
  - "slice"
called_by:
  - "_handlePipelineStepToggleImpl"
  - "_reapplyVbaPipelineToLiveImpl"
  - "runIsolatedLivePipelineSteps"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
스텝이 많아도 로그가 터지지 않게 앞 40개까지만 남긴다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `isStepEnabled`
- 피호출(영향 전파 경로): `_handlePipelineStepToggleImpl`, `_reapplyVbaPipelineToLiveImpl`, `runIsolatedLivePipelineSteps`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
