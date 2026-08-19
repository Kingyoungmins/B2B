---
type: function
title: _workbook_name_lookup_keys
module: serve_b2b.py
lang: python
extraction: ast
signature: "(value)"
role: "Return conservative lookup keys for workbook-name resolution."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:8163-8201"

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
  - "_strip_generated_workbook_prefix"
  - "_workbook_name_lookup_key"
  - "add"
  - "raw"
  - "values"
calls_external:
  - "Path"
  - "base"
  - "candidate"
  - "key"
  - "list"
  - "set"
  - "stem"
  - "str"
  - "strip"
  - "unquote"
  - "update"
  - "val"
called_by:
  - "PythonComSkillContext.book"
  - "_alias_open_workbook_name"
  - "_resolve_open_workbook_name"
  - "_stash_workbook_name_alias"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
Return conservative lookup keys for workbook-name resolution.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_strip_generated_workbook_prefix`, `_workbook_name_lookup_key`, `add`, `raw`, `values`
- 피호출(영향 전파 경로): `PythonComSkillContext.book`, `_alias_open_workbook_name`, `_resolve_open_workbook_name`, `_stash_workbook_name_alias`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
