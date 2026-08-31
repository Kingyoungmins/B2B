---
type: function
title: build_request
module: log_dash.py
lang: python
extraction: ast
signature: "(sub_path)"
role: "프록시할 urllib Request 를 만든다. (요청 객체, 오류메시지) 중 하나만 채워 돌려준다."
role_source: docstring
version: "0.8.2"
loc: "log_dash.py:50-68"

# ── 입출력 ──
inputs:
  - "sub_path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "_upstream_config"
  - "allowed"
calls_external:
  - "Request"
  - "admin_key"
  - "get"
  - "headers"
  - "lstrip"
  - "quote"
  - "rstrip"
  - "str"
  - "strip"
  - "sub_path"
  - "url"
called_by:
  - "stream"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
프록시할 urllib Request 를 만든다. (요청 객체, 오류메시지) 중 하나만 채워 돌려준다.

## 사이드이펙트 & 주의
- 네트워크 호출

## 관계
- 호출: `_upstream_config`, `allowed`
- 피호출(영향 전파 경로): `stream`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
