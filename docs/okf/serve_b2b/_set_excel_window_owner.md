---
type: function
title: _set_excel_window_owner
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, owner_hwnd)"
role: "(legacy) app.Hwnd 프레임의 owner 지정. frame 모드에서는 세션 프레임 hwnd 에"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:4402-4409"

# ── 입출력 ──
inputs:
  - "app"
  - "owner_hwnd"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_set_window_owner_hwnd"
calls_external:
  - "hwnd"
  - "int"
  - "owner_hwnd"
called_by:
  - "_open_excel_session_impl"
  - "_position_excel_session_impl"
  - "_raise_excel_session_impl"
  - "_replace_excel_session_workbook_impl"
  - "_restore_live_window"
  - "_show_only_excel_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(legacy) app.Hwnd 프레임의 owner 지정. frame 모드에서는 세션 프레임 hwnd 에

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_set_window_owner_hwnd`
- 피호출(영향 전파 경로): `_open_excel_session_impl`, `_position_excel_session_impl`, `_raise_excel_session_impl`, `_replace_excel_session_workbook_impl`, `_restore_live_window`, `_show_only_excel_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
