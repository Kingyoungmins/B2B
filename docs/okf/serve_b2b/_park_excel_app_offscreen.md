---
type: function
title: _park_excel_app_offscreen
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:13993-14012"

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
  - "_hide_excel_hwnd"
  - "range"
  - "value"
calls_external:
  - "app"
  - "attr"
  - "setattr"
called_by:
  - "_copy_source_workbook_into_target"
  - "_hide_excel_app_window"
  - "_open_excel_workbook_for_skill"
  - "_replace_excel_session_workbook_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_hide_excel_hwnd`, `range`, `value`
- 피호출(영향 전파 경로): `_copy_source_workbook_into_target`, `_hide_excel_app_window`, `_open_excel_workbook_for_skill`, `_replace_excel_session_workbook_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
