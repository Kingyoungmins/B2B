---
type: method
title: PythonComSkillContext._ws
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:11777-11874"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_excel_collection_names"
  - "_match_workbook_by_stable_key"
  - "_resolve_ephemeral_excel_open_sheet_alias"
  - "_tick"
  - "_vba_trace"
  - "append"
  - "names"
  - "normalize_sheet_lookup"
  - "sheet"
calls_external:
  - "PythonComSkillError"
  - "_pref"
  - "alias"
  - "bool"
  - "cand"
  - "cross"
  - "cur"
  - "fromkeys"
  - "len"
  - "list"
  - "matches"
  - "n"
  - "nm"
  - "nn"
  - "only"
  - "owb"
  - "req"
  - "rn"
  - "st"
  - "startswith"
  - "str"
  - "trunc"
  - "uniq"
called_by:
  - "PythonComSkillContext._filter_to_sheet_native"
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext.add_sheet"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.apply_filter"
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
  - "self._app"
  - "self._tick"
  - "self._wb"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Worksheets`, `_excel_collection_names`, `_match_workbook_by_stable_key`, `_resolve_ephemeral_excel_open_sheet_alias`, `_tick`, `_vba_trace`, `append`, `names`, `normalize_sheet_lookup`, `sheet`
- 피호출(영향 전파 경로): `PythonComSkillContext._filter_to_sheet_native`, `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext.add_sheet`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.apply_filter`, `PythonComSkillContext.clear`, `PythonComSkillContext.clear_filter`, `PythonComSkillContext.copy`, `PythonComSkillContext.copy_key_blocks`, `PythonComSkillContext.copy_sheet`, `PythonComSkillContext.copy_values`, `PythonComSkillContext.delete_cols`, `PythonComSkillContext.delete_rows`, `PythonComSkillContext.delete_rows_where`, `PythonComSkillContext.delete_sheet`, `PythonComSkillContext.enable_filter`, `PythonComSkillContext.fill_sum_col`, `PythonComSkillContext.filter_to_sheet`, `PythonComSkillContext.find_header`, `PythonComSkillContext.find_header_row`, `PythonComSkillContext.first_empty_col`, `PythonComSkillContext.formula_mask`, `PythonComSkillContext.has_formulas`, `PythonComSkillContext.hide_cols`, `PythonComSkillContext.hide_rows`, `PythonComSkillContext.insert_cols`, `PythonComSkillContext.insert_rows`, `PythonComSkillContext.last_col`, `PythonComSkillContext.last_row`, `PythonComSkillContext.merge`, `PythonComSkillContext.move_col_clear`, `PythonComSkillContext.move_cols`, `PythonComSkillContext.move_sheet`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.paste_copied`, `PythonComSkillContext.read`, `PythonComSkillContext.read_formulas`, `PythonComSkillContext.rename_sheet`, `PythonComSkillContext.replace`, `PythonComSkillContext.set_border`, `PythonComSkillContext.set_fill`, `PythonComSkillContext.set_font`, `PythonComSkillContext.set_number_format`, `PythonComSkillContext.shift_months`, `PythonComSkillContext.sort`, `PythonComSkillContext.sum_column`, `PythonComSkillContext.sum_lookup`, `PythonComSkillContext.sum_where`, `PythonComSkillContext.swap_cols`, `PythonComSkillContext.unmerge`, `PythonComSkillContext.used_last_col`, `PythonComSkillContext.used_last_row`, `PythonComSkillContext.used_range`, `PythonComSkillContext.write`, `PythonComSkillContext.write_formulas`

## 실패/예외
- `PythonComSkillError`
