---
type: function
title: excel_zip_file_suffix
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "Return the Excel extension implied by an OPC/ZIP workbook package."
role_source: docstring
version: "0.8.1"
loc: "serve_b2b.py:3022-3048"

# ── 입출력 ──
inputs:
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "office_file_signature"
calls_external:
  - "ZipFile"
  - "lower"
  - "n"
  - "namelist"
  - "path"
  - "set"
  - "startswith"
  - "str"
called_by:
  - "excel_compatible_open_path"
  - "is_ooxml_zip_file"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
Return the Excel extension implied by an OPC/ZIP workbook package.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `office_file_signature`
- 피호출(영향 전파 경로): `excel_compatible_open_path`, `is_ooxml_zip_file`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
