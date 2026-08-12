---
type: endpoint
title: _syncPipelineToggleStatus
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[단일 축 · 상태칩 정착] 토글이 끝난 뒤 상태칩을 스위치에 맞춘다 — ON=적용됨 · OFF=보류."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:3765-3765"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "getPipelineRuntimeStatus"
  - "isStepEnabled"
  - "push"
  - "setPipelineRuntimeStatus"
calls_external:
  - "forEach"
called_by:
  - "_handlePipelineStepToggleImpl"
  - "_runHeldStepsBatchImpl"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[단일 축 · 상태칩 정착] 토글이 끝난 뒤 상태칩을 스위치에 맞춘다 — ON=적용됨 · OFF=보류.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `getPipelineRuntimeStatus`, `isStepEnabled`, `push`, `setPipelineRuntimeStatus`
- 피호출(영향 전파 경로): `_handlePipelineStepToggleImpl`, `_runHeldStepsBatchImpl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
