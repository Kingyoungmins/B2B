---
type: function
title: _excel_output_preview_sheets
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:18341-18418"

# ── 입출력 ──
inputs:
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "Worksheets"
  - "_col_letter"
  - "_com_scalar"
  - "_excel_collection_names"
  - "_range_matrix"
  - "append"
  - "cell_to_json"
  - "max_row"
  - "range"
  - "rows"
  - "value"
  - "values"
calls_external:
  - "PREVIEW_ROWS"
  - "cols"
  - "format_row"
  - "formats_matrix"
  - "formula_row"
  - "formula_text"
  - "formula_value"
  - "formulas_matrix"
  - "int"
  - "isinstance"
  - "json_value"
  - "len"
  - "max"
  - "max_col"
  - "min"
  - "name"
  - "out_format_row"
  - "out_row"
  - "startswith"
  - "str"
  - "value_row"
called_by:
  - "_run_excel_python_pipeline_impl"
reads:
  - "PREVIEW_COLS"
  - "PREVIEW_ROWS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `Worksheets`, `_col_letter`, `_com_scalar`, `_excel_collection_names`, `_range_matrix`, `append`, `cell_to_json`, `max_row`, `range`, `rows`, `value`, `values`
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
