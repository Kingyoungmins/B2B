---
type: function
title: _pivot_crosstab
module: serve_b2b.py
lang: python
extraction: ast
signature: "(data, g_i, c_i, v_i, agg, row_label='행')"
role: "2D 크로스탭 grid 생성. 반환: [[row_label, col1, col2, ...], [행키, agg, agg, ...], ...]."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:3058-3081"

# ── 입출력 ──
inputs:
  - "data"
  - "g_i"
  - "c_i"
  - "v_i"
  - "agg"
  - "row_label"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_pivot_agg"
  - "_pivot_sort_keys"
  - "add"
  - "append"
calls_external:
  - "agg"
  - "ck"
  - "ckeys"
  - "len"
  - "list"
  - "r"
  - "rk"
  - "rkeys"
  - "set"
  - "setdefault"
  - "str"
  - "strip"
  - "v"
called_by:
  - "PythonComSkillContext._pivot_value_table"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
2D 크로스탭 grid 생성. 반환: [[row_label, col1, col2, ...], [행키, agg, agg, ...], ...].

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_pivot_agg`, `_pivot_sort_keys`, `add`, `append`
- 피호출(영향 전파 경로): `PythonComSkillContext._pivot_value_table`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
