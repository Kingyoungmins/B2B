---
type: function
title: stream
module: log_dash.py
lang: python
extraction: ast
signature: "(sub_path, write, send_headers, timeout=60.0)"
role: "수집 서버 응답을 그대로 흘려보낸다."
role_source: docstring
version: "0.8.0"
loc: "log_dash.py:71-106"

# ── 입출력 ──
inputs:
  - "sub_path"
  - "write"
  - "send_headers"
  - "timeout"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "build_request"
  - "read"
  - "write"
calls_external:
  - "CHUNK"
  - "body"
  - "chunk"
  - "clen"
  - "ctype"
  - "fname"
  - "get"
  - "int"
  - "len"
  - "req"
  - "send_headers"
  - "sub_path"
  - "timeout"
  - "urlopen"
called_by:
  - "B2BHandler.do_GET"
  - "_unmarshal_app"
  - "excel_record_start"
reads:
  - "CHUNK"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
수집 서버 응답을 그대로 흘려보낸다.

## 사이드이펙트 & 주의
- 네트워크 호출

## 관계
- 호출: `build_request`, `read`, `write`
- 피호출(영향 전파 경로): `B2BHandler.do_GET`, `_unmarshal_app`, `excel_record_start`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
