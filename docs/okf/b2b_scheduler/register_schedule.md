---
type: function
title: register_schedule
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(payload)"
role: "스케줄 한 건을 바탕화면 ESTB 아래에 저장한다."
role_source: docstring
version: "0.8.1"
loc: "b2b_scheduler.py:208-254"

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
  - "_is_protected"
  - "_write_schedule_files"
  - "append"
  - "safe_component"
  - "schedule_root"
calls_external:
  - "b64decode"
  - "blob"
  - "ctx"
  - "dict"
  - "fname"
  - "get"
  - "join"
  - "len"
  - "mkdir"
  - "payload"
  - "root"
  - "saved"
  - "str"
  - "strip"
  - "unlinked"
  - "write_bytes"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
스케줄 한 건을 바탕화면 ESTB 아래에 저장한다.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_is_protected`, `_write_schedule_files`, `append`, `safe_component`, `schedule_root`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
