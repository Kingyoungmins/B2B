---
type: function
title: _hide_excel_session_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:7737-7753"

# ── 입출력 ──
inputs:
  - "excel_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
raises: []

# ── 유기적 관계 ──
calls:
  - "_handoff_foreground_to_host"
  - "_hide_excel_app_window"
  - "_move_hwnd_offscreen"
  - "_session_frame_hwnd"
  - "get_excel_session"
  - "session_workbook"
calls_external:
  - "app"
  - "excel_id"
  - "get"
  - "hwnd"
  - "session"
  - "wb"
called_by:
  - "hide_excel_session"
reads:
  - "EXCEL_LOCK"
  - "LIVE_FRAME_MODE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화

## 관계
- 호출: `_handoff_foreground_to_host`, `_hide_excel_app_window`, `_move_hwnd_offscreen`, `_session_frame_hwnd`, `get_excel_session`, `session_workbook`
- 피호출(영향 전파 경로): `hide_excel_session`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
