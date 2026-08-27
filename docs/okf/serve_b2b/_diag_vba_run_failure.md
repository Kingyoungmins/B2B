---
type: function
title: _diag_vba_run_failure
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, host_wb, vbproj, module, module_name, safe_code, err)"
role: "[임시 진단] 러너 매크로 실행 실패 원인 포착: 컴파일에러 vs 매크로차단 vs 기타."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:9272-9374"

# ── 입출력 ──
inputs:
  - "app"
  - "host_wb"
  - "vbproj"
  - "module"
  - "module_name"
  - "safe_code"
  - "err"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_process_id"
  - "_force_kill_pid"
  - "_track_spawned_excel_app"
  - "append"
  - "replace"
  - "write"
calls_external:
  - "Add"
  - "AddFromString"
  - "Close"
  - "DispatchEx"
  - "GetParent"
  - "GetWindowLong"
  - "IsWindowVisible"
  - "Lines"
  - "Quit"
  - "Remove"
  - "Run"
  - "SaveAs"
  - "_P"
  - "__file__"
  - "_h"
  - "_s"
  - "_wc"
  - "bool"
  - "discard"
  - "err"
  - "fa"
  - "fdir"
  - "fn"
  - "fpid"
  - "ftmp"
  - "getattr"
  - "injected"
  - "int"
  - "isoformat"
  - "join"
  - "lines"
  - "logp"
  - "mkdtemp"
  - "now"
  - "open"
  - "pm"
  - "resolve"
  - "rmtree"
  - "str"
  - "uuid4"
called_by:
  - "_inject_and_run_vba_in_host"
reads:
  - "SPAWNED_EXCEL_PIDS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[임시 진단] 러너 매크로 실행 실패 원인 포착: 컴파일에러 vs 매크로차단 vs 기타.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 파일시스템 변경/IO

## 관계
- 호출: `_excel_process_id`, `_force_kill_pid`, `_track_spawned_excel_app`, `append`, `replace`, `write`
- 피호출(영향 전파 경로): `_inject_and_run_vba_in_host`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
