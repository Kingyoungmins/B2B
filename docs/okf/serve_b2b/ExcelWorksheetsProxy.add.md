---
type: method
title: ExcelWorksheetsProxy.add
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelWorksheetsProxy
signature: "(self, name=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:16404-16408"

# ── 입출력 ──
inputs:
  - "self"
  - "name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Add"
  - "ExcelWorksheetProxy"
  - "name"
  - "str"
  - "ws"
called_by:
  - "ExcelSkillContext.sheet"
  - "OpenpyxlSkillContext._write_grid"
  - "OpenpyxlSkillContext.add_sheet"
  - "OpenpyxlSkillContext.sheet"
  - "PythonComSkillContext._mark_mutated"
  - "PythonComSkillContext.dedupe"
  - "PythonComSkillContext.swap_cols"
  - "_alias_ephemeral_excel_open_sheet_name"
  - "_alias_open_workbook_name"
  - "_cleanup_excel_sessions_impl"
  - "_current_app_version"
  - "_delete_pipeline_snapshot_entry"
  - "_ensure_companion_workbooks"
  - "_excel_runtime_diagnostics"
  - "_force_restart_excel_sessions_direct"
  - "_hide_all_excel_sessions_impl"
  - "_install_ctx_kwarg_tolerance"
  - "_long_digit_identifier_columns"
  - "_maybe_perf_trace_runtime"
  - "_ole_directory_stream_names"
  - "_opxl_display_cell_value"
  - "_other_b2b_backend_running"
  - "_pivot_crosstab"
  - "_python_com_static_check"
  - "_run_full_pipeline_single_instance_impl"
  - "_runtime_sampler_once"
  - "_setup_isolated_pipeline_instance"
  - "_stable_workbook_key"
  - "_stash_workbook_name_alias"
  - "_trace_step_code_once"
  - "_track_spawned_excel_app"
  - "_vba_macro_refs"
  - "_visible_excel_top_hwnds_for_pids"
  - "_workbook_name_lookup_keys"
  - "ensure_worker_workbook"
  - "unique_archive_name"
reads:
  - "self._collection"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `ExcelSkillContext.sheet`, `OpenpyxlSkillContext._write_grid`, `OpenpyxlSkillContext.add_sheet`, `OpenpyxlSkillContext.sheet`, `PythonComSkillContext._mark_mutated`, `PythonComSkillContext.dedupe`, `PythonComSkillContext.swap_cols`, `_alias_ephemeral_excel_open_sheet_name`, `_alias_open_workbook_name`, `_cleanup_excel_sessions_impl`, `_current_app_version`, `_delete_pipeline_snapshot_entry`, `_ensure_companion_workbooks`, `_excel_runtime_diagnostics`, `_force_restart_excel_sessions_direct`, `_hide_all_excel_sessions_impl`, `_install_ctx_kwarg_tolerance`, `_long_digit_identifier_columns`, `_maybe_perf_trace_runtime`, `_ole_directory_stream_names`, `_opxl_display_cell_value`, `_other_b2b_backend_running`, `_pivot_crosstab`, `_python_com_static_check`, `_run_full_pipeline_single_instance_impl`, `_runtime_sampler_once`, `_setup_isolated_pipeline_instance`, `_stable_workbook_key`, `_stash_workbook_name_alias`, `_trace_step_code_once`, `_track_spawned_excel_app`, `_vba_macro_refs`, `_visible_excel_top_hwnds_for_pids`, `_workbook_name_lookup_keys`, `ensure_worker_workbook`, `unique_archive_name`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
