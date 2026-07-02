---
type: method
title: OpenpyxlWorksheetProxy.append
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlWorksheetProxy
signature: "(self, values)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:12491-12515"

# ── 입출력 ──
inputs:
  - "self"
  - "values"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "cell"
  - "flush_pending_rows"
  - "values"
calls_external:
  - "c"
  - "enumerate"
  - "getattr"
  - "int"
  - "list"
called_by:
  - "B2BHandler.handle_current_view_diff"
  - "B2BHandler.handle_excel_run_vba_pipeline"
  - "ExcelSkillContext._merge_pivot_grid_into_base"
  - "ExcelSkillContext.filter_to_sheet"
  - "ExcelSkillContext.input_sheet"
  - "ExcelSkillContext.pivot"
  - "ExcelSkillContext.sheet"
  - "ExcelSkillContext.sort"
  - "ExcelSkillContext.workbook_like"
  - "OpenpyxlSkillContext._merge_pivot_grid_into_base"
  - "OpenpyxlSkillContext.display_rows"
  - "OpenpyxlSkillContext.filter_to_sheet"
  - "OpenpyxlSkillContext.flush_pending_rows"
  - "OpenpyxlSkillContext.input_sheet"
  - "OpenpyxlSkillContext.pivot"
  - "OpenpyxlSkillContext.rows"
  - "OpenpyxlSkillContext.sheet"
  - "OpenpyxlSkillContext.sort"
  - "OpenpyxlSkillContext.workbook_like"
  - "OpenpyxlWorksheetProxy._formula_cells"
  - "OpenpyxlWorksheetProxy.flush_pending_rows"
  - "PythonComSkillContext._as_2d"
  - "PythonComSkillContext._journal_save"
  - "PythonComSkillContext._ws"
  - "PythonComSkillContext.add_sheet"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.book"
  - "PythonComSkillContext.copy"
  - "PythonComSkillContext.copy_sheet"
  - "PythonComSkillContext.dedupe"
  - "PythonComSkillContext.delete_cols"
  - "PythonComSkillContext.delete_rows"
  - "PythonComSkillContext.delete_sheet"
  - "PythonComSkillContext.filter_to_sheet"
  - "PythonComSkillContext.hide_cols"
  - "PythonComSkillContext.hide_rows"
  - "PythonComSkillContext.insert_cols"
  - "PythonComSkillContext.insert_rows"
  - "PythonComSkillContext.lookup"
  - "PythonComSkillContext.merge"
  - "PythonComSkillContext.move_cols"
  - "PythonComSkillContext.paste_copied"
  - "PythonComSkillContext.pivot"
  - "PythonComSkillContext.rename_sheet"
  - "PythonComSkillContext.replace"
  - "PythonComSkillContext.set_number_format"
  - "PythonComSkillContext.sort"
  - "PythonComSkillContext.unmerge"
  - "_OpxlRange._get_value"
  - "_alias_ephemeral_excel_open_sheet_name"
  - "_browser_content_target"
  - "_capture_browser_hwnd"
  - "_cleanup_excel_sessions_impl"
  - "_diag_prerun_window_state"
  - "_diag_vba_run_failure"
  - "_disable_vba_break_on_all_errors"
  - "_ensure_companion_workbooks"
  - "_excel_collection_names"
  - "_excel_output_preview_sheets"
  - "_excel_runtime_diagnostics"
  - "_force_restart_excel_sessions_direct"
  - "_hide_all_excel_sessions_impl"
  - "_hide_peer_session_frames"
  - "_hide_peer_workbook_windows"
  - "_opxl_numeric_values"
  - "_opxl_range_values"
  - "_opxl_split_top_level_args"
  - "_pivot_crosstab"
  - "_poll_excel_session_changes_impl"
  - "_python_com_static_check"
  - "_run_excel_python_pipeline_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_vba_pipeline_on_session_impl"
  - "_setup_isolated_pipeline_instance"
  - "_shift_months_in_text"
  - "_strip_vba_comment"
  - "_validate_vba_source_before_inject"
  - "_vba_macro_refs"
  - "build_result_previews"
  - "compute_sheet_diff"
  - "excel_workbooks_open"
  - "inspect_workbook"
  - "inspect_workbook_with_excel"
  - "load_workbook_aoa"
  - "load_workbook_aoa_with_excel"
  - "normalize_python_pipeline_code"
  - "read_csv_rows"
  - "run_backend_pipeline_payload_with_worker"
