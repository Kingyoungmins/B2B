---
type: function
title: _row_run_steps
module: record_service.py
lang: python
extraction: ast
signature: "(merged, book, sheet, base_id)"
role: "gap 이 있는 런을 '행별 연속 구간(row-run)'으로 분할한 스텝 목록."
role_source: docstring
version: "0.8.1"
loc: "record_service.py:260-285"

# ── 입출력 ──
inputs:
  - "merged"
  - "book"
  - "sheet"
  - "base_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_fill_step"
  - "append"
  - "book"
  - "sheet"
calls_external:
  - "ce"
  - "cs"
  - "make_range"
  - "merged"
  - "r"
  - "sorted"
called_by:
  - "consolidate_literal_runs"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
gap 이 있는 런을 '행별 연속 구간(row-run)'으로 분할한 스텝 목록.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_fill_step`, `append`, `book`, `sheet`
- 피호출(영향 전파 경로): `consolidate_literal_runs`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
