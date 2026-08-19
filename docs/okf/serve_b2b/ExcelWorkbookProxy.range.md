---
type: method
title: ExcelWorkbookProxy.range
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelWorkbookProxy
signature: "(self, sheet_or_name, address)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:15665-15666"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_or_name"
  - "address"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "address"
  - "self"
  - "sheet_or_name"
called_by:
  - "B2BHandler.proxy"
  - "ExcelSkillContext.pivot"
  - "ExcelWorksheetsProxy.__iter__"
  - "OpenpyxlSkillContext.display_rows"
  - "OpenpyxlSkillContext.pivot"
  - "OpenpyxlSkillContext.sort"
  - "OpenpyxlWorksheetProxy.flush_pending_rows"
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext._shaped_matrix"
  - "PythonComSkillContext.dedupe"
  - "PythonComSkillContext.fill_sum_col"
  - "PythonComSkillContext.find_header"
  - "PythonComSkillContext.native_pivot"
  - "PythonComSkillContext.shift_months"
  - "PythonComSkillContext.split_column"
  - "PythonComSkillContext.sum_column"
  - "PythonComSkillContext.sum_lookup"
  - "PythonComSkillContext.sum_where"
  - "PythonComSkillContext.swap_cols"
  - "PythonComSkillContext.used_last_row"
  - "_OpxlRange._get_value"
  - "_OpxlRange._set_value"
  - "_OpxlRowProxy.values"
  - "_apply_openpyxl_text_format_for_long_digit_columns"
  - "_configure_excel_grid_window"
  - "_copy_source_workbook_into_target"
  - "_disable_excel_context_menus"
  - "_enable_excel_context_menus"
  - "_excel_collection_names"
  - "_excel_output_preview_sheets"
  - "_find_best_pipeline_snapshot"
  - "_hide_vba_editor"
  - "_hide_workbook_windows"
  - "_opxl_range_values"
  - "_park_excel_app_offscreen"
  - "_protect_workbook_for_read_only_mirror"
  - "_read_excel_clipboard_source"
  - "_run_vba_via_runner_with_retry"
  - "_stable_workbook_key"
  - "_verify_capture_sheet_aoa"
  - "compute_sheet_diff"
  - "inspect_workbook"
  - "inspect_workbook_with_excel"
  - "is_encrypted_ooxml"
  - "load_workbook_aoa_with_excel"
  - "render_pptx_to_slides_b64"
reads:
  - "self._ctx"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `B2BHandler.proxy`, `ExcelSkillContext.pivot`, `ExcelWorksheetsProxy.__iter__`, `OpenpyxlSkillContext.display_rows`, `OpenpyxlSkillContext.pivot`, `OpenpyxlSkillContext.sort`, `OpenpyxlWorksheetProxy.flush_pending_rows`, `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext._shaped_matrix`, `PythonComSkillContext.dedupe`, `PythonComSkillContext.fill_sum_col`, `PythonComSkillContext.find_header`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.shift_months`, `PythonComSkillContext.split_column`, `PythonComSkillContext.sum_column`, `PythonComSkillContext.sum_lookup`, `PythonComSkillContext.sum_where`, `PythonComSkillContext.swap_cols`, `PythonComSkillContext.used_last_row`, `_OpxlRange._get_value`, `_OpxlRange._set_value`, `_OpxlRowProxy.values`, `_apply_openpyxl_text_format_for_long_digit_columns`, `_configure_excel_grid_window`, `_copy_source_workbook_into_target`, `_disable_excel_context_menus`, `_enable_excel_context_menus`, `_excel_collection_names`, `_excel_output_preview_sheets`, `_find_best_pipeline_snapshot`, `_hide_vba_editor`, `_hide_workbook_windows`, `_opxl_range_values`, `_park_excel_app_offscreen`, `_protect_workbook_for_read_only_mirror`, `_read_excel_clipboard_source`, `_run_vba_via_runner_with_retry`, `_stable_workbook_key`, `_verify_capture_sheet_aoa`, `compute_sheet_diff`, `inspect_workbook`, `inspect_workbook_with_excel`, `is_encrypted_ooxml`, `load_workbook_aoa_with_excel`, `render_pptx_to_slides_b64`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