reads:
  - "self._ws"
  - "self.flush_pending_rows"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `cell`, `flush_pending_rows`, `values`
- 피호출(영향 전파 경로): `B2BHandler.handle_current_view_diff`, `B2BHandler.handle_excel_run_vba_pipeline`, `ExcelSkillContext._merge_pivot_grid_into_base`, `ExcelSkillContext.filter_to_sheet`, `ExcelSkillContext.input_sheet`, `ExcelSkillContext.pivot`, `ExcelSkillContext.sheet`, `ExcelSkillContext.sort`, `ExcelSkillContext.workbook_like`, `OpenpyxlSkillContext._merge_pivot_grid_into_base`, `OpenpyxlSkillContext.display_rows`, `OpenpyxlSkillContext.filter_to_sheet`, `OpenpyxlSkillContext.flush_pending_rows`, `OpenpyxlSkillContext.input_sheet`, `OpenpyxlSkillContext.pivot`, `OpenpyxlSkillContext.rows`, `OpenpyxlSkillContext.sheet`, `OpenpyxlSkillContext.sort`, `OpenpyxlSkillContext.workbook_like`, `OpenpyxlWorksheetProxy._formula_cells`, `OpenpyxlWorksheetProxy.flush_pending_rows`, `PythonComSkillContext._as_2d`, `PythonComSkillContext._journal_save`, `PythonComSkillContext._ws`, `PythonComSkillContext.add_sheet`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.book`, `PythonComSkillContext.copy`, `PythonComSkillContext.copy_sheet`, `PythonComSkillContext.dedupe`, `PythonComSkillContext.delete_cols`, `PythonComSkillContext.delete_rows`, `PythonComSkillContext.delete_sheet`, `PythonComSkillContext.filter_to_sheet`, `PythonComSkillContext.hide_cols`, `PythonComSkillContext.hide_rows`, `PythonComSkillContext.insert_cols`, `PythonComSkillContext.insert_rows`, `PythonComSkillContext.lookup`, `PythonComSkillContext.merge`, `PythonComSkillContext.move_cols`, `PythonComSkillContext.paste_copied`, `PythonComSkillContext.pivot`, `PythonComSkillContext.rename_sheet`, `PythonComSkillContext.replace`, `PythonComSkillContext.set_number_format`, `PythonComSkillContext.sort`, `PythonComSkillContext.unmerge`, `_OpxlRange._get_value`, `_alias_ephemeral_excel_open_sheet_name`, `_browser_content_target`, `_capture_browser_hwnd`, `_cleanup_excel_sessions_impl`, `_diag_prerun_window_state`, `_diag_vba_run_failure`, `_disable_vba_break_on_all_errors`, `_ensure_companion_workbooks`, `_excel_collection_names`, `_excel_output_preview_sheets`, `_excel_runtime_diagnostics`, `_force_restart_excel_sessions_direct`, `_hide_all_excel_sessions_impl`, `_hide_peer_session_frames`, `_hide_peer_workbook_windows`, `_opxl_numeric_values`, `_opxl_range_values`, `_opxl_split_top_level_args`, `_pivot_crosstab`, `_poll_excel_session_changes_impl`, `_python_com_static_check`, `_run_excel_python_pipeline_impl`, `_run_full_pipeline_single_instance_impl`, `_run_vba_pipeline_on_session_impl`, `_setup_isolated_pipeline_instance`, `_shift_months_in_text`, `_strip_vba_comment`, `_validate_vba_source_before_inject`, `_vba_macro_refs`, `build_result_previews`, `compute_sheet_diff`, `excel_workbooks_open`, `inspect_workbook`, `inspect_workbook_with_excel`, `load_workbook_aoa`, `load_workbook_aoa_with_excel`, `normalize_python_pipeline_code`, `read_csv_rows`, `run_backend_pipeline_payload_with_worker`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
