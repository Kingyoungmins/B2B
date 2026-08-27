---
type: function
title: _disable_vba_break_on_all_errors
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "VBE Error Trapping 이 Break on All Errors 면 처리된 오류도 디버거로 진입한다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:5609-5638"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
calls_external:
  - "CloseKey"
  - "CreateKeyEx"
  - "SetValueEx"
  - "getattr"
  - "key"
  - "view"
  - "view_name"
  - "winreg"
called_by:
  - "_inject_and_run_vba"
  - "_open_excel_session_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_vba_via_runner_with_retry"
  - "_setup_isolated_pipeline_instance"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
VBE Error Trapping 이 Break on All Errors 면 처리된 오류도 디버거로 진입한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`
- 피호출(영향 전파 경로): `_inject_and_run_vba`, `_open_excel_session_impl`, `_run_full_pipeline_single_instance_impl`, `_run_vba_via_runner_with_retry`, `_setup_isolated_pipeline_instance`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
