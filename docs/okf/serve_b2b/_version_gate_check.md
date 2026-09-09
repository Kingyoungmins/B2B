---
type: function
title: _version_gate_check
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "버전 서버 /v1/version 의 allowed 목록과 지금 버전을 대조한다. 반환은 팝업에 필요한 전부."
role_source: docstring
version: "0.8.4"
loc: "serve_b2b.py:386-431"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "_current_app_version"
  - "_normalize_version_text"
  - "_vba_trace"
  - "allowed"
  - "config"
  - "read"
calls_external:
  - "Request"
  - "cur"
  - "data"
  - "decode"
  - "dict"
  - "err"
  - "get"
  - "headers"
  - "isinstance"
  - "join"
  - "loads"
  - "req"
  - "rstrip"
  - "str"
  - "urlopen"
  - "v"
called_by:
  - "version_gate_status"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
버전 서버 /v1/version 의 allowed 목록과 지금 버전을 대조한다. 반환은 팝업에 필요한 전부.

## 사이드이펙트 & 주의
- 네트워크 호출

## 관계
- 호출: `_current_app_version`, `_normalize_version_text`, `_vba_trace`, `allowed`, `config`, `read`
- 피호출(영향 전파 경로): `version_gate_status`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
