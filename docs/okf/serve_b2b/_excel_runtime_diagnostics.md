---
type: function
title: _excel_runtime_diagnostics
module: serve_b2b.py
lang: python
extraction: ast
signature: "(reap=False, log=True)"
role: "Return lightweight Excel process diagnostics and optionally reap app-owned orphan PIDs."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:4863-4952"

# ── 입출력 ──
inputs:
  - "reap"
  - "log"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "상태 변경(전역/세션): EXCEL_LAST_REAP_AT"
raises: []

# ── 유기적 관계 ──
calls:
  - "_force_kill_pid"
  - "_is_pid_alive"
  - "_maybe_perf_trace_runtime"
  - "add"
  - "append"
  - "values"
calls_external:
  - "PYTHON_SKILL_APP_PID"
  - "acquire"
  - "alive"
  - "bool"
  - "diagnostics"
  - "discard"
  - "float"
  - "get"
  - "int"
  - "len"
  - "list"
  - "p"
  - "pid"
  - "protected_pid"
  - "python_pid"
  - "reap"
  - "release"
  - "session_pids"
  - "set"
  - "sorted"
  - "time"
  - "tracked_pids"
called_by:
  - "B2BHandler.do_POST"
  - "_health_excel_diagnostics"
  - "_run_low_risk_housekeeping"
  - "_runtime_sampler_once"
reads:
  - "EXCEL_LAST_REAP_AT"
  - "EXCEL_LOCK"
  - "EXCEL_REAP_INTERVAL_SECONDS"
  - "EXCEL_SESSIONS"
  - "PYTHON_SKILL_APP_PID"
  - "SPAWNED_EXCEL_PIDS"
writes:
  - "EXCEL_LAST_REAP_AT"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
Return lightweight Excel process diagnostics and optionally reap app-owned orphan PIDs.

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- 상태 변경(전역/세션): EXCEL_LAST_REAP_AT
- 변경 상태 `EXCEL_LAST_REAP_AT` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_force_kill_pid`, `_is_pid_alive`, `_maybe_perf_trace_runtime`, `add`, `append`, `values`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`, `_health_excel_diagnostics`, `_run_low_risk_housekeeping`, `_runtime_sampler_once`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
