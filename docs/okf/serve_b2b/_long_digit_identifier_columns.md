---
type: function
title: _long_digit_identifier_columns
module: serve_b2b.py
lang: python
extraction: ast
signature: "(grid)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:7893-7901"

# ── 입출력 ──
inputs:
  - "grid"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_looks_like_long_digit_identifier"
  - "add"
  - "row"
  - "value"
calls_external:
  - "columns"
  - "enumerate"
  - "idx"
  - "isinstance"
  - "set"
  - "sorted"
called_by:
  - "_apply_com_text_format_for_long_digit_columns"
  - "_apply_openpyxl_text_format_for_long_digit_columns"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_looks_like_long_digit_identifier`, `add`, `row`, `value`
- 피호출(영향 전파 경로): `_apply_com_text_format_for_long_digit_columns`, `_apply_openpyxl_text_format_for_long_digit_columns`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
