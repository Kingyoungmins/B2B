---
type: function
title: excel_call
module: serve_b2b.py
lang: python
extraction: ast
signature: "(fn, *args, timeout=60, **kwargs)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "serve_b2b.py:863-878"

# ── 입출력 ──
inputs:
  - "fn"
  - "timeout"
  - "*args"
  - "**kwargs"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "RuntimeError"
  - "TimeoutError"
  - "result"

# ── 유기적 관계 ──
calls:
  - "ensure_excel_worker"
  - "excel_available"
calls_external:
  - "Queue"
  - "RuntimeError"
  - "TimeoutError"
  - "get"
  - "put"
  - "timeout"
called_by:
  - "B2BHandler.handle_excel_preview_schema"
  - "activate_excel_session"
  - "cleanup_excel_sessions"
  - "close_excel_session"
  - "excel_record_start"
  - "excel_record_stop"
  - "excel_record_verify"
  - "get_excel_hover_info"
  - "hide_all_excel_sessions"
  - "hide_excel_session"
  - "hide_inactive_excel_sessions"
  - "inspect_workbook"
  - "open_excel_session"
  - "poll_excel_session_changes"
  - "poll_excel_session_selection"
  - "position_excel_session"
  - "raise_excel_session"
  - "recover_excel_session"
  - "replace_excel_session_workbook"
  - "run_capture_copypaste"
  - "run_excel_python_pipeline_payload"
  - "run_full_pipeline_single_instance"
  - "run_python_on_session"
  - "run_vba_on_session"
  - "run_vba_pipeline_on_session"
  - "save_excel_session"
  - "show_only_excel_session"
  - "verify_step_isolated"
reads:
  - "EXCEL_QUEUE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `ensure_excel_worker`, `excel_available`
- 피호출(영향 전파 경로): `B2BHandler.handle_excel_preview_schema`, `activate_excel_session`, `cleanup_excel_sessions`, `close_excel_session`, `excel_record_start`, `excel_record_stop`, `excel_record_verify`, `get_excel_hover_info`, `hide_all_excel_sessions`, `hide_excel_session`, `hide_inactive_excel_sessions`, `inspect_workbook`, `open_excel_session`, `poll_excel_session_changes`, `poll_excel_session_selection`, `position_excel_session`, `raise_excel_session`, `recover_excel_session`, `replace_excel_session_workbook`, `run_capture_copypaste`, `run_excel_python_pipeline_payload`, `run_full_pipeline_single_instance`, `run_python_on_session`, `run_vba_on_session`, `run_vba_pipeline_on_session`, `save_excel_session`, `show_only_excel_session`, `verify_step_isolated`

## 실패/예외
- `RuntimeError`
- `TimeoutError`
- `result`
