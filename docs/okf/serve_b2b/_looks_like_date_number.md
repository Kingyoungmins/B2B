---
type: function
title: _looks_like_date_number
module: serve_b2b.py
lang: python
extraction: ast
signature: "(digits)"
role: "YYMMDD(260607) / YYYYMM(202606) / YYYYMMDD(20260607) 처럼 날짜로 읽히는 숫자만 True."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:8059-8076"

# ── 입출력 ──
inputs:
  - "digits"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "_ok"
  - "digits"
  - "int"
  - "len"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
YYMMDD(260607) / YYYYMM(202606) / YYYYMMDD(20260607) 처럼 날짜로 읽히는 숫자만 True.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
