---
type: function
title: _inject_and_run_vba_in_host
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, host_wb, context_wb, code, entry)"
role: "Inject/run VBA in host_wb while keeping context_wb as ActiveWorkbook."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:9492-9644"

# ── 입출력 ──
inputs:
  - "app"
  - "host_wb"
  - "context_wb"
  - "code"
  - "entry"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_diag_prerun_window_state"
  - "_diag_vba_log_line"
  - "_diag_vba_run_failure"
  - "_rewrite_thisworkbook_for_runner_host"
  - "_run_vba_macro_any_ref"
  - "_trace_hash"
  - "_trace_text"
  - "_trace_workbook_info"
  - "_vba_macro_refs"
  - "_vba_string_literal"
  - "_vba_trace"
  - "_vba_workbook_name"
  - "_wrap_vba_skill_code"
  - "replace"
calls_external:
  - "Activate"
  - "Add"
  - "AddFromString"
  - "Remove"
  - "RuntimeError"
  - "_as"
  - "app"
  - "code"
  - "context_name"
  - "context_wb"
  - "entry"
  - "err"
  - "err_desc_name"
  - "err_description"
  - "err_num_name"
  - "err_number"
  - "host_wb"
  - "int"
  - "len"
  - "module"
  - "module_name"
  - "runner_name"
  - "safe_code"
  - "startswith"
  - "str"
  - "vbproj"
called_by:
  - "_inject_and_run_vba"
  - "_run_vba_via_runner_with_retry"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
Inject/run VBA in host_wb while keeping context_wb as ActiveWorkbook.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_diag_prerun_window_state`, `_diag_vba_log_line`, `_diag_vba_run_failure`, `_rewrite_thisworkbook_for_runner_host`, `_run_vba_macro_any_ref`, `_trace_hash`, `_trace_text`, `_trace_workbook_info`, `_vba_macro_refs`, `_vba_string_literal`, `_vba_trace`, `_vba_workbook_name`, `_wrap_vba_skill_code`, `replace`
- 피호출(영향 전파 경로): `_inject_and_run_vba`, `_run_vba_via_runner_with_retry`

## 실패/예외
- `RuntimeError`
