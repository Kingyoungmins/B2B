---
type: function
title: build_result_previews
module: serve_b2b.py
lang: python
extraction: ast
signature: "(inputs, output, current, diffs=None, forced_value_cells=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:20264-20296"

# ── 입출력 ──
inputs:
  - "inputs"
  - "output"
  - "current"
  - "diffs"
  - "forced_value_cells"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
  - "preview_sheets"
  - "sheet_dimensions"
  - "sheet_format_maps"
  - "sheet_formula_maps"
  - "sheets"
calls_external:
  - "file_id"
  - "get"
  - "items"
  - "keys"
  - "list"
  - "output"
  - "output_file_id"
called_by:
  - "_result_from_workbook_files"
  - "_run_excel_python_pipeline_impl"
  - "_run_openpyxl_python_pipeline_impl"
  - "run_backend_pipeline_payload"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`, `preview_sheets`, `sheet_dimensions`, `sheet_format_maps`, `sheet_formula_maps`, `sheets`
- 피호출(영향 전파 경로): `_result_from_workbook_files`, `_run_excel_python_pipeline_impl`, `_run_openpyxl_python_pipeline_impl`, `run_backend_pipeline_payload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
