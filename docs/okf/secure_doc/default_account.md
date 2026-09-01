---
type: function
title: default_account
module: secure_doc.py
lang: python
extraction: ast
signature: "()"
role: "MIP requestorAccount 기본값 — whoami 로 찍힌 이름의 '사용자' 부분."
role_source: docstring
version: "0.8.2"
loc: "secure_doc.py:73-96"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _ACCOUNT_CACHE"
raises: []

# ── 유기적 관계 ──
calls:
  - "current_user"
  - "replace"
calls_external:
  - "get"
  - "lower"
  - "rsplit"
  - "str"
  - "strip"
called_by:
  - "config"
reads:
  - "_ACCOUNT_CACHE"
writes:
  - "_ACCOUNT_CACHE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
MIP requestorAccount 기본값 — whoami 로 찍힌 이름의 '사용자' 부분.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _ACCOUNT_CACHE
- 변경 상태 `_ACCOUNT_CACHE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `current_user`, `replace`
- 피호출(영향 전파 경로): `config`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
