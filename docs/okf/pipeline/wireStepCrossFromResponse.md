---
type: endpoint
title: wireStepCrossFromResponse
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(data, step)"
role: "응답 한 건에서 이 스텝의 쓰기 증거를 뽑아 붙인다. 백엔드 경로가 둘이라 모양도 둘이다."
role_source: banner
version: "0.8.0"
loc: "pipeline.js:1290-1290"

# ── 입출력 ──
inputs:
  - "data"
  - "step"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "wirePipelineStepCrossEvidence"
calls_external:
  - "isArray"
called_by:
  - "applyVbaStepToLiveExcel"
  - "runLivePipelineStepSequentially"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
응답 한 건에서 이 스텝의 쓰기 증거를 뽑아 붙인다. 백엔드 경로가 둘이라 모양도 둘이다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `wirePipelineStepCrossEvidence`
- 피호출(영향 전파 경로): `applyVbaStepToLiveExcel`, `runLivePipelineStepSequentially`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
