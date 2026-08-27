---
type: function
title: _is_total_label
module: serve_b2b.py
lang: python
extraction: ast
signature: "(cells)"
role: "행의 라벨 셀들(보통 A~C) 중 하나라도 '합계/총계/소계/누계/계' 면 True."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:15947-15955"

# ── 입출력 ──
inputs:
  - "cells"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "match"
  - "str"
  - "strip"
  - "t"
  - "v"
called_by:
  - "PythonComSkillContext.sum_column"
reads:
  - "_TOTAL_LABEL_RE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
행의 라벨 셀들(보통 A~C) 중 하나라도 '합계/총계/소계/누계/계' 면 True.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext.sum_column`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
