---
type: function
title: _unmaximize_hwnd_no_activate
module: serve_b2b.py
lang: python
extraction: ast
signature: "(hwnd)"
role: "최대화된 창을 '활성화 없이' 보통 크기로 되돌린다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:4404-4426"

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
  - "GetWindowPlacement"
  - "IsWindow"
  - "IsZoomed"
  - "SetWindowPlacement"
  - "hwnd"
  - "int"
called_by:
  - "_move_hwnd_offscreen"
  - "_position_excel_window"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
최대화된 창을 '활성화 없이' 보통 크기로 되돌린다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_move_hwnd_offscreen`, `_position_excel_window`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
