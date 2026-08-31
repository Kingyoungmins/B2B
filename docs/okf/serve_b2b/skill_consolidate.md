---
type: function
title: skill_consolidate
module: serve_b2b.py
lang: python
extraction: ast
signature: "(payload, base='')"
role: "녹화 스킬 코드를 '기존 ctx 헬퍼'로 최대한 통합(등가 게이트 통과 시에만)."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:7684-7705"

# ── 입출력 ──
inputs:
  - "payload"
  - "base"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_perf_trace"
  - "_vllm_chat_once"
calls_external:
  - "base"
  - "code"
  - "consolidate_via_llm_reason"
  - "get"
  - "s"
  - "strip"
  - "u"
called_by:
  - "B2BHandler.handle_skill_consolidate"
reads:
  - "VLLM_BASE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
녹화 스킬 코드를 '기존 ctx 헬퍼'로 최대한 통합(등가 게이트 통과 시에만).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_perf_trace`, `_vllm_chat_once`
- 피호출(영향 전파 경로): `B2BHandler.handle_skill_consolidate`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
