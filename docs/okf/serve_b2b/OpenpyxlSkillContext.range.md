---
type: method
title: OpenpyxlSkillContext.range
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self, sheet_or_name, address, workbook=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:12897-12905"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_or_name"
  - "address"
  - "workbook"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): self.last_output_address, self.last_output_sheet"
raises: []

# ── 유기적 관계 ──
calls:
  - "Range"
  - "_is_output_workbook"
  - "sheet"
calls_external:
  - "address"
  - "hasattr"
  - "sheet_or_name"
  - "str"
  - "workbook"
called_by:
  - "B2BHandler.proxy"
  - "ExcelSkillContext.pivot"
  - "ExcelWorksheetsProxy.__iter__"
  - "OpenpyxlSkillContext.display_rows"
  - "OpenpyxlSkillContext.pivot"
  - "OpenpyxlSkillContext.sort"
  - "OpenpyxlWorksheetProxy.flush_pending_rows"
  - "PythonComSkillContext._shaped_matrix"
  - "PythonComSkillContext.dedupe"
  - "PythonComSkillContext.pivot"
  - "PythonComSkillContext.shift_months"
  - "PythonComSkillContext.split_column"
  - "_OpxlRange._get_value"
  - "_OpxlRange._set_value"
  - "_OpxlRowProxy.values"
  - "_apply_openpyxl_text_format_for_long_digit_columns"
  - "_configure_excel_grid_window"
  - "_copy_source_workbook_into_target"
  - "_disable_excel_context_menus"
  - "_excel_collection_names"
  - "_excel_output_preview_sheets"
  - "_find_best_pipeline_snapshot"
  - "_hide_vba_editor"
  - "_hide_workbook_windows"
  - "_opxl_range_values"
  - "_park_excel_app_offscreen"
  - "_protect_workbook_for_read_only_mirror"
  - "_read_excel_clipboard_source"
  - "_run_vba_via_runner_with_retry"
  - "compute_sheet_diff"
  - "inspect_workbook_with_excel"
  - "load_workbook_aoa_with_excel"
reads:
  - "self._is_output_workbook"
  - "self.sheet"
writes:
  - "self.last_output_address"
  - "self.last_output_sheet"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): self.last_output_address, self.last_output_sheet
- 변경 상태 `self.last_output_address, self.last_output_sheet` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `Range`, `_is_output_workbook`, `sheet`
- 피호출(영향 전파 경로): `B2BHandler.proxy`, `ExcelSkillContext.pivot`, `ExcelWorksheetsProxy.__iter__`, `OpenpyxlSkillContext.display_rows`, `OpenpyxlSkillContext.pivot`, `OpenpyxlSkillContext.sort`, `OpenpyxlWorksheetProxy.flush_pending_rows`, `PythonComSkillContext._shaped_matrix`, `PythonComSkillContext.dedupe`, `PythonComSkillContext.pivot`, `PythonComSkillContext.shift_months`, `PythonComSkillContext.split_column`, `_OpxlRange._get_value`, `_OpxlRange._set_value`, `_OpxlRowProxy.values`, `_apply_openpyxl_text_format_for_long_digit_columns`, `_configure_excel_grid_window`, `_copy_source_workbook_into_target`, `_disable_excel_context_menus`, `_excel_collection_names`, `_excel_output_preview_sheets`, `_find_best_pipeline_snapshot`, `_hide_vba_editor`, `_hide_workbook_windows`, `_opxl_range_values`, `_park_excel_app_offscreen`, `_protect_workbook_for_read_only_mirror`, `_read_excel_clipboard_source`, `_run_vba_via_runner_with_retry`, `compute_sheet_diff`, `inspect_workbook_with_excel`, `load_workbook_aoa_with_excel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
