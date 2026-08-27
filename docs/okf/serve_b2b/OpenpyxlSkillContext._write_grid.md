---
type: method
title: OpenpyxlSkillContext._write_grid
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self, ws, grid, start_row=1, start_col=1)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:18948-18980"

# ── 입출력 ──
inputs:
  - "self"
  - "ws"
  - "grid"
  - "start_row"
  - "start_col"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_apply_openpyxl_text_format_for_long_digit_columns"
  - "_opxl_write_cell"
  - "add"
  - "cell"
  - "raw"
  - "value"
calls_external:
  - "R"
  - "bool"
  - "callable"
  - "enumerate"
  - "getattr"
  - "grid"
  - "i"
  - "id"
  - "len"
  - "report"
  - "start_col"
  - "start_row"
  - "total"
  - "ws"
called_by:
  - "ExcelSkillContext._merge_pivot_grid_into_base"
  - "ExcelSkillContext.filter_to_sheet"
  - "ExcelSkillContext.pivot"
  - "ExcelSkillContext.write_grid"
  - "OpenpyxlSkillContext._merge_pivot_grid_into_base"
  - "OpenpyxlSkillContext.filter_to_sheet"
  - "OpenpyxlSkillContext.pivot"
  - "OpenpyxlSkillContext.set_range"
  - "OpenpyxlSkillContext.sort"
  - "OpenpyxlSkillContext.write_grid"
reads:
  - "self._dirty_workbook_ids"
  - "self._progress"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_apply_openpyxl_text_format_for_long_digit_columns`, `_opxl_write_cell`, `add`, `cell`, `raw`, `value`
- 피호출(영향 전파 경로): `ExcelSkillContext._merge_pivot_grid_into_base`, `ExcelSkillContext.filter_to_sheet`, `ExcelSkillContext.pivot`, `ExcelSkillContext.write_grid`, `OpenpyxlSkillContext._merge_pivot_grid_into_base`, `OpenpyxlSkillContext.filter_to_sheet`, `OpenpyxlSkillContext.pivot`, `OpenpyxlSkillContext.set_range`, `OpenpyxlSkillContext.sort`, `OpenpyxlSkillContext.write_grid`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
