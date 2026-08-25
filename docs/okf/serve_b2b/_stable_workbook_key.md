---
type: function
title: _stable_workbook_key
module: serve_b2b.py
lang: python
extraction: ast
signature: "(name)"
role: "'같은 템플릿, 다른 월/날짜/버전' 파일을 같게 보기 위한 안정 키(소문자·기호제거)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:8443-8485"

# ── 입출력 ──
inputs:
  - "name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_strip_generated_workbook_prefix"
  - "add"
  - "range"
calls_external:
  - "Path"
  - "_drop_month_seq"
  - "finditer"
  - "group"
  - "int"
  - "lower"
  - "rep"
  - "s"
  - "set"
  - "str"
  - "sub"
  - "unquote"
called_by:
  - "_match_workbook_by_stable_key"
reads:
  - "_VOLATILE_NAME_TOKENS"
  - "_VOLATILE_SUFFIX_TOKENS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
'같은 템플릿, 다른 월/날짜/버전' 파일을 같게 보기 위한 안정 키(소문자·기호제거).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_strip_generated_workbook_prefix`, `add`, `range`
- 피호출(영향 전파 경로): `_match_workbook_by_stable_key`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
