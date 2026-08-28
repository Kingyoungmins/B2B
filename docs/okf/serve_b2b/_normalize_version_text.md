---
type: function
title: _normalize_version_text
module: serve_b2b.py
lang: python
extraction: ast
signature: "(text)"
role: "'0.7.2' / 'v0.7.2' / '0.7.2.0' 을 모두 '0.7.2.0' 으로 맞춘다."
role_source: docstring
version: "0.8.1"
loc: "serve_b2b.py:225-239"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "all"
  - "int"
  - "isdigit"
  - "join"
  - "lstrip"
  - "p"
  - "split"
  - "str"
  - "strip"
called_by:
  - "_current_app_version"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
'0.7.2' / 'v0.7.2' / '0.7.2.0' 을 모두 '0.7.2.0' 으로 맞춘다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_current_app_version`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
