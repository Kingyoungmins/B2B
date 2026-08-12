---
type: function
title: _restore_live_window
module: serve_b2b.py
lang: python
extraction: ast
signature: "(session, app, wb)"
role: "리셋(_copy_source_workbook_into_target)으로 offscreen park 된 라이브 창을 owner 모드 방식으로"
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:9219-9261"

# ── 입출력 ──
inputs:
  - "session"
  - "app"
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_ensure_excel_workbook_view"
  - "_hide_non_target_workbook_windows"
  - "_position_excel_window"
  - "_present_live_session_frame"
  - "_set_excel_window_owner"
calls_external:
  - "Activate"
  - "app"
  - "get"
  - "height"
  - "left"
  - "session"
  - "top"
  - "wb"
  - "width"
called_by:
  - "_recover_excel_session_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_python_on_session_impl"
  - "_run_vba_on_session_impl"
  - "_run_vba_pipeline_on_session_impl"
  - "_sync_modified_companions_into_live"
reads:
  - "LIVE_FRAME_MODE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
리셋(_copy_source_workbook_into_target)으로 offscreen park 된 라이브 창을 owner 모드 방식으로

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_ensure_excel_workbook_view`, `_hide_non_target_workbook_windows`, `_position_excel_window`, `_present_live_session_frame`, `_set_excel_window_owner`
- 피호출(영향 전파 경로): `_recover_excel_session_impl`, `_run_full_pipeline_single_instance_impl`, `_run_python_on_session_impl`, `_run_vba_on_session_impl`, `_run_vba_pipeline_on_session_impl`, `_sync_modified_companions_into_live`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
