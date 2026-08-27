---
type: function
title: _hide_peer_session_frames
module: serve_b2b.py
lang: python
extraction: ast
signature: "(active_excel_id, host_hwnd=None)"
role: "frame 모드: 활성 세션 외 라이브 프레임을 전부 화면 밖으로 파킹."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:7149-7170"

# ── 입출력 ──
inputs:
  - "active_excel_id"
  - "host_hwnd"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_handoff_foreground_to_host"
  - "_move_hwnd_offscreen"
  - "_session_frame_hwnd"
  - "append"
calls_external:
  - "get"
  - "host_hwnd"
  - "hwnd"
  - "items"
  - "list"
  - "other"
  - "sid"
called_by:
  - "_present_live_session_frame"
reads:
  - "EXCEL_SESSIONS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
frame 모드: 활성 세션 외 라이브 프레임을 전부 화면 밖으로 파킹.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_handoff_foreground_to_host`, `_move_hwnd_offscreen`, `_session_frame_hwnd`, `append`
- 피호출(영향 전파 경로): `_present_live_session_frame`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
