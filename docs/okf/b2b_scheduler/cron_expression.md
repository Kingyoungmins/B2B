---
type: function
title: cron_expression
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(sched)"
role: "스케줄 → crontab 5필드(분 시 일 월 요일)."
role_source: docstring
version: "0.8.1"
loc: "b2b_scheduler.py:109-130"

# ── 입출력 ──
inputs:
  - "sched"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "get"
  - "int"
  - "len"
  - "parts"
  - "split"
  - "str"
called_by:
  - "_write_schedule_files"
  - "update_schedule"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
스케줄 → crontab 5필드(분 시 일 월 요일).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_write_schedule_files`, `update_schedule`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
