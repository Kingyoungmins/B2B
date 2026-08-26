---
type: function
title: _self_referencing_formula_cells
module: serve_b2b.py
lang: python
extraction: ast
signature: "(data, row0, col0)"
role: "write_formulas 로 쓰려는 수식 중 '자기 셀'을 참조하는 것의 주소 목록(예: W3 에 =IF(W3<>\"\",W3,…))."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:11908-11942"

# ── 입출력 ──
inputs:
  - "data"
  - "row0"
  - "col0"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_col_letter"
  - "append"
calls_external:
  - "body"
  - "col_txt"
  - "compile"
  - "enumerate"
  - "escape"
  - "finditer"
  - "get"
  - "group"
  - "isinstance"
  - "lstrip"
  - "scan"
  - "startswith"
  - "str"
  - "sub"
  - "val"
called_by:
  - "PythonComSkillContext.write_formulas"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
write_formulas 로 쓰려는 수식 중 '자기 셀'을 참조하는 것의 주소 목록(예: W3 에 =IF(W3<>"",W3,…)).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_col_letter`, `append`
- 피호출(영향 전파 경로): `PythonComSkillContext.write_formulas`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
