---
type: function
title: _note_llm_usage
module: serve_b2b.py
lang: python
extraction: ast
signature: "(tail, model, stream, path)"
role: "프록시가 relay 를 끝낸 뒤 usage 를 트레이스로 남긴다 — 실패해도 조용히(계측은 덤)."
role_source: docstring
version: "0.8.4"
loc: "serve_b2b.py:368-379"

# ── 입출력 ──
inputs:
  - "tail"
  - "model"
  - "stream"
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_extract_llm_usage"
  - "_vba_trace"
  - "stream"
calls_external:
  - "bool"
  - "str"
  - "tail"
called_by:
  - "B2BHandler.proxy"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
프록시가 relay 를 끝낸 뒤 usage 를 트레이스로 남긴다 — 실패해도 조용히(계측은 덤).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_extract_llm_usage`, `_vba_trace`, `stream`
- 피호출(영향 전파 경로): `B2BHandler.proxy`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
