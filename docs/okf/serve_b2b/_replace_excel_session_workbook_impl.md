---
type: function
title: _replace_excel_session_workbook_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id, path, name=None, result_id=None, read_only_mirror=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:5974-6260"

# ── 입출력 ──
inputs:
  - "excel_id"
  - "path"
  - "name"
  - "result_id"
  - "read_only_mirror"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_configure_excel_grid_window"
  - "_ensure_excel_workbook_view"
  - "_excel_collection_names"
  - "_file_label_kind"
  - "_file_size_mb"
  - "_hide_excel_app_window"
  - "_hide_excel_hwnd"
  - "_move_hwnd_offscreen"
  - "_park_excel_app_offscreen"
  - "_position_excel_window"
  - "_present_live_session_frame"
  - "_protect_workbook_for_read_only_mirror"
  - "_resolve_live_identity_name"
  - "_safe_activate_excel_app"
  - "_set_excel_window_owner"
  - "_vba_trace"
  - "_workbook_window_hwnd"
  - "excel_workbooks_open"
  - "get_excel_session"
  - "session_workbook"
calls_external:
  - "Activate"
  - "BACKEND_DIR"
  - "Close"
  - "Path"
  - "RuntimeError"
  - "Windows"
  - "_clean_open"
  - "_new_frame_hwnd"
  - "_rt"
  - "active_sheet"
  - "app"
  - "bool"
  - "clean_name"
  - "copy2"
  - "dict"
  - "excel_id"
  - "exists"
  - "get"
  - "height"
  - "int"
  - "left"
  - "mkdtemp"
  - "name"
  - "new_temp_path"
  - "new_wb"
  - "old_replace_dir"
  - "old_temp_path"
  - "path"
  - "perf_counter"
  - "pop"
  - "read_only_mirror"
  - "replace_open_dir"
  - "replace_open_path"
  - "rmtree"
  - "round"
  - "session"
  - "split"
  - "str"
  - "top"
  - "unlink"
called_by:
  - "replace_excel_session_workbook"
reads:
  - "BACKEND_DIR"
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
- 파일시스템 변경/IO

## 관계
- 호출: `Worksheets`, `_configure_excel_grid_window`, `_ensure_excel_workbook_view`, `_excel_collection_names`, `_file_label_kind`, `_file_size_mb`, `_hide_excel_app_window`, `_hide_excel_hwnd`, `_move_hwnd_offscreen`, `_park_excel_app_offscreen`, `_position_excel_window`, `_present_live_session_frame`, `_protect_workbook_for_read_only_mirror`, `_resolve_live_identity_name`, `_safe_activate_excel_app`, `_set_excel_window_owner`, `_vba_trace`, `_workbook_window_hwnd`, `excel_workbooks_open`, `get_excel_session`, `session_workbook`
- 피호출(영향 전파 경로): `replace_excel_session_workbook`

## 실패/예외
- `RuntimeError`
