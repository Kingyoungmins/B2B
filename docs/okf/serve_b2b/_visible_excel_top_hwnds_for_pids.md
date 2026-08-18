---
type: function
title: _visible_excel_top_hwnds_for_pids
module: serve_b2b.py
lang: python
extraction: ast
signature: "(pids)"
role: "주어진 pid 들의 '보이는' 최상위 Excel 창(XLMAIN) 목록."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:4208-4244"

# ── 입출력 ──
inputs:
  - "pids"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "append"
calls_external:
  - "EnumWindows"
  - "GetClassName"
  - "GetWindowThreadProcessId"
  - "IsWindowVisible"
  - "hwnd"
  - "int"
  - "p"
  - "set"
  - "upper"
  - "visit"
called_by:
  - "_hide_all_excel_sessions_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
주어진 pid 들의 '보이는' 최상위 Excel 창(XLMAIN) 목록.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `append`
- 피호출(영향 전파 경로): `_hide_all_excel_sessions_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
