---
type: method
title: _OpxlRange.Columns
module: serve_b2b.py
lang: python
extraction: ast
class: _OpxlRange
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:16507-16508"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "_OpxlCount"
called_by:
  - "ExcelSkillContext.sort"
  - "ExcelWorksheetProxy.delete_cols"
  - "ExcelWorksheetProxy.insert_cols"
  - "PythonComSkillContext.delete_cols"
  - "PythonComSkillContext.hide_cols"
  - "PythonComSkillContext.insert_cols"
  - "PythonComSkillContext.sort"
  - "PythonComSkillContext.swap_cols"
reads:
  - "self._c1"
  - "self._c2"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `ExcelSkillContext.sort`, `ExcelWorksheetProxy.delete_cols`, `ExcelWorksheetProxy.insert_cols`, `PythonComSkillContext.delete_cols`, `PythonComSkillContext.hide_cols`, `PythonComSkillContext.insert_cols`, `PythonComSkillContext.sort`, `PythonComSkillContext.swap_cols`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
