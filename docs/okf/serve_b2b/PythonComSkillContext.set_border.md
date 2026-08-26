---
type: method
title: PythonComSkillContext.set_border
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_range, style='thin', color=None, edges='all')"
role: "테두리. style: thin/medium/thick/double/none(지우기). edges: all(각 셀 사방+내부)/outline(바깥 테두리만)/"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12836-12888"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1_range"
  - "style"
  - "color"
  - "edges"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "_parse_excel_color"
  - "_rng"
  - "_tick"
  - "_ws"
  - "append"
  - "replace"
  - "sheet"
calls_external:
  - "Borders"
  - "PythonComSkillError"
  - "_apply_edge"
  - "a1_range"
  - "cc"
  - "color"
  - "get"
  - "idx"
  - "int"
  - "lower"
  - "nm"
  - "split"
  - "str"
  - "strip"
  - "ws"
called_by: []
reads:
  - "self._rng"
  - "self._shared"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
테두리. style: thin/medium/thick/double/none(지우기). edges: all(각 셀 사방+내부)/outline(바깥 테두리만)/

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_parse_excel_color`, `_rng`, `_tick`, `_ws`, `append`, `replace`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
