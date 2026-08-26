---
type: function
title: _cleanup_excel_sessions_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:868-921"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): LIVE_EXCEL_APP"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_close_companion_workbooks"
  - "_force_kill_pid"
  - "_is_pid_alive"
  - "_note_live_app_reset"
  - "_quit_python_skill_app"
  - "add"
  - "append"
  - "clear"
  - "session_workbook"
  - "values"
calls_external:
  - "Close"
  - "Path"
  - "Quit"
  - "app"
  - "cdir"
  - "get"
  - "id"
  - "int"
  - "key"
  - "len"
  - "list"
  - "pid"
  - "pids"
  - "rmtree"
  - "session"
  - "set"
  - "sleep"
  - "temp_path"
  - "time"
  - "unlink"
called_by:
  - "cleanup_excel_sessions"
  - "ensure_excel_worker"
reads:
  - "EXCEL_SESSIONS"
writes:
  - "LIVE_EXCEL_APP"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): LIVE_EXCEL_APP
- 파일시스템 변경/IO
- 변경 상태 `LIVE_EXCEL_APP` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_close_companion_workbooks`, `_force_kill_pid`, `_is_pid_alive`, `_note_live_app_reset`, `_quit_python_skill_app`, `add`, `append`, `clear`, `session_workbook`, `values`
- 피호출(영향 전파 경로): `cleanup_excel_sessions`, `ensure_excel_worker`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
