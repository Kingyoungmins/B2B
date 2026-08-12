---
type: method
title: PythonComSkillContext.set_font
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_range, size=None, bold=None, italic=None, color=None, name=None)"
role: "글꼴 서식. 지정한 항목만 바꾼다 — size(pt 숫자)/bold/italic(True·False)/color(색)/name(글꼴명)."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:11712-11734"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1_range"
  - "size"
  - "bold"
  - "italic"
  - "color"
  - "name"
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
  - "sheet"
calls_external:
  - "PythonComSkillError"
  - "a1_range"
  - "bold"
  - "bool"
  - "cc"
  - "color"
  - "float"
  - "int"
  - "italic"
  - "name"
  - "size"
  - "str"
  - "ws"
called_by: []
reads:
  - "self._rng"
  - "self._shared"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
글꼴 서식. 지정한 항목만 바꾼다 — size(pt 숫자)/bold/italic(True·False)/color(색)/name(글꼴명).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_parse_excel_color`, `_rng`, `_tick`, `_ws`, `append`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
