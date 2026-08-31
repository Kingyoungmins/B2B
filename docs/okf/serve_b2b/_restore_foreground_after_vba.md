---
type: function
title: _restore_foreground_after_vba
module: serve_b2b.py
lang: python
extraction: ast
signature: "(prev_hwnd, excel_pid)"
role: "VBA 편집기가 가져간 '활성 자리'를 원래 창으로 되돌린다."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:9266-9306"

# ── 입출력 ──
inputs:
  - "prev_hwnd"
  - "excel_pid"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_force_set_foreground"
  - "_vba_trace"
calls_external:
  - "GetForegroundWindow"
  - "GetWindowThreadProcessId"
  - "IsWindow"
  - "IsWindowVisible"
  - "cur"
  - "excel_pid"
  - "int"
  - "ok"
  - "prev_hwnd"
called_by:
  - "_inject_and_run_vba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
VBA 편집기가 가져간 '활성 자리'를 원래 창으로 되돌린다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_force_set_foreground`, `_vba_trace`
- 피호출(영향 전파 경로): `_inject_and_run_vba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
