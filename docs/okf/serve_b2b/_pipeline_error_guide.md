---
type: function
title: _pipeline_error_guide
module: serve_b2b.py
lang: python
extraction: ast
signature: "(message, code='')"
role: "난해한 엔진 예외를 (원인, 프롬프트 작성 가이드) 한국어 쌍으로 변환한다."
role_source: docstring
version: "0.5.18"
loc: "serve_b2b.py:799-867"

# ── 입출력 ──
inputs:
  - "message"
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "any"
  - "code_text"
  - "has"
  - "lower"
  - "search"
  - "str"
called_by:
  - "_run_excel_python_pipeline_impl"
  - "_run_openpyxl_python_pipeline_impl"
  - "_run_vba_on_session_impl"
  - "_vba_pipeline_step_info"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
난해한 엔진 예외를 (원인, 프롬프트 작성 가이드) 한국어 쌍으로 변환한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`, `_run_openpyxl_python_pipeline_impl`, `_run_vba_on_session_impl`, `_vba_pipeline_step_info`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
