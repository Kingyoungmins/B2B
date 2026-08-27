---
type: method
title: B2BHandler.proxy
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:2736-2822"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "end_headers"
  - "range"
  - "read"
  - "value"
  - "write"
calls_external:
  - "PROXY_RETRY_ATTEMPTS"
  - "Request"
  - "body"
  - "chunk"
  - "encode"
  - "flush"
  - "get"
  - "headers"
  - "int"
  - "items"
  - "key"
  - "len"
  - "length"
  - "lower"
  - "max"
  - "payload"
  - "req"
  - "rstrip"
  - "send_header"
  - "send_response"
  - "sleep"
  - "startswith"
  - "str"
  - "strip"
  - "target"
  - "urlopen"
called_by:
  - "B2BHandler.do_GET"
  - "B2BHandler.do_POST"
reads:
  - "PROXY_RETRY_ATTEMPTS"
  - "PROXY_RETRY_BASE_DELAY"
  - "VLLM_BASE"
  - "self.command"
  - "self.end_headers"
  - "self.headers"
  - "self.path"
  - "self.rfile"
  - "self.send_header"
  - "self.send_response"
  - "self.wfile"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 네트워크 호출

## 관계
- 호출: `end_headers`, `range`, `read`, `value`, `write`
- 피호출(영향 전파 경로): `B2BHandler.do_GET`, `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
