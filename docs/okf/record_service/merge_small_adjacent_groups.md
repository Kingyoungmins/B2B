---
type: function
title: merge_small_adjacent_groups
module: record_service.py
lang: python
extraction: ast
signature: "(groups, small=2, limit=40)"
role: "같은 워크북의 이웃 묶음 중 한쪽이 소묶음(≤small 스텝)이면 흡수한다(순서 불변)."
role_source: docstring
version: "0.8.0"
loc: "record_service.py:473-503"

# ── 입출력 ──
inputs:
  - "groups"
  - "small"
  - "limit"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_group_title"
  - "append"
calls_external:
  - "code"
  - "dict"
  - "extend"
  - "g"
  - "get"
  - "ids"
  - "items"
  - "len"
  - "list"
  - "r"
  - "setdefault"
called_by:
  - "RecordService._run"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
같은 워크북의 이웃 묶음 중 한쪽이 소묶음(≤small 스텝)이면 흡수한다(순서 불변).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_group_title`, `append`
- 피호출(영향 전파 경로): `RecordService._run`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
