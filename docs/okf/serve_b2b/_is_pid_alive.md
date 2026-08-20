---
type: function
title: _is_pid_alive
module: serve_b2b.py
lang: python
extraction: ast
signature: "(pid)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:4410-4468"

# ── 입출력 ──
inputs:
  - "pid"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "서브프로세스/OS 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "hidden_subprocess_kwargs"
calls_external:
  - "CloseHandle"
  - "OpenProcess"
  - "WaitForSingleObject"
  - "WinDLL"
  - "bool"
  - "get_last_error"
  - "handle"
  - "int"
  - "pid"
  - "pid_exists"
  - "run"
  - "str"
called_by:
  - "B2BHandler.do_POST"
  - "_cleanup_excel_sessions_impl"
  - "_close_excel_session_impl"
  - "_excel_runtime_diagnostics"
  - "_force_restart_excel_sessions_direct"
  - "_get_live_excel_app"
  - "_native_parent_watch_once"
  - "_quit_python_skill_app"
  - "cleanup_excel_sessions"
  - "cleanup_stale_temp_artifacts"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 서브프로세스/OS 호출

## 관계
- 호출: `hidden_subprocess_kwargs`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`, `_cleanup_excel_sessions_impl`, `_close_excel_session_impl`, `_excel_runtime_diagnostics`, `_force_restart_excel_sessions_direct`, `_get_live_excel_app`, `_native_parent_watch_once`, `_quit_python_skill_app`, `cleanup_excel_sessions`, `cleanup_stale_temp_artifacts`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
