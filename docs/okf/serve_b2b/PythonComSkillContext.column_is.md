---
type: method
title: PythonComSkillContext.column_is
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, column, values)"
role: "선언적 필터 조건을 만든다(자동필터 경로용). column 은 \"H\" 같은 열 문자 또는 1-based 번호."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12969-12971"

# ── 입출력 ──
inputs:
  - "self"
  - "column"
  - "values"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "values"
calls_external:
  - "ColumnIs"
  - "column"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
선언적 필터 조건을 만든다(자동필터 경로용). column 은 "H" 같은 열 문자 또는 1-based 번호.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `values`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
