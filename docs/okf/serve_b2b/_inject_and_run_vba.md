---
type: function
title: _inject_and_run_vba
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, wb, code, entry)"
role: "VBA 모듈을 임시 추가해 entry Sub를 실행하고, 끝나면 제거한다."
role_source: docstring
version: "0.5.18"
loc: "serve_b2b.py:6681-6740"

# ── 입출력 ──
inputs:
  - "app"
  - "wb"
  - "code"
  - "entry"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_disable_vba_break_on_all_errors"
  - "_excel_process_id"
  - "_extract_vba_source_for_injection"
  - "_hide_vba_editor"
  - "_inject_and_run_vba_in_host"
  - "_is_vba_macro_run_blocked_error"
  - "_normalize_vba_workbook_literals"
  - "_run_vba_via_runner_with_retry"
  - "_start_vba_debug_suppressor"
  - "_strip_empty_vba_loops"
  - "_suppress_vba_debug_windows"
  - "_trace_hash"
  - "_trace_text"
  - "_trace_workbook_info"
  - "_validate_vba_source_before_inject"
  - "_vba_should_use_runner_host"
  - "_vba_trace"
calls_external:
  - "app"
  - "code"
  - "entry"
  - "err"
  - "excel_pid"
  - "len"
  - "original_code"
  - "set"
  - "str"
  - "strip"
  - "wb"
called_by:
  - "_run_excel_python_pipeline_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_vba_on_session_impl"
  - "_run_vba_pipeline_on_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
VBA 모듈을 임시 추가해 entry Sub를 실행하고, 끝나면 제거한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_disable_vba_break_on_all_errors`, `_excel_process_id`, `_extract_vba_source_for_injection`, `_hide_vba_editor`, `_inject_and_run_vba_in_host`, `_is_vba_macro_run_blocked_error`, `_normalize_vba_workbook_literals`, `_run_vba_via_runner_with_retry`, `_start_vba_debug_suppressor`, `_strip_empty_vba_loops`, `_suppress_vba_debug_windows`, `_trace_hash`, `_trace_text`, `_trace_workbook_info`, `_validate_vba_source_before_inject`, `_vba_should_use_runner_host`, `_vba_trace`
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`, `_run_full_pipeline_single_instance_impl`, `_run_vba_on_session_impl`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
