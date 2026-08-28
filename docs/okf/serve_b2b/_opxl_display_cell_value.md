---
type: function
title: _opxl_display_cell_value
module: serve_b2b.py
lang: python
extraction: ast
signature: "(ws, row, col, cached_ws=None, seen=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "serve_b2b.py:18161-18180"

# ── 입출력 ──
inputs:
  - "ws"
  - "row"
  - "col"
  - "cached_ws"
  - "seen"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_opxl_eval_formula"
  - "_opxl_get_cached_cell_value"
  - "add"
  - "cell"
  - "col"
  - "row"
  - "value"
calls_external:
  - "RuntimeError"
  - "cached_ws"
  - "discard"
  - "id"
  - "int"
  - "isinstance"
  - "key"
  - "seen"
  - "set"
  - "startswith"
  - "str"
  - "ws"
called_by:
  - "OpenpyxlSkillContext.display_rows"
  - "OpenpyxlSkillContext.value"
  - "_opxl_eval_formula"
  - "_opxl_range_values"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_opxl_eval_formula`, `_opxl_get_cached_cell_value`, `add`, `cell`, `col`, `row`, `value`
- 피호출(영향 전파 경로): `OpenpyxlSkillContext.display_rows`, `OpenpyxlSkillContext.value`, `_opxl_eval_formula`, `_opxl_range_values`

## 실패/예외
- `RuntimeError`
