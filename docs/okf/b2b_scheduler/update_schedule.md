---
type: function
title: update_schedule
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(payload)"
role: "등록된 스케줄의 실행 주기를 바꾼다 — cron.txt 만 다시 쓴다."
role_source: docstring
version: "0.8.1"
loc: "b2b_scheduler.py:392-426"

# ── 입출력 ──
inputs:
  - "payload"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
  - "cron_expression"
  - "read_cron_file"
  - "safe_component"
  - "schedule_root"
calls_external:
  - "created_line"
  - "get"
  - "is_dir"
  - "join"
  - "lines"
  - "next"
  - "now"
  - "root"
  - "sched"
  - "startswith"
  - "str"
  - "strftime"
  - "write_text"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
등록된 스케줄의 실행 주기를 바꾼다 — cron.txt 만 다시 쓴다.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `append`, `cron_expression`, `read_cron_file`, `safe_component`, `schedule_root`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
