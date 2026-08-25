---
type: function
title: _native_parent_watch_once
module: serve_b2b.py
lang: python
extraction: ast
signature: "(now)"
role: "Native host가 사라졌는데 Python 서버만 살아남으면 Excel COM 인스턴스도 고아로 남는다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:5090-5123"

# ── 입출력 ──
inputs:
  - "now"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): PARENT_WATCH_MISSING_SINCE"
raises: []

# ── 유기적 관계 ──
calls:
  - "_is_pid_alive"
  - "_log_sync_stop"
  - "_perf_trace"
  - "cleanup_excel_sessions"
  - "cleanup_node_worker"
calls_external:
  - "NATIVE_HOST_PID"
  - "PARENT_WATCH_GRACE_SECONDS"
  - "_exit"
  - "err"
  - "max"
  - "round"
  - "str"
called_by:
  - "_runtime_maintenance_loop"
reads:
  - "DISABLE_PARENT_WATCH"
  - "NATIVE_HOST_PID"
  - "PARENT_WATCH_GRACE_SECONDS"
  - "PARENT_WATCH_MISSING_SINCE"
writes:
  - "PARENT_WATCH_MISSING_SINCE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
Native host가 사라졌는데 Python 서버만 살아남으면 Excel COM 인스턴스도 고아로 남는다.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): PARENT_WATCH_MISSING_SINCE
- 변경 상태 `PARENT_WATCH_MISSING_SINCE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_is_pid_alive`, `_log_sync_stop`, `_perf_trace`, `cleanup_excel_sessions`, `cleanup_node_worker`
- 피호출(영향 전파 경로): `_runtime_maintenance_loop`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
