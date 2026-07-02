---
type: function
title: _opxl_eval_formula
module: serve_b2b.py
lang: python
extraction: ast
signature: "(ws, formula, cached_ws=None, seen=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:12202-12253"

# ── 입출력 ──
inputs:
  - "ws"
  - "formula"
  - "cached_ws"
  - "seen"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "ValueError"

# ── 유기적 관계 ──
calls:
  - "_opxl_col_to_index"
  - "_opxl_display_cell_value"
  - "_opxl_numeric_values"
  - "_opxl_range_values"
  - "_opxl_safe_eval_arithmetic"
  - "_opxl_split_top_level_args"
  - "col"
  - "replace"
  - "row"
  - "value"
  - "values"
calls_external:
  - "ValueError"
  - "_replace_cell"
  - "arg"
  - "args"
  - "cached_ws"
  - "col_text"
  - "endswith"
  - "extend"
  - "fullmatch"
  - "groups"
  - "int"
  - "isinstance"
  - "len"
  - "nums"
  - "prefix"
  - "py_expr"
  - "repr"
  - "row_text"
  - "seen"
  - "startswith"
  - "str"
  - "strip"
  - "sub"
  - "sum"
  - "target_cached"
  - "target_ws"
  - "upper"
  - "ws"
called_by:
  - "_opxl_display_cell_value"
reads:
  - "_OPXL_CELL_REF_RE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_opxl_col_to_index`, `_opxl_display_cell_value`, `_opxl_numeric_values`, `_opxl_range_values`, `_opxl_safe_eval_arithmetic`, `_opxl_split_top_level_args`, `col`, `replace`, `row`, `value`, `values`
- 피호출(영향 전파 경로): `_opxl_display_cell_value`

## 실패/예외
- `ValueError`
