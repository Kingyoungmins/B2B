---
type: method
title: OpenpyxlWorksheetProxy.row
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlWorksheetProxy
signature: "(self, row_idx)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:18392-18393"

# ── 입출력 ──
inputs:
  - "self"
  - "row_idx"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "_OpxlRowProxy"
  - "row_idx"
  - "self"
called_by:
  - "ColumnIs.__call__"
  - "ExcelSkillContext._merge_pivot_grid_into_base"
  - "ExcelSkillContext.col"
  - "ExcelSkillContext.display_value"
  - "ExcelSkillContext.rows"
  - "ExcelSkillContext.value"
  - "ExcelWorkbookProxy.display_value"
  - "ExcelWorkbookProxy.value"
  - "ExcelWorksheetProxy.append"
  - "ExcelWorksheetProxy.cell"
  - "OpenpyxlSkillContext._merge_pivot_grid_into_base"
  - "OpenpyxlSkillContext.col"
  - "OpenpyxlSkillContext.display_rows"
  - "OpenpyxlSkillContext.display_value"
  - "OpenpyxlSkillContext.rows"
  - "OpenpyxlSkillContext.value"
  - "OpenpyxlWorkbookProxy.display_value"
  - "OpenpyxlWorkbookProxy.value"
  - "OpenpyxlWorksheetProxy.cell"
  - "OpenpyxlWorksheetProxy.delete_cols"
  - "OpenpyxlWorksheetProxy.delete_rows"
  - "OpenpyxlWorksheetProxy.insert_cols"
  - "OpenpyxlWorksheetProxy.insert_rows"
  - "PythonComSkillContext._as_2d"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.delete_rows"
  - "PythonComSkillContext.delete_rows_where"
  - "PythonComSkillContext.filter_to_range"
  - "PythonComSkillContext.filter_to_sheet"
  - "PythonComSkillContext.find_header"
  - "PythonComSkillContext.first_empty_col"
  - "PythonComSkillContext.insert_rows"
  - "PythonComSkillContext.last_col"
  - "PythonComSkillContext.last_row"
  - "PythonComSkillContext.replace"
  - "PythonComSkillContext.shift_months"
  - "_OpxlCellProxy.__init__"
  - "_OpxlCopiedFloat.__new__"
  - "_OpxlCopiedInt.__new__"
  - "_OpxlFormulaString.__new__"
  - "_OpxlRange._set_value"
  - "_apply_openpyxl_text_format_for_long_digit_columns"
  - "_literal_cells"
  - "_long_digit_identifier_columns"
  - "_opxl_coord"
  - "_opxl_coord_from_row_col"
  - "_opxl_display_cell_value"
  - "_opxl_eval_formula"
  - "_opxl_get_cached_cell_value"
  - "_opxl_merged_anchor"
  - "_opxl_range_values"
  - "_opxl_write_cell"
  - "_range_matrix"
  - "_sheet_snapshot"
  - "inspect_workbook"
  - "preview_sheets"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `ColumnIs.__call__`, `ExcelSkillContext._merge_pivot_grid_into_base`, `ExcelSkillContext.col`, `ExcelSkillContext.display_value`, `ExcelSkillContext.rows`, `ExcelSkillContext.value`, `ExcelWorkbookProxy.display_value`, `ExcelWorkbookProxy.value`, `ExcelWorksheetProxy.append`, `ExcelWorksheetProxy.cell`, `OpenpyxlSkillContext._merge_pivot_grid_into_base`, `OpenpyxlSkillContext.col`, `OpenpyxlSkillContext.display_rows`, `OpenpyxlSkillContext.display_value`, `OpenpyxlSkillContext.rows`, `OpenpyxlSkillContext.value`, `OpenpyxlWorkbookProxy.display_value`, `OpenpyxlWorkbookProxy.value`, `OpenpyxlWorksheetProxy.cell`, `OpenpyxlWorksheetProxy.delete_cols`, `OpenpyxlWorksheetProxy.delete_rows`, `OpenpyxlWorksheetProxy.insert_cols`, `OpenpyxlWorksheetProxy.insert_rows`, `PythonComSkillContext._as_2d`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.delete_rows`, `PythonComSkillContext.delete_rows_where`, `PythonComSkillContext.filter_to_range`, `PythonComSkillContext.filter_to_sheet`, `PythonComSkillContext.find_header`, `PythonComSkillContext.first_empty_col`, `PythonComSkillContext.insert_rows`, `PythonComSkillContext.last_col`, `PythonComSkillContext.last_row`, `PythonComSkillContext.replace`, `PythonComSkillContext.shift_months`, `_OpxlCellProxy.__init__`, `_OpxlCopiedFloat.__new__`, `_OpxlCopiedInt.__new__`, `_OpxlFormulaString.__new__`, `_OpxlRange._set_value`, `_apply_openpyxl_text_format_for_long_digit_columns`, `_literal_cells`, `_long_digit_identifier_columns`, `_opxl_coord`, `_opxl_coord_from_row_col`, `_opxl_display_cell_value`, `_opxl_eval_formula`, `_opxl_get_cached_cell_value`, `_opxl_merged_anchor`, `_opxl_range_values`, `_opxl_write_cell`, `_range_matrix`, `_sheet_snapshot`, `inspect_workbook`, `preview_sheets`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
