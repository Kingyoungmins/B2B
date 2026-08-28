---
type: function
title: _process_perf_snapshot
module: serve_b2b.py
lang: python
extraction: ast
signature: "(pid)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "serve_b2b.py:5023-5048"

# ── 입출력 ──
inputs:
  - "pid"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "status"
calls_external:
  - "Process"
  - "cpu"
  - "cpu_times"
  - "err"
  - "float"
  - "getattr"
  - "int"
  - "memory_info"
  - "name"
  - "num_handles"
  - "num_threads"
  - "pid"
  - "round"
  - "str"
  - "update"
called_by:
  - "_maybe_perf_trace_runtime"
  - "_runtime_sampler_once"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `status`
- 피호출(영향 전파 경로): `_maybe_perf_trace_runtime`, `_runtime_sampler_once`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
