---
type: function
title: _worker_step_target_wb
module: serve_b2b.py
lang: python
extraction: ast
signature: "(step, input_wb_by_name, output_wb)"
role: "[혼합 호환] 워커에서 VBA/COM-bulk 스텝의 기준 워크북 결정:"
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:18687-18698"

# ── 입출력 ──
inputs:
  - "step"
  - "input_wb_by_name"
  - "output_wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "get"
  - "items"
  - "k"
  - "lower"
  - "str"
  - "strip"
called_by:
  - "_run_excel_python_pipeline_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[혼합 호환] 워커에서 VBA/COM-bulk 스텝의 기준 워크북 결정:

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
