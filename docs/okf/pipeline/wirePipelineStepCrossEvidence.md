---
type: endpoint
title: wirePipelineStepCrossEvidence
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(stepCross, sourceSteps)"
role: "[교차파일 런타임 증거 2026-08-12] 정적 탐지는 코드 문자열에서 파일명을 찾는다. 그래서 파일명이"
role_source: banner
version: "0.7.4"
loc: "pipeline.js:1252-1252"

# ── 입출력 ──
inputs:
  - "stepCross"
  - "sourceSteps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
calls_external:
  - "filter"
  - "find"
  - "isArray"
  - "isInteger"
called_by:
  - "_reapplyVbaPipelineToLiveImpl"
  - "runIsolatedLivePipelineSteps"
  - "runLivePipelineStepSequentially"
  - "wireStepCrossFromResponse"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[교차파일 런타임 증거 2026-08-12] 정적 탐지는 코드 문자열에서 파일명을 찾는다. 그래서 파일명이

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `_reapplyVbaPipelineToLiveImpl`, `runIsolatedLivePipelineSteps`, `runLivePipelineStepSequentially`, `wireStepCrossFromResponse`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
