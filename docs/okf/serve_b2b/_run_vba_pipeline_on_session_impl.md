---
type: function
title: _run_vba_pipeline_on_session_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id, steps, reset=True, entry=None, view_sheet=None)"
role: "VBA/Python 스킬 파이프라인을 적용한다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:9711-10084"

# ── 입출력 ──
inputs:
  - "excel_id"
  - "steps"
  - "reset"
  - "entry"
  - "view_sheet"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): PIPELINE_PROGRESS, RESULTS"
  - "파일시스템 변경/IO"
raises:
  - "PipelineExecutionError"

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_capture_live_view_state"
  - "_clear_workbook_name_aliases"
  - "_copy_source_workbook_into_target"
  - "_excel_collection_names"
  - "_exec_python_com_skill"
  - "_file_label_kind"
  - "_file_size_mb"
  - "_inject_and_run_vba"
  - "_isolated_wb_path"
  - "_kill_pid_quiet"
  - "_live_preview_schema"
  - "_promote_csv_multisheet_name"
  - "_protect_workbook_for_read_only_mirror"
  - "_resolve_ephemeral_excel_open_sheet_alias"
  - "_restore_app_state"
  - "_restore_live_protected_view"
  - "_restore_live_view_state"
  - "_restore_live_window"
  - "_setup_isolated_pipeline_instance"
  - "_step_extended_timeout_s"
  - "_sync_modified_companions_into_live"
  - "_trace_hash"
  - "_trace_text"
  - "_trace_workbook_info"
  - "_vba_pipeline_step_info"
  - "_vba_trace"
  - "append"
  - "get_excel_session"
  - "names"
  - "session_workbook"
calls_external:
  - "Activate"
  - "Close"
  - "Path"
  - "PipelineExecutionError"
  - "Quit"
  - "SaveAs"
  - "SaveCopyAs"
  - "_activate_step_target_sheet"
  - "_pe"
  - "_snap_err"
  - "_snap_name"
  - "_snap_path"
  - "app"
  - "bool"
  - "code"
  - "companions"
  - "dict"
  - "entry"
  - "enumerate"
  - "err"
  - "excel_id"
  - "fallback_idx"
  - "fapp"
  - "fpid"
  - "ftarget"
  - "get"
  - "getattr"
  - "info"
  - "initial_view"
  - "int"
  - "isinstance"
  - "join"
  - "lang"
  - "len"
  - "list"
  - "lower"
  - "mkdir"
  - "mkdtemp"
  - "perf_counter"
  - "pop"
called_by:
  - "_run_vba_on_session_impl"
  - "run_vba_pipeline_on_session"
reads:
  - "BACKEND_DIR"
  - "EXCEL_LOCK"
  - "PIPELINE_PROGRESS"
  - "RESULTS"
  - "VBA_SKILL_ENTRY"
writes:
  - "PIPELINE_PROGRESS"
  - "RESULTS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
VBA/Python 스킬 파이프라인을 적용한다.

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): PIPELINE_PROGRESS, RESULTS
- 파일시스템 변경/IO
- 변경 상태 `PIPELINE_PROGRESS, RESULTS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `Worksheets`, `_capture_live_view_state`, `_clear_workbook_name_aliases`, `_copy_source_workbook_into_target`, `_excel_collection_names`, `_exec_python_com_skill`, `_file_label_kind`, `_file_size_mb`, `_inject_and_run_vba`, `_isolated_wb_path`, `_kill_pid_quiet`, `_live_preview_schema`, `_promote_csv_multisheet_name`, `_protect_workbook_for_read_only_mirror`, `_resolve_ephemeral_excel_open_sheet_alias`, `_restore_app_state`, `_restore_live_protected_view`, `_restore_live_view_state`, `_restore_live_window`, `_setup_isolated_pipeline_instance`, `_step_extended_timeout_s`, `_sync_modified_companions_into_live`, `_trace_hash`, `_trace_text`, `_trace_workbook_info`, `_vba_pipeline_step_info`, `_vba_trace`, `append`, `get_excel_session`, `names`, `session_workbook`
- 피호출(영향 전파 경로): `_run_vba_on_session_impl`, `run_vba_pipeline_on_session`

## 실패/예외
- `PipelineExecutionError`
