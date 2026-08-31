---
type: function
title: _suppress_vba_debug_windows
module: serve_b2b.py
lang: python
extraction: ast
signature: "(pid=None)"
role: "VBE/디버그 다이얼로그가 떠도 사용자에게 보이지 않도록 즉시 닫거나 숨긴다."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:9192-9229"

# ── 입출력 ──
inputs:
  - "pid"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "EnumWindows"
  - "GetClassName"
  - "GetWindowText"
  - "GetWindowThreadProcessId"
  - "PostMessage"
  - "ShowWindow"
  - "get"
  - "getattr"
  - "globals"
  - "hwnd"
  - "int"
  - "lower"
  - "sw_hide"
  - "visit"
  - "wm_close"
called_by:
  - "_inject_and_run_vba"
  - "_start_vba_debug_suppressor"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
VBE/디버그 다이얼로그가 떠도 사용자에게 보이지 않도록 즉시 닫거나 숨긴다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_inject_and_run_vba`, `_start_vba_debug_suppressor`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
