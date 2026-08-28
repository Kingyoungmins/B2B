---
type: function
title: _perf_trace
module: serve_b2b.py
lang: python
extraction: ast
signature: "(event, **fields)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "serve_b2b.py:5076-5089"

# ── 입출력 ──
inputs:
  - "event"
  - "**fields"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_perf_trace_path"
  - "write"
calls_external:
  - "dumps"
  - "fields"
  - "getpid"
  - "isoformat"
  - "line"
  - "now"
  - "open"
  - "payload"
  - "str"
  - "update"
called_by:
  - "B2BHandler.do_POST"
  - "B2BHandler.handle_client_trace"
  - "_addon_telemetry_init"
  - "_cleanup_pipeline_snapshots_by_limits"
  - "_force_kill_pid"
  - "_force_restart_excel_sessions_direct"
  - "_get_python_skill_app"
  - "_maybe_perf_trace_runtime"
  - "_maybe_quit_idle_python_skill_app"
  - "_native_parent_watch_once"
  - "_quit_python_skill_app"
  - "_run_low_risk_housekeeping"
  - "_runtime_maintenance_loop"
  - "_runtime_sampler_once"
  - "_track_spawned_excel_app"
  - "cleanup_backend_runtime_files"
  - "cleanup_excel_sessions"
  - "skill_consolidate"
reads:
  - "_TRACE_WRITE_LOCK"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_perf_trace_path`, `write`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`, `B2BHandler.handle_client_trace`, `_addon_telemetry_init`, `_cleanup_pipeline_snapshots_by_limits`, `_force_kill_pid`, `_force_restart_excel_sessions_direct`, `_get_python_skill_app`, `_maybe_perf_trace_runtime`, `_maybe_quit_idle_python_skill_app`, `_native_parent_watch_once`, `_quit_python_skill_app`, `_run_low_risk_housekeeping`, `_runtime_maintenance_loop`, `_runtime_sampler_once`, `_track_spawned_excel_app`, `cleanup_backend_runtime_files`, `cleanup_excel_sessions`, `skill_consolidate`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
