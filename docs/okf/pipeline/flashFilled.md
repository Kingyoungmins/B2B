---
type: endpoint
title: flashFilled
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "pipeline.js:3688-3688"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
  - "add"
  - "getFile"
  - "getOriginalFile"
calls_external:
  - "Number"
  - "String"
  - "contains"
  - "forEach"
  - "querySelectorAll"
  - "setTimeout"
called_by:
  - "applyBackendPipelineResult"
  - "runPipeline"
reads:
  - "state.currentFileId"
  - "state.currentSheet"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 타이머

## 관계
- 호출: `$`, `add`, `getFile`, `getOriginalFile`
- 피호출(영향 전파 경로): `applyBackendPipelineResult`, `runPipeline`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
