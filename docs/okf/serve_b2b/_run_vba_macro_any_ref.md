---
type: function
title: _run_vba_macro_any_ref
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, host_wb, module_name, macro_name)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:8405-8427"

# ── 입출력 ──
inputs:
  - "app"
  - "host_wb"
  - "module_name"
  - "macro_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "RuntimeError"
  - "last_err"

# ── 유기적 관계 ──
calls:
  - "_diag_vba_log_line"
  - "_trace_text"
  - "_trace_workbook_info"
  - "_vba_macro_refs"
  - "_vba_trace"
calls_external:
  - "Activate"
  - "Run"
  - "RuntimeError"
  - "err"
  - "host_wb"
  - "macro_name"
  - "module_name"
  - "ref"
  - "refs"
  - "result"
  - "str"
called_by:
  - "_inject_and_run_vba_in_host"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_diag_vba_log_line`, `_trace_text`, `_trace_workbook_info`, `_vba_macro_refs`, `_vba_trace`
- 피호출(영향 전파 경로): `_inject_and_run_vba_in_host`

## 실패/예외
- `RuntimeError`
- `last_err`
