---
type: method
title: PythonComSkillContext.normalize
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, value)"
role: "값 비교용 정규화. 공백/대소문자 차이와 함께 **숫자/글자 저장 차이도 흡수**한다"
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:14390-14393"

# ── 입출력 ──
inputs:
  - "self"
  - "value"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "normalize_value_key"
  - "value"
calls_external: []
called_by:
  - "ExcelSkillContext._col0"
  - "ExcelSkillContext._find_sheet_name"
  - "ExcelSkillContext._merge_pivot_grid_into_base"
  - "ExcelSkillContext.add_sheet"
  - "ExcelSkillContext.col"
  - "ExcelSkillContext.workbook_like"
  - "OpenpyxlSkillContext._col0"
  - "OpenpyxlSkillContext._find_sheet_name"
  - "OpenpyxlSkillContext._merge_pivot_grid_into_base"
  - "OpenpyxlSkillContext.add_sheet"
  - "OpenpyxlSkillContext.col"
  - "OpenpyxlSkillContext.sort"
  - "OpenpyxlSkillContext.workbook_like"
  - "PythonComSkillContext._mark_mutated"
  - "PythonComSkillContext.dedupe"
  - "PythonComSkillContext.lookup"
  - "_companion_excel_ids_for_books"
  - "_fullrun_excel_ids_for_books"
  - "_live_session_excel_ids_for_books"
  - "_sync_modified_companions_into_live"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
값 비교용 정규화. 공백/대소문자 차이와 함께 **숫자/글자 저장 차이도 흡수**한다

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `normalize_value_key`, `value`
- 피호출(영향 전파 경로): `ExcelSkillContext._col0`, `ExcelSkillContext._find_sheet_name`, `ExcelSkillContext._merge_pivot_grid_into_base`, `ExcelSkillContext.add_sheet`, `ExcelSkillContext.col`, `ExcelSkillContext.workbook_like`, `OpenpyxlSkillContext._col0`, `OpenpyxlSkillContext._find_sheet_name`, `OpenpyxlSkillContext._merge_pivot_grid_into_base`, `OpenpyxlSkillContext.add_sheet`, `OpenpyxlSkillContext.col`, `OpenpyxlSkillContext.sort`, `OpenpyxlSkillContext.workbook_like`, `PythonComSkillContext._mark_mutated`, `PythonComSkillContext.dedupe`, `PythonComSkillContext.lookup`, `_companion_excel_ids_for_books`, `_fullrun_excel_ids_for_books`, `_live_session_excel_ids_for_books`, `_sync_modified_companions_into_live`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
