---
type: function
title: _cleanup_fullrun_snapshots
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "최근 N개만 남기고 오래된 경계 기록을 버린다. 파일은 '남은 기록이 참조하지 않을 때만' 지운다"
role_source: docstring
version: "0.8.1"
loc: "serve_b2b.py:19926-19952"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "values"
calls_external:
  - "Path"
  - "any"
  - "get"
  - "len"
  - "list"
  - "p"
  - "pop"
  - "records"
  - "set"
  - "sorted"
  - "str"
  - "unlink"
called_by:
  - "_run_full_pipeline_single_instance_impl"
reads:
  - "FULLRUN_SNAPSHOT_MAX_RECORDS"
  - "FULLRUN_STEP_SNAPSHOTS"
  - "RESULTS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
최근 N개만 남기고 오래된 경계 기록을 버린다. 파일은 '남은 기록이 참조하지 않을 때만' 지운다

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `add`, `values`
- 피호출(영향 전파 경로): `_run_full_pipeline_single_instance_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
