---
type: function
title: chunk_groups
module: record_service.py
lang: python
extraction: ast
signature: "(groups, limit=40)"
role: "스텝이 많은 묶음을 limit 이하로 쪼갠다."
role_source: docstring
version: "0.8.2"
loc: "record_service.py:531-557"

# ── 입출력 ──
inputs:
  - "groups"
  - "limit"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
  - "range"
calls_external:
  - "g"
  - "get"
  - "items"
  - "len"
  - "limit"
  - "steps"
  - "sub"
called_by:
  - "RecordService._run"
reads:
  - "ROLE_TITLES"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
스텝이 많은 묶음을 limit 이하로 쪼갠다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`, `range`
- 피호출(영향 전파 경로): `RecordService._run`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
