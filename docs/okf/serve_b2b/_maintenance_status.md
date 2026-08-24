---
type: function
title: _maintenance_status
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "serve_b2b.py:4789-4798"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "B2BHandler.do_GET"
  - "B2BHandler.do_POST"
  - "_runtime_sampler_once"
reads:
  - "HOUSEKEEPING_ERROR"
  - "HOUSEKEEPING_INTERVAL_SECONDS"
  - "HOUSEKEEPING_LAST_DURATION_MS"
  - "HOUSEKEEPING_LAST_RUN_AT"
  - "HOUSEKEEPING_LAST_SKIPPED_REASON"
  - "HOUSEKEEPING_RUN_COUNT"
  - "RUNTIME_SAMPLER_INTERVAL_SECONDS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `B2BHandler.do_GET`, `B2BHandler.do_POST`, `_runtime_sampler_once`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
