---
type: endpoint
title: readOpenAICompatStream
module: llm-api.js
lang: js
extraction: regex   # 정규식 근사
signature: "(resp, options)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "llm-api.js:370-370"

# ── 입출력 ──
inputs:
  - "resp"
  - "options"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "looksLikeRepeatedReasoning"
  - "onDelta"
calls_external:
  - "Error"
  - "TextDecoder"
  - "decode"
  - "getReader"
  - "now"
  - "onReasoningDelta"
  - "onReasoningWarning"
  - "parse"
  - "pop"
  - "read"
  - "slice"
  - "split"
  - "startsWith"
  - "trim"
called_by:
  - "callOpenAICompatOnce"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `looksLikeRepeatedReasoning`, `onDelta`
- 피호출(영향 전파 경로): `callOpenAICompatOnce`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
