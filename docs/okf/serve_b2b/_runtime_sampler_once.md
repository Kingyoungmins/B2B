---
type: function
title: _runtime_sampler_once
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "serve_b2b.py:3490-3518"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_queue_size"
  - "_excel_runtime_diagnostics"
  - "_maintenance_status"
  - "_perf_trace"
  - "_pipeline_job_stats"
  - "_pipeline_snapshot_stats"
  - "_process_perf_snapshot"
  - "_runtime_counts_snapshot"
  - "_sample_lock_contended"
  - "add"
  - "excel_available"
calls_external:
  - "diagnostics"
  - "excel_pids"
  - "get"
  - "getpid"
  - "int"
  - "p"
  - "pid"
  - "set"
  - "sorted"
  - "update"
called_by:
  - "_runtime_maintenance_loop"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_excel_queue_size`, `_excel_runtime_diagnostics`, `_maintenance_status`, `_perf_trace`, `_pipeline_job_stats`, `_pipeline_snapshot_stats`, `_process_perf_snapshot`, `_runtime_counts_snapshot`, `_sample_lock_contended`, `add`, `excel_available`
- 피호출(영향 전파 경로): `_runtime_maintenance_loop`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
