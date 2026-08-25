---
type: function
title: _move_hwnd_offscreen
module: serve_b2b.py
lang: python
extraction: ast
signature: "(hwnd)"
role: "프레임을 숨기지 않고 화면 밖(-32000)으로만 이동(WS_VISIBLE 유지)."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:4425-4443"

# ── 입출력 ──
inputs:
  - "hwnd"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_unmaximize_hwnd_no_activate"
calls_external:
  - "IsWindow"
  - "SetWindowPos"
  - "flags"
  - "getattr"
  - "hwnd"
  - "int"
  - "win32con"
called_by:
  - "_hide_all_excel_sessions_impl"
  - "_hide_excel_session_impl"
  - "_hide_peer_session_frames"
  - "_open_excel_session_impl"
  - "_reopen_excel_session_workbook"
  - "_replace_excel_session_workbook_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
프레임을 숨기지 않고 화면 밖(-32000)으로만 이동(WS_VISIBLE 유지).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_unmaximize_hwnd_no_activate`
- 피호출(영향 전파 경로): `_hide_all_excel_sessions_impl`, `_hide_excel_session_impl`, `_hide_peer_session_frames`, `_open_excel_session_impl`, `_reopen_excel_session_workbook`, `_replace_excel_session_workbook_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
