---
type: function
title: _opxl_range_values
module: serve_b2b.py
lang: python
extraction: ast
signature: "(ws, token, cached_ws=None, seen=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:15967-15995"

# ── 입출력 ──
inputs:
  - "ws"
  - "token"
  - "cached_ws"
  - "seen"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_opxl_col_to_index"
  - "_opxl_display_cell_value"
  - "append"
  - "col"
  - "range"
  - "replace"
  - "row"
calls_external:
  - "c1"
  - "c2"
  - "fullmatch"
  - "group"
  - "int"
  - "left"
  - "max"
  - "min"
  - "r1"
  - "r2"
  - "right"
  - "seen"
  - "split"
  - "str"
  - "strip"
  - "target_cached"
  - "target_ws"
  - "token"
called_by:
  - "_opxl_eval_formula"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_opxl_col_to_index`, `_opxl_display_cell_value`, `append`, `col`, `range`, `replace`, `row`
- 피호출(영향 전파 경로): `_opxl_eval_formula`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
