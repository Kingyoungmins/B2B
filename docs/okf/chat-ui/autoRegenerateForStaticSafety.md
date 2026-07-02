---
type: endpoint
title: autoRegenerateForStaticSafety
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code, failures, context)"
role: "정적 안전 위반 시 Qwen 을 자동 재호출해 고친 코드를 받아 다시 검사 흐름에 태운다."
role_source: banner
version: "0.5.18"
loc: "chat-ui.js:1668-1668"

# ── 입출력 ──
inputs:
  - "code"
  - "failures"
  - "context"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
  - "add"
  - "addAssistantReply"
  - "addMessage"
  - "buildPythonStaticSafetyRegenPrompt"
  - "buildStaticSafetyRegenPrompt"
  - "callLLM"
  - "escapeHtml"
  - "latestUserRequestForSafety"
  - "scrollChatToBottom"
  - "setupStreamingAssistantMessage"
  - "toast"
calls_external:
  - "Number"
  - "String"
  - "degenerate"
  - "flush"
  - "getAiDisplayName"
  - "remove"
  - "setAnswer"
  - "some"
  - "test"
called_by:
  - "validateAssistantCodeBeforeApply"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
정적 안전 위반 시 Qwen 을 자동 재호출해 고친 코드를 받아 다시 검사 흐름에 태운다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `$`, `add`, `addAssistantReply`, `addMessage`, `buildPythonStaticSafetyRegenPrompt`, `buildStaticSafetyRegenPrompt`, `callLLM`, `escapeHtml`, `latestUserRequestForSafety`, `scrollChatToBottom`, `setupStreamingAssistantMessage`, `toast`
- 피호출(영향 전파 경로): `validateAssistantCodeBeforeApply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
