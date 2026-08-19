---
type: method
title: PythonComSkillContext._rng
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, ws, a1)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:11423-11438"

# ── 입출력 ──
inputs:
  - "self"
  - "ws"
  - "a1"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "Range"
  - "_col_num"
calls_external:
  - "PythonComSkillError"
  - "a1"
  - "c1"
  - "c2"
  - "group"
  - "int"
  - "match"
  - "r1"
  - "r2"
  - "ref"
  - "str"
  - "strip"
called_by:
  - "PythonComSkillContext.clear"
  - "PythonComSkillContext.copy"
  - "PythonComSkillContext.copy_values"
  - "PythonComSkillContext.formula_mask"
  - "PythonComSkillContext.has_formulas"
  - "PythonComSkillContext.merge"
  - "PythonComSkillContext.paste_copied"
  - "PythonComSkillContext.read"
  - "PythonComSkillContext.read_formulas"
  - "PythonComSkillContext.replace"
  - "PythonComSkillContext.set_border"
  - "PythonComSkillContext.set_fill"
  - "PythonComSkillContext.set_font"
  - "PythonComSkillContext.set_number_format"
  - "PythonComSkillContext.shift_months"
  - "PythonComSkillContext.sort"
  - "PythonComSkillContext.unmerge"
  - "PythonComSkillContext.write"
  - "PythonComSkillContext.write_formulas"
reads:
  - "self._col_num"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Range`, `_col_num`
- 피호출(영향 전파 경로): `PythonComSkillContext.clear`, `PythonComSkillContext.copy`, `PythonComSkillContext.copy_values`, `PythonComSkillContext.formula_mask`, `PythonComSkillContext.has_formulas`, `PythonComSkillContext.merge`, `PythonComSkillContext.paste_copied`, `PythonComSkillContext.read`, `PythonComSkillContext.read_formulas`, `PythonComSkillContext.replace`, `PythonComSkillContext.set_border`, `PythonComSkillContext.set_fill`, `PythonComSkillContext.set_font`, `PythonComSkillContext.set_number_format`, `PythonComSkillContext.shift_months`, `PythonComSkillContext.sort`, `PythonComSkillContext.unmerge`, `PythonComSkillContext.write`, `PythonComSkillContext.write_formulas`

## 실패/예외
- `PythonComSkillError`
