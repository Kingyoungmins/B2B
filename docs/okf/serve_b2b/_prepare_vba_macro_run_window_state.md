---
type: function
title: _prepare_vba_macro_run_window_state
module: serve_b2b.py
lang: python
extraction: ast
signature: "(session, app, wb)"
role: "Put Excel into the same non-visible state that reliably allows Application.Run."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:19240-19267"

# ── 입출력 ──
inputs:
  - "session"
  - "app"
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_process_id"
  - "_hide_excel_app_window"
  - "_hide_excel_windows_for_pid"
  - "_hide_workbook_windows"
calls_external:
  - "app"
  - "get"
  - "pid"
  - "wb"
called_by:
  - "_run_vba_on_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
Put Excel into the same non-visible state that reliably allows Application.Run.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_excel_process_id`, `_hide_excel_app_window`, `_hide_excel_windows_for_pid`, `_hide_workbook_windows`
- 피호출(영향 전파 경로): `_run_vba_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
