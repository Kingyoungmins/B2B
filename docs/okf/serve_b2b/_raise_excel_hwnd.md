---
type: function
title: _raise_excel_hwnd
module: serve_b2b.py
lang: python
extraction: ast
signature: "(hwnd)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "serve_b2b.py:4564-4587"

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
  - "IsIconic"
  - "IsWindow"
  - "SetWindowPos"
  - "ShowWindow"
  - "flags"
  - "getattr"
  - "hwnd"
  - "int"
  - "win32con"
called_by:
  - "_activate_excel_session_impl"
  - "_present_live_session_frame"
  - "_raise_excel_session_impl"
  - "_raise_excel_window"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_activate_excel_session_impl`, `_present_live_session_frame`, `_raise_excel_session_impl`, `_raise_excel_window`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
