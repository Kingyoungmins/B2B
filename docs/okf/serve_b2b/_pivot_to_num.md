---
type: function
title: _pivot_to_num
module: serve_b2b.py
lang: python
extraction: ast
signature: "(v)"
role: "---- 피벗/크로스탭 집계(순수 함수 — COM 불필요, 단위테스트 가능). ctx.pivot 2D 가 사용. ----"
role_source: banner
version: "0.8.0"
loc: "serve_b2b.py:3469-3477"

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
  - "float"
  - "isinstance"
  - "str"
  - "v"
called_by:
  - "_pivot_agg"
  - "_pivot_sort_keys"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
---- 피벗/크로스탭 집계(순수 함수 — COM 불필요, 단위테스트 가능). ctx.pivot 2D 가 사용. ----

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `replace`
- 피호출(영향 전파 경로): `_pivot_agg`, `_pivot_sort_keys`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
