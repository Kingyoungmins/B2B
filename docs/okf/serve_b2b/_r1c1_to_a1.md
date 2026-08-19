---
type: function
title: _r1c1_to_a1
module: serve_b2b.py
lang: python
extraction: ast
signature: "(r1c1)"
role: "Excel 'Link' 포맷의 R1C1 범위 표기를 A1 로 변환. Link 포맷은 항상 R1C1 이다."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:10768-10809"

# ── 입출력 ──
inputs:
  - "r1c1"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_col_letter"
calls_external:
  - "_area"
  - "_conv"
  - "a"
  - "group"
  - "int"
  - "join"
  - "match"
  - "r1c1"
  - "split"
  - "str"
  - "strip"
  - "tok"
  - "x"
  - "y"
called_by:
  - "_read_excel_clipboard_source"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
Excel 'Link' 포맷의 R1C1 범위 표기를 A1 로 변환. Link 포맷은 항상 R1C1 이다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_col_letter`
- 피호출(영향 전파 경로): `_read_excel_clipboard_source`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
