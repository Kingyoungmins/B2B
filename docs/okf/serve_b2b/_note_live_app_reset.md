---
type: function
title: _note_live_app_reset
module: serve_b2b.py
lang: python
extraction: ast
signature: "(reason, **extra)"
role: "[진단] 공유 라이브 Excel 인스턴스가 리셋/종료되는 순간을 남긴다. 녹화 중(NATIVE_RECORDING.active)"
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:91-102"

# ── 입출력 ──
inputs:
  - "reason"
  - "**extra"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_vba_trace"
calls_external:
  - "bool"
  - "extra"
  - "get"
  - "globals"
  - "reason"
  - "recording"
called_by:
  - "_cleanup_excel_sessions_impl"
  - "_close_excel_session_impl"
  - "_force_restart_excel_sessions_direct"
  - "_get_live_excel_app"
  - "_quit_live_excel_app"
reads:
  - "NATIVE_RECORDING"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[진단] 공유 라이브 Excel 인스턴스가 리셋/종료되는 순간을 남긴다. 녹화 중(NATIVE_RECORDING.active)

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_vba_trace`
- 피호출(영향 전파 경로): `_cleanup_excel_sessions_impl`, `_close_excel_session_impl`, `_force_restart_excel_sessions_direct`, `_get_live_excel_app`, `_quit_live_excel_app`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
