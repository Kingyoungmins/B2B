---
type: function
title: _run_full_pipeline_single_instance_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(groups, reset_excel_ids=None, view_sheet=None, entry=None, output_mode='sync', state_sig=None)"
role: "[0.5.15 백그라운드 전체실행] 격리 인스턴스 '1개'에서 관여 파일 전부를 '원본'부터 열고, 전 그룹·스텝을"
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:10336-10757"

# ── 입출력 ──
inputs:
  - "groups"
  - "reset_excel_ids"
  - "view_sheet"
  - "entry"
  - "output_mode"
  - "state_sig"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): PIPELINE_PROGRESS, RESULTS"
  - "파일시스템 변경/IO"
raises:
  - "PipelineExecutionError"
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_capture_live_view_state"
  - "_clear_workbook_name_aliases"
  - "_copy_source_workbook_into_target"
  - "_disable_vba_break_on_all_errors"
  - "_ensure_vbom_access"
  - "_excel_process_id"
  - "_exec_python_com_skill"
  - "_file_label_kind"
  - "_file_size_mb"
  - "_fullrun_excel_ids_for_books"
  - "_inject_and_run_vba"
  - "_isolated_wb_path"
  - "_kill_pid_quiet"
  - "_live_preview_schema"
  - "_protect_workbook_for_read_only_mirror"
  - "_restore_app_state"
  - "_restore_live_protected_view"
  - "_restore_live_view_state"
  - "_restore_live_window"
  - "_save_live_final_snapshot"
  - "_step_extended_timeout_s"
  - "_trace_hash"
  - "_track_spawned_excel_app"
  - "_vba_pipeline_step_info"
  - "_vba_trace"
  - "_warn_excel_nonfatal"
  - "add"
  - "append"
  - "default_output_dir"
  - "excel_workbooks_open"
  - "get_excel_session"
  - "session_workbook"
  - "values"
calls_external:
  - "Activate"
  - "Close"
  - "DispatchEx"
  - "Path"
  - "PipelineExecutionError"
  - "Quit"
  - "RuntimeError"
  - "SaveAs"
  - "SaveCopyAs"
  - "_capture_fail_state_snapshots"
  - "_cerr"
  - "_fr_books"
  - "_fr_step_cross"
  - "_fr_sum"
  - "_fr_tracked"
  - "_fs_err"
  - "_p"
  - "_pe"
  - "_save_err"
  - "_serr"
  - "_sheet"
  - "_sid"
  - "_snap_err"
  - "_snap_path"
  - "_to_sync"
  - "_wb_rec"
  - "a0"
  - "anchor_excel_id"
  - "attr"
  - "bool"
  - "byExcel"
  - "cname"
  - "code"
  - "copy2"
  - "cpath"
  - "cwb"
  - "dict"
  - "entry"
  - "enumerate"
  - "err"
called_by:
  - "run_full_pipeline_single_instance"
reads:
  - "BACKEND_DIR"
  - "EXCEL_LOCK"
  - "EXCEL_SESSIONS"
  - "PIPELINE_PROGRESS"
  - "RESULTS"
  - "VBA_SKILL_ENTRY"
  - "WORKBOOKS"
writes:
  - "PIPELINE_PROGRESS"
  - "RESULTS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[0.5.15 백그라운드 전체실행] 격리 인스턴스 '1개'에서 관여 파일 전부를 '원본'부터 열고, 전 그룹·스텝을

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): PIPELINE_PROGRESS, RESULTS
- 파일시스템 변경/IO
- 변경 상태 `PIPELINE_PROGRESS, RESULTS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `Worksheets`, `_capture_live_view_state`, `_clear_workbook_name_aliases`, `_copy_source_workbook_into_target`, `_disable_vba_break_on_all_errors`, `_ensure_vbom_access`, `_excel_process_id`, `_exec_python_com_skill`, `_file_label_kind`, `_file_size_mb`, `_fullrun_excel_ids_for_books`, `_inject_and_run_vba`, `_isolated_wb_path`, `_kill_pid_quiet`, `_live_preview_schema`, `_protect_workbook_for_read_only_mirror`, `_restore_app_state`, `_restore_live_protected_view`, `_restore_live_view_state`, `_restore_live_window`, `_save_live_final_snapshot`, `_step_extended_timeout_s`, `_trace_hash`, `_track_spawned_excel_app`, `_vba_pipeline_step_info`, `_vba_trace`, `_warn_excel_nonfatal`, `add`, `append`, `default_output_dir`, `excel_workbooks_open`, `get_excel_session`, `session_workbook`, `values`
- 피호출(영향 전파 경로): `run_full_pipeline_single_instance`

## 실패/예외
- `PipelineExecutionError`
- `RuntimeError`
