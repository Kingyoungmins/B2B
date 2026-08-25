---
type: function
title: _trace_step_code_once
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code, **fields)"
role: "스텝 코드 '전문'을 해시당 한 번만 로그에 남긴다."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:9039-9059"

# ── 입출력 ──
inputs:
  - "code"
  - "**fields"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_trace_hash"
  - "_trace_text"
  - "_vba_trace"
  - "add"
  - "clear"
calls_external:
  - "_TRACED_CODE_HASHES"
  - "code"
  - "fields"
  - "h"
  - "len"
  - "str"
called_by:
  - "_run_full_pipeline_single_instance_impl"
  - "_run_vba_pipeline_on_session_impl"
reads:
  - "_TRACED_CODE_HASHES"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
스텝 코드 '전문'을 해시당 한 번만 로그에 남긴다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_trace_hash`, `_trace_text`, `_vba_trace`, `add`, `clear`
- 피호출(영향 전파 경로): `_run_full_pipeline_single_instance_impl`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
