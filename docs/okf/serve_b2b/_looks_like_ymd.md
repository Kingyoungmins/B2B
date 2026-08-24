---
type: function
title: _looks_like_ymd
module: serve_b2b.py
lang: python
extraction: ast
signature: "(year, month, day)"
role: "구분자 있는 날짜(2026-03-01)인지 — 연 1900~2199 / 월 1~12 / 일 1~31 만 참."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:8341-8347"

# ── 입출력 ──
inputs:
  - "year"
  - "month"
  - "day"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "day"
  - "int"
  - "month"
  - "year"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
구분자 있는 날짜(2026-03-01)인지 — 연 1900~2199 / 월 1~12 / 일 1~31 만 참.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
