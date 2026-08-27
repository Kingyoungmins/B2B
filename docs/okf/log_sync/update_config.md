---
type: function
title: update_config
module: log_sync.py
lang: python
extraction: ast
signature: "(values)"
role: "화면(F9 개발자 설정)의 버전 서버 주소/키를 그대로 물려받는다."
role_source: docstring
version: "0.8.0"
loc: "log_sync.py:123-167"

# ── 입출력 ──
inputs:
  - "values"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _CONFIG, _STATE"
raises: []

# ── 유기적 관계 ──
calls:
  - "_normalize_base"
  - "config"
  - "status"
  - "values"
calls_external:
  - "dict"
  - "get"
  - "int"
  - "isinstance"
  - "set"
  - "str"
  - "strip"
called_by:
  - "B2BHandler.do_POST"
  - "start"
reads:
  - "_CONFIG"
  - "_LOCK"
  - "_STATE"
  - "_WAKE"
writes:
  - "_CONFIG"
  - "_STATE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
화면(F9 개발자 설정)의 버전 서버 주소/키를 그대로 물려받는다.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _CONFIG, _STATE
- 변경 상태 `_CONFIG, _STATE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_normalize_base`, `config`, `status`, `values`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`, `start`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
