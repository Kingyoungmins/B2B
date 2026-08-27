---
type: method
title: PythonComSkillContext.last_col
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, row=1)"
role: "해당 행 기준 마지막 데이터 열(1-based)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12457-12461"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "_tick"
  - "_ws"
  - "row"
  - "sheet"
calls_external:
  - "End"
  - "_XL_TO_LEFT"
  - "int"
called_by:
  - "PythonComSkillContext._filter_to_sheet_native"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.copy_key_blocks"
  - "PythonComSkillContext.filter_to_range"
  - "PythonComSkillContext.find_header"
  - "PythonComSkillContext.match_fill"
  - "PythonComSkillContext.move_cols"
reads:
  - "_XL_TO_LEFT"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
해당 행 기준 마지막 데이터 열(1-based).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `_tick`, `_ws`, `row`, `sheet`
- 피호출(영향 전파 경로): `PythonComSkillContext._filter_to_sheet_native`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.copy_key_blocks`, `PythonComSkillContext.filter_to_range`, `PythonComSkillContext.find_header`, `PythonComSkillContext.match_fill`, `PythonComSkillContext.move_cols`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
