---
type: function
title: _pipeline_payload_needs_com
module: serve_b2b.py
lang: python
extraction: ast
signature: "(payload)"
role: "openpyxl 엔진이 안전하지 않으면 사유 문자열을 반환(없으면 \"\")."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:20749-20796"

# ── 입출력 ──
inputs:
  - "payload"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_python_step_has_structural_or_format_operation"
  - "_python_step_has_values_only_formula_copy_risk"
  - "_python_step_requests_excel_com"
  - "_xlsx_has_formulas"
  - "_xlsx_has_merged_cells"
  - "_xlsx_object_reason"
  - "get_workbook_or_raise"
  - "is_csv_path"
  - "is_python_pipeline_step"
  - "is_vba_pipeline_step"
  - "python_step_uses_legacy_dialect"
calls_external:
  - "any"
  - "get"
  - "out_wid"
  - "s"
  - "step"
  - "str"
  - "wid"
called_by:
  - "run_backend_pipeline_payload"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
openpyxl 엔진이 안전하지 않으면 사유 문자열을 반환(없으면 "").

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_python_step_has_structural_or_format_operation`, `_python_step_has_values_only_formula_copy_risk`, `_python_step_requests_excel_com`, `_xlsx_has_formulas`, `_xlsx_has_merged_cells`, `_xlsx_object_reason`, `get_workbook_or_raise`, `is_csv_path`, `is_python_pipeline_step`, `is_vba_pipeline_step`, `python_step_uses_legacy_dialect`
- 피호출(영향 전파 경로): `run_backend_pipeline_payload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
