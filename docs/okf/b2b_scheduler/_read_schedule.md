---
type: function
title: _read_schedule
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(folder)"
role: "폴더 하나를 스케줄 한 건으로 읽는다. schedule.json 이 없으면 있는 만큼만 채운다."
role_source: docstring
version: "0.8.1"
loc: "b2b_scheduler.py:275-316"

# ── 입출력 ──
inputs:
  - "folder"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises:
  - "ValueError"

# ── 유기적 관계 ──
calls:
  - "_is_protected"
  - "describe_cron"
  - "parse_cron_expr"
  - "read_cron_file"
calls_external:
  - "ValueError"
  - "dict"
  - "expr"
  - "folder"
  - "get"
  - "is_file"
  - "isinstance"
  - "iterdir"
  - "len"
  - "loaded"
  - "loads"
  - "parsed"
  - "read_text"
  - "sorted"
  - "split"
  - "startswith"
  - "stat"
  - "str"
  - "strip"
  - "update"
called_by:
  - "list_schedules"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
폴더 하나를 스케줄 한 건으로 읽는다. schedule.json 이 없으면 있는 만큼만 채운다.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_is_protected`, `describe_cron`, `parse_cron_expr`, `read_cron_file`
- 피호출(영향 전파 경로): `list_schedules`

## 실패/예외
- `ValueError`
