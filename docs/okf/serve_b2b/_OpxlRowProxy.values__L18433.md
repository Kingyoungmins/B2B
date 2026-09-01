---
type: method
title: _OpxlRowProxy.values
module: serve_b2b.py
lang: python
extraction: ast
class: _OpxlRowProxy
signature: "(self, row_values)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "serve_b2b.py:18433-18434"

# ── 입출력 ──
inputs:
  - "self"
  - "row_values"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_set_pending_row_values"
calls_external:
  - "list"
called_by:
  - "B2BHandler.handle_workbook_upload"
  - "ColumnIs.__init__"
  - "ExcelSkillContext.input"
  - "ExcelSkillContext.input_sheet"
  - "ExcelSkillContext.pivot"
  - "ExcelSkillContext.rows"
  - "ExcelSkillContext.sheet"
  - "ExcelSkillContext.workbook_like"
  - "ExcelWorksheetProxy.append"
  - "OpenpyxlSkillContext.flush_pending_rows"
  - "OpenpyxlSkillContext.input"
  - "OpenpyxlSkillContext.input_sheet"
  - "OpenpyxlSkillContext.pivot"
  - "OpenpyxlSkillContext.sheet"
  - "OpenpyxlSkillContext.workbook_like"
  - "OpenpyxlWorksheetProxy.append"
  - "OpenpyxlWorksheetProxy.flush_pending_rows"
  - "PythonComSkillContext._as_2d"
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext.apply_filter"
  - "PythonComSkillContext.column_is"
  - "PythonComSkillContext.find_header_row"
  - "PythonComSkillContext.native_pivot"
  - "PythonComSkillContext.write"
  - "_cleanup_excel_sessions_impl"
  - "_cleanup_fullrun_snapshots"
  - "_delete_pipeline_snapshot_entry"
  - "_excel_output_preview_sheets"
  - "_excel_runtime_diagnostics"
  - "_force_restart_excel_sessions_direct"
  - "_fullrun_snapshot_files_exist"
  - "_hide_all_excel_sessions_impl"
  - "_install_ctx_kwarg_tolerance"
  - "_live_final_snapshot_stats"
  - "_opxl_eval_formula"
  - "_pipeline_job_stats"
  - "_pipeline_snapshot_stats"
  - "_registered_path_for_name"
  - "_remaining_sessions_for_pid"
  - "_run_full_pipeline_single_instance_impl"
  - "_set_live_sessions_edit_unlock"
  - "_sheet_snapshot"
  - "_snapshot_files_exist"
  - "_verify_recorded_expected_live"
  - "_workbook_name_lookup_keys"
  - "cleanup_backend_runtime_files"
  - "cleanup_excel_sessions"
  - "digest_grid"
  - "inspect_workbook"
  - "inspect_workbook_with_excel"
  - "load_workbook_aoa"
  - "sheet_expected_state"
  - "update_config"
reads:
  - "self._row_idx"
  - "self._sheet_proxy"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_set_pending_row_values`
- 피호출(영향 전파 경로): `B2BHandler.handle_workbook_upload`, `ColumnIs.__init__`, `ExcelSkillContext.input`, `ExcelSkillContext.input_sheet`, `ExcelSkillContext.pivot`, `ExcelSkillContext.rows`, `ExcelSkillContext.sheet`, `ExcelSkillContext.workbook_like`, `ExcelWorksheetProxy.append`, `OpenpyxlSkillContext.flush_pending_rows`, `OpenpyxlSkillContext.input`, `OpenpyxlSkillContext.input_sheet`, `OpenpyxlSkillContext.pivot`, `OpenpyxlSkillContext.sheet`, `OpenpyxlSkillContext.workbook_like`, `OpenpyxlWorksheetProxy.append`, `OpenpyxlWorksheetProxy.flush_pending_rows`, `PythonComSkillContext._as_2d`, `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext.apply_filter`, `PythonComSkillContext.column_is`, `PythonComSkillContext.find_header_row`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.write`, `_cleanup_excel_sessions_impl`, `_cleanup_fullrun_snapshots`, `_delete_pipeline_snapshot_entry`, `_excel_output_preview_sheets`, `_excel_runtime_diagnostics`, `_force_restart_excel_sessions_direct`, `_fullrun_snapshot_files_exist`, `_hide_all_excel_sessions_impl`, `_install_ctx_kwarg_tolerance`, `_live_final_snapshot_stats`, `_opxl_eval_formula`, `_pipeline_job_stats`, `_pipeline_snapshot_stats`, `_registered_path_for_name`, `_remaining_sessions_for_pid`, `_run_full_pipeline_single_instance_impl`, `_set_live_sessions_edit_unlock`, `_sheet_snapshot`, `_snapshot_files_exist`, `_verify_recorded_expected_live`, `_workbook_name_lookup_keys`, `cleanup_backend_runtime_files`, `cleanup_excel_sessions`, `digest_grid`, `inspect_workbook`, `inspect_workbook_with_excel`, `load_workbook_aoa`, `sheet_expected_state`, `update_config`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
