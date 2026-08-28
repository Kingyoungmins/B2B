---
type: function
title: parse_cron_expr
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(expr)"
role: "crontab 5필드 → 화면이 쓰는 스케줄 dict. 못 읽으면 None."
role_source: docstring
version: "0.8.1"
loc: "b2b_scheduler.py:333-370"

# ── 입출력 ──
inputs:
  - "expr"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "dom"
  - "dow"
  - "hour"
  - "int"
  - "len"
  - "minute"
  - "mon"
  - "parts"
  - "split"
  - "str"
called_by:
  - "_read_schedule"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
crontab 5필드 → 화면이 쓰는 스케줄 dict. 못 읽으면 None.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_read_schedule`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
