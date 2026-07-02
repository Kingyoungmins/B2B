---
type: method
title: ExcelSkillContext._ws_of
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, sheet_or_name, workbook=None)"
role: "---- 정렬 / 필터 / 피벗 헬퍼 (자주 쓰는 작업을 안정적으로) ----"
role_source: banner
version: "0.5.18"
loc: "serve_b2b.py:11506-11507"

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
timestamp: "0.5.18-gen"
---

## 역할
---- 정렬 / 필터 / 피벗 헬퍼 (자주 쓰는 작업을 안정적으로) ----

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `sheet`
- 피호출(영향 전파 경로): `ExcelSkillContext.filter_to_sheet`, `ExcelSkillContext.iter_rows`, `ExcelSkillContext.pivot`, `ExcelSkillContext.set_range`, `ExcelSkillContext.sort`, `ExcelSkillContext.value`, `ExcelSkillContext.write_grid`, `OpenpyxlSkillContext.display_rows`, `OpenpyxlSkillContext.filter_to_sheet`, `OpenpyxlSkillContext.pivot`, `OpenpyxlSkillContext.rows`, `OpenpyxlSkillContext.set_range`, `OpenpyxlSkillContext.sort`, `OpenpyxlSkillContext.value`, `OpenpyxlSkillContext.write_grid`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
