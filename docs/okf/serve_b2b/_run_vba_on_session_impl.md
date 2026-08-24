---
type: function
title: _run_vba_on_session_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id, code, entry=None, restore_window=True)"
role: "라이브 세션에 떠 있는 실제 워크북에 VBA 매크로를 주입해 즉시 실행한다(저지연 리모콘, 단일 단계 append)."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:9776-9881"

# ── 입출력 ──
inputs:
  - "excel_id"
  - "code"
  - "entry"
  - "restore_window"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
raises:
  - "PipelineExecutionError"
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_capture_live_view_state"
  - "_diag_vba_log_line"
  - "_ensure_companion_workbooks"
  - "_inject_and_run_vba"
  - "_is_vba_macro_run_blocked_error"
  - "_live_preview_schema"
  - "_pipeline_error_guide"
  - "_prepare_vba_macro_run_window_state"
  - "_protect_workbook_for_read_only_mirror"
  - "_restore_app_state"
  - "_restore_live_protected_view"
  - "_restore_live_window"
  - "_run_vba_pipeline_on_session_impl"
  - "get_excel_session"
  - "session_workbook"
calls_external:
  - "PipelineExecutionError"
  - "RuntimeError"
  - "app"
  - "code"
  - "entry"
  - "err"
  - "excel_id"
  - "get"
  - "int"
  - "perf_counter"
  - "round"
  - "session"
  - "str"
  - "strip"
  - "wb"
called_by:
  - "run_vba_on_session"
reads:
  - "EXCEL_LOCK"
  - "VBA_SKILL_ENTRY"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
라이브 세션에 떠 있는 실제 워크북에 VBA 매크로를 주입해 즉시 실행한다(저지연 리모콘, 단일 단계 append).

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화

## 관계
- 호출: `_capture_live_view_state`, `_diag_vba_log_line`, `_ensure_companion_workbooks`, `_inject_and_run_vba`, `_is_vba_macro_run_blocked_error`, `_live_preview_schema`, `_pipeline_error_guide`, `_prepare_vba_macro_run_window_state`, `_protect_workbook_for_read_only_mirror`, `_restore_app_state`, `_restore_live_protected_view`, `_restore_live_window`, `_run_vba_pipeline_on_session_impl`, `get_excel_session`, `session_workbook`
- 피호출(영향 전파 경로): `run_vba_on_session`

## 실패/예외
- `PipelineExecutionError`
- `RuntimeError`
