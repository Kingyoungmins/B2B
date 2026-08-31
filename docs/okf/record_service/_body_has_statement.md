---
type: function
title: _body_has_statement
module: record_service.py
lang: python
extraction: ast
signature: "(body)"
role: "body 라인 중 '실제 실행문'이 하나라도 있는지. 주석(#)·빈 줄만 있으면 False."
role_source: docstring
version: "0.8.2"
loc: "record_service.py:560-570"

# ── 입출력 ──
inputs:
  - "body"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "ln"
  - "startswith"
  - "str"
  - "strip"
called_by:
  - "group_to_pipeline_entry"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
body 라인 중 '실제 실행문'이 하나라도 있는지. 주석(#)·빈 줄만 있으면 False.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `group_to_pipeline_entry`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
