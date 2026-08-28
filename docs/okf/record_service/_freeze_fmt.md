---
type: function
title: _freeze_fmt
module: record_service.py
lang: python
extraction: ast
signature: "(fmt)"
role: "서식 dict 를 비교 가능한 정렬 키로(중첩 dict/list 포함)."
role_source: docstring
version: "0.8.1"
loc: "record_service.py:423-429"

# ── 입출력 ──
inputs:
  - "fmt"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "dict"
  - "fmt"
  - "isinstance"
  - "items"
  - "k"
  - "sorted"
  - "str"
  - "tuple"
  - "v"
  - "x"
called_by:
  - "consolidate_format_runs"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
서식 dict 를 비교 가능한 정렬 키로(중첩 dict/list 포함).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `consolidate_format_runs`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
