---
type: function
title: _python_com_static_check
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code)"
role: "실행 전 AST 정적 게이트. 위반은 사람이 읽을 수 있는 한국어 사유로 모아 한 번에 반환."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:14072-14289"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "add"
  - "append"
  - "replace"
  - "value"
calls_external:
  - "PythonComSkillError"
  - "_Checker"
  - "_a1_cells_estimate"
  - "_col_to_index"
  - "_dynamic_range_text_is_wide"
  - "_is_ctx_receiver"
  - "abs"
  - "bool"
  - "ch"
  - "code"
  - "code_text"
  - "f"
  - "failures"
  - "finditer"
  - "float"
  - "fromkeys"
  - "func"
  - "generic_visit"
  - "group"
  - "int"
  - "isinstance"
  - "join"
  - "list"
  - "match"
  - "node"
  - "ord"
  - "parse"
  - "pop"
  - "s"
  - "search"
  - "str"
  - "strip"
  - "tgt"
  - "tree"
  - "unique"
  - "upper"
  - "visit"
called_by:
  - "_exec_python_com_skill"
reads:
  - "PY_SKILL_ENTRY"
  - "self.generic_visit"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
실행 전 AST 정적 게이트. 위반은 사람이 읽을 수 있는 한국어 사유로 모아 한 번에 반환.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `append`, `replace`, `value`
- 피호출(영향 전파 경로): `_exec_python_com_skill`

## 실패/예외
- `PythonComSkillError`
