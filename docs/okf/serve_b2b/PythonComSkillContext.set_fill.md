---
type: method
title: PythonComSkillContext.set_fill
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_range, color=None)"
role: "셀 음영/배경색 설정. color 는 '#RRGGBB'/'노랑'·'red' 같은 색이름/정수. None 이면 '채우기 없음'."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12803-12818"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1_range"
  - "color"
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
  - "col"
  - "sheet"
calls_external:
  - "PythonComSkillError"
  - "a1_range"
  - "color"
  - "int"
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
셀 음영/배경색 설정. color 는 '#RRGGBB'/'노랑'·'red' 같은 색이름/정수. None 이면 '채우기 없음'.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_parse_excel_color`, `_rng`, `_tick`, `_ws`, `append`, `col`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
