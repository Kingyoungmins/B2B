---
type: method
title: PythonComSkillContext.swap_cols
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, col_a, col_b, header_row=None)"
role: "인접한 두 열의 위치를 서로 맞바꾼다. Excel 네이티브 Cut/Insert 로 옮겨 **수식 참조가 자동 보정**된다"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:13704-13748"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "col_a"
  - "col_b"
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
  - "Columns"
  - "Range"
  - "_col_letter"
  - "_resolve_col"
  - "_tick"
  - "_ws"
  - "add"
  - "append"
  - "col"
  - "range"
  - "sheet"
calls_external:
  - "Cut"
  - "Insert"
  - "Merge"
  - "PythonComSkillError"
  - "UnMerge"
  - "a"
  - "addr"
  - "b"
  - "col_a"
  - "col_b"
  - "hi"
  - "int"
  - "lo"
  - "max"
  - "min"
  - "r"
  - "set"
  - "str"
called_by: []
reads:
  - "self._app"
  - "self._resolve_col"
  - "self._shared"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
인접한 두 열의 위치를 서로 맞바꾼다. Excel 네이티브 Cut/Insert 로 옮겨 **수식 참조가 자동 보정**된다

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Columns`, `Range`, `_col_letter`, `_resolve_col`, `_tick`, `_ws`, `add`, `append`, `col`, `range`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
