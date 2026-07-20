---
type: endpoint
title: callOpenAICompatOnce
module: llm-api.js
lang: js
extraction: regex   # 정규식 근사
signature: "(system, options)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "llm-api.js:213-213"

# ── 입출력 ──
inputs:
  - "system"
  - "options"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "applyQwenThinkControl"
  - "effectiveOpenAICompatBaseUrl"
  - "fetchOpenAICompat"
  - "getLLMChatHistory"
  - "isRetryableOpenAICompatStatus"
  - "push"
  - "readOpenAICompatStream"
  - "uid"
calls_external:
  - "Error"
  - "String"
  - "degenerate"
  - "get"
  - "includes"
  - "json"
  - "n"
  - "now"
  - "random"
  - "slice"
  - "stringify"
  - "test"
  - "text"
called_by:
  - "callOpenAICompat"
reads:
  - "state.chatHistory"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `applyQwenThinkControl`, `effectiveOpenAICompatBaseUrl`, `fetchOpenAICompat`, `getLLMChatHistory`, `isRetryableOpenAICompatStatus`, `push`, `readOpenAICompatStream`, `uid`
- 피호출(영향 전파 경로): `callOpenAICompat`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
