---
type: function
title: _vba_strip_strings_and_comments
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code)"
role: "따옴표 문자열(\"\" 이스케이프 포함) → 빈 문자열로, 이후 ' 주석 제거 — 키워드 오탐 방지."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:7772-7779"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
calls_external:
  - "find"
  - "join"
  - "out"
  - "splitlines"
  - "str"
  - "sub"
called_by:
  - "_validate_vba_source_before_inject"
  - "_vba_security_scan"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
따옴표 문자열("" 이스케이프 포함) → 빈 문자열로, 이후 ' 주석 제거 — 키워드 오탐 방지.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`
- 피호출(영향 전파 경로): `_validate_vba_source_before_inject`, `_vba_security_scan`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
