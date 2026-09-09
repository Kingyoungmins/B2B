---
type: function
title: _extract_llm_usage
module: serve_b2b.py
lang: python
extraction: ast
signature: "(tail)"
role: "응답(비스트림 JSON 또는 SSE 꼬리)에서 마지막 usage 블록을 뽑는다. 실패 시 None."
role_source: docstring
version: "0.8.4"
loc: "serve_b2b.py:350-365"

# ── 입출력 ──
inputs:
  - "tail"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "dict"
  - "finditer"
  - "get"
  - "group"
  - "int"
  - "isinstance"
  - "loads"
  - "u"
called_by:
  - "_note_llm_usage"
reads:
  - "_USAGE_RE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
응답(비스트림 JSON 또는 SSE 꼬리)에서 마지막 usage 블록을 뽑는다. 실패 시 None.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_note_llm_usage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
