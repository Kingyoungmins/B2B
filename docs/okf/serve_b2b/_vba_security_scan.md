---
type: function
title: _vba_security_scan
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code)"
role: "금지 구문 발견 시 사용자 안내 문자열 반환, 없으면 None."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:8390-8400"

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
  - "_vba_strip_strings_and_comments"
  - "raw"
calls_external:
  - "code"
  - "search"
  - "str"
  - "stripped"
called_by:
  - "_recorded_vba_hazards"
  - "_validate_vba_source_before_inject"
reads:
  - "_VBA_FORBIDDEN_BARE"
  - "_VBA_FORBIDDEN_RAW"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
금지 구문 발견 시 사용자 안내 문자열 반환, 없으면 None.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_vba_strip_strings_and_comments`, `raw`
- 피호출(영향 전파 경로): `_recorded_vba_hazards`, `_validate_vba_source_before_inject`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
