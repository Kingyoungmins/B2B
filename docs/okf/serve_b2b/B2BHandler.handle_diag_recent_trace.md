---
type: method
title: B2BHandler.handle_diag_recent_trace
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "[AI 도움 run.trace] 직전 실행의 서버 트레이스 타임라인 — 스텝이 '실제로 어느 워크북에서"
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:2415-2462"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_vba_trace_path"
  - "append"
  - "read_json_body"
  - "send_json"
calls_external:
  - "dict"
  - "err"
  - "events"
  - "get"
  - "int"
  - "isinstance"
  - "item"
  - "k"
  - "len"
  - "line"
  - "loads"
  - "max"
  - "min"
  - "read_text"
  - "splitlines"
  - "str"
  - "v"
called_by:
  - "B2BHandler.do_POST"
reads:
  - "self.read_json_body"
  - "self.send_json"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[AI 도움 run.trace] 직전 실행의 서버 트레이스 타임라인 — 스텝이 '실제로 어느 워크북에서

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_vba_trace_path`, `append`, `read_json_body`, `send_json`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
