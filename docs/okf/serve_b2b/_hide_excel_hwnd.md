---
type: function
title: _hide_excel_hwnd
module: serve_b2b.py
lang: python
extraction: ast
signature: "(hwnd)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:13846-13872"

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
  - "IsWindow"
  - "SetWindowPos"
  - "ShowWindow"
  - "flags"
  - "getattr"
  - "hwnd"
  - "int"
  - "win32con"
called_by:
  - "_hide_excel_app_window"
  - "_hide_excel_windows_for_pid"
  - "_hide_workbook_window"
  - "_hide_workbook_windows"
  - "_park_excel_app_offscreen"
  - "_replace_excel_session_workbook_impl"
  - "_start_excel_hide_guard"
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
- 호출: 없음
- 피호출(영향 전파 경로): `_hide_excel_app_window`, `_hide_excel_windows_for_pid`, `_hide_workbook_window`, `_hide_workbook_windows`, `_park_excel_app_offscreen`, `_replace_excel_session_workbook_impl`, `_start_excel_hide_guard`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
