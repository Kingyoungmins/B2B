---
type: function
title: _style_live_frame
module: serve_b2b.py
lang: python
extraction: ast
signature: "(hwnd)"
role: "라이브 프레임을 작업표시줄/Alt+Tab 목록에서 제외(WS_EX_TOOLWINDOW, WS_EX_APPWINDOW 제거)."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:4135-4156"

# ── 입출력 ──
inputs:
  - "hwnd"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "GetWindowLong"
  - "IsWindow"
  - "SetWindowLong"
  - "SetWindowPos"
  - "desired"
  - "flags"
  - "getattr"
  - "hwnd"
  - "int"
  - "win32con"
called_by:
  - "_open_excel_session_impl"
  - "_present_live_session_frame"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
라이브 프레임을 작업표시줄/Alt+Tab 목록에서 제외(WS_EX_TOOLWINDOW, WS_EX_APPWINDOW 제거).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_open_excel_session_impl`, `_present_live_session_frame`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
