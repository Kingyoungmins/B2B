---
type: method
title: OpenpyxlWorksheetProxy.Cells
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlWorksheetProxy
signature: "(self, r, c)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:12473-12475"

# ── 입출력 ──
inputs:
  - "self"
  - "r"
  - "c"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "flush_pending_rows"
calls_external:
  - "_OpxlRange"
  - "c"
  - "r"
called_by:
  - "ExcelSkillContext._write_grid"
  - "ExcelSkillContext.set_range"
  - "ExcelSkillContext.value"
  - "ExcelWorksheetProxy.append"
  - "ExcelWorksheetProxy.cell"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.find_header"
  - "PythonComSkillContext.last_col"
  - "PythonComSkillContext.last_row"
  - "PythonComSkillContext.paste_copied"
  - "PythonComSkillContext.shift_months"
  - "_apply_com_text_format_for_long_digit_columns"
  - "_capture_copypaste_on_session_impl"
  - "_excel_output_preview_sheets"
  - "_live_preview_schema"
  - "_range_formula_info"
  - "_sheet_snapshot"
  - "inspect_workbook_with_excel"
  - "load_workbook_aoa_with_excel"
reads:
  - "self._ws"
  - "self.flush_pending_rows"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `flush_pending_rows`
- 피호출(영향 전파 경로): `ExcelSkillContext._write_grid`, `ExcelSkillContext.set_range`, `ExcelSkillContext.value`, `ExcelWorksheetProxy.append`, `ExcelWorksheetProxy.cell`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.find_header`, `PythonComSkillContext.last_col`, `PythonComSkillContext.last_row`, `PythonComSkillContext.paste_copied`, `PythonComSkillContext.shift_months`, `_apply_com_text_format_for_long_digit_columns`, `_capture_copypaste_on_session_impl`, `_excel_output_preview_sheets`, `_live_preview_schema`, `_range_formula_info`, `_sheet_snapshot`, `inspect_workbook_with_excel`, `load_workbook_aoa_with_excel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
