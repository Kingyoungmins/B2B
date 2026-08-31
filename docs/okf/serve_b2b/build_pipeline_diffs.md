---
type: function
title: build_pipeline_diffs
module: serve_b2b.py
lang: python
extraction: ast
signature: "(before_inputs, before_output, after_inputs, after_output, current)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "serve_b2b.py:22182-22190"

# ── 입출력 ──
inputs:
  - "before_inputs"
  - "before_output"
  - "after_inputs"
  - "after_output"
  - "current"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "compute_workbook_diff"
calls_external:
  - "after_output"
  - "before_output"
  - "get"
  - "keys"
  - "name"
  - "set"
  - "sorted"
called_by:
  - "run_backend_pipeline_payload"
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
- 호출: `compute_workbook_diff`
- 피호출(영향 전파 경로): `run_backend_pipeline_payload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
