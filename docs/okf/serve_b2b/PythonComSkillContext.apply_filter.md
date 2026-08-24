---
type: method
title: PythonComSkillContext.apply_filter
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, column, values, header_row=1)"
role: "'눈으로만' 특정 값만 보이게 필터를 건다 — 데이터를 지우지 않고, 조건에 안 맞는 행을 화면에서 '숨김'"
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:12693-12735"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "column"
  - "values"
  - "header_row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "_col_index"
  - "_tick"
  - "_ws"
  - "append"
  - "find_header"
  - "sheet"
  - "used_last_col"
  - "used_last_row"
  - "values"
calls_external:
  - "AutoFilter"
  - "PythonComSkillError"
  - "ShowAllData"
  - "_col1"
  - "bool"
  - "column"
  - "field"
  - "fullmatch"
  - "hr"
  - "int"
  - "isinstance"
  - "join"
  - "last_c"
  - "last_r"
  - "len"
  - "list"
  - "max"
  - "s"
  - "spec"
  - "str"
  - "strip"
  - "v"
  - "vals"
called_by: []
reads:
  - "self._col_index"
  - "self._shared"
  - "self._tick"
  - "self._ws"
  - "self.find_header"
  - "self.used_last_col"
  - "self.used_last_row"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
'눈으로만' 특정 값만 보이게 필터를 건다 — 데이터를 지우지 않고, 조건에 안 맞는 행을 화면에서 '숨김'

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `_col_index`, `_tick`, `_ws`, `append`, `find_header`, `sheet`, `used_last_col`, `used_last_row`, `values`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
