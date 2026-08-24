---
type: function
title: _position_excel_window
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, left, top, width, height, browser_hwnd=None, native_parent_hwnd=None, native_host_hwnd=None, native_overlay=False, client_left=None, client_top=None, client_width=None, client_height=None, viewport_width=None, viewport_height=None, show=True, keep_zorder=False, hwnd=None, no_activate=False)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:3881-4061"

# ── 입출력 ──
inputs:
  - "app"
  - "left"
  - "top"
  - "width"
  - "height"
  - "browser_hwnd"
  - "native_parent_hwnd"
  - "native_host_hwnd"
  - "native_overlay"
  - "client_left"
  - "client_top"
  - "client_width"
  - "client_height"
  - "viewport_width"
  - "viewport_height"
  - "show"
  - "keep_zorder"
  - "hwnd"
  - "no_activate"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_focus_excel_grid_child"
  - "_resolve_excel_mirror_rect"
  - "_unmaximize_hwnd_no_activate"
calls_external:
  - "GetParent"
  - "GetWindowLong"
  - "IsIconic"
  - "IsWindow"
  - "ScreenToClient"
  - "SetParent"
  - "SetWindowLong"
  - "SetWindowPos"
  - "ShowWindow"
  - "browser_hwnd"
  - "client_height"
  - "client_left"
  - "client_top"
  - "client_width"
  - "desired_ex_style"
  - "desired_style"
  - "flags"
  - "getattr"
  - "height"
  - "hwnd"
  - "int"
  - "left"
  - "native_parent_hwnd"
  - "parent_hwnd"
  - "style"
  - "top"
  - "viewport_height"
  - "viewport_width"
  - "width"
  - "win32con"
called_by:
  - "_open_excel_session_impl"
  - "_position_excel_session_impl"
  - "_present_live_session_frame"
  - "_replace_excel_session_workbook_impl"
  - "_restore_live_window"
  - "_show_only_excel_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_focus_excel_grid_child`, `_resolve_excel_mirror_rect`, `_unmaximize_hwnd_no_activate`
- 피호출(영향 전파 경로): `_open_excel_session_impl`, `_position_excel_session_impl`, `_present_live_session_frame`, `_replace_excel_session_workbook_impl`, `_restore_live_window`, `_show_only_excel_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
