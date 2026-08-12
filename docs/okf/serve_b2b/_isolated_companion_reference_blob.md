---
type: function
title: _isolated_companion_reference_blob
module: serve_b2b.py
lang: python
extraction: ast
signature: "(steps)"
role: "스텝 코드에서 참조 파일명을 확실히 읽어낼 수 있으면 그 코드 뭉치(소문자)를 돌려주고,"
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:9614-9631"

# ── 입출력 ──
inputs:
  - "steps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
  - "normalize"
calls_external:
  - "blob"
  - "casefold"
  - "code"
  - "dict"
  - "finditer"
  - "get"
  - "group"
  - "isinstance"
  - "join"
  - "parts"
  - "st"
  - "str"
called_by:
  - "_setup_isolated_pipeline_instance"
reads:
  - "_BOOK_CALL_RE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
스텝 코드에서 참조 파일명을 확실히 읽어낼 수 있으면 그 코드 뭉치(소문자)를 돌려주고,

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`, `normalize`
- 피호출(영향 전파 경로): `_setup_isolated_pipeline_instance`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
