---
type: function
title: _workbook_window_hwnd
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb)"
role: "SDI 프레임(이 워크북의 최상위 창) 핸들. 공유 인스턴스에서 app.Hwnd 는"
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:6332-6341"

# ── 입출력 ──
inputs:
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Windows"
  - "int"
called_by:
  - "_open_excel_session_impl"
  - "_reopen_excel_session_workbook"
  - "_replace_excel_session_workbook_impl"
  - "_session_frame_hwnd"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
SDI 프레임(이 워크북의 최상위 창) 핸들. 공유 인스턴스에서 app.Hwnd 는

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_open_excel_session_impl`, `_reopen_excel_session_workbook`, `_replace_excel_session_workbook_impl`, `_session_frame_hwnd`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
