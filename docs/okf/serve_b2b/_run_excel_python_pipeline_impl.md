---
type: function
title: _run_excel_python_pipeline_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(payload, job_id=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:14342-14778"

# ── 입출력 ──
inputs:
  - "payload"
  - "job_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): RESULTS"
  - "파일시스템 변경/IO"
raises:
  - "PipelineExecutionError"
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_configure_excel_grid_window"
  - "_copy_source_workbook_into_target"
  - "_excel_output_preview_sheets"
  - "_exec_python_com_skill"
  - "_find_best_pipeline_snapshot"
  - "_get_python_skill_app"
  - "_hide_excel_app_window"
  - "_inject_and_run_vba"
  - "_open_excel_workbook_for_skill"
  - "_pipeline_error_guide"
  - "_pipeline_snapshot_key"
  - "_protect_workbook_for_read_only_mirror"
  - "_python_step_sig"
  - "_result_from_workbook_files"
  - "_safe_excel_calculate"
  - "_safe_python_globals"
  - "_save_pipeline_step_snapshot"
  - "_snapshot_path"
  - "_start_excel_hide_guard"
  - "_warn_excel_nonfatal"
  - "_worker_step_target_wb"
  - "append"
  - "build_result_previews"
  - "excel_available"
  - "get_excel_session"
  - "get_workbook_or_raise"
  - "inspect_workbook"
  - "is_python_pipeline_step"
  - "is_vba_pipeline_step"
  - "normalize_python_pipeline_code"
  - "python_step_uses_legacy_dialect"
  - "raise_if_pipeline_cancelled"
  - "refresh_excel_session_snapshots"
  - "rows_only_sheets"
  - "session_workbook"
  - "update_pipeline_job"
  - "update_workbook_current_cache"
calls_external:
  - "Activate"
  - "Close"
  - "ExcelSkillContext"
  - "Path"
  - "PipelineExecutionError"
  - "RuntimeError"
  - "SaveCopyAs"
  - "VBA_SKILL_ENTRY"
  - "_twb"
  - "active_steps"
  - "app"
  - "applied_sigs"
  - "bool"
  - "callable"
  - "code"
  - "compile"
  - "ctx"
  - "current"
  - "dest"
  - "dict"
  - "enumerate"
  - "err"
  - "exec"
  - "exists"
  - "final_snapshot"
  - "get"
  - "idx"
  - "in_paths"
  - "input_download_urls"
  - "input_items"
  - "input_previews"
  - "input_stable_src"
  - "input_wb_by_name"
  - "input_wb_records"
  - "input_wbs"
  - "items"
  - "job_id"
  - "len"
  - "list"
  - "live_excel_id"
called_by:
  - "run_excel_python_pipeline_payload"
reads:
  - "BACKEND_DIR"
  - "PIPELINE_STEP_SNAPSHOTS"
  - "RESULTS"
  - "SNAPSHOT_INTERMEDIATE_MAX_BYTES"
  - "VBA_SKILL_ENTRY"
writes:
  - "RESULTS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): RESULTS
- 파일시스템 변경/IO
- 변경 상태 `RESULTS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_configure_excel_grid_window`, `_copy_source_workbook_into_target`, `_excel_output_preview_sheets`, `_exec_python_com_skill`, `_find_best_pipeline_snapshot`, `_get_python_skill_app`, `_hide_excel_app_window`, `_inject_and_run_vba`, `_open_excel_workbook_for_skill`, `_pipeline_error_guide`, `_pipeline_snapshot_key`, `_protect_workbook_for_read_only_mirror`, `_python_step_sig`, `_result_from_workbook_files`, `_safe_excel_calculate`, `_safe_python_globals`, `_save_pipeline_step_snapshot`, `_snapshot_path`, `_start_excel_hide_guard`, `_warn_excel_nonfatal`, `_worker_step_target_wb`, `append`, `build_result_previews`, `excel_available`, `get_excel_session`, `get_workbook_or_raise`, `inspect_workbook`, `is_python_pipeline_step`, `is_vba_pipeline_step`, `normalize_python_pipeline_code`, `python_step_uses_legacy_dialect`, `raise_if_pipeline_cancelled`, `refresh_excel_session_snapshots`, `rows_only_sheets`, `session_workbook`, `update_pipeline_job`, `update_workbook_current_cache`
- 피호출(영향 전파 경로): `run_excel_python_pipeline_payload`

## 실패/예외
- `PipelineExecutionError`
- `RuntimeError`
