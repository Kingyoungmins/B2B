---
type: method
title: ExcelWorkbookProxy.Worksheets
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelWorkbookProxy
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:15896-15897"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "ExcelWorksheetsProxy"
called_by:
  - "ExcelSkillContext.add_sheet"
  - "ExcelSkillContext.input_sheet"
  - "ExcelSkillContext.sheet"
  - "PythonComSkillContext._rollback"
  - "PythonComSkillContext._ws"
  - "PythonComSkillContext.add_sheet"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.copy_sheet"
  - "PythonComSkillContext.native_pivot"
  - "PythonComSkillContext.pivot"
  - "_activate_excel_session_impl"
  - "_active_sheet_snapshot"
  - "_capture_copypaste_on_session_impl"
  - "_configure_excel_grid_window"
  - "_copy_source_workbook_into_target"
  - "_excel_output_preview_sheets"
  - "_live_preview_schema"
  - "_poll_excel_session_changes_impl"
  - "_protect_workbook_for_read_only_mirror"
  - "_replace_excel_session_workbook_impl"
  - "_restore_live_view_state"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_vba_pipeline_on_session_impl"
  - "_verify_capture_sheet_aoa"
  - "_verify_recorded_expected_live"
  - "inspect_workbook_with_excel"
  - "load_workbook_aoa_with_excel"
  - "refresh_excel_session_snapshots"
reads:
  - "self._ctx"
  - "self._workbook"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `ExcelSkillContext.add_sheet`, `ExcelSkillContext.input_sheet`, `ExcelSkillContext.sheet`, `PythonComSkillContext._rollback`, `PythonComSkillContext._ws`, `PythonComSkillContext.add_sheet`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.copy_sheet`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.pivot`, `_activate_excel_session_impl`, `_active_sheet_snapshot`, `_capture_copypaste_on_session_impl`, `_configure_excel_grid_window`, `_copy_source_workbook_into_target`, `_excel_output_preview_sheets`, `_live_preview_schema`, `_poll_excel_session_changes_impl`, `_protect_workbook_for_read_only_mirror`, `_replace_excel_session_workbook_impl`, `_restore_live_view_state`, `_run_full_pipeline_single_instance_impl`, `_run_vba_pipeline_on_session_impl`, `_verify_capture_sheet_aoa`, `_verify_recorded_expected_live`, `inspect_workbook_with_excel`, `load_workbook_aoa_with_excel`, `refresh_excel_session_snapshots`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
