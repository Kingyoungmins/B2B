---
type: function
title: _run_vba_via_runner_with_retry
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, wb, code, entry, attempts=2)"
role: "임시 .xlsm 러너에서 VBA 를 실행한다. '매크로를 실행할 수 없습니다'(-2146827284)는 일부 환경에서"
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:9352-9387"

# ── 입출력 ──
inputs:
  - "app"
  - "wb"
  - "code"
  - "entry"
  - "attempts"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_close_vba_runner_workbook"
  - "_create_vba_runner_workbook"
  - "_diag_vba_log_line"
  - "_disable_vba_break_on_all_errors"
  - "_hide_vba_editor"
  - "_inject_and_run_vba_in_host"
  - "_is_vba_macro_run_blocked_error"
  - "range"
calls_external:
  - "RuntimeError"
  - "app"
  - "attempts"
  - "code"
  - "entry"
  - "err"
  - "max"
  - "runner_temp"
  - "runner_wb"
  - "sleep"
  - "wb"
called_by:
  - "_inject_and_run_vba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
임시 .xlsm 러너에서 VBA 를 실행한다. '매크로를 실행할 수 없습니다'(-2146827284)는 일부 환경에서

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_close_vba_runner_workbook`, `_create_vba_runner_workbook`, `_diag_vba_log_line`, `_disable_vba_break_on_all_errors`, `_hide_vba_editor`, `_inject_and_run_vba_in_host`, `_is_vba_macro_run_blocked_error`, `range`
- 피호출(영향 전파 경로): `_inject_and_run_vba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
