---
type: method
title: PythonComSkillContext.find_header
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, header_text, header_row=1)"
role: "헤더 행에서 헤더 텍스트로 열 번호(1-based)를 찾는다. 없으면 오류."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:11223-11278"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "header_text"
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
  - "_range_matrix"
  - "_tick"
  - "_ws"
  - "header_row"
  - "last_col"
  - "normalize_text"
  - "range"
  - "row"
  - "sheet"
  - "used_last_col"
calls_external:
  - "PythonComSkillError"
  - "abs"
  - "bottom"
  - "cells"
  - "enumerate"
  - "header_text"
  - "headers"
  - "int"
  - "len"
  - "max"
  - "min"
  - "sorted"
  - "str"
  - "strip"
  - "t"
  - "target"
  - "text"
  - "top"
  - "v"
  - "wcols"
  - "wmatrix"
called_by:
  - "PythonComSkillContext._resolve_col"
  - "PythonComSkillContext.apply_filter"
  - "PythonComSkillContext.move_cols"
  - "PythonComSkillContext.sort"
reads:
  - "self._tick"
  - "self._ws"
  - "self.last_col"
  - "self.used_last_col"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
헤더 행에서 헤더 텍스트로 열 번호(1-based)를 찾는다. 없으면 오류.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `_range_matrix`, `_tick`, `_ws`, `header_row`, `last_col`, `normalize_text`, `range`, `row`, `sheet`, `used_last_col`
- 피호출(영향 전파 경로): `PythonComSkillContext._resolve_col`, `PythonComSkillContext.apply_filter`, `PythonComSkillContext.move_cols`, `PythonComSkillContext.sort`

## 실패/예외
- `PythonComSkillError`
