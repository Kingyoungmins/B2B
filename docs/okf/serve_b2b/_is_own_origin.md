---
type: function
title: _is_own_origin
module: serve_b2b.py
lang: python
extraction: ast
signature: "(origin)"
role: "Origin 이 '이 서버 자신'인가. 우리 화면은 이 서버가 내보내므로 그것만 허용한다."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:4675-4694"

# ── 입출력 ──
inputs:
  - "origin"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "bool"
  - "expected"
  - "get"
  - "globals"
  - "int"
  - "lower"
  - "port"
  - "str"
  - "strip"
  - "urlsplit"
called_by:
  - "B2BHandler.do_GET"
  - "B2BHandler.do_POST"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
Origin 이 '이 서버 자신'인가. 우리 화면은 이 서버가 내보내므로 그것만 허용한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `B2BHandler.do_GET`, `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
