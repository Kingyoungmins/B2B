---
type: endpoint
title: pipelineStepsWithUnresolvedTarget
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps)"
role: "대상을 못 찾은 스텝들 — 파일이 둘 이상일 때만 문제다(하나뿐이면 고를 여지가 없다)."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:571-571"

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
  - "pipelineKnownFiles"
  - "pipelineStepDeclaredTargetUnresolved"
calls_external:
  - "filter"
  - "map"
called_by:
  - "runIsolatedLivePipelineSteps"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
대상을 못 찾은 스텝들 — 파일이 둘 이상일 때만 문제다(하나뿐이면 고를 여지가 없다).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `pipelineKnownFiles`, `pipelineStepDeclaredTargetUnresolved`
- 피호출(영향 전파 경로): `runIsolatedLivePipelineSteps`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
