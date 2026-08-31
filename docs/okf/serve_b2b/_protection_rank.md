---
type: function
title: _protection_rank
module: serve_b2b.py
lang: python
extraction: ast
signature: "(kind)"
role: "보호 강도 순위. 낮아지면 보호가 약해진 것이다."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:3911-3913"

# ── 입출력 ──
inputs:
  - "kind"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "get"
called_by:
  - "_check_protection_loss"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
보호 강도 순위. 낮아지면 보호가 약해진 것이다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_check_protection_loss`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
