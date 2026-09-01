---
type: function
title: _post_drm
module: secure_doc.py
lang: python
extraction: ast
signature: "(op, data, filename, extra_form=None, timeout=None, expect='stream')"
role: "POST {서버}/v1/drm/<op> (multipart). 성공=바이트, Gateway JSON 오류=SecureDocError."
role_source: docstring
version: "0.8.2"
loc: "secure_doc.py:201-263"

# ── 입출력 ──
inputs:
  - "op"
  - "data"
  - "filename"
  - "extra_form"
  - "timeout"
  - "expect"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크 호출"
raises:
  - "SecureDocError"

# ── 유기적 관계 ──
calls:
  - "_clean_name"
  - "_headers"
  - "_note_network_failure"
  - "_try_json"
  - "append"
  - "config"
  - "raw"
  - "read"
calls_external:
  - "Request"
  - "SecureDocError"
  - "_kind"
  - "body"
  - "bytes"
  - "cfg"
  - "data"
  - "encode"
  - "err"
  - "filename"
  - "get"
  - "getattr"
  - "items"
  - "join"
  - "lower"
  - "parts"
  - "req"
  - "str"
  - "strip"
  - "urlopen"
  - "uuid4"
called_by:
  - "decrypt_bytes"
  - "encrypt_bytes"
  - "secret_check"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
POST {서버}/v1/drm/<op> (multipart). 성공=바이트, Gateway JSON 오류=SecureDocError.

## 사이드이펙트 & 주의
- 네트워크 호출

## 관계
- 호출: `_clean_name`, `_headers`, `_note_network_failure`, `_try_json`, `append`, `config`, `raw`, `read`
- 피호출(영향 전파 경로): `decrypt_bytes`, `encrypt_bytes`, `secret_check`

## 실패/예외
- `SecureDocError`
