---
type: function
title: _run_low_risk_housekeeping
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:5226-5285"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "상태 변경(전역/세션): HOUSEKEEPING_ERROR, HOUSEKEEPING_GC_LAST_AT, HOUSEKEEPING_LAST_DURATION_MS, HOUSEKEEPING_LAST_RUN_AT, HOUSEKEEPING_LAST_SKIPPED_REASON, HOUSEKEEPING_RUNNING, HOUSEKEEPING_RUN_COUNT"
raises: []

# ── 유기적 관계 ──
calls:
  - "_cleanup_pipeline_snapshots_by_limits"
  - "_cleanup_stale_copy_source"
  - "_excel_runtime_diagnostics"
  - "_perf_trace"
  - "_pipeline_is_busy"
  - "excel_available"
  - "prune_pipeline_jobs_locked"
calls_external:
  - "HOUSEKEEPING_ERROR"
  - "HOUSEKEEPING_INTERVAL_SECONDS"
  - "HOUSEKEEPING_LAST_DURATION_MS"
  - "HOUSEKEEPING_LAST_SKIPPED_REASON"
  - "acquire"
  - "bool"
  - "collect"
  - "detail"
  - "err"
  - "float"
  - "get"
  - "max"
  - "perf_counter"
  - "release"
  - "round"
  - "str"
  - "time"
called_by:
  - "_runtime_maintenance_loop"
reads:
  - "EXCEL_LOCK"
  - "HOUSEKEEPING_ERROR"
  - "HOUSEKEEPING_GC_LAST_AT"
  - "HOUSEKEEPING_INTERVAL_SECONDS"
  - "HOUSEKEEPING_LAST_DURATION_MS"
  - "HOUSEKEEPING_LAST_SKIPPED_REASON"
  - "HOUSEKEEPING_RUNNING"
  - "PIPELINE_JOBS_LOCK"
  - "RUNTIME_LAST_ACTIVITY_AT"
writes:
  - "HOUSEKEEPING_ERROR"
  - "HOUSEKEEPING_GC_LAST_AT"
  - "HOUSEKEEPING_LAST_DURATION_MS"
  - "HOUSEKEEPING_LAST_RUN_AT"
  - "HOUSEKEEPING_LAST_SKIPPED_REASON"
  - "HOUSEKEEPING_RUNNING"
  - "HOUSEKEEPING_RUN_COUNT"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- 상태 변경(전역/세션): HOUSEKEEPING_ERROR, HOUSEKEEPING_GC_LAST_AT, HOUSEKEEPING_LAST_DURATION_MS, HOUSEKEEPING_LAST_RUN_AT, HOUSEKEEPING_LAST_SKIPPED_REASON, HOUSEKEEPING_RUNNING, HOUSEKEEPING_RUN_COUNT
- 변경 상태 `HOUSEKEEPING_ERROR, HOUSEKEEPING_GC_LAST_AT, HOUSEKEEPING_LAST_DURATION_MS, HOUSEKEEPING_LAST_RUN_AT, HOUSEKEEPING_LAST_SKIPPED_REASON, HOUSEKEEPING_RUNNING, HOUSEKEEPING_RUN_COUNT` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_cleanup_pipeline_snapshots_by_limits`, `_cleanup_stale_copy_source`, `_excel_runtime_diagnostics`, `_perf_trace`, `_pipeline_is_busy`, `excel_available`, `prune_pipeline_jobs_locked`
- 피호출(영향 전파 경로): `_runtime_maintenance_loop`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
