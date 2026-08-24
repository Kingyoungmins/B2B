---
type: function
title: _coerce_number
module: serve_b2b.py
lang: python
extraction: ast
signature: "(v)"
role: "셀 값을 숫자로. bool·라벨·빈칸은 None. 콤마·통화·괄호(음수) 표기 허용."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:15497-15513"

# ── 입출력 ──
inputs:
  - "v"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "replace"
calls_external:
  - "bool"
  - "endswith"
  - "float"
  - "isinstance"
  - "s"
  - "startswith"
  - "str"
  - "strip"
  - "v"
called_by:
  - "PythonComSkillContext.sum_column"
  - "PythonComSkillContext.sum_lookup"
  - "PythonComSkillContext.sum_where"
  - "_cond_match"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
셀 값을 숫자로. bool·라벨·빈칸은 None. 콤마·통화·괄호(음수) 표기 허용.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `replace`
- 피호출(영향 전파 경로): `PythonComSkillContext.sum_column`, `PythonComSkillContext.sum_lookup`, `PythonComSkillContext.sum_where`, `_cond_match`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
