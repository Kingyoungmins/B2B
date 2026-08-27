---
type: function
title: _runtime_sampler_once
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:5226-5267"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): RUNTIME_LAST_ACTIVITY_AT, RUNTIME_LAST_ACTIVITY_SIG"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_queue_size"
  - "_excel_runtime_diagnostics"
  - "_maintenance_status"
  - "_perf_trace"
  - "_pipeline_is_busy"
  - "_pipeline_job_stats"
  - "_pipeline_snapshot_stats"
  - "_process_perf_snapshot"
  - "_runtime_counts_snapshot"
  - "_sample_lock_contended"
  - "add"
  - "excel_available"
calls_external:
  - "diagnostics"
  - "dumps"
  - "excel_pids"
  - "get"
  - "getpid"
  - "int"
  - "p"
  - "pid"
  - "set"
  - "sorted"
  - "time"
  - "update"
called_by:
  - "_runtime_maintenance_loop"
reads:
  - "RUNTIME_LAST_ACTIVITY_SIG"
writes:
  - "RUNTIME_LAST_ACTIVITY_AT"
  - "RUNTIME_LAST_ACTIVITY_SIG"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): RUNTIME_LAST_ACTIVITY_AT, RUNTIME_LAST_ACTIVITY_SIG
- 변경 상태 `RUNTIME_LAST_ACTIVITY_AT, RUNTIME_LAST_ACTIVITY_SIG` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_excel_queue_size`, `_excel_runtime_diagnostics`, `_maintenance_status`, `_perf_trace`, `_pipeline_is_busy`, `_pipeline_job_stats`, `_pipeline_snapshot_stats`, `_process_perf_snapshot`, `_runtime_counts_snapshot`, `_sample_lock_contended`, `add`, `excel_available`
- 피호출(영향 전파 경로): `_runtime_maintenance_loop`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
