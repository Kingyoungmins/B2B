---
type: function
title: _close_excel_session_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:7576-7641"

# ── 입출력 ──
inputs:
  - "excel_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): LIVE_EXCEL_APP"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_close_companion_workbooks"
  - "_force_kill_pid"
  - "_handoff_foreground_to_host"
  - "_hide_excel_app_window"
  - "_hide_excel_windows_for_pid"
  - "_is_live_shared_app"
  - "_is_pid_alive"
  - "_note_live_app_reset"
  - "_remaining_sessions_for_pid"
  - "session_workbook"
calls_external:
  - "Close"
  - "Path"
  - "Quit"
  - "app"
  - "bool"
  - "cdir"
  - "excel_id"
  - "get"
  - "key"
  - "pid"
  - "pop"
  - "rmtree"
  - "session"
  - "sleep"
  - "temp_path"
  - "time"
  - "unlink"
called_by:
  - "close_excel_session"
reads:
  - "EXCEL_LOCK"
  - "EXCEL_SESSIONS"
  - "LIVE_FRAME_MODE"
  - "NATIVE_RECORDING"
writes:
  - "LIVE_EXCEL_APP"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): LIVE_EXCEL_APP
- 파일시스템 변경/IO
- 변경 상태 `LIVE_EXCEL_APP` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_close_companion_workbooks`, `_force_kill_pid`, `_handoff_foreground_to_host`, `_hide_excel_app_window`, `_hide_excel_windows_for_pid`, `_is_live_shared_app`, `_is_pid_alive`, `_note_live_app_reset`, `_remaining_sessions_for_pid`, `session_workbook`
- 피호출(영향 전파 경로): `close_excel_session`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
