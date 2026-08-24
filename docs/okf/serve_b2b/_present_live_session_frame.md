---
type: function
title: _present_live_session_frame
module: serve_b2b.py
lang: python
extraction: ast
signature: "(session, app, wb, left, top, width, height, client_left=None, client_top=None, client_width=None, client_height=None, viewport_width=None, viewport_height=None, skip_position=False)"
role: "frame 모드 표시 경로: 대상 프레임만 배치/표시하고 나머지 라이브 프레임은 파킹."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:7100-7206"

# ── 입출력 ──
inputs:
  - "session"
  - "app"
  - "wb"
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
  - "skip_position"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_enable_excel_context_menus"
  - "_ensure_excel_workbook_view"
  - "_hide_peer_session_frames"
  - "_is_live_shared_app"
  - "_position_excel_window"
  - "_protect_workbook_for_read_only_mirror"
  - "_raise_excel_hwnd"
  - "_restore_excel_default_input"
  - "_session_frame_hwnd"
  - "_set_excel_ribbon_visible"
  - "_set_window_owner_hwnd"
  - "_show_window_na"
  - "_style_live_frame"
calls_external:
  - "GetWindowRect"
  - "IsWindowVisible"
  - "Windows"
  - "app"
  - "bool"
  - "client_height"
  - "client_left"
  - "client_top"
  - "client_width"
  - "get"
  - "height"
  - "left"
  - "session"
  - "target_hwnd"
  - "top"
  - "viewport_height"
  - "viewport_width"
  - "wb"
  - "width"
called_by:
  - "_recover_excel_session_impl"
  - "_replace_excel_session_workbook_impl"
  - "_restore_live_window"
  - "_show_only_excel_session_impl"
reads:
  - "LIVE_RESTORE_SUPPRESSED"
  - "RECORDING_EDIT_UNLOCKED"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
frame 모드 표시 경로: 대상 프레임만 배치/표시하고 나머지 라이브 프레임은 파킹.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_enable_excel_context_menus`, `_ensure_excel_workbook_view`, `_hide_peer_session_frames`, `_is_live_shared_app`, `_position_excel_window`, `_protect_workbook_for_read_only_mirror`, `_raise_excel_hwnd`, `_restore_excel_default_input`, `_session_frame_hwnd`, `_set_excel_ribbon_visible`, `_set_window_owner_hwnd`, `_show_window_na`, `_style_live_frame`
- 피호출(영향 전파 경로): `_recover_excel_session_impl`, `_replace_excel_session_workbook_impl`, `_restore_live_window`, `_show_only_excel_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
