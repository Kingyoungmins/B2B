---
type: function
title: _session_frame_hwnd
module: serve_b2b.py
lang: python
extraction: ast
signature: "(session, wb=None)"
role: "세션 워크북의 프레임 핸들(캐시). recover/replace 로 워크북이 바뀌면 자동 재조회."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:6344-6357"

# ── 입출력 ──
inputs:
  - "session"
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_workbook_window_hwnd"
calls_external:
  - "IsWindow"
  - "get"
  - "hwnd"
  - "int"
  - "wb"
called_by:
  - "_activate_excel_session_impl"
  - "_hide_all_excel_sessions_impl"
  - "_hide_excel_session_impl"
  - "_hide_peer_session_frames"
  - "_position_excel_session_impl"
  - "_present_live_session_frame"
  - "_raise_excel_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
세션 워크북의 프레임 핸들(캐시). recover/replace 로 워크북이 바뀌면 자동 재조회.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_workbook_window_hwnd`
- 피호출(영향 전파 경로): `_activate_excel_session_impl`, `_hide_all_excel_sessions_impl`, `_hide_excel_session_impl`, `_hide_peer_session_frames`, `_position_excel_session_impl`, `_present_live_session_frame`, `_raise_excel_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
