---
type: function
title: _verify_recorded_expected_live
module: serve_b2b.py
lang: python
extraction: ast
signature: "(expected)"
role: "Excel 워커 — 녹화 정지 시점 기대 상태(expected)와 현재 라이브 시트를 대조."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:7287-7349"

# ── 입출력 ──
inputs:
  - "expected"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "append"
  - "book"
  - "sheet"
  - "values"
calls_external:
  - "all"
  - "bool"
  - "checked"
  - "exp_merges"
  - "exp_set"
  - "get"
  - "got_set"
  - "int"
  - "isinstance"
  - "len"
  - "list"
  - "map"
  - "res"
  - "set"
  - "setdefault"
  - "sheet_expected_state"
  - "sorted"
  - "str"
  - "wb"
  - "ws"
called_by:
  - "excel_record_verify"
reads:
  - "EXCEL_SESSIONS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
Excel 워커 — 녹화 정지 시점 기대 상태(expected)와 현재 라이브 시트를 대조.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Worksheets`, `append`, `book`, `sheet`, `values`
- 피호출(영향 전파 경로): `excel_record_verify`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
