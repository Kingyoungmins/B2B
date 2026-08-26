---
type: function
title: _resolve_excel_mirror_rect
module: serve_b2b.py
lang: python
extraction: ast
signature: "(left, top, width, height, browser_hwnd=None, client_left=None, client_top=None, client_width=None, client_height=None, viewport_width=None, viewport_height=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:4069-4092"

# ── 입출력 ──
inputs:
  - "left"
  - "top"
  - "width"
  - "height"
  - "browser_hwnd"
  - "client_left"
  - "client_top"
  - "client_width"
  - "client_height"
  - "viewport_width"
  - "viewport_height"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_browser_content_rect"
calls_external:
  - "browser_hwnd"
  - "float"
  - "int"
  - "max"
  - "screen_height"
  - "screen_left"
  - "screen_top"
  - "screen_width"
called_by:
  - "_position_excel_window"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_browser_content_rect`
- 피호출(영향 전파 경로): `_position_excel_window`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
