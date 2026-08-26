---
type: endpoint
title: _liveMatchesEnabledSteps
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps)"
role: "적용 서명이 비어 있으면(불러오기·무효화) 모른다 = false."
role_source: banner
version: "0.8.0"
loc: "pipeline.js:4983-4983"

# ── 입출력 ──
inputs:
  - "steps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "liveEnabledStepsSignature"
calls_external: []
called_by:
  - "pipelineHeldBatchInfo"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
적용 서명이 비어 있으면(불러오기·무효화) 모른다 = false.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `liveEnabledStepsSignature`
- 피호출(영향 전파 경로): `pipelineHeldBatchInfo`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
