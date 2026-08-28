---
type: function
title: _write_schedule_files
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(root, ctx, saved)"
role: "cron.txt / config.txt / schedule.json 을 한 번에 쓴다."
role_source: docstring
version: "0.8.1"
loc: "b2b_scheduler.py:139-205"

# ── 입출력 ──
inputs:
  - "root"
  - "ctx"
  - "saved"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
  - "cron_expression"
calls_external:
  - "cfg"
  - "cron_lines"
  - "dumps"
  - "get"
  - "join"
  - "manifest"
  - "next"
  - "now"
  - "sched"
  - "str"
  - "strftime"
  - "write_text"
called_by:
  - "register_schedule"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
cron.txt / config.txt / schedule.json 을 한 번에 쓴다.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `append`, `cron_expression`
- 피호출(영향 전파 경로): `register_schedule`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
