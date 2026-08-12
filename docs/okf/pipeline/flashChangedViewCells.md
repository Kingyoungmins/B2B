---
type: endpoint
title: flashChangedViewCells
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(changes)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "pipeline.js:3158-3158"

# ── 입출력 ──
inputs:
  - "changes"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
  - "add"
calls_external:
  - "forEach"
  - "querySelector"
  - "remove"
  - "setTimeout"
called_by:
  - "flashBackendDiff"
  - "runPipelineRealtime"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 타이머

## 관계
- 호출: `$`, `add`
- 피호출(영향 전파 경로): `flashBackendDiff`, `runPipelineRealtime`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
