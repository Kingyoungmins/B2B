---
type: function
title: _live_window_signature
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "Excel 앱 창의 (위치·크기, 표시 여부) — VBA 실행 전후 비교용."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:20445-20460"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "GetWindowRect"
  - "IsWindowVisible"
  - "bool"
  - "hwnd"
  - "int"
  - "tuple"
called_by:
  - "_run_vba_on_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
Excel 앱 창의 (위치·크기, 표시 여부) — VBA 실행 전후 비교용.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_run_vba_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
