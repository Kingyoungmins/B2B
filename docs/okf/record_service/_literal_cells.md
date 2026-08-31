---
type: function
title: _literal_cells
module: record_service.py
lang: python
extraction: ast
signature: "(step)"
role: "리터럴 값 스텝이면 {(row,col): value} 로 펼쳐 반환, 아니면 None."
role_source: docstring
version: "0.8.2"
loc: "record_service.py:254-273"

# ── 입출력 ──
inputs:
  - "step"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "row"
calls_external:
  - "enumerate"
  - "get"
  - "grid"
  - "isinstance"
  - "parse_range"
called_by:
  - "consolidate_literal_runs"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
리터럴 값 스텝이면 {(row,col): value} 로 펼쳐 반환, 아니면 None.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `row`
- 피호출(영향 전파 경로): `consolidate_literal_runs`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
