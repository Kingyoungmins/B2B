---
type: function
title: _vllm_health_probe
module: serve_b2b.py
lang: python
extraction: ast
signature: "(base='', timeout=2.0)"
role: "vLLM 도달성 프로브 — /v1/models 를 짧은 타임아웃으로 확인(캐시 30s)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:7478-7500"

# ── 입출력 ──
inputs:
  - "base"
  - "timeout"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크 호출"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Request"
  - "err"
  - "get"
  - "int"
  - "req"
  - "rstrip"
  - "str"
  - "time"
  - "timeout"
  - "update"
  - "urlopen"
called_by: []
reads:
  - "VLLM_BASE"
  - "_VLLM_PROBE_CACHE"
  - "_VLLM_PROBE_TTL"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
vLLM 도달성 프로브 — /v1/models 를 짧은 타임아웃으로 확인(캐시 30s).

## 사이드이펙트 & 주의
- 네트워크 호출

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
