---
type: function
title: _vba_trace
module: serve_b2b.py
lang: python
extraction: ast
signature: "(event, **fields)"
role: "Structured VBA/pipeline trace for field failures."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:9082-9100"

# ── 입출력 ──
inputs:
  - "event"
  - "**fields"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_vba_trace_path"
  - "write"
calls_external:
  - "dumps"
  - "fields"
  - "getpid"
  - "isoformat"
  - "line"
  - "now"
  - "open"
  - "payload"
  - "str"
  - "update"
called_by:
  - "B2BHandler._hide_if_host_minimized"
  - "B2BHandler.do_POST"
  - "B2BHandler.handle_excel_capture_copypaste"
  - "B2BHandler.handle_excel_preview_schema"
  - "B2BHandler.handle_excel_run_full_pipeline"
  - "B2BHandler.handle_excel_run_vba"
  - "B2BHandler.handle_excel_run_vba_pipeline"
  - "B2BHandler.handle_workbook_upload"
  - "PythonComSkillContext._filter_to_sheet_native"
  - "PythonComSkillContext._ws"
  - "PythonComSkillContext.book"
  - "PythonComSkillContext.copy"
  - "PythonComSkillContext.copy_key_blocks"
  - "PythonComSkillContext.last_row"
  - "PythonComSkillContext.native_pivot"
  - "PythonComSkillContext.paste_copied"
  - "PythonComSkillContext.pivot"
  - "PythonComSkillContext.read"
  - "PythonComSkillContext.sum_column"
  - "PythonComSkillContext.sum_lookup"
  - "PythonComSkillContext.sum_where"
  - "PythonComSkillContext.write"
  - "_capture_copypaste_on_session_impl"
  - "_commit_pending_excel_cell_edit"
  - "_exec_python_com_skill"
  - "_get_live_excel_app"
  - "_inject_and_run_vba"
  - "_inject_and_run_vba_in_host"
  - "_note_live_app_reset"
  - "_open_excel_session_impl"
  - "_replace_excel_session_workbook_impl"
  - "_resolve_open_workbook_name"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_python_on_session_impl"
  - "_run_vba_macro_any_ref"
  - "_run_vba_pipeline_on_session_impl"
  - "_save_excel_session_impl"
  - "_secure_outgoing_data"
  - "_setup_isolated_pipeline_instance"
  - "_sync_modified_companions_into_live"
  - "_trace_step_code_once"
  - "_verify_step_isolated_impl"
  - "cleanup_stale_temp_artifacts"
  - "excel_record_start"
  - "excel_record_stop"
  - "inspect_workbook"
  - "run_python_on_session"
  - "session_workbook"
reads:
  - "_TRACE_WRITE_LOCK"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
Structured VBA/pipeline trace for field failures.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_vba_trace_path`, `write`
- 피호출(영향 전파 경로): `B2BHandler._hide_if_host_minimized`, `B2BHandler.do_POST`, `B2BHandler.handle_excel_capture_copypaste`, `B2BHandler.handle_excel_preview_schema`, `B2BHandler.handle_excel_run_full_pipeline`, `B2BHandler.handle_excel_run_vba`, `B2BHandler.handle_excel_run_vba_pipeline`, `B2BHandler.handle_workbook_upload`, `PythonComSkillContext._filter_to_sheet_native`, `PythonComSkillContext._ws`, `PythonComSkillContext.book`, `PythonComSkillContext.copy`, `PythonComSkillContext.copy_key_blocks`, `PythonComSkillContext.last_row`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.paste_copied`, `PythonComSkillContext.pivot`, `PythonComSkillContext.read`, `PythonComSkillContext.sum_column`, `PythonComSkillContext.sum_lookup`, `PythonComSkillContext.sum_where`, `PythonComSkillContext.write`, `_capture_copypaste_on_session_impl`, `_commit_pending_excel_cell_edit`, `_exec_python_com_skill`, `_get_live_excel_app`, `_inject_and_run_vba`, `_inject_and_run_vba_in_host`, `_note_live_app_reset`, `_open_excel_session_impl`, `_replace_excel_session_workbook_impl`, `_resolve_open_workbook_name`, `_run_full_pipeline_single_instance_impl`, `_run_python_on_session_impl`, `_run_vba_macro_any_ref`, `_run_vba_pipeline_on_session_impl`, `_save_excel_session_impl`, `_secure_outgoing_data`, `_setup_isolated_pipeline_instance`, `_sync_modified_companions_into_live`, `_trace_step_code_once`, `_verify_step_isolated_impl`, `cleanup_stale_temp_artifacts`, `excel_record_start`, `excel_record_stop`, `inspect_workbook`, `run_python_on_session`, `session_workbook`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
