---
type: function
title: _set_window_owner_hwnd
module: serve_b2b.py
lang: python
extraction: ast
signature: "(hwnd, owner_hwnd)"
role: "지정한 최상위 창의 소유자(owner)를 지정/해제한다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:4321-4350"

# ── 입출력 ──
inputs:
  - "hwnd"
  - "owner_hwnd"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "IsWindow"
  - "SetWindowLong"
  - "getattr"
  - "hwnd"
  - "int"
  - "owner"
  - "owner_hwnd"
  - "win32con"
called_by:
  - "_open_excel_session_impl"
  - "_position_excel_session_impl"
  - "_present_live_session_frame"
  - "_raise_excel_session_impl"
  - "_set_excel_window_owner"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
지정한 최상위 창의 소유자(owner)를 지정/해제한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_open_excel_session_impl`, `_position_excel_session_impl`, `_present_live_session_frame`, `_raise_excel_session_impl`, `_set_excel_window_owner`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
