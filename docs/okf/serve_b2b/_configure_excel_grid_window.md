---
type: function
title: _configure_excel_grid_window
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, wb=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:4048-4080"

# ── 입출력 ──
inputs:
  - "app"
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_allow_read_only_mirror_selection"
  - "_configure_read_only_mirror_input_block"
  - "_disable_excel_context_menus"
  - "_recording_edit_unlock_active"
  - "_set_display_prop_if_changed"
  - "_show_excel_formula_bar"
  - "range"
calls_external:
  - "CommandBars"
  - "ExecuteExcel4Macro"
  - "_p"
  - "app"
  - "idx"
  - "win"
called_by:
  - "_open_excel_session_impl"
  - "_reopen_excel_session_workbook"
  - "_replace_excel_session_workbook_impl"
  - "_restore_live_protected_view"
  - "_run_excel_python_pipeline_impl"
  - "_save_excel_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Worksheets`, `_allow_read_only_mirror_selection`, `_configure_read_only_mirror_input_block`, `_disable_excel_context_menus`, `_recording_edit_unlock_active`, `_set_display_prop_if_changed`, `_show_excel_formula_bar`, `range`
- 피호출(영향 전파 경로): `_open_excel_session_impl`, `_reopen_excel_session_workbook`, `_replace_excel_session_workbook_impl`, `_restore_live_protected_view`, `_run_excel_python_pipeline_impl`, `_save_excel_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
