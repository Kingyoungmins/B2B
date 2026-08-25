---
type: function
title: _prepare_excel_session_for_close
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, wb=None)"
role: "Close/Quit 직전에 Excel 이 빈 회색 top-level 창을 복원하지 못하게 먼저 숨긴다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:19412-19434"

# ── 입출력 ──
inputs:
  - "app"
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_hide_excel_app_window"
  - "_hide_workbook_windows"
calls_external:
  - "app"
  - "wb"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
Close/Quit 직전에 Excel 이 빈 회색 top-level 창을 복원하지 못하게 먼저 숨긴다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_hide_excel_app_window`, `_hide_workbook_windows`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
