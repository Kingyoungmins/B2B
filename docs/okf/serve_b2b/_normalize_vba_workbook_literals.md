---
type: function
title: _normalize_vba_workbook_literals
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, code)"
role: "Patch workbook filename string literals to the actual open workbook name."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:8392-8432"

# ── 입출력 ──
inputs:
  - "app"
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_alias_ephemeral_excel_open_sheet_name"
  - "_alias_open_workbook_name"
  - "replace"
calls_external:
  - "app"
  - "group"
  - "literal"
  - "lower"
  - "quote_ch"
  - "repl_ephemeral_sheet"
  - "repl_workbook"
  - "search"
  - "str"
  - "sub"
  - "text"
called_by:
  - "_inject_and_run_vba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
Patch workbook filename string literals to the actual open workbook name.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_alias_ephemeral_excel_open_sheet_name`, `_alias_open_workbook_name`, `replace`
- 피호출(영향 전파 경로): `_inject_and_run_vba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
