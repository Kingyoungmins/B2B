---
type: function
title: _find_best_fullrun_snapshot
module: serve_b2b.py
lang: python
extraction: ast
signature: "(source_specs, entry, flat_steps)"
role: "가장 긴 접두(= 가장 많이 건너뛰는 경계)부터 찾는다. 경계는 비용 게이트 때문에 드문드문"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:19749-19757"

# ── 입출력 ──
inputs:
  - "source_specs"
  - "entry"
  - "flat_steps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_fullrun_snapshot_files_exist"
  - "_fullrun_snapshot_key"
  - "range"
calls_external:
  - "entry"
  - "flat_steps"
  - "get"
  - "key"
  - "len"
  - "snap"
  - "source_specs"
called_by:
  - "_run_full_pipeline_single_instance_impl"
reads:
  - "FULLRUN_STEP_SNAPSHOTS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
가장 긴 접두(= 가장 많이 건너뛰는 경계)부터 찾는다. 경계는 비용 게이트 때문에 드문드문

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_fullrun_snapshot_files_exist`, `_fullrun_snapshot_key`, `range`
- 피호출(영향 전파 경로): `_run_full_pipeline_single_instance_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
