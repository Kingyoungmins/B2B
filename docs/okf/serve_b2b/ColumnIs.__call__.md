---
type: method
title: ColumnIs.__call__
module: serve_b2b.py
lang: python
extraction: ast
class: ColumnIs
signature: "(self, row)"
role: "[중요] 값 경로에서도 그대로 쓰인다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12120-12137"

# ── 입출력 ──
inputs:
  - "self"
  - "row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_col_letter_to_index"
  - "row"
calls_external:
  - "any"
  - "cur"
  - "idx"
  - "int"
  - "isinstance"
  - "len"
  - "str"
  - "strip"
  - "v"
called_by:
  - "ExcelWorksheetsProxy.Item"
  - "ExcelWorksheetsProxy.__getitem__"
reads:
  - "self.column"
  - "self.values"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[중요] 값 경로에서도 그대로 쓰인다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_col_letter_to_index`, `row`
- 피호출(영향 전파 경로): `ExcelWorksheetsProxy.Item`, `ExcelWorksheetsProxy.__getitem__`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
