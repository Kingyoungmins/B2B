---
type: function
title: _resolve_open_workbook_name
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, requested_name)"
role: "Return the actual open workbook name matching requested_name."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:8961-8989"

# ── 입출력 ──
inputs:
  - "app"
  - "requested_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_match_workbook_by_stable_key"
  - "_vba_trace"
  - "_workbook_name_lookup_keys"
  - "names"
calls_external:
  - "len"
  - "matches"
  - "name"
  - "requested"
  - "stable"
  - "str"
called_by:
  - "_alias_open_workbook_name"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
Return the actual open workbook name matching requested_name.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_match_workbook_by_stable_key`, `_vba_trace`, `_workbook_name_lookup_keys`, `names`
- 피호출(영향 전파 경로): `_alias_open_workbook_name`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
