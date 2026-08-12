---
type: function
title: inspect_workbook
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:18976-19090"

# ── 입출력 ──
inputs:
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_vba_trace"
  - "append"
  - "cell_to_json"
  - "excel_available"
  - "excel_call"
  - "inspect_csv_workbook"
  - "inspect_workbook_fallback"
  - "inspect_workbook_with_excel"
  - "is_csv_path"
  - "iter_rows"
  - "openpyxl_load_workbook_compatible"
  - "range"
  - "row"
  - "rows"
  - "sheets"
  - "values"
calls_external:
  - "PREVIEW_COLS"
  - "PREVIEW_ROWS"
  - "Path"
  - "_cached_grid"
  - "_inspect_via_com"
  - "cached_row"
  - "cached_value"
  - "close"
  - "current_thread"
  - "enumerate"
  - "err"
  - "format_row"
  - "get"
  - "grid"
  - "len"
  - "list"
  - "max"
  - "path"
  - "perf_counter"
  - "r"
  - "round"
  - "sleep"
  - "startswith"
  - "str"
  - "sum"
called_by:
  - "B2BHandler.handle_workbook_reinspect"
  - "B2BHandler.handle_workbook_upload"
  - "_result_from_workbook_files"
  - "_run_excel_python_pipeline_impl"
  - "_run_openpyxl_python_pipeline_impl"
reads:
  - "EXCEL_THREAD"
  - "PREVIEW_COLS"
  - "PREVIEW_ROWS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_vba_trace`, `append`, `cell_to_json`, `excel_available`, `excel_call`, `inspect_csv_workbook`, `inspect_workbook_fallback`, `inspect_workbook_with_excel`, `is_csv_path`, `iter_rows`, `openpyxl_load_workbook_compatible`, `range`, `row`, `rows`, `sheets`, `values`
- 피호출(영향 전파 경로): `B2BHandler.handle_workbook_reinspect`, `B2BHandler.handle_workbook_upload`, `_result_from_workbook_files`, `_run_excel_python_pipeline_impl`, `_run_openpyxl_python_pipeline_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
