---
type: function
title: _looks_like_hms
module: serve_b2b.py
lang: python
extraction: ast
signature: "(hour, minute, second)"
role: "파일명에 찍히는 시각(10_55_33)인지 — 00~23 / 00~59 / 00~59 만 참."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:8410-8416"

# ── 입출력 ──
inputs:
  - "hour"
  - "minute"
  - "second"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "hour"
  - "int"
  - "minute"
  - "second"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
파일명에 찍히는 시각(10_55_33)인지 — 00~23 / 00~59 / 00~59 만 참.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
