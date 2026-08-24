---
type: endpoint
title: assistHistoryMessages
module: assist-llm.js
lang: js
extraction: regex   # 정규식 근사
signature: "(extraTail)"
role: "state.assist.history 를 LLM 메시지 배열로. 도구 왕복(JSON)은 history 에 남기지 않는다 —"
role_source: banner
version: "0.7.5"
loc: "assist-llm.js:23-23"

# ── 입출력 ──
inputs:
  - "extraTail"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
calls_external:
  - "String"
  - "forEach"
  - "isArray"
  - "reverse"
  - "slice"
  - "trim"
called_by:
  - "callAssistLLM"
reads:
  - "state.assist"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
state.assist.history 를 LLM 메시지 배열로. 도구 왕복(JSON)은 history 에 남기지 않는다 —

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `callAssistLLM`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
