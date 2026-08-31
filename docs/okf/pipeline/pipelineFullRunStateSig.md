---
type: endpoint
title: pipelineFullRunStateSig
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(runSteps)"
role: "— 남기면 새로고침 복원이 '덜 적용된 상태'를 최종본으로 착각한다."
role_source: banner
version: "0.8.2"
loc: "pipeline.js:163-163"

# ── 입출력 ──
inputs:
  - "runSteps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "pipelineLiveStateSig"
calls_external: []
called_by:
  - "runIsolatedLivePipelineSteps"
  - "runPipelineOnBackend"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
— 남기면 새로고침 복원이 '덜 적용된 상태'를 최종본으로 착각한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `pipelineLiveStateSig`
- 피호출(영향 전파 경로): `runIsolatedLivePipelineSteps`, `runPipelineOnBackend`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
