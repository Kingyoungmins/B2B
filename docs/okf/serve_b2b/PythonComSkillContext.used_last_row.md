---
type: method
title: PythonComSkillContext.used_last_row
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet)"
role: "시트 '사용 범위' 마지막 행(1-based). 특정 열 기준 last_row(col=N) 은 그 열이 희소/병합이면 표 하단을"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12117-12137"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
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
  - "range"
  - "sheet"
  - "used_last_col"
calls_external:
  - "End"
  - "_XL_UP"
  - "best"
  - "c"
  - "int"
  - "last_c"
  - "max"
  - "min"
  - "rows_n"
called_by:
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.apply_filter"
  - "PythonComSkillContext.enable_filter"
  - "PythonComSkillContext.first_empty_col"
  - "PythonComSkillContext.native_pivot"
  - "PythonComSkillContext.sum_lookup"
reads:
  - "_XL_UP"
  - "self._tick"
  - "self._ws"
  - "self.used_last_col"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
시트 '사용 범위' 마지막 행(1-based). 특정 열 기준 last_row(col=N) 은 그 열이 희소/병합이면 표 하단을

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `_tick`, `_ws`, `range`, `sheet`, `used_last_col`
- 피호출(영향 전파 경로): `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.apply_filter`, `PythonComSkillContext.enable_filter`, `PythonComSkillContext.first_empty_col`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.sum_lookup`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
