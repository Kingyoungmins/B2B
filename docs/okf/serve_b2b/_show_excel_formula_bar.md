---
type: function
title: _show_excel_formula_bar
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "읽기 전용 미러에서도 실제 Excel처럼 수식 입력줄은 보이게 둔다."
role_source: docstring
version: "0.5.18"
loc: "serve_b2b.py:2498-2504"

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
calls_external: []
called_by:
  - "_configure_excel_grid_window"
  - "_ensure_excel_workbook_view"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
읽기 전용 미러에서도 실제 Excel처럼 수식 입력줄은 보이게 둔다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_configure_excel_grid_window`, `_ensure_excel_workbook_view`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
