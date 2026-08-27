---
type: function
title: normalize_value_key
module: serve_b2b.py
lang: python
extraction: ast
signature: "(value)"
role: "[제보 2026-08-27] '셀 값'을 비교할 때 쓰는 정규화."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:3319-3345"

# ── 입출력 ──
inputs:
  - "value"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "value"
calls_external:
  - "bool"
  - "float"
  - "int"
  - "is_integer"
  - "isinstance"
  - "join"
  - "lower"
  - "split"
  - "str"
called_by:
  - "ExcelSkillContext.normalize"
  - "OpenpyxlSkillContext.normalize"
  - "PythonComSkillContext.normalize"
  - "_cond_match"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[제보 2026-08-27] '셀 값'을 비교할 때 쓰는 정규화.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `value`
- 피호출(영향 전파 경로): `ExcelSkillContext.normalize`, `OpenpyxlSkillContext.normalize`, `PythonComSkillContext.normalize`, `_cond_match`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
