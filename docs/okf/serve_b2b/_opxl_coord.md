---
type: function
title: _opxl_coord
module: serve_b2b.py
lang: python
extraction: ast
signature: "(token)"
role: "====================================================================="
role_source: banner
version: "0.8.0"
loc: "serve_b2b.py:17454-17457"

# ── 입출력 ──
inputs:
  - "token"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "col"
  - "replace"
  - "row"
calls_external:
  - "coordinate_to_tuple"
  - "int"
  - "str"
  - "strip"
  - "token"
called_by:
  - "OpenpyxlSkillContext.set_range"
  - "OpenpyxlWorksheetProxy.Range"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
=====================================================================

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `col`, `replace`, `row`
- 피호출(영향 전파 경로): `OpenpyxlSkillContext.set_range`, `OpenpyxlWorksheetProxy.Range`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
