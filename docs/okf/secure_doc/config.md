---
type: function
title: config
module: secure_doc.py
lang: python
extraction: ast
signature: "()"
role: "주소/키는 log_sync(로그 전송)와 같은 곳을 본다 — F9 에서 주소를 바꾸면 여기도 따라온다."
role_source: docstring
version: "0.8.2"
loc: "secure_doc.py:99-130"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_env"
  - "default_account"
calls_external:
  - "bool"
  - "float"
  - "lower"
  - "max"
  - "min"
  - "rstrip"
  - "timeout"
  - "url"
called_by:
  - "B2BHandler.handle_workbook_upload"
  - "_endpoint"
  - "_loop"
  - "_post"
  - "_post_drm"
  - "_upstream_config"
  - "available"
  - "decrypt_bytes"
  - "encrypt_bytes"
  - "maybe_decrypt_upload"
  - "probe"
  - "secret_check"
  - "start"
  - "status"
  - "stop"
  - "tick"
  - "update_config"
reads:
  - "DEFAULT_TIMEOUT_SECONDS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
주소/키는 log_sync(로그 전송)와 같은 곳을 본다 — F9 에서 주소를 바꾸면 여기도 따라온다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_env`, `default_account`
- 피호출(영향 전파 경로): `B2BHandler.handle_workbook_upload`, `_endpoint`, `_loop`, `_post`, `_post_drm`, `_upstream_config`, `available`, `decrypt_bytes`, `encrypt_bytes`, `maybe_decrypt_upload`, `probe`, `secret_check`, `start`, `status`, `stop`, `tick`, `update_config`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
