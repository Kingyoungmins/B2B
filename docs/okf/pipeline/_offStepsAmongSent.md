---
type: endpoint
title: _offStepsAmongSent
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps, sentIdxList)"
role: "보낸 스텝 중 '지금 꺼져 있는' 스텝이 있으면 그 자리에서 잡아낸다 — 이게 제보의 핵심 증거다."
role_source: banner
version: "0.8.0"
loc: "pipeline.js:4428-4428"

# ── 입출력 ──
inputs:
  - "steps"
  - "sentIdxList"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "isStepEnabled"
  - "push"
calls_external:
  - "forEach"
  - "join"
called_by:
  - "_reapplyVbaPipelineToLiveImpl"
  - "runIsolatedLivePipelineSteps"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
보낸 스텝 중 '지금 꺼져 있는' 스텝이 있으면 그 자리에서 잡아낸다 — 이게 제보의 핵심 증거다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `isStepEnabled`, `push`
- 피호출(영향 전파 경로): `_reapplyVbaPipelineToLiveImpl`, `runIsolatedLivePipelineSteps`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
