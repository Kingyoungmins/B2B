---
type: method
title: ExcelSkillContext._write_grid
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, ws, grid, start_row=1, start_col=1)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:16196-16206"

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
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "_apply_com_text_format_for_long_digit_columns"
calls_external:
  - "len"
  - "list"
  - "max"
  - "norm"
  - "start_col"
  - "start_row"
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
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `_apply_com_text_format_for_long_digit_columns`
- 피호출(영향 전파 경로): `ExcelSkillContext._merge_pivot_grid_into_base`, `ExcelSkillContext.filter_to_sheet`, `ExcelSkillContext.pivot`, `ExcelSkillContext.write_grid`, `OpenpyxlSkillContext._merge_pivot_grid_into_base`, `OpenpyxlSkillContext.filter_to_sheet`, `OpenpyxlSkillContext.pivot`, `OpenpyxlSkillContext.set_range`, `OpenpyxlSkillContext.sort`, `OpenpyxlSkillContext.write_grid`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
