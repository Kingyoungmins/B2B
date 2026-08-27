---
type: function
title: _excel_process_id
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:4779-4789"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "GetWindowThreadProcessId"
  - "hwnd"
  - "int"
  - "pid"
called_by:
  - "_alias_open_workbook_name"
  - "_clear_workbook_name_aliases"
  - "_commit_pending_excel_cell_edit"
  - "_diag_vba_run_failure"
  - "_get_live_excel_app"
  - "_get_python_skill_app"
  - "_inject_and_run_vba"
  - "_open_excel_session_impl"
  - "_prepare_vba_macro_run_window_state"
  - "_reopen_excel_session_workbook"
  - "_run_full_pipeline_single_instance_impl"
  - "_setup_isolated_pipeline_instance"
  - "_stash_workbook_name_alias"
  - "_track_spawned_excel_app"
  - "_user_facing_workbook_name_for_live"
  - "_verify_step_isolated_impl"
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
- 호출: 없음
- 피호출(영향 전파 경로): `_alias_open_workbook_name`, `_clear_workbook_name_aliases`, `_commit_pending_excel_cell_edit`, `_diag_vba_run_failure`, `_get_live_excel_app`, `_get_python_skill_app`, `_inject_and_run_vba`, `_open_excel_session_impl`, `_prepare_vba_macro_run_window_state`, `_reopen_excel_session_workbook`, `_run_full_pipeline_single_instance_impl`, `_setup_isolated_pipeline_instance`, `_stash_workbook_name_alias`, `_track_spawned_excel_app`, `_user_facing_workbook_name_for_live`, `_verify_step_isolated_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
