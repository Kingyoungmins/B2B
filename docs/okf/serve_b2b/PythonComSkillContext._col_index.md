---
type: method
title: PythonComSkillContext._col_index
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(letter)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:12290-12296"

# ── 입출력 ──
inputs:
  - "letter"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls: []
calls_external:
  - "PythonComSkillError"
  - "ch"
  - "letter"
  - "ord"
  - "str"
  - "strip"
  - "upper"
called_by:
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext._resolve_col"
  - "PythonComSkillContext.apply_filter"
  - "PythonComSkillContext.delete_cols"
  - "PythonComSkillContext.first_empty_col"
  - "PythonComSkillContext.insert_cols"
  - "PythonComSkillContext.match_fill"
  - "PythonComSkillContext.move_cols"
  - "PythonComSkillContext.native_pivot"
  - "PythonComSkillContext.sort"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext._resolve_col`, `PythonComSkillContext.apply_filter`, `PythonComSkillContext.delete_cols`, `PythonComSkillContext.first_empty_col`, `PythonComSkillContext.insert_cols`, `PythonComSkillContext.match_fill`, `PythonComSkillContext.move_cols`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.sort`

## 실패/예외
- `PythonComSkillError`
