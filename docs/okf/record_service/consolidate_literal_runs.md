---
type: function
title: consolidate_literal_runs
module: record_service.py
lang: python
extraction: ast
signature: "(steps, min_run=PASTE_MERGE_MIN_RUN, max_cells=PASTE_MERGE_MAX_CELLS)"
role: "연속된 같은 (book,sheet) 리터럴 값 스텝 런을 더 적은 range_fill 로 통합."
role_source: docstring
version: "0.8.0"
loc: "record_service.py:296-358"

# ── 입출력 ──
inputs:
  - "steps"
  - "min_run"
  - "max_cells"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_fill_step"
  - "_literal_cells"
  - "_row_run_steps"
  - "_steps_to_transform"
  - "append"
  - "book"
  - "sheet"
calls_external:
  - "c"
  - "c1"
  - "c2"
  - "cells0"
  - "cs"
  - "dict"
  - "extend"
  - "info"
  - "len"
  - "make_range"
  - "max"
  - "merged"
  - "min"
  - "new_steps"
  - "r1"
  - "r2"
  - "rs"
  - "run"
  - "s"
  - "steps"
  - "t"
  - "touched_equivalent"
  - "update"
called_by:
  - "RecordService._run"
reads:
  - "PASTE_MERGE_MAX_CELLS"
  - "PASTE_MERGE_MIN_RUN"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
연속된 같은 (book,sheet) 리터럴 값 스텝 런을 더 적은 range_fill 로 통합.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_fill_step`, `_literal_cells`, `_row_run_steps`, `_steps_to_transform`, `append`, `book`, `sheet`
- 피호출(영향 전파 경로): `RecordService._run`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
