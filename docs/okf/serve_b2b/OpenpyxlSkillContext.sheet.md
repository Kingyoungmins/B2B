---
type: method
title: OpenpyxlSkillContext.sheet
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self, name=None, workbook=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:12887-12925"

# ── 입출력 ──
inputs:
  - "self"
  - "name"
  - "workbook"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): self._last_sheet_workbook_raw, self.last_output_sheet"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_default_workbook"
  - "_find_sheet_name"
  - "_is_output_workbook"
  - "_unwrap_workbook"
  - "add"
  - "append"
  - "raw"
  - "values"
calls_external:
  - "OpenpyxlWorksheetProxy"
  - "RuntimeError"
  - "allow_single"
  - "bool"
  - "candidate"
  - "default_wb"
  - "id"
  - "key"
  - "len"
  - "list"
  - "lookup_name"
  - "matches"
  - "name"
  - "raw_candidate"
  - "set"
  - "str"
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
  - "PythonComSkillContext._resolve_col"
  - "PythonComSkillContext._ws"
  - "PythonComSkillContext.add_total_row"
  - "PythonComSkillContext.clear"
  - "PythonComSkillContext.dedupe"
  - "PythonComSkillContext.delete_cols"
  - "PythonComSkillContext.delete_rows"
  - "PythonComSkillContext.filter_to_sheet"
  - "PythonComSkillContext.find_header"
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
  - "PythonComSkillContext.pivot"
  - "PythonComSkillContext.read"
  - "PythonComSkillContext.read_cell"
  - "PythonComSkillContext.read_formulas"
  - "PythonComSkillContext.replace"
  - "PythonComSkillContext.set_number_format"
  - "PythonComSkillContext.shift_months"
  - "PythonComSkillContext.sort"
  - "PythonComSkillContext.split_column"
  - "PythonComSkillContext.unmerge"
  - "PythonComSkillContext.used_range"
  - "PythonComSkillContext.write"
  - "PythonComSkillContext.write_cell"
  - "PythonComSkillContext.write_formulas"
  - "_OpenpyxlSheetsProxy.__call__"
  - "_OpenpyxlSheetsProxy.__getitem__"
  - "_activate_excel_session_impl"
  - "_restore_live_view_state"
  - "activate_excel_session"
reads:
  - "self._default_workbook"
  - "self._find_sheet_name"
  - "self._is_output_workbook"
  - "self._unwrap_workbook"
  - "self.active_sheet_name"
  - "self.inputs"
  - "self.workbook"
writes:
  - "self._last_sheet_workbook_raw"
  - "self.last_output_sheet"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): self._last_sheet_workbook_raw, self.last_output_sheet
- 변경 상태 `self._last_sheet_workbook_raw, self.last_output_sheet` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_default_workbook`, `_find_sheet_name`, `_is_output_workbook`, `_unwrap_workbook`, `add`, `append`, `raw`, `values`
- 피호출(영향 전파 경로): `ExcelSkillContext._merge_pivot_grid_into_base`, `ExcelSkillContext._ws_of`, `ExcelSkillContext.range`, `ExcelSkillContext.rows`, `ExcelSkillContext.sheet_like`, `ExcelWorksheetsProxy.__call__`, `OpenpyxlSkillContext._merge_pivot_grid_into_base`, `OpenpyxlSkillContext._ws_of`, `OpenpyxlSkillContext.range`, `OpenpyxlSkillContext.sheet_like`, `OpenpyxlWorkbookProxy.__getitem__`, `PythonComSkillContext._resolve_col`, `PythonComSkillContext._ws`, `PythonComSkillContext.add_total_row`, `PythonComSkillContext.clear`, `PythonComSkillContext.dedupe`, `PythonComSkillContext.delete_cols`, `PythonComSkillContext.delete_rows`, `PythonComSkillContext.filter_to_sheet`, `PythonComSkillContext.find_header`, `PythonComSkillContext.formula_mask`, `PythonComSkillContext.has_formulas`, `PythonComSkillContext.hide_cols`, `PythonComSkillContext.hide_rows`, `PythonComSkillContext.insert_cols`, `PythonComSkillContext.insert_rows`, `PythonComSkillContext.last_col`, `PythonComSkillContext.last_row`, `PythonComSkillContext.lookup`, `PythonComSkillContext.merge`, `PythonComSkillContext.move_col_clear`, `PythonComSkillContext.move_cols`, `PythonComSkillContext.pivot`, `PythonComSkillContext.read`, `PythonComSkillContext.read_cell`, `PythonComSkillContext.read_formulas`, `PythonComSkillContext.replace`, `PythonComSkillContext.set_number_format`, `PythonComSkillContext.shift_months`, `PythonComSkillContext.sort`, `PythonComSkillContext.split_column`, `PythonComSkillContext.unmerge`, `PythonComSkillContext.used_range`, `PythonComSkillContext.write`, `PythonComSkillContext.write_cell`, `PythonComSkillContext.write_formulas`, `_OpenpyxlSheetsProxy.__call__`, `_OpenpyxlSheetsProxy.__getitem__`, `_activate_excel_session_impl`, `_restore_live_view_state`, `activate_excel_session`

## 실패/예외
- `RuntimeError`
