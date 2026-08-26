---
type: function
title: _diag_vba_log_line
module: serve_b2b.py
lang: python
extraction: ast
signature: "(msg)"
role: "[임시 진단] VBA 실행 결과 한 줄을 vba_runner_fail.log 에 남긴다(성공/런타임에러/실행예외 구분)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:9101-9109"

# ── 입출력 ──
inputs:
  - "msg"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "write"
calls_external:
  - "_P"
  - "__file__"
  - "isoformat"
  - "now"
  - "open"
  - "resolve"
called_by:
  - "_inject_and_run_vba_in_host"
  - "_run_vba_macro_any_ref"
  - "_run_vba_on_session_impl"
  - "_run_vba_via_runner_with_retry"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[임시 진단] VBA 실행 결과 한 줄을 vba_runner_fail.log 에 남긴다(성공/런타임에러/실행예외 구분).

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `write`
- 피호출(영향 전파 경로): `_inject_and_run_vba_in_host`, `_run_vba_macro_any_ref`, `_run_vba_on_session_impl`, `_run_vba_via_runner_with_retry`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
