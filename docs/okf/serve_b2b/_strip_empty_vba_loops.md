---
type: function
title: _strip_empty_vba_loops
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code)"
role: "본문이 비어 있는 `For Each <var> In <expr> … Next` 루프를 제거한다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:9017-9031"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "search"
  - "str"
  - "sub"
  - "text"
called_by:
  - "_inject_and_run_vba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
본문이 비어 있는 `For Each <var> In <expr> … Next` 루프를 제거한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_inject_and_run_vba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
