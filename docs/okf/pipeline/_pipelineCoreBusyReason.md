---
type: endpoint
title: _pipelineCoreBusyReason
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[토글 제외 공용 사유] 토글 구현부(_handlePipelineStepToggleImpl)는 이걸 쓴다 — 자기 자신의"
role_source: banner
version: "0.8.0"
loc: "pipeline.js:5448-5448"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "_handlePipelineStepToggleImpl"
  - "_runHeldStepsBatchImpl"
  - "pipelineEditBusyReason"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[토글 제외 공용 사유] 토글 구현부(_handlePipelineStepToggleImpl)는 이걸 쓴다 — 자기 자신의

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_handlePipelineStepToggleImpl`, `_runHeldStepsBatchImpl`, `pipelineEditBusyReason`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
