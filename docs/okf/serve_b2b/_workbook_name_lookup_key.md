---
type: function
title: _workbook_name_lookup_key
module: serve_b2b.py
lang: python
extraction: ast
signature: "(value)"
role: "Normalize workbook names for generated-code lookups."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:7979-7993"

# ── 입출력 ──
inputs:
  - "value"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "replace"
calls_external:
  - "lower"
  - "str"
  - "strip"
  - "sub"
  - "text"
  - "unquote"
called_by:
  - "PythonComSkillContext.copy_sheet"
  - "_capture_copypaste_on_session_impl"
  - "_registered_path_for_name"
  - "_workbook_name_lookup_keys"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
Normalize workbook names for generated-code lookups.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `replace`
- 피호출(영향 전파 경로): `PythonComSkillContext.copy_sheet`, `_capture_copypaste_on_session_impl`, `_registered_path_for_name`, `_workbook_name_lookup_keys`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
