---
type: method
title: PythonComSkillContext._journal_save
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, ws, rng, new_data=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:11593-11607"

# ── 입출력 ──
inputs:
  - "self"
  - "ws"
  - "rng"
  - "new_data"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_mark_mutated"
  - "_note_blanked_cells_from_range"
  - "_range_matrix"
  - "_tick"
  - "append"
calls_external:
  - "new_data"
  - "rng"
  - "str"
  - "ws"
called_by:
  - "PythonComSkillContext.clear"
  - "PythonComSkillContext.copy"
  - "PythonComSkillContext.copy_values"
  - "PythonComSkillContext.merge"
  - "PythonComSkillContext.paste_copied"
  - "PythonComSkillContext.replace"
  - "PythonComSkillContext.shift_months"
  - "PythonComSkillContext.sort"
  - "PythonComSkillContext.write"
  - "PythonComSkillContext.write_formulas"
reads:
  - "self._mark_mutated"
  - "self._note_blanked_cells_from_range"
  - "self._shared"
  - "self._tick"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_mark_mutated`, `_note_blanked_cells_from_range`, `_range_matrix`, `_tick`, `append`
- 피호출(영향 전파 경로): `PythonComSkillContext.clear`, `PythonComSkillContext.copy`, `PythonComSkillContext.copy_values`, `PythonComSkillContext.merge`, `PythonComSkillContext.paste_copied`, `PythonComSkillContext.replace`, `PythonComSkillContext.shift_months`, `PythonComSkillContext.sort`, `PythonComSkillContext.write`, `PythonComSkillContext.write_formulas`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
