---
type: function
title: _protect_workbook_for_read_only_mirror
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb, enabled=True)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:3419-3436"

# ── 입출력 ──
inputs:
  - "wb"
  - "enabled"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_protect_sheet_for_read_only_mirror"
  - "_recording_edit_unlock_active"
  - "range"
calls_external:
  - "EXCEL_MIRROR_PROTECT_PASSWORD"
  - "Unprotect"
  - "idx"
  - "ws"
called_by:
  - "_open_excel_session_impl"
  - "_present_live_session_frame"
  - "_reopen_excel_session_workbook"
  - "_replace_excel_session_workbook_impl"
  - "_restore_live_protected_view"
  - "_run_excel_python_pipeline_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_python_on_session_impl"
  - "_run_vba_on_session_impl"
  - "_run_vba_pipeline_on_session_impl"
  - "_save_excel_session_impl"
  - "_set_live_sessions_edit_unlock"
  - "_sync_modified_companions_into_live"
  - "_verify_step_isolated_impl"
reads:
  - "EXCEL_MIRROR_PROTECT_PASSWORD"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Worksheets`, `_protect_sheet_for_read_only_mirror`, `_recording_edit_unlock_active`, `range`
- 피호출(영향 전파 경로): `_open_excel_session_impl`, `_present_live_session_frame`, `_reopen_excel_session_workbook`, `_replace_excel_session_workbook_impl`, `_restore_live_protected_view`, `_run_excel_python_pipeline_impl`, `_run_full_pipeline_single_instance_impl`, `_run_python_on_session_impl`, `_run_vba_on_session_impl`, `_run_vba_pipeline_on_session_impl`, `_save_excel_session_impl`, `_set_live_sessions_edit_unlock`, `_sync_modified_companions_into_live`, `_verify_step_isolated_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
