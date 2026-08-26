---
type: endpoint
title: _looksLikeRepeatedRequest
module: llm-api.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text, selfPushed)"
role: "→ 같은 요청의 반복 자체를 '직전 결과가 기대와 달랐다'는 신호로 본다."
role_source: banner
version: "0.8.0"
loc: "llm-api.js:27-27"

# ── 입출력 ──
inputs:
  - "text"
  - "selfPushed"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "norm"
calls_external:
  - "String"
  - "filter"
  - "includes"
  - "isArray"
  - "map"
  - "pop"
  - "replace"
  - "slice"
  - "some"
  - "toLowerCase"
called_by:
  - "callLLM"
reads:
  - "state.chatHistory"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
→ 같은 요청의 반복 자체를 '직전 결과가 기대와 달랐다'는 신호로 본다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `norm`
- 피호출(영향 전파 경로): `callLLM`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
