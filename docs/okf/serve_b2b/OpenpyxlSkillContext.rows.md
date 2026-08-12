---
type: method
title: OpenpyxlSkillContext.rows
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self, sheet_or_name, workbook=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:16994-17005"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_or_name"
  - "workbook"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_ws_of"
  - "append"
  - "flush_pending_rows"
  - "iter_rows"
  - "row"
calls_external:
  - "all"
  - "getattr"
  - "hasattr"
  - "list"
  - "pop"
  - "sheet_or_name"
  - "workbook"
  - "ws"
called_by:
  - "ExcelSkillContext._merge_pivot_grid_into_base"
  - "ExcelSkillContext.col"
  - "ExcelSkillContext.display_rows"
  - "ExcelSkillContext.filter_to_sheet"
  - "ExcelSkillContext.header_row"
  - "ExcelSkillContext.iter_rows"
  - "ExcelSkillContext.pivot"
  - "ExcelSkillContext.sort"
  - "OpenpyxlSkillContext._merge_pivot_grid_into_base"
  - "OpenpyxlSkillContext.col"
  - "OpenpyxlSkillContext.filter_to_sheet"
  - "OpenpyxlSkillContext.header_row"
  - "OpenpyxlSkillContext.iter_rows"
  - "OpenpyxlSkillContext.pivot"
  - "OpenpyxlSkillContext.sort"
  - "PythonComSkillContext._as_2d"
  - "PythonComSkillContext._resize_rng"
  - "PythonComSkillContext._shaped_matrix"
  - "PythonComSkillContext.match_fill"
  - "PythonComSkillContext.write"
  - "PythonComSkillContext.write_formulas"
  - "_OpxlRange._set_value"
  - "_excel_output_preview_sheets"
  - "inspect_csv_workbook"
  - "inspect_workbook"
  - "load_workbook_aoa_with_excel"
reads:
  - "self._ws_of"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_ws_of`, `append`, `flush_pending_rows`, `iter_rows`, `row`
- 피호출(영향 전파 경로): `ExcelSkillContext._merge_pivot_grid_into_base`, `ExcelSkillContext.col`, `ExcelSkillContext.display_rows`, `ExcelSkillContext.filter_to_sheet`, `ExcelSkillContext.header_row`, `ExcelSkillContext.iter_rows`, `ExcelSkillContext.pivot`, `ExcelSkillContext.sort`, `OpenpyxlSkillContext._merge_pivot_grid_into_base`, `OpenpyxlSkillContext.col`, `OpenpyxlSkillContext.filter_to_sheet`, `OpenpyxlSkillContext.header_row`, `OpenpyxlSkillContext.iter_rows`, `OpenpyxlSkillContext.pivot`, `OpenpyxlSkillContext.sort`, `PythonComSkillContext._as_2d`, `PythonComSkillContext._resize_rng`, `PythonComSkillContext._shaped_matrix`, `PythonComSkillContext.match_fill`, `PythonComSkillContext.write`, `PythonComSkillContext.write_formulas`, `_OpxlRange._set_value`, `_excel_output_preview_sheets`, `inspect_csv_workbook`, `inspect_workbook`, `load_workbook_aoa_with_excel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
