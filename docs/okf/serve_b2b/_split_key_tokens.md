---
type: function
title: _split_key_tokens
module: serve_b2b.py
lang: python
extraction: ast
signature: "(v)"
role: "한 셀 안 다중 키(가입번호 등)를 분리 — 줄바꿈/공백/콤마/세미콜론/슬래시 구분. 각 토큰은 _norm_key."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:14639-14651"

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
  - "_norm_key"
  - "append"
calls_external:
  - "p"
  - "s"
  - "split"
  - "str"
  - "strip"
  - "v"
called_by:
  - "PythonComSkillContext.sum_lookup"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
한 셀 안 다중 키(가입번호 등)를 분리 — 줄바꿈/공백/콤마/세미콜론/슬래시 구분. 각 토큰은 _norm_key.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_norm_key`, `append`
- 피호출(영향 전파 경로): `PythonComSkillContext.sum_lookup`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
