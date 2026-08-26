---
type: method
title: ExcelSkillContext.col
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, sheet_or_name, header, workbook=None, header_rows=20)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:16819-16830"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_or_name"
  - "header"
  - "workbook"
  - "header_rows"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "normalize"
  - "row"
  - "rows"
  - "value"
calls_external:
  - "ExcelColumnNumber"
  - "RuntimeError"
  - "c_idx"
  - "enumerate"
  - "header"
  - "sheet_or_name"
  - "workbook"
called_by:
  - "ExcelSkillContext.display_value"
  - "ExcelSkillContext.value"
  - "ExcelWorkbookProxy.display_value"
  - "ExcelWorkbookProxy.value"
  - "OpenpyxlSkillContext.display_value"
  - "OpenpyxlSkillContext.value"
  - "OpenpyxlWorkbookProxy.display_value"
  - "OpenpyxlWorkbookProxy.value"
  - "OpenpyxlWorksheetProxy.delete_cols"
  - "OpenpyxlWorksheetProxy.delete_rows"
  - "OpenpyxlWorksheetProxy.insert_cols"
  - "OpenpyxlWorksheetProxy.insert_rows"
  - "PythonComSkillContext._resolve_col"
  - "PythonComSkillContext.delete_cols"
  - "PythonComSkillContext.insert_cols"
  - "PythonComSkillContext.last_row"
  - "PythonComSkillContext.set_fill"
  - "PythonComSkillContext.split_column"
  - "PythonComSkillContext.sum_column"
  - "PythonComSkillContext.sum_where"
  - "PythonComSkillContext.swap_cols"
  - "_OpxlCellProxy.__init__"
  - "_OpxlCopiedFloat.__new__"
  - "_OpxlCopiedInt.__new__"
  - "_OpxlFormulaString.__new__"
  - "_apply_com_text_format_for_long_digit_columns"
  - "_apply_openpyxl_text_format_for_long_digit_columns"
  - "_opxl_coord"
  - "_opxl_coord_from_row_col"
  - "_opxl_display_cell_value"
  - "_opxl_eval_formula"
  - "_opxl_get_cached_cell_value"
  - "_opxl_merged_anchor"
  - "_opxl_range_values"
  - "_opxl_write_cell"
reads:
  - "self.normalize"
  - "self.rows"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `normalize`, `row`, `rows`, `value`
- 피호출(영향 전파 경로): `ExcelSkillContext.display_value`, `ExcelSkillContext.value`, `ExcelWorkbookProxy.display_value`, `ExcelWorkbookProxy.value`, `OpenpyxlSkillContext.display_value`, `OpenpyxlSkillContext.value`, `OpenpyxlWorkbookProxy.display_value`, `OpenpyxlWorkbookProxy.value`, `OpenpyxlWorksheetProxy.delete_cols`, `OpenpyxlWorksheetProxy.delete_rows`, `OpenpyxlWorksheetProxy.insert_cols`, `OpenpyxlWorksheetProxy.insert_rows`, `PythonComSkillContext._resolve_col`, `PythonComSkillContext.delete_cols`, `PythonComSkillContext.insert_cols`, `PythonComSkillContext.last_row`, `PythonComSkillContext.set_fill`, `PythonComSkillContext.split_column`, `PythonComSkillContext.sum_column`, `PythonComSkillContext.sum_where`, `PythonComSkillContext.swap_cols`, `_OpxlCellProxy.__init__`, `_OpxlCopiedFloat.__new__`, `_OpxlCopiedInt.__new__`, `_OpxlFormulaString.__new__`, `_apply_com_text_format_for_long_digit_columns`, `_apply_openpyxl_text_format_for_long_digit_columns`, `_opxl_coord`, `_opxl_coord_from_row_col`, `_opxl_display_cell_value`, `_opxl_eval_formula`, `_opxl_get_cached_cell_value`, `_opxl_merged_anchor`, `_opxl_range_values`, `_opxl_write_cell`

## 실패/예외
- `RuntimeError`
