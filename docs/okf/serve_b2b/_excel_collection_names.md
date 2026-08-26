---
type: function
title: _excel_collection_names
module: serve_b2b.py
lang: python
extraction: ast
signature: "(collection)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:3481-3495"

# ── 입출력 ──
inputs:
  - "collection"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Item"
  - "append"
  - "range"
calls_external:
  - "getattr"
  - "idx"
  - "int"
  - "item"
  - "name"
  - "str"
called_by:
  - "ExcelWorksheetsProxy.names"
  - "PythonComSkillContext._filter_to_sheet_native"
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext._ws"
  - "PythonComSkillContext.add_sheet"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.copy_sheet"
  - "PythonComSkillContext.filter_to_sheet"
  - "PythonComSkillContext.native_pivot"
  - "PythonComSkillContext.pivot"
  - "PythonComSkillContext.rename_sheet"
  - "PythonComSkillContext.sheets"
  - "_activate_excel_session_impl"
  - "_active_sheet_name"
  - "_active_sheet_snapshot"
  - "_alias_ephemeral_excel_open_sheet_name"
  - "_capture_live_view_state"
  - "_excel_names"
  - "_excel_output_preview_sheets"
  - "_live_preview_schema"
  - "_open_excel_session_impl"
  - "_poll_excel_session_changes_impl"
  - "_replace_excel_session_workbook_impl"
  - "_restore_live_view_state"
  - "_run_vba_pipeline_on_session_impl"
  - "_trace_workbook_info"
  - "inspect_workbook_with_excel"
  - "refresh_excel_session_snapshots"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `Item`, `append`, `range`
- 피호출(영향 전파 경로): `ExcelWorksheetsProxy.names`, `PythonComSkillContext._filter_to_sheet_native`, `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext._ws`, `PythonComSkillContext.add_sheet`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.copy_sheet`, `PythonComSkillContext.filter_to_sheet`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.pivot`, `PythonComSkillContext.rename_sheet`, `PythonComSkillContext.sheets`, `_activate_excel_session_impl`, `_active_sheet_name`, `_active_sheet_snapshot`, `_alias_ephemeral_excel_open_sheet_name`, `_capture_live_view_state`, `_excel_names`, `_excel_output_preview_sheets`, `_live_preview_schema`, `_open_excel_session_impl`, `_poll_excel_session_changes_impl`, `_replace_excel_session_workbook_impl`, `_restore_live_view_state`, `_run_vba_pipeline_on_session_impl`, `_trace_workbook_info`, `inspect_workbook_with_excel`, `refresh_excel_session_snapshots`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
