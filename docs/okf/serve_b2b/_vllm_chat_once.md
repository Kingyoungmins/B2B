---
type: function
title: _vllm_chat_once
module: serve_b2b.py
lang: python
extraction: ast
signature: "(system, user, base, timeout=30)"
role: "서버측 vLLM 단발 호출 — 프록시와 같은 엔드포인트(enable_thinking=False)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:7551-7566"

# ── 입출력 ──
inputs:
  - "system"
  - "user"
  - "base"
  - "timeout"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "read"
calls_external:
  - "Request"
  - "body"
  - "decode"
  - "dumps"
  - "encode"
  - "get"
  - "loads"
  - "req"
  - "rstrip"
  - "target"
  - "timeout"
  - "urlopen"
called_by:
  - "skill_consolidate"
reads:
  - "VLLM_BASE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
서버측 vLLM 단발 호출 — 프록시와 같은 엔드포인트(enable_thinking=False).

## 사이드이펙트 & 주의
- 네트워크 호출

## 관계
- 호출: `read`
- 피호출(영향 전파 경로): `skill_consolidate`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
