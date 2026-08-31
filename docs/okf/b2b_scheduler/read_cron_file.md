---
type: function
title: read_cron_file
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(folder)"
role: "cron.txt 에서 (식, 주석줄들) 을 뽑는다."
role_source: docstring
version: "0.8.2"
loc: "b2b_scheduler.py:373-389"

# ── 입출력 ──
inputs:
  - "folder"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
calls_external:
  - "is_file"
  - "read_text"
  - "splitlines"
  - "startswith"
  - "strip"
  - "t"
called_by:
  - "_read_schedule"
  - "update_schedule"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
cron.txt 에서 (식, 주석줄들) 을 뽑는다.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `append`
- 피호출(영향 전파 경로): `_read_schedule`, `update_schedule`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
