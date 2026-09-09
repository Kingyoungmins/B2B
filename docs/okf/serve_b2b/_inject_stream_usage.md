---
type: function
title: _inject_stream_usage
module: serve_b2b.py
lang: python
extraction: ast
signature: "(body)"
role: "LLM 요청 본문에서 (모델, 스트림 여부)를 읽고, 스트리밍이면 stream_options.include_usage"
role_source: docstring
version: "0.8.4"
loc: "serve_b2b.py:322-344"

# ── 입출력 ──
inputs:
  - "body"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "bool"
  - "data"
  - "decode"
  - "dict"
  - "dumps"
  - "encode"
  - "get"
  - "isinstance"
  - "loads"
  - "so"
  - "str"
called_by:
  - "B2BHandler.proxy"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
LLM 요청 본문에서 (모델, 스트림 여부)를 읽고, 스트리밍이면 stream_options.include_usage

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `B2BHandler.proxy`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
