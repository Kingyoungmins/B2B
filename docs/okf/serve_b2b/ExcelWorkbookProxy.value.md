---
type: method
title: ExcelWorkbookProxy.value
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelWorkbookProxy
signature: "(self, sheet_or_name, row, col)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:15435-15436"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_or_name"
  - "row"
  - "col"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "col"
  - "row"
calls_external:
  - "self"
  - "sheet_or_name"
called_by:
  - "B2BHandler.handle_client_trace"
  - "B2BHandler.proxy"
  - "ExcelColumnNumber.__init__"
  - "ExcelSkillContext.col"
  - "ExcelSkillContext.display_value"
  - "ExcelSkillContext.normalize"
  - "ExcelSkillContext.pivot"
  - "ExcelWorksheetProxy.__setattr__"
  - "OpenpyxlSkillContext._write_grid"
  - "OpenpyxlSkillContext.col"
  - "OpenpyxlSkillContext.display_value"
  - "OpenpyxlSkillContext.normalize"
  - "OpenpyxlSkillContext.pivot"
  - "OpenpyxlWorksheetProxy.__setattr__"
  - "OpenpyxlWorksheetProxy._formula_cells"
  - "OpenpyxlWorksheetProxy.flush_pending_rows"
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext._shaped_matrix"
  - "PythonComSkillContext.native_pivot"
  - "PythonComSkillContext.normalize"
  - "PythonComSkillContext.pivot"
  - "_OpxlCellProxy.__setattr__"
  - "_OpxlCopiedFloat.__new__"
  - "_OpxlCopiedInt.__new__"
  - "_OpxlFormulaString.__new__"
  - "_OpxlFormulaString.replace"
  - "_OpxlRange._set_value"
  - "_com_scalar"
  - "_excel_output_preview_sheets"
  - "_get_live_excel_app"
  - "_get_python_skill_app"
  - "_long_digit_identifier_columns"
  - "_looks_like_long_digit_identifier"
  - "_open_excel_session_impl"
  - "_opxl_copied_source"
  - "_opxl_display_cell_value"
  - "_opxl_eval_formula"
  - "_opxl_get_cached_cell_value"
  - "_opxl_numeric_values"
  - "_opxl_translate_formula"
  - "_opxl_unwrap_copied_value"
  - "_opxl_write_cell"
  - "_park_excel_app_offscreen"
  - "_python_com_static_check"
  - "_range_matrix"
  - "_set_display_prop_if_changed"
  - "_sheet_snapshot"
  - "_vba_macro_refs"
  - "_wrap_ctx_helper_kwargs"
  - "cell_to_json"
  - "diff_value"
  - "inspect_workbook_with_excel"
  - "load_workbook_aoa_with_excel"
reads:
  - "self._ctx"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `col`, `row`
- 피호출(영향 전파 경로): `B2BHandler.handle_client_trace`, `B2BHandler.proxy`, `ExcelColumnNumber.__init__`, `ExcelSkillContext.col`, `ExcelSkillContext.display_value`, `ExcelSkillContext.normalize`, `ExcelSkillContext.pivot`, `ExcelWorksheetProxy.__setattr__`, `OpenpyxlSkillContext._write_grid`, `OpenpyxlSkillContext.col`, `OpenpyxlSkillContext.display_value`, `OpenpyxlSkillContext.normalize`, `OpenpyxlSkillContext.pivot`, `OpenpyxlWorksheetProxy.__setattr__`, `OpenpyxlWorksheetProxy._formula_cells`, `OpenpyxlWorksheetProxy.flush_pending_rows`, `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext._shaped_matrix`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.normalize`, `PythonComSkillContext.pivot`, `_OpxlCellProxy.__setattr__`, `_OpxlCopiedFloat.__new__`, `_OpxlCopiedInt.__new__`, `_OpxlFormulaString.__new__`, `_OpxlFormulaString.replace`, `_OpxlRange._set_value`, `_com_scalar`, `_excel_output_preview_sheets`, `_get_live_excel_app`, `_get_python_skill_app`, `_long_digit_identifier_columns`, `_looks_like_long_digit_identifier`, `_open_excel_session_impl`, `_opxl_copied_source`, `_opxl_display_cell_value`, `_opxl_eval_formula`, `_opxl_get_cached_cell_value`, `_opxl_numeric_values`, `_opxl_translate_formula`, `_opxl_unwrap_copied_value`, `_opxl_write_cell`, `_park_excel_app_offscreen`, `_python_com_static_check`, `_range_matrix`, `_set_display_prop_if_changed`, `_sheet_snapshot`, `_vba_macro_refs`, `_wrap_ctx_helper_kwargs`, `cell_to_json`, `diff_value`, `inspect_workbook_with_excel`, `load_workbook_aoa_with_excel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
