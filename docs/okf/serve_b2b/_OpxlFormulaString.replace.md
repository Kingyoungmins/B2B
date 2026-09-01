---
type: method
title: _OpxlFormulaString.replace
module: serve_b2b.py
lang: python
extraction: ast
class: _OpxlFormulaString
signature: "(self, old, new, count=-1)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "serve_b2b.py:18449-18459"

# ── 입출력 ──
inputs:
  - "self"
  - "old"
  - "new"
  - "count"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "value"
calls_external:
  - "_OpxlFormulaString"
  - "count"
  - "getattr"
  - "new"
  - "old"
  - "self"
  - "super"
called_by:
  - "ExcelSkillContext._num"
  - "OpenpyxlSkillContext._num"
  - "OpenpyxlWorksheetProxy.Range"
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext.set_border"
  - "_basename"
  - "_capture_browser_hwnd"
  - "_capture_copypaste_on_session_impl"
  - "_capture_live_view_state"
  - "_clean_name"
  - "_coerce_number"
  - "_diag_vba_run_failure"
  - "_drop_dead_typing_lines"
  - "_extract_vba_source_for_injection"
  - "_inject_and_run_vba_in_host"
  - "_normalize_base"
  - "_normalize_vba_workbook_literals"
  - "_opxl_coord"
  - "_opxl_eval_formula"
  - "_opxl_numeric_values"
  - "_opxl_range_values"
  - "_pivot_to_num"
  - "_poll_excel_session_changes_impl"
  - "_range_formula_info"
  - "_read_excel_session_selection_impl"
  - "_recover_excel_session_impl"
  - "_trace_text"
  - "_vba_macro_ref"
  - "_vba_macro_refs"
  - "_vba_string_literal"
  - "_workbook_name_lookup_key"
  - "default_account"
  - "normalize_python_pipeline_code"
  - "safe_archive_filename"
  - "sheet_merge_areas"
  - "skill_docs_from_zip"
  - "stop_native_recording_impl"
reads:
  - "self._b2b_origin_col"
  - "self._b2b_origin_row"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `value`
- 피호출(영향 전파 경로): `ExcelSkillContext._num`, `OpenpyxlSkillContext._num`, `OpenpyxlWorksheetProxy.Range`, `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext.set_border`, `_basename`, `_capture_browser_hwnd`, `_capture_copypaste_on_session_impl`, `_capture_live_view_state`, `_clean_name`, `_coerce_number`, `_diag_vba_run_failure`, `_drop_dead_typing_lines`, `_extract_vba_source_for_injection`, `_inject_and_run_vba_in_host`, `_normalize_base`, `_normalize_vba_workbook_literals`, `_opxl_coord`, `_opxl_eval_formula`, `_opxl_numeric_values`, `_opxl_range_values`, `_pivot_to_num`, `_poll_excel_session_changes_impl`, `_range_formula_info`, `_read_excel_session_selection_impl`, `_recover_excel_session_impl`, `_trace_text`, `_vba_macro_ref`, `_vba_macro_refs`, `_vba_string_literal`, `_workbook_name_lookup_key`, `default_account`, `normalize_python_pipeline_code`, `safe_archive_filename`, `sheet_merge_areas`, `skill_docs_from_zip`, `stop_native_recording_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
