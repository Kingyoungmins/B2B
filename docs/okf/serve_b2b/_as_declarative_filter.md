---
type: function
title: _as_declarative_filter
module: serve_b2b.py
lang: python
extraction: ast
signature: "(predicate)"
role: "predicate 가 선언적 조건이면 그대로, 아니면 None(=람다 경로로)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:11724-11726"

# ── 입출력 ──
inputs:
  - "predicate"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "ColumnIs"
  - "isinstance"
  - "predicate"
called_by:
  - "PythonComSkillContext.filter_to_sheet"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
predicate 가 선언적 조건이면 그대로, 아니면 None(=람다 경로로).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext.filter_to_sheet`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
