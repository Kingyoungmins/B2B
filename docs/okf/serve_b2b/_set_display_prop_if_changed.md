---
type: function
title: _set_display_prop_if_changed
module: serve_b2b.py
lang: python
extraction: ast
signature: "(obj, name, value)"
role: "Display* 계열 속성은 '쓰기 자체'가 값 무관하게 복사 마퀴(CutCopyMode)를 취소한다"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:3870-3883"

# ── 입출력 ──
inputs:
  - "obj"
  - "name"
  - "value"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "value"
calls_external:
  - "bool"
  - "getattr"
  - "name"
  - "obj"
  - "setattr"
called_by:
  - "_configure_excel_grid_window"
  - "_ensure_excel_workbook_view"
  - "_show_excel_formula_bar"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
Display* 계열 속성은 '쓰기 자체'가 값 무관하게 복사 마퀴(CutCopyMode)를 취소한다

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `value`
- 피호출(영향 전파 경로): `_configure_excel_grid_window`, `_ensure_excel_workbook_view`, `_show_excel_formula_bar`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
