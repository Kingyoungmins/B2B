---
type: function
title: _recover_excel_session_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id, left, top, width, height, client_left=None, client_top=None, client_width=None, client_height=None, viewport_width=None, viewport_height=None, browser_title=None, native_parent_hwnd=None, native_host_hwnd=None, native_overlay=False)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:7215-7306"

# ── 입출력 ──
inputs:
  - "excel_id"
  - "left"
  - "top"
  - "width"
  - "height"
  - "client_left"
  - "client_top"
  - "client_width"
  - "client_height"
  - "viewport_width"
  - "viewport_height"
  - "browser_title"
  - "native_parent_hwnd"
  - "native_host_hwnd"
  - "native_overlay"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_address"
  - "_hide_peer_workbook_windows"
  - "_present_live_session_frame"
  - "_reopen_excel_session_workbook"
  - "_restore_app_state"
  - "_restore_live_protected_view"
  - "_restore_live_window"
  - "_safe_activate_excel_app"
  - "_show_workbook_window"
  - "get_excel_session"
  - "replace"
  - "session_workbook"
calls_external:
  - "Windows"
  - "app"
  - "bool"
  - "client_height"
  - "client_left"
  - "client_top"
  - "client_width"
  - "excel_id"
  - "float"
  - "get"
  - "height"
  - "hidden_ids"
  - "int"
  - "left"
  - "len"
  - "reopened"
  - "session"
  - "top"
  - "viewport_height"
  - "viewport_width"
  - "wb"
  - "width"
called_by:
  - "recover_excel_session"
reads:
  - "EXCEL_LOCK"
  - "LIVE_FRAME_MODE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_excel_address`, `_hide_peer_workbook_windows`, `_present_live_session_frame`, `_reopen_excel_session_workbook`, `_restore_app_state`, `_restore_live_protected_view`, `_restore_live_window`, `_safe_activate_excel_app`, `_show_workbook_window`, `get_excel_session`, `replace`, `session_workbook`
- 피호출(영향 전파 경로): `recover_excel_session`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
