---
type: method
title: OpenpyxlSkillContext.add_sheet
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self, name, workbook=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:18297-18315"

# ── 입출력 ──
inputs:
  - "self"
  - "name"
  - "workbook"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): self.last_output_sheet"
raises: []

# ── 유기적 관계 ──
calls:
  - "_default_workbook"
  - "_is_output_workbook"
  - "_unwrap_workbook"
  - "add"
  - "normalize"
calls_external:
  - "OpenpyxlWorksheetProxy"
  - "create_sheet"
  - "final"
  - "id"
  - "idx"
  - "len"
  - "max"
  - "n"
  - "name"
  - "raw_ws"
  - "str"
  - "sub"
  - "suffix"
  - "wb"
called_by:
  - "ExcelSkillContext.filter_to_sheet"
  - "ExcelSkillContext.pivot"
  - "OpenpyxlSkillContext.filter_to_sheet"
  - "OpenpyxlSkillContext.pivot"
  - "PythonComSkillContext._filter_to_sheet_native"
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext.filter_to_sheet"
  - "PythonComSkillContext.native_pivot"
  - "_OpenpyxlSheetsProxy.add"
reads:
  - "self._default_workbook"
  - "self._dirty_workbook_ids"
  - "self._is_output_workbook"
  - "self._unwrap_workbook"
  - "self.normalize"
writes:
  - "self.last_output_sheet"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): self.last_output_sheet
- 변경 상태 `self.last_output_sheet` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_default_workbook`, `_is_output_workbook`, `_unwrap_workbook`, `add`, `normalize`
- 피호출(영향 전파 경로): `ExcelSkillContext.filter_to_sheet`, `ExcelSkillContext.pivot`, `OpenpyxlSkillContext.filter_to_sheet`, `OpenpyxlSkillContext.pivot`, `PythonComSkillContext._filter_to_sheet_native`, `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext.filter_to_sheet`, `PythonComSkillContext.native_pivot`, `_OpenpyxlSheetsProxy.add`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
