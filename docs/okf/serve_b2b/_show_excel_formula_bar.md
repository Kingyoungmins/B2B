---
type: function
title: _show_excel_formula_bar
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "읽기 전용 미러에서도 실제 Excel처럼 수식 입력줄은 보이게 둔다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:3837-3840"

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
  - "_set_display_prop_if_changed"
calls_external:
  - "app"
called_by:
  - "_configure_excel_grid_window"
  - "_ensure_excel_workbook_view"
  - "_set_live_sessions_edit_unlock"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
읽기 전용 미러에서도 실제 Excel처럼 수식 입력줄은 보이게 둔다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_set_display_prop_if_changed`
- 피호출(영향 전파 경로): `_configure_excel_grid_window`, `_ensure_excel_workbook_view`, `_set_live_sessions_edit_unlock`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
