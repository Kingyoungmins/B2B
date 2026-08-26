---
type: function
title: _detach_live_excel_window
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "라이브 Excel 창이 WebView 에 임베드(WS_CHILD/owner)돼 있으면 독립 top-level 로 분리한다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:9962-9996"

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
  - "GetParent"
  - "GetWindowLong"
  - "SetParent"
  - "SetWindowLong"
  - "getattr"
  - "hwnd"
  - "int"
  - "new_style"
  - "owner_idx"
  - "win32con"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
라이브 Excel 창이 WebView 에 임베드(WS_CHILD/owner)돼 있으면 독립 top-level 로 분리한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
