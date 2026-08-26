---
type: method
title: PythonComSkillContext.lookup
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, key_col, into_col, table_sheet, table_key_col, table_val_col, header_row=1, default=None)"
role: "VLOOKUP/조인: sheet 의 key_col 값을 table_sheet 의 table_key_col 에서 찾아 그 행의 table_val_col 값을"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:14450-14482"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "key_col"
  - "into_col"
  - "table_sheet"
  - "table_key_col"
  - "table_val_col"
  - "header_row"
  - "default"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_col_letter"
  - "_resolve_col"
  - "append"
  - "header_row"
  - "last_row"
  - "normalize"
  - "read"
  - "sheet"
  - "write"
calls_external:
  - "icol"
  - "int"
  - "into_col"
  - "k"
  - "kcol"
  - "key_col"
  - "keys"
  - "out"
  - "table_key_col"
  - "table_sheet"
  - "table_val_col"
  - "tkcol"
  - "tvcol"
  - "vals"
  - "zip"
called_by: []
reads:
  - "self._resolve_col"
  - "self.last_row"
  - "self.normalize"
  - "self.read"
  - "self.write"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
VLOOKUP/조인: sheet 의 key_col 값을 table_sheet 의 table_key_col 에서 찾아 그 행의 table_val_col 값을

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_col_letter`, `_resolve_col`, `append`, `header_row`, `last_row`, `normalize`, `read`, `sheet`, `write`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
