---
type: method
title: OpenpyxlWorksheetProxy.Range
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlWorksheetProxy
signature: "(self, a1, a2=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:17909-17922"

# ── 입출력 ──
inputs:
  - "self"
  - "a1"
  - "a2"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_opxl_coord"
  - "flush_pending_rows"
  - "replace"
calls_external:
  - "_OpxlRange"
  - "a1"
  - "c"
  - "c1"
  - "c2"
  - "left"
  - "max"
  - "min"
  - "r"
  - "r1"
  - "r2"
  - "right"
  - "s"
  - "split"
  - "str"
  - "strip"
called_by:
  - "ExcelSkillContext._write_grid"
  - "ExcelSkillContext.range"
  - "ExcelSkillContext.set_range"
  - "ExcelWorksheetProxy.append"
  - "ExcelWorksheetProxy.delete_cols"
  - "ExcelWorksheetProxy.delete_rows"
  - "ExcelWorksheetProxy.insert_cols"
  - "ExcelWorksheetProxy.insert_rows"
  - "OpenpyxlSkillContext.range"
  - "PythonComSkillContext._filter_to_sheet_native"
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext._resize_rng"
  - "PythonComSkillContext._rng"
  - "PythonComSkillContext._rollback"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.apply_filter"
  - "PythonComSkillContext.copy_key_blocks"
  - "PythonComSkillContext.delete_rows_where"
  - "PythonComSkillContext.enable_filter"
  - "PythonComSkillContext.filter_to_sheet"
  - "PythonComSkillContext.find_header"
  - "PythonComSkillContext.first_empty_col"
  - "PythonComSkillContext.move_col_clear"
  - "PythonComSkillContext.native_pivot"
  - "PythonComSkillContext.paste_copied"
  - "PythonComSkillContext.swap_cols"
  - "_activate_excel_session_impl"
  - "_apply_com_text_format_for_long_digit_columns"
  - "_capture_copypaste_on_session_impl"
  - "_excel_output_preview_sheets"
  - "_live_preview_schema"
  - "_restore_live_view_state"
  - "_sheet_snapshot"
  - "inspect_workbook_with_excel"
  - "load_workbook_aoa_with_excel"
reads:
  - "self._ws"
  - "self.flush_pending_rows"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_opxl_coord`, `flush_pending_rows`, `replace`
- 피호출(영향 전파 경로): `ExcelSkillContext._write_grid`, `ExcelSkillContext.range`, `ExcelSkillContext.set_range`, `ExcelWorksheetProxy.append`, `ExcelWorksheetProxy.delete_cols`, `ExcelWorksheetProxy.delete_rows`, `ExcelWorksheetProxy.insert_cols`, `ExcelWorksheetProxy.insert_rows`, `OpenpyxlSkillContext.range`, `PythonComSkillContext._filter_to_sheet_native`, `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext._resize_rng`, `PythonComSkillContext._rng`, `PythonComSkillContext._rollback`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.apply_filter`, `PythonComSkillContext.copy_key_blocks`, `PythonComSkillContext.delete_rows_where`, `PythonComSkillContext.enable_filter`, `PythonComSkillContext.filter_to_sheet`, `PythonComSkillContext.find_header`, `PythonComSkillContext.first_empty_col`, `PythonComSkillContext.move_col_clear`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.paste_copied`, `PythonComSkillContext.swap_cols`, `_activate_excel_session_impl`, `_apply_com_text_format_for_long_digit_columns`, `_capture_copypaste_on_session_impl`, `_excel_output_preview_sheets`, `_live_preview_schema`, `_restore_live_view_state`, `_sheet_snapshot`, `inspect_workbook_with_excel`, `load_workbook_aoa_with_excel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
