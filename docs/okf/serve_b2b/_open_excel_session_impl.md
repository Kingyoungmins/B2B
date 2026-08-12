---
type: function
title: _open_excel_session_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path, name=None, workbook_id=None, result_id=None, read_only_mirror=False, left=None, top=None, width=None, height=None, client_left=None, client_top=None, client_width=None, client_height=None, viewport_width=None, viewport_height=None, browser_title=None, native_parent_hwnd=None, native_host_hwnd=None, native_overlay=False, live_editable=False, defer_visible=False, from_state_sig=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:5108-5525"

# ── 입출력 ──
inputs:
  - "path"
  - "name"
  - "workbook_id"
  - "result_id"
  - "read_only_mirror"
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
  - "live_editable"
  - "defer_visible"
  - "from_state_sig"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): EXCEL_SESSIONS, LIVE_RESTORE_SUPPRESSED"
  - "파일시스템 변경/IO"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_capture_browser_hwnd"
  - "_configure_excel_grid_window"
  - "_disable_vba_break_on_all_errors"
  - "_ensure_excel_workbook_view"
  - "_ensure_vbom_access"
  - "_excel_collection_names"
  - "_excel_process_id"
  - "_find_live_final_snapshot"
  - "_get_live_excel_app"
  - "_is_live_shared_app"
  - "_move_hwnd_offscreen"
  - "_position_excel_window"
  - "_protect_workbook_for_read_only_mirror"
  - "_safe_activate_excel_app"
  - "_set_excel_window_owner"
  - "_set_window_owner_hwnd"
  - "_show_window_na"
  - "_style_live_frame"
  - "_track_spawned_excel_app"
  - "_vba_trace"
  - "_workbook_window_hwnd"
  - "excel_available"
  - "excel_workbooks_open"
  - "value"
calls_external:
  - "Activate"
  - "Close"
  - "DispatchEx"
  - "Path"
  - "Quit"
  - "RuntimeError"
  - "Windows"
  - "_cerr"
  - "_wanted_name"
  - "app"
  - "attr"
  - "bool"
  - "browser_hwnd"
  - "browser_title"
  - "client_height"
  - "client_left"
  - "client_top"
  - "client_width"
  - "copy2"
  - "copy_src"
  - "defer_visible"
  - "exists"
  - "float"
  - "frame_hwnd"
  - "from_state_sig"
  - "get"
  - "height"
  - "int"
  - "items"
  - "left"
  - "list"
  - "live_dir"
  - "live_editable"
  - "lower"
  - "mkdir"
  - "name"
  - "native_host_hwnd"
  - "native_overlay"
  - "open_read_only"
  - "open_temp_path"
called_by:
  - "open_excel_session"
reads:
  - "BACKEND_DIR"
  - "EXCEL_LOCK"
  - "EXCEL_SESSIONS"
  - "LIVE_FRAME_MODE"
  - "RECORDING_EDIT_UNLOCKED"
  - "WORKBOOKS"
writes:
  - "EXCEL_SESSIONS"
  - "LIVE_RESTORE_SUPPRESSED"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): EXCEL_SESSIONS, LIVE_RESTORE_SUPPRESSED
- 파일시스템 변경/IO
- 변경 상태 `EXCEL_SESSIONS, LIVE_RESTORE_SUPPRESSED` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_capture_browser_hwnd`, `_configure_excel_grid_window`, `_disable_vba_break_on_all_errors`, `_ensure_excel_workbook_view`, `_ensure_vbom_access`, `_excel_collection_names`, `_excel_process_id`, `_find_live_final_snapshot`, `_get_live_excel_app`, `_is_live_shared_app`, `_move_hwnd_offscreen`, `_position_excel_window`, `_protect_workbook_for_read_only_mirror`, `_safe_activate_excel_app`, `_set_excel_window_owner`, `_set_window_owner_hwnd`, `_show_window_na`, `_style_live_frame`, `_track_spawned_excel_app`, `_vba_trace`, `_workbook_window_hwnd`, `excel_available`, `excel_workbooks_open`, `value`
- 피호출(영향 전파 경로): `open_excel_session`

## 실패/예외
- `RuntimeError`
