---
type: function
title: _post
module: log_sync.py
lang: python
extraction: ast
signature: "(path, payload, timeout=15.0)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "log_sync.py:227-241"

# ── 입출력 ──
inputs:
  - "path"
  - "payload"
  - "timeout"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "_endpoint"
  - "config"
  - "read"
calls_external:
  - "Request"
  - "body"
  - "data"
  - "decode"
  - "dumps"
  - "encode"
  - "hasattr"
  - "headers"
  - "loads"
  - "path"
  - "payload"
  - "req"
  - "resp"
  - "str"
  - "timeout"
  - "urlopen"
called_by:
  - "_ensure_session"
  - "_send_log_file"
  - "_send_skill"
  - "stop"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 네트워크 호출

## 관계
- 호출: `_endpoint`, `config`, `read`
- 피호출(영향 전파 경로): `_ensure_session`, `_send_log_file`, `_send_skill`, `stop`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
