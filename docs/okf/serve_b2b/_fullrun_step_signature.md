---
type: function
title: _fullrun_step_signature
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id, step)"
role: "스텝 1개의 '실행 결과에 영향 있는' 부분만. _step_signature 와 같은 철학이되"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:19760-19777"

# ── 입출력 ──
inputs:
  - "excel_id"
  - "step"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_signature_code_for_snapshot"
  - "is_python_pipeline_step"
  - "normalize_python_pipeline_code"
calls_external:
  - "code"
  - "dict"
  - "get"
  - "isinstance"
  - "lower"
  - "st"
  - "step"
  - "str"
called_by:
  - "_fullrun_snapshot_key"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
스텝 1개의 '실행 결과에 영향 있는' 부분만. _step_signature 와 같은 철학이되

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_signature_code_for_snapshot`, `is_python_pipeline_step`, `normalize_python_pipeline_code`
- 피호출(영향 전파 경로): `_fullrun_snapshot_key`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
