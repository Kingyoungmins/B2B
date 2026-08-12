---
type: function
title: _parse_excel_color
module: serve_b2b.py
lang: python
extraction: ast
signature: "(c)"
role: "색 입력을 Excel .Color 롱값으로 변환. '#RRGGBB'/'RRGGBB'/색이름(노랑·red 등)/정수 지원."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:10784-10805"

# ── 입출력 ──
inputs:
  - "c"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls: []
calls_external:
  - "PythonComSkillError"
  - "bool"
  - "c"
  - "fullmatch"
  - "get"
  - "int"
  - "isinstance"
  - "lower"
  - "lstrip"
  - "s"
  - "str"
  - "strip"
called_by:
  - "PythonComSkillContext.set_border"
  - "PythonComSkillContext.set_fill"
  - "PythonComSkillContext.set_font"
reads:
  - "_COLOR_NAMES"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
색 입력을 Excel .Color 롱값으로 변환. '#RRGGBB'/'RRGGBB'/색이름(노랑·red 등)/정수 지원.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext.set_border`, `PythonComSkillContext.set_fill`, `PythonComSkillContext.set_font`

## 실패/예외
- `PythonComSkillError`
