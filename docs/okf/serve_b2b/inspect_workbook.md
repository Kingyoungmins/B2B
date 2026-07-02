---
type: function
title: inspect_workbook
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:14902-14955"

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
  - "append"
  - "cell_to_json"
  - "excel_available"
  - "inspect_csv_workbook"
  - "inspect_workbook_fallback"
  - "inspect_workbook_with_excel"
  - "is_csv_path"
  - "iter_rows"
  - "openpyxl_load_workbook_compatible"
  - "row"
  - "rows"
  - "values"
calls_external:
  - "PREVIEW_COLS"
  - "PREVIEW_ROWS"
  - "cached_row"
  - "cached_rows"
  - "cached_value"
  - "close"
  - "enumerate"
  - "err"
  - "format_row"
  - "len"
  - "max"
  - "next"
  - "path"
  - "r"
  - "startswith"
  - "str"
called_by:
  - "B2BHandler.handle_workbook_upload"
  - "_result_from_workbook_files"
  - "_run_excel_python_pipeline_impl"
  - "_run_openpyxl_python_pipeline_impl"
reads:
  - "PREVIEW_COLS"
  - "PREVIEW_ROWS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`, `cell_to_json`, `excel_available`, `inspect_csv_workbook`, `inspect_workbook_fallback`, `inspect_workbook_with_excel`, `is_csv_path`, `iter_rows`, `openpyxl_load_workbook_compatible`, `row`, `rows`, `values`
- 피호출(영향 전파 경로): `B2BHandler.handle_workbook_upload`, `_result_from_workbook_files`, `_run_excel_python_pipeline_impl`, `_run_openpyxl_python_pipeline_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
