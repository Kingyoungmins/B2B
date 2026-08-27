---
type: method
title: OpenpyxlSkillContext._ws_of
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self, sheet_or_name, workbook=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:18823-18824"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_or_name"
  - "workbook"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "sheet"
calls_external:
  - "hasattr"
  - "sheet_or_name"
  - "workbook"
called_by:
  - "ExcelSkillContext.filter_to_sheet"
  - "ExcelSkillContext.iter_rows"
  - "ExcelSkillContext.pivot"
  - "ExcelSkillContext.set_range"
  - "ExcelSkillContext.sort"
  - "ExcelSkillContext.value"
  - "ExcelSkillContext.write_grid"
  - "OpenpyxlSkillContext.display_rows"
  - "OpenpyxlSkillContext.filter_to_sheet"
  - "OpenpyxlSkillContext.pivot"
  - "OpenpyxlSkillContext.rows"
  - "OpenpyxlSkillContext.set_range"
  - "OpenpyxlSkillContext.sort"
  - "OpenpyxlSkillContext.value"
  - "OpenpyxlSkillContext.write_grid"
reads:
  - "self.sheet"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `sheet`
- 피호출(영향 전파 경로): `ExcelSkillContext.filter_to_sheet`, `ExcelSkillContext.iter_rows`, `ExcelSkillContext.pivot`, `ExcelSkillContext.set_range`, `ExcelSkillContext.sort`, `ExcelSkillContext.value`, `ExcelSkillContext.write_grid`, `OpenpyxlSkillContext.display_rows`, `OpenpyxlSkillContext.filter_to_sheet`, `OpenpyxlSkillContext.pivot`, `OpenpyxlSkillContext.rows`, `OpenpyxlSkillContext.set_range`, `OpenpyxlSkillContext.sort`, `OpenpyxlSkillContext.value`, `OpenpyxlSkillContext.write_grid`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
