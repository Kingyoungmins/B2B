---
type: method
title: PythonComSkillContext.last_row
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, col=1)"
role: "해당 열 기준 마지막 데이터 행(1-based). 표 끝 합계행 포함 여부는 호출자가 판단."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12035-12047"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "col"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "_tick"
  - "_vba_trace"
  - "_ws"
  - "col"
  - "row"
  - "sheet"
calls_external:
  - "End"
  - "_XL_UP"
  - "int"
  - "ms"
  - "perf_counter"
  - "round"
  - "str"
called_by:
  - "PythonComSkillContext._filter_to_sheet_native"
  - "PythonComSkillContext.add_total_row"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.dedupe"
  - "PythonComSkillContext.fill_sum_col"
  - "PythonComSkillContext.lookup"
  - "PythonComSkillContext.match_fill"
  - "PythonComSkillContext.move_col_clear"
  - "PythonComSkillContext.split_column"
  - "PythonComSkillContext.sum_column"
  - "PythonComSkillContext.sum_lookup"
  - "PythonComSkillContext.sum_where"
reads:
  - "_XL_UP"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
해당 열 기준 마지막 데이터 행(1-based). 표 끝 합계행 포함 여부는 호출자가 판단.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `_tick`, `_vba_trace`, `_ws`, `col`, `row`, `sheet`
- 피호출(영향 전파 경로): `PythonComSkillContext._filter_to_sheet_native`, `PythonComSkillContext.add_total_row`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.dedupe`, `PythonComSkillContext.fill_sum_col`, `PythonComSkillContext.lookup`, `PythonComSkillContext.match_fill`, `PythonComSkillContext.move_col_clear`, `PythonComSkillContext.split_column`, `PythonComSkillContext.sum_column`, `PythonComSkillContext.sum_lookup`, `PythonComSkillContext.sum_where`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
