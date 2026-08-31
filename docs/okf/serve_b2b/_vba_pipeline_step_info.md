---
type: function
title: _vba_pipeline_step_info
module: serve_b2b.py
lang: python
extraction: ast
signature: "(step, fallback_idx, err)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "serve_b2b.py:8524-8557"

# ── 입출력 ──
inputs:
  - "step"
  - "fallback_idx"
  - "err"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_pipeline_error_guide"
calls_external:
  - "_code"
  - "dict"
  - "err"
  - "fallback_idx"
  - "get"
  - "int"
  - "isinstance"
  - "raw_idx"
  - "step"
  - "str"
called_by:
  - "_run_full_pipeline_single_instance_impl"
  - "_run_vba_pipeline_on_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_pipeline_error_guide`
- 피호출(영향 전파 경로): `_run_full_pipeline_single_instance_impl`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
