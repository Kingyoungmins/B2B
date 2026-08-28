---
type: method
title: B2BHandler._addon_scheduler_dispatch
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self, method)"
role: "b2b_scheduler(애드온)가 맡는 경로면 여기서 응답까지 끝내고 True, 아니면 False."
role_source: docstring
version: "0.8.1"
loc: "serve_b2b.py:1693-1727"

# ── 입출력 ──
inputs:
  - "self"
  - "method"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_is_own_origin"
  - "handle_get"
  - "handle_post"
  - "handles_get"
  - "handles_post"
  - "read_json_body"
  - "send_json"
calls_external:
  - "_origin"
  - "err"
  - "get"
  - "result"
  - "route"
  - "split"
  - "str"
  - "strip"
  - "type"
called_by:
  - "B2BHandler.do_GET"
  - "B2BHandler.do_POST"
reads:
  - "self.headers"
  - "self.path"
  - "self.read_json_body"
  - "self.send_json"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
b2b_scheduler(애드온)가 맡는 경로면 여기서 응답까지 끝내고 True, 아니면 False.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_is_own_origin`, `handle_get`, `handle_post`, `handles_get`, `handles_post`, `read_json_body`, `send_json`
- 피호출(영향 전파 경로): `B2BHandler.do_GET`, `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
