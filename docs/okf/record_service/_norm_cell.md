---
type: function
title: _norm_cell
module: record_service.py
lang: python
extraction: ast
signature: "(v)"
role: "Value2 셀값 정규화 — 재현 전후 부동소수 미세오차/None 표기 차이를 흡수."
role_source: docstring
version: "0.8.2"
loc: "record_service.py:77-85"

# ── 입출력 ──
inputs:
  - "v"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "abs"
  - "float"
  - "int"
  - "isinstance"
  - "repr"
  - "round"
  - "str"
  - "v"
called_by:
  - "digest_grid"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
Value2 셀값 정규화 — 재현 전후 부동소수 미세오차/None 표기 차이를 흡수.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `digest_grid`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
