---
type: endpoint
title: _signatureStepsAsRestored
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps)"
role: "켜짐/꺼짐은 실행 시점 값을 그대로 쓴다(무엇이 적용됐는지는 실행 시점이 진실)."
role_source: banner
version: "0.8.2"
loc: "pipeline.js:4382-4382"

# ── 입출력 ──
inputs:
  - "steps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Map"
  - "get"
  - "isArray"
  - "map"
called_by:
  - "noteLivePipelineApplied"
reads:
  - "state.pipeline"
  - "state.pipelineMappedDuringRun"
  - "state.pipelineOriginalDuringRun"
  - "state.runnerMappingRunActive"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
켜짐/꺼짐은 실행 시점 값을 그대로 쓴다(무엇이 적용됐는지는 실행 시점이 진실).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `noteLivePipelineApplied`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
