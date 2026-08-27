---
type: function
title: _fill_step
module: record_service.py
lang: python
extraction: ast
signature: "(merged, book, sheet, r1, c1, r2, c2, step_id, desc)"
role: "merged[(r,c)] 값으로 (r1,c1)-(r2,c2) 박스를 채운 단일 range_fill Step."
role_source: docstring
version: "0.8.0"
loc: "record_service.py:251-257"

# ── 입출력 ──
inputs:
  - "merged"
  - "book"
  - "sheet"
  - "r1"
  - "c1"
  - "r2"
  - "c2"
  - "step_id"
  - "desc"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "book"
  - "range"
  - "sheet"
calls_external:
  - "RANGE_FILL"
  - "Step"
  - "Target"
  - "desc"
  - "get"
  - "make_range"
  - "rng"
  - "step_id"
called_by:
  - "_row_run_steps"
  - "consolidate_literal_runs"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
merged[(r,c)] 값으로 (r1,c1)-(r2,c2) 박스를 채운 단일 range_fill Step.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `book`, `range`, `sheet`
- 피호출(영향 전파 경로): `_row_run_steps`, `consolidate_literal_runs`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
