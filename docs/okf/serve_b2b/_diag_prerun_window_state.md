---
type: function
title: _diag_prerun_window_state
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, context_wb)"
role: "[임시 진단] VBA Application.Run 직전, Excel 앱 프레임 + 대상 워크북 창의"
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:8912-8939"

# ── 입출력 ──
inputs:
  - "app"
  - "context_wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
  - "write"
calls_external:
  - "GetParent"
  - "GetWindowLong"
  - "IsWindowVisible"
  - "Windows"
  - "_P"
  - "__file__"
  - "_desc"
  - "_wc"
  - "bool"
  - "getattr"
  - "h"
  - "int"
  - "isoformat"
  - "join"
  - "now"
  - "open"
  - "out"
  - "resolve"
called_by:
  - "_inject_and_run_vba_in_host"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[임시 진단] VBA Application.Run 직전, Excel 앱 프레임 + 대상 워크북 창의

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 파일시스템 변경/IO

## 관계
- 호출: `append`, `write`
- 피호출(영향 전파 경로): `_inject_and_run_vba_in_host`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
