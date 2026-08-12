---
type: function
title: _norm_key
module: serve_b2b.py
lang: python
extraction: ast
signature: "(v)"
role: "블록 키(가입번호 등) 정규화 — 숫자로 저장돼 있어도 텍스트 키와 매칭되도록 정수문자열로."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:14612-14618"

# ── 입출력 ──
inputs:
  - "v"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "bool"
  - "float"
  - "int"
  - "is_integer"
  - "isinstance"
  - "str"
  - "strip"
  - "v"
called_by:
  - "PythonComSkillContext.copy_key_blocks"
  - "_split_key_tokens"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
블록 키(가입번호 등) 정규화 — 숫자로 저장돼 있어도 텍스트 키와 매칭되도록 정수문자열로.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext.copy_key_blocks`, `_split_key_tokens`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
