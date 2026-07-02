---
type: method
title: PythonComSkillContext.delete_cols
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, col, count=1)"
role: "전체 열 삭제. col 은 'Q', 17, 또는 'Q:AU' 범위 모두 허용."
role_source: docstring
version: "0.5.18"
loc: "serve_b2b.py:9103-9118"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "col"
  - "count"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Columns"
  - "_col_index"
  - "_col_letter"
  - "_tick"
  - "_ws"
  - "append"
  - "col"
  - "sheet"
calls_external:
  - "Delete"
  - "col_letter"
  - "count"
  - "int"
  - "isinstance"
  - "spec"
  - "str"
  - "strip"
called_by:
  - "PythonComSkillContext.move_cols"
reads:
  - "self._col_index"
  - "self._shared"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
전체 열 삭제. col 은 'Q', 17, 또는 'Q:AU' 범위 모두 허용.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `Columns`, `_col_index`, `_col_letter`, `_tick`, `_ws`, `append`, `col`, `sheet`
- 피호출(영향 전파 경로): `PythonComSkillContext.move_cols`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
