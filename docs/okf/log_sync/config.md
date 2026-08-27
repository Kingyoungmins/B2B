---
type: function
title: config
module: log_sync.py
lang: python
extraction: ast
signature: "()"
role: "환경변수 > 화면에서 넘겨준 설정 > 기본값 순으로 결정한다."
role_source: docstring
version: "0.8.0"
loc: "log_sync.py:109-120"

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
  - "_normalize_base"
calls_external:
  - "bool"
  - "get"
  - "int"
  - "interval"
  - "lower"
  - "max"
  - "min"
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
  - "DEFAULT_API_KEY"
  - "DEFAULT_INTERVAL_SECONDS"
  - "DEFAULT_UPSTREAM_URL"
  - "_CONFIG"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
환경변수 > 화면에서 넘겨준 설정 > 기본값 순으로 결정한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_env`, `_normalize_base`
- 피호출(영향 전파 경로): `B2BHandler.handle_workbook_upload`, `_endpoint`, `_loop`, `_post`, `_post_drm`, `_upstream_config`, `available`, `decrypt_bytes`, `encrypt_bytes`, `maybe_decrypt_upload`, `probe`, `secret_check`, `start`, `status`, `stop`, `tick`, `update_config`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
