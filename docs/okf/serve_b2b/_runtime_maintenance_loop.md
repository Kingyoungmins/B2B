---
type: function
title: _runtime_maintenance_loop
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "serve_b2b.py:5412-5430"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_native_parent_watch_once"
  - "_perf_trace"
  - "_run_low_risk_housekeeping"
  - "_runtime_sampler_once"
calls_external:
  - "HOUSEKEEPING_INTERVAL_SECONDS"
  - "PARENT_WATCH_INTERVAL_SECONDS"
  - "RUNTIME_SAMPLER_INTERVAL_SECONDS"
  - "err"
  - "max"
  - "now"
  - "sleep"
  - "str"
  - "time"
called_by:
  - "start_runtime_maintenance_threads"
reads:
  - "HOUSEKEEPING_INTERVAL_SECONDS"
  - "PARENT_WATCH_INTERVAL_SECONDS"
  - "RUNTIME_SAMPLER_INTERVAL_SECONDS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_native_parent_watch_once`, `_perf_trace`, `_run_low_risk_housekeeping`, `_runtime_sampler_once`
- 피호출(영향 전파 경로): `start_runtime_maintenance_threads`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
