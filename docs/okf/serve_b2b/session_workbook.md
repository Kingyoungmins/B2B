---
type: function
title: session_workbook
module: serve_b2b.py
lang: python
extraction: ast
signature: "(session)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "serve_b2b.py:5942-5991"

# ── 입출력 ──
inputs:
  - "session"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_vba_trace"
calls_external:
  - "GetActiveObject"
  - "GetObject"
  - "Path"
  - "RuntimeError"
  - "_pristine"
  - "_restore_err"
  - "copy2"
  - "exists"
  - "get"
  - "lower"
  - "resolve"
  - "str"
called_by:
  - "B2BHandler.handle_excel_preview_schema"
  - "PythonComSkillContext.copy_sheet"
  - "_activate_excel_session_impl"
  - "_capture_copypaste_on_session_impl"
  - "_cleanup_excel_sessions_impl"
  - "_close_excel_session_impl"
  - "_ensure_companion_workbooks"
  - "_get_excel_hover_info_impl"
  - "_hide_all_excel_sessions_impl"
  - "_hide_excel_session_impl"
  - "_poll_excel_session_changes_impl"
  - "_position_excel_session_impl"
  - "_raise_excel_session_impl"
  - "_read_excel_session_selection_impl"
  - "_recover_excel_session_impl"
  - "_replace_excel_session_workbook_impl"
  - "_run_excel_python_pipeline_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_python_on_session_impl"
  - "_run_vba_on_session_impl"
  - "_run_vba_pipeline_on_session_impl"
  - "_save_excel_session_impl"
  - "_setup_isolated_pipeline_instance"
  - "_show_only_excel_session_impl"
  - "_sync_modified_companions_into_live"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 파일시스템 변경/IO

## 관계
- 호출: `_vba_trace`
- 피호출(영향 전파 경로): `B2BHandler.handle_excel_preview_schema`, `PythonComSkillContext.copy_sheet`, `_activate_excel_session_impl`, `_capture_copypaste_on_session_impl`, `_cleanup_excel_sessions_impl`, `_close_excel_session_impl`, `_ensure_companion_workbooks`, `_get_excel_hover_info_impl`, `_hide_all_excel_sessions_impl`, `_hide_excel_session_impl`, `_poll_excel_session_changes_impl`, `_position_excel_session_impl`, `_raise_excel_session_impl`, `_read_excel_session_selection_impl`, `_recover_excel_session_impl`, `_replace_excel_session_workbook_impl`, `_run_excel_python_pipeline_impl`, `_run_full_pipeline_single_instance_impl`, `_run_python_on_session_impl`, `_run_vba_on_session_impl`, `_run_vba_pipeline_on_session_impl`, `_save_excel_session_impl`, `_setup_isolated_pipeline_instance`, `_show_only_excel_session_impl`, `_sync_modified_companions_into_live`

## 실패/예외
- `RuntimeError`
