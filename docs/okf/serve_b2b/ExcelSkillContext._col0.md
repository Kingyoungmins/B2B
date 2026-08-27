---
type: method
title: ExcelSkillContext._col0
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, rows, name_or_idx, header_rows=20)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:17421-17435"

# ── 입출력 ──
inputs:
  - "self"
  - "rows"
  - "name_or_idx"
  - "header_rows"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "normalize"
calls_external:
  - "enumerate"
  - "int"
  - "isinstance"
  - "max"
  - "name_or_idx"
  - "v"
called_by:
  - "ExcelSkillContext.pivot"
  - "ExcelSkillContext.sort"
  - "OpenpyxlSkillContext.pivot"
  - "OpenpyxlSkillContext.sort"
  - "PythonComSkillContext._pivot_value_table"
reads:
  - "self.normalize"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `normalize`
- 피호출(영향 전파 경로): `ExcelSkillContext.pivot`, `ExcelSkillContext.sort`, `OpenpyxlSkillContext.pivot`, `OpenpyxlSkillContext.sort`, `PythonComSkillContext._pivot_value_table`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
