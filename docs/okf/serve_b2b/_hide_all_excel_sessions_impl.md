---
type: function
title: _hide_all_excel_sessions_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:7689-7763"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
raises: []

# ── 유기적 관계 ──
calls:
  - "_handoff_foreground_to_host"
  - "_hide_excel_app_window"
  - "_hide_excel_windows_for_pid"
  - "_move_hwnd_offscreen"
  - "_session_frame_hwnd"
  - "_visible_excel_top_hwnds_for_pids"
  - "add"
  - "append"
  - "session_workbook"
  - "values"
calls_external:
  - "SPAWNED_EXCEL_PIDS"
  - "_hwnd"
  - "_p"
  - "app"
  - "frame_hwnds"
  - "get"
  - "host_hwnd"
  - "hwnd"
  - "int"
  - "list"
  - "live_frame_pids"
  - "p"
  - "pid"
  - "session"
  - "set"
  - "wb"
called_by:
  - "_hide_inactive_excel_sessions_impl"
  - "hide_all_excel_sessions"
reads:
  - "EXCEL_LOCK"
  - "EXCEL_SESSIONS"
  - "LIVE_FRAME_MODE"
  - "SPAWNED_EXCEL_PIDS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화

## 관계
- 호출: `_handoff_foreground_to_host`, `_hide_excel_app_window`, `_hide_excel_windows_for_pid`, `_move_hwnd_offscreen`, `_session_frame_hwnd`, `_visible_excel_top_hwnds_for_pids`, `add`, `append`, `session_workbook`, `values`
- 피호출(영향 전파 경로): `_hide_inactive_excel_sessions_impl`, `hide_all_excel_sessions`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
