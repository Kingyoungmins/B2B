---
type: method
title: PythonComSkillContext._shaped_matrix
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(rng, value)"
role: "_range_matrix 가 빈/None(전부 빈 셀) 결과를 줄 때도 범위 차원을 보존해"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12304-12316"

# ── 입출력 ──
inputs:
  - "rng"
  - "value"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_range_matrix"
  - "range"
  - "rows"
  - "value"
calls_external:
  - "cols"
  - "int"
  - "max"
called_by:
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.formula_mask"
  - "PythonComSkillContext.read"
  - "PythonComSkillContext.read_formulas"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
_range_matrix 가 빈/None(전부 빈 셀) 결과를 줄 때도 범위 차원을 보존해

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_range_matrix`, `range`, `rows`, `value`
- 피호출(영향 전파 경로): `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.formula_mask`, `PythonComSkillContext.read`, `PythonComSkillContext.read_formulas`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
