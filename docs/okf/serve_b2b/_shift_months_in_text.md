---
type: function
title: _shift_months_in_text
module: serve_b2b.py
lang: python
extraction: ast
signature: "(s, delta, current_year=2000)"
role: "문자열의 모든 'N월'(앞의 'YY/YYYY년', 뒤의 'D일' 포함)을 delta 개월 이동한다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:3066-3100"

# ── 입출력 ──
inputs:
  - "s"
  - "delta"
  - "current_year"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_days_in_month"
  - "append"
calls_external:
  - "cy"
  - "delta"
  - "dy"
  - "end"
  - "finditer"
  - "format"
  - "group"
  - "int"
  - "join"
  - "len"
  - "mon"
  - "nd"
  - "new_m"
  - "ny"
  - "out"
  - "piece"
  - "s"
  - "start"
  - "str"
  - "yr"
called_by:
  - "PythonComSkillContext.shift_months"
reads:
  - "_MONTH_SHIFT_PAT"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
문자열의 모든 'N월'(앞의 'YY/YYYY년', 뒤의 'D일' 포함)을 delta 개월 이동한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_days_in_month`, `append`
- 피호출(영향 전파 경로): `PythonComSkillContext.shift_months`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
