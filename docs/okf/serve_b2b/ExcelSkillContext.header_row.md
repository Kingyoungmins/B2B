---
type: method
title: ExcelSkillContext.header_row
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, sheet_or_name, workbook=None, header_rows=20)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:16806-16814"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_or_name"
  - "workbook"
  - "header_rows"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "rows"
calls_external:
  - "enumerate"
  - "sheet_or_name"
  - "sum"
  - "workbook"
called_by:
  - "ExcelSkillContext.data_start_row"
  - "ExcelSkillContext.pivot"
  - "OpenpyxlSkillContext.data_start_row"
  - "OpenpyxlSkillContext.pivot"
  - "PythonComSkillContext._filter_to_sheet_native"
  - "PythonComSkillContext._resolve_col"
  - "PythonComSkillContext.add_total_row"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.copy_col"
  - "PythonComSkillContext.dedupe"
  - "PythonComSkillContext.fill_sum_col"
  - "PythonComSkillContext.find_header"
  - "PythonComSkillContext.lookup"
  - "PythonComSkillContext.move_col_clear"
  - "PythonComSkillContext.split_column"
  - "PythonComSkillContext.sum_column"
  - "PythonComSkillContext.sum_lookup"
  - "PythonComSkillContext.sum_where"
reads:
  - "self.rows"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `rows`
- 피호출(영향 전파 경로): `ExcelSkillContext.data_start_row`, `ExcelSkillContext.pivot`, `OpenpyxlSkillContext.data_start_row`, `OpenpyxlSkillContext.pivot`, `PythonComSkillContext._filter_to_sheet_native`, `PythonComSkillContext._resolve_col`, `PythonComSkillContext.add_total_row`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.copy_col`, `PythonComSkillContext.dedupe`, `PythonComSkillContext.fill_sum_col`, `PythonComSkillContext.find_header`, `PythonComSkillContext.lookup`, `PythonComSkillContext.move_col_clear`, `PythonComSkillContext.split_column`, `PythonComSkillContext.sum_column`, `PythonComSkillContext.sum_lookup`, `PythonComSkillContext.sum_where`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
