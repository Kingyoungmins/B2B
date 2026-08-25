---
type: method
title: PythonComSkillContext.write_formulas
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_start, formulas)"
role: "수식 문자열 2차원 리스트를 한 번에 기록(예: [[\"=B2-C2\"],[\"=B3-C3\"]])."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12337-12358"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1_start"
  - "formulas"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "_as_2d"
  - "_journal_save"
  - "_resize_rng"
  - "_rng"
  - "_self_referencing_formula_cells"
  - "_tick"
  - "_ws"
  - "rows"
  - "sheet"
calls_external:
  - "PythonComSkillError"
  - "_bad"
  - "a1_start"
  - "anchor"
  - "cols"
  - "data"
  - "formulas"
  - "int"
  - "join"
  - "len"
  - "rng"
  - "ws"
called_by:
  - "PythonComSkillContext.add_total_row"
reads:
  - "self._as_2d"
  - "self._journal_save"
  - "self._resize_rng"
  - "self._rng"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
수식 문자열 2차원 리스트를 한 번에 기록(예: [["=B2-C2"],["=B3-C3"]]).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_as_2d`, `_journal_save`, `_resize_rng`, `_rng`, `_self_referencing_formula_cells`, `_tick`, `_ws`, `rows`, `sheet`
- 피호출(영향 전파 경로): `PythonComSkillContext.add_total_row`

## 실패/예외
- `PythonComSkillError`
