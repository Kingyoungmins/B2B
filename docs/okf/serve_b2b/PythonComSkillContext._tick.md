---
type: method
title: PythonComSkillContext._tick
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, n=1)"
role: "---- 내부 가드 ----"
role_source: banner
version: "0.8.0"
loc: "serve_b2b.py:12063-12071"

# ── 입출력 ──
inputs:
  - "self"
  - "n"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls: []
calls_external:
  - "PythonComSkillError"
  - "monotonic"
called_by:
  - "PythonComSkillContext._filter_native_worth_it"
  - "PythonComSkillContext._filter_to_sheet_native"
  - "PythonComSkillContext._journal_save"
  - "PythonComSkillContext._note_blanked_cells_from_range"
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext._ws"
  - "PythonComSkillContext.add_sheet"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.apply_filter"
  - "PythonComSkillContext.book"
  - "PythonComSkillContext.clear"
  - "PythonComSkillContext.clear_filter"
  - "PythonComSkillContext.copy"
  - "PythonComSkillContext.copy_key_blocks"
  - "PythonComSkillContext.copy_sheet"
  - "PythonComSkillContext.copy_values"
  - "PythonComSkillContext.delete_cols"
  - "PythonComSkillContext.delete_rows"
  - "PythonComSkillContext.delete_rows_where"
  - "PythonComSkillContext.delete_sheet"
  - "PythonComSkillContext.enable_filter"
  - "PythonComSkillContext.fill_sum_col"
  - "PythonComSkillContext.filter_to_range"
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
  - "PythonComSkillContext.merge"
  - "PythonComSkillContext.move_col_clear"
  - "PythonComSkillContext.move_cols"
  - "PythonComSkillContext.move_sheet"
  - "PythonComSkillContext.native_pivot"
  - "PythonComSkillContext.paste_copied"
  - "PythonComSkillContext.read"
  - "PythonComSkillContext.read_formulas"
  - "PythonComSkillContext.rename_sheet"
  - "PythonComSkillContext.replace"
  - "PythonComSkillContext.set_border"
  - "PythonComSkillContext.set_fill"
  - "PythonComSkillContext.set_font"
  - "PythonComSkillContext.set_number_format"
  - "PythonComSkillContext.sheets"
  - "PythonComSkillContext.shift_months"
  - "PythonComSkillContext.sort"
  - "PythonComSkillContext.sum_column"
  - "PythonComSkillContext.sum_lookup"
  - "PythonComSkillContext.sum_where"
  - "PythonComSkillContext.swap_cols"
  - "PythonComSkillContext.unmerge"
  - "PythonComSkillContext.used_last_col"
  - "PythonComSkillContext.used_last_row"
  - "PythonComSkillContext.used_range"
  - "PythonComSkillContext.write"
  - "PythonComSkillContext.write_formulas"
reads:
  - "PY_COM_BUDGET"
  - "self._shared"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
---- 내부 가드 ----

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext._filter_native_worth_it`, `PythonComSkillContext._filter_to_sheet_native`, `PythonComSkillContext._journal_save`, `PythonComSkillContext._note_blanked_cells_from_range`, `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext._ws`, `PythonComSkillContext.add_sheet`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.apply_filter`, `PythonComSkillContext.book`, `PythonComSkillContext.clear`, `PythonComSkillContext.clear_filter`, `PythonComSkillContext.copy`, `PythonComSkillContext.copy_key_blocks`, `PythonComSkillContext.copy_sheet`, `PythonComSkillContext.copy_values`, `PythonComSkillContext.delete_cols`, `PythonComSkillContext.delete_rows`, `PythonComSkillContext.delete_rows_where`, `PythonComSkillContext.delete_sheet`, `PythonComSkillContext.enable_filter`, `PythonComSkillContext.fill_sum_col`, `PythonComSkillContext.filter_to_range`, `PythonComSkillContext.filter_to_sheet`, `PythonComSkillContext.find_header`, `PythonComSkillContext.find_header_row`, `PythonComSkillContext.first_empty_col`, `PythonComSkillContext.formula_mask`, `PythonComSkillContext.has_formulas`, `PythonComSkillContext.hide_cols`, `PythonComSkillContext.hide_rows`, `PythonComSkillContext.insert_cols`, `PythonComSkillContext.insert_rows`, `PythonComSkillContext.last_col`, `PythonComSkillContext.last_row`, `PythonComSkillContext.merge`, `PythonComSkillContext.move_col_clear`, `PythonComSkillContext.move_cols`, `PythonComSkillContext.move_sheet`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.paste_copied`, `PythonComSkillContext.read`, `PythonComSkillContext.read_formulas`, `PythonComSkillContext.rename_sheet`, `PythonComSkillContext.replace`, `PythonComSkillContext.set_border`, `PythonComSkillContext.set_fill`, `PythonComSkillContext.set_font`, `PythonComSkillContext.set_number_format`, `PythonComSkillContext.sheets`, `PythonComSkillContext.shift_months`, `PythonComSkillContext.sort`, `PythonComSkillContext.sum_column`, `PythonComSkillContext.sum_lookup`, `PythonComSkillContext.sum_where`, `PythonComSkillContext.swap_cols`, `PythonComSkillContext.unmerge`, `PythonComSkillContext.used_last_col`, `PythonComSkillContext.used_last_row`, `PythonComSkillContext.used_range`, `PythonComSkillContext.write`, `PythonComSkillContext.write_formulas`

## 실패/예외
- `PythonComSkillError`
