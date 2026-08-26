---
type: method
title: OpenpyxlWorkbookProxy.sheet
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlWorkbookProxy
signature: "(self, name=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:18004-18005"

# ── 입출력 ──
inputs:
  - "self"
  - "name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "name"
  - "self"
called_by:
  - "ExcelSkillContext._merge_pivot_grid_into_base"
  - "ExcelSkillContext._ws_of"
  - "ExcelSkillContext.range"
  - "ExcelSkillContext.rows"
  - "ExcelSkillContext.sheet_like"
  - "ExcelWorksheetsProxy.__call__"
  - "OpenpyxlSkillContext._merge_pivot_grid_into_base"
  - "OpenpyxlSkillContext._ws_of"
  - "OpenpyxlSkillContext.range"
  - "OpenpyxlSkillContext.sheet_like"
  - "OpenpyxlWorkbookProxy.__getitem__"
  - "PythonComSkillContext._filter_to_sheet_native"
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext._resolve_col"
  - "PythonComSkillContext._ws"
  - "PythonComSkillContext.add_total_row"
  - "PythonComSkillContext.apply_filter"
  - "PythonComSkillContext.clear"
  - "PythonComSkillContext.clear_filter"
  - "PythonComSkillContext.copy_col"
  - "PythonComSkillContext.dedupe"
  - "PythonComSkillContext.delete_cols"
  - "PythonComSkillContext.delete_rows"
  - "PythonComSkillContext.delete_rows_where"
  - "PythonComSkillContext.enable_filter"
  - "PythonComSkillContext.fill_sum_col"
  - "PythonComSkillContext.filter_to_sheet"
  - "PythonComSkillContext.find_header"
  - "PythonComSkillContext.find_header_row"
  - "PythonComSkillContext.first_empty_col"
  - "PythonComSkillContext.formula_mask"
  - "PythonComSkillContext.has_formulas"
  - "PythonComSkillContext.hide_cols"
  - "PythonComSkillContext.hide_rows"
  - "PythonComSkillContext.insert_cols"
  - "PythonComSkillContext.insert_rows"
  - "PythonComSkillContext.last_col"
  - "PythonComSkillContext.last_row"
  - "PythonComSkillContext.lookup"
  - "PythonComSkillContext.merge"
  - "PythonComSkillContext.move_col_clear"
  - "PythonComSkillContext.move_cols"
  - "PythonComSkillContext.native_pivot"
  - "PythonComSkillContext.pivot"
  - "PythonComSkillContext.read"
  - "PythonComSkillContext.read_cell"
  - "PythonComSkillContext.read_formulas"
  - "PythonComSkillContext.replace"
  - "PythonComSkillContext.set_border"
  - "PythonComSkillContext.set_fill"
  - "PythonComSkillContext.set_font"
  - "PythonComSkillContext.set_number_format"
  - "PythonComSkillContext.shift_months"
  - "PythonComSkillContext.sort"
  - "PythonComSkillContext.split_column"
  - "PythonComSkillContext.sum_column"
  - "PythonComSkillContext.sum_where"
  - "PythonComSkillContext.swap_cols"
  - "PythonComSkillContext.unmerge"
  - "PythonComSkillContext.used_last_col"
  - "PythonComSkillContext.used_last_row"
  - "PythonComSkillContext.used_range"
  - "PythonComSkillContext.write"
  - "PythonComSkillContext.write_cell"
  - "PythonComSkillContext.write_formulas"
  - "_OpenpyxlSheetsProxy.__call__"
  - "_OpenpyxlSheetsProxy.__getitem__"
  - "_activate_excel_session_impl"
  - "_restore_live_view_state"
  - "_verify_recorded_expected_live"
  - "activate_excel_session"
  - "verify_step_isolated"
reads:
  - "self._ctx"
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
- 피호출(영향 전파 경로): `ExcelSkillContext._merge_pivot_grid_into_base`, `ExcelSkillContext._ws_of`, `ExcelSkillContext.range`, `ExcelSkillContext.rows`, `ExcelSkillContext.sheet_like`, `ExcelWorksheetsProxy.__call__`, `OpenpyxlSkillContext._merge_pivot_grid_into_base`, `OpenpyxlSkillContext._ws_of`, `OpenpyxlSkillContext.range`, `OpenpyxlSkillContext.sheet_like`, `OpenpyxlWorkbookProxy.__getitem__`, `PythonComSkillContext._filter_to_sheet_native`, `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext._resolve_col`, `PythonComSkillContext._ws`, `PythonComSkillContext.add_total_row`, `PythonComSkillContext.apply_filter`, `PythonComSkillContext.clear`, `PythonComSkillContext.clear_filter`, `PythonComSkillContext.copy_col`, `PythonComSkillContext.dedupe`, `PythonComSkillContext.delete_cols`, `PythonComSkillContext.delete_rows`, `PythonComSkillContext.delete_rows_where`, `PythonComSkillContext.enable_filter`, `PythonComSkillContext.fill_sum_col`, `PythonComSkillContext.filter_to_sheet`, `PythonComSkillContext.find_header`, `PythonComSkillContext.find_header_row`, `PythonComSkillContext.first_empty_col`, `PythonComSkillContext.formula_mask`, `PythonComSkillContext.has_formulas`, `PythonComSkillContext.hide_cols`, `PythonComSkillContext.hide_rows`, `PythonComSkillContext.insert_cols`, `PythonComSkillContext.insert_rows`, `PythonComSkillContext.last_col`, `PythonComSkillContext.last_row`, `PythonComSkillContext.lookup`, `PythonComSkillContext.merge`, `PythonComSkillContext.move_col_clear`, `PythonComSkillContext.move_cols`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.pivot`, `PythonComSkillContext.read`, `PythonComSkillContext.read_cell`, `PythonComSkillContext.read_formulas`, `PythonComSkillContext.replace`, `PythonComSkillContext.set_border`, `PythonComSkillContext.set_fill`, `PythonComSkillContext.set_font`, `PythonComSkillContext.set_number_format`, `PythonComSkillContext.shift_months`, `PythonComSkillContext.sort`, `PythonComSkillContext.split_column`, `PythonComSkillContext.sum_column`, `PythonComSkillContext.sum_where`, `PythonComSkillContext.swap_cols`, `PythonComSkillContext.unmerge`, `PythonComSkillContext.used_last_col`, `PythonComSkillContext.used_last_row`, `PythonComSkillContext.used_range`, `PythonComSkillContext.write`, `PythonComSkillContext.write_cell`, `PythonComSkillContext.write_formulas`, `_OpenpyxlSheetsProxy.__call__`, `_OpenpyxlSheetsProxy.__getitem__`, `_activate_excel_session_impl`, `_restore_live_view_state`, `_verify_recorded_expected_live`, `activate_excel_session`, `verify_step_isolated`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
