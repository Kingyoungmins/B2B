---
type: function
title: _handoff_foreground_to_host
module: serve_b2b.py
lang: python
extraction: ast
signature: "(host_hwnd, hwnds)"
role: "숨기거나 파킹하려는 프레임이 현재 포그라운드면, OS 가 다음 활성 창을 임의로 고르기 전에"
role_source: docstring
version: "0.5.19"
loc: "serve_b2b.py:3104-3141"

# ── 입출력 ──
inputs:
  - "host_hwnd"
  - "hwnds"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "AttachThreadInput"
  - "GetCurrentThreadId"
  - "GetForegroundWindow"
  - "GetWindowThreadProcessId"
  - "IsWindow"
  - "SetForegroundWindow"
  - "bool"
  - "cur_thread"
  - "fg"
  - "fg_thread"
  - "h"
  - "host"
  - "int"
  - "set"
called_by:
  - "_close_excel_session_impl"
  - "_hide_all_excel_sessions_impl"
  - "_hide_excel_session_impl"
  - "_hide_peer_session_frames"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
숨기거나 파킹하려는 프레임이 현재 포그라운드면, OS 가 다음 활성 창을 임의로 고르기 전에

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_close_excel_session_impl`, `_hide_all_excel_sessions_impl`, `_hide_excel_session_impl`, `_hide_peer_session_frames`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
