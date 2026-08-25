---
type: function
title: _companion_excel_ids_for_books
module: serve_b2b.py
lang: python
extraction: ast
signature: "(companions, books)"
role: "바뀐 워크북 이름 집합 → 그게 어느 라이브 세션인지(excelId). 대상 세션은 동반본이 아니므로"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:10216-10231"

# ── 입출력 ──
inputs:
  - "companions"
  - "books"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
  - "normalize"
calls_external:
  - "casefold"
  - "get"
  - "n"
  - "oid"
  - "set"
  - "str"
called_by:
  - "_step_cross_payload"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
바뀐 워크북 이름 집합 → 그게 어느 라이브 세션인지(excelId). 대상 세션은 동반본이 아니므로

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`, `normalize`
- 피호출(영향 전파 경로): `_step_cross_payload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
