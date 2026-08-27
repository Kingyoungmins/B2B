---
type: function
title: _hide_excel_app_window
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:20141-20150"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_hide_excel_hwnd"
  - "_park_excel_app_offscreen"
calls_external:
  - "app"
called_by:
  - "_close_excel_session_impl"
  - "_copy_source_workbook_into_target"
  - "_get_python_skill_app"
  - "_hide_all_excel_sessions_impl"
  - "_hide_excel_session_impl"
  - "_open_excel_workbook_for_skill"
  - "_prepare_excel_session_for_close"
  - "_prepare_vba_macro_run_window_state"
  - "_replace_excel_session_workbook_impl"
  - "_run_excel_python_pipeline_impl"
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
- 호출: `_hide_excel_hwnd`, `_park_excel_app_offscreen`
- 피호출(영향 전파 경로): `_close_excel_session_impl`, `_copy_source_workbook_into_target`, `_get_python_skill_app`, `_hide_all_excel_sessions_impl`, `_hide_excel_session_impl`, `_open_excel_workbook_for_skill`, `_prepare_excel_session_for_close`, `_prepare_vba_macro_run_window_state`, `_replace_excel_session_workbook_impl`, `_run_excel_python_pipeline_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
