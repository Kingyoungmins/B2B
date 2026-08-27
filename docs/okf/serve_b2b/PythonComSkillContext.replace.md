---
type: method
title: PythonComSkillContext.replace
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_range, find, repl, match_entire=False)"
role: "범위 안 셀에서 find 를 repl 로 바꾼다(부분 치환, match_entire=True면 셀 전체 일치만). 수식 셀은 보존."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:15455-15493"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1_range"
  - "find"
  - "repl"
  - "match_entire"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_journal_save"
  - "_range_matrix"
  - "_rng"
  - "_tick"
  - "_ws"
  - "append"
  - "row"
  - "sheet"
calls_external:
  - "a1_range"
  - "enumerate"
  - "fcell"
  - "find"
  - "find_s"
  - "formulas"
  - "isinstance"
  - "len"
  - "orow"
  - "repl"
  - "repl_s"
  - "rng"
  - "startswith"
  - "str"
  - "v"
  - "vals"
  - "ws"
called_by:
  - "ExcelSkillContext._num"
  - "OpenpyxlSkillContext._num"
  - "OpenpyxlWorksheetProxy.Range"
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext.set_border"
  - "_capture_browser_hwnd"
  - "_capture_copypaste_on_session_impl"
  - "_capture_live_view_state"
  - "_coerce_number"
  - "_diag_vba_run_failure"
  - "_extract_vba_source_for_injection"
  - "_inject_and_run_vba_in_host"
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
  - "normalize_python_pipeline_code"
  - "safe_archive_filename"
reads:
  - "self._journal_save"
  - "self._rng"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
범위 안 셀에서 find 를 repl 로 바꾼다(부분 치환, match_entire=True면 셀 전체 일치만). 수식 셀은 보존.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_journal_save`, `_range_matrix`, `_rng`, `_tick`, `_ws`, `append`, `row`, `sheet`
- 피호출(영향 전파 경로): `ExcelSkillContext._num`, `OpenpyxlSkillContext._num`, `OpenpyxlWorksheetProxy.Range`, `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext.set_border`, `_capture_browser_hwnd`, `_capture_copypaste_on_session_impl`, `_capture_live_view_state`, `_coerce_number`, `_diag_vba_run_failure`, `_extract_vba_source_for_injection`, `_inject_and_run_vba_in_host`, `_normalize_vba_workbook_literals`, `_opxl_coord`, `_opxl_eval_formula`, `_opxl_numeric_values`, `_opxl_range_values`, `_pivot_to_num`, `_poll_excel_session_changes_impl`, `_range_formula_info`, `_read_excel_session_selection_impl`, `_recover_excel_session_impl`, `_trace_text`, `_vba_macro_ref`, `_vba_macro_refs`, `_vba_string_literal`, `_workbook_name_lookup_key`, `normalize_python_pipeline_code`, `safe_archive_filename`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
