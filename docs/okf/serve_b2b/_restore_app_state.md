---
type: function
title: _restore_app_state
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "VBA 실행(성공/실패 무관) 후 Application 전역 상태를 결정적으로 정상화한다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:9103-9131"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Calculate"
called_by:
  - "_recover_excel_session_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_python_on_session_impl"
  - "_run_vba_on_session_impl"
  - "_run_vba_pipeline_on_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
VBA 실행(성공/실패 무관) 후 Application 전역 상태를 결정적으로 정상화한다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_recover_excel_session_impl`, `_run_full_pipeline_single_instance_impl`, `_run_python_on_session_impl`, `_run_vba_on_session_impl`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
