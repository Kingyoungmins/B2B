---
type: function
title: _show_window_na
module: serve_b2b.py
lang: python
extraction: ast
signature: "(hwnd)"
role: "창을 활성화 없이 표시(SW_SHOWNA). 포커스는 현재 창(호스트)에 그대로 남는다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:4013-4023"

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
  - "IsWindow"
  - "ShowWindow"
  - "getattr"
  - "hwnd"
  - "int"
  - "win32con"
called_by:
  - "_activate_excel_session_impl"
  - "_open_excel_session_impl"
  - "_present_live_session_frame"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
창을 활성화 없이 표시(SW_SHOWNA). 포커스는 현재 창(호스트)에 그대로 남는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_activate_excel_session_impl`, `_open_excel_session_impl`, `_present_live_session_frame`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
