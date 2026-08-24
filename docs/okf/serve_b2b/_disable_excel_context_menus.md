---
type: function
title: _disable_excel_context_menus
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "오버레이 엑셀에서 마우스 우클릭(컨텍스트) 메뉴를 막는다."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:3655-3672"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Item"
  - "_recording_edit_unlock_active"
  - "range"
calls_external:
  - "app"
  - "idx"
called_by:
  - "_configure_excel_grid_window"
  - "_save_excel_session_impl"
  - "_set_live_sessions_edit_unlock"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
오버레이 엑셀에서 마우스 우클릭(컨텍스트) 메뉴를 막는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `Item`, `_recording_edit_unlock_active`, `range`
- 피호출(영향 전파 경로): `_configure_excel_grid_window`, `_save_excel_session_impl`, `_set_live_sessions_edit_unlock`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
