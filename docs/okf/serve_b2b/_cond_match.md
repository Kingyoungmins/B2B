---
type: function
title: _cond_match
module: serve_b2b.py
lang: python
extraction: ast
signature: "(cell, op, target)"
role: "sum_where 조건 비교. 비교연산자는 숫자로, 그 외는 normalize 텍스트로."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:15129-15144"

# ── 입출력 ──
inputs:
  - "cell"
  - "op"
  - "target"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_coerce_number"
  - "cell"
  - "normalize_text"
calls_external:
  - "bool"
  - "str"
  - "target"
  - "ts"
called_by:
  - "PythonComSkillContext.sum_where"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
sum_where 조건 비교. 비교연산자는 숫자로, 그 외는 normalize 텍스트로.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_coerce_number`, `cell`, `normalize_text`
- 피호출(영향 전파 경로): `PythonComSkillContext.sum_where`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
