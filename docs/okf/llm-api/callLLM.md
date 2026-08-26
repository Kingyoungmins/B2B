---
type: endpoint
title: callLLM
module: llm-api.js
lang: js
extraction: regex   # 정규식 근사
signature: "(userMessage, options)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "llm-api.js:45-45"

# ── 입출력 ──
inputs:
  - "userMessage"
  - "options"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "_looksLikeCorrection"
  - "_looksLikeRepeatedRequest"
  - "buildEditingContext"
  - "buildSchemaSummary"
  - "callAnthropic"
  - "callOpenAICompat"
  - "getSkillEngine"
  - "isThinkModeEnabled"
  - "push"
  - "skillEnginePromptNote"
  - "uid"
calls_external:
  - "String"
  - "b2bReportUpstreamError"
  - "b2bReportUpstreamOk"
  - "findIndex"
  - "now"
  - "random"
called_by:
  - "assistCloseOut"
  - "assistHandleUserMessage"
  - "autoRegenerateAsVbaFallback"
  - "autoRegenerateForMissingCode"
  - "autoRegenerateForStaticSafety"
  - "autoRepairPipelineStep"
  - "requestErrorRecovery"
  - "sendChat"
  - "showThinkRetryPrompt"
reads:
  - "state.chatHistory"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `_looksLikeCorrection`, `_looksLikeRepeatedRequest`, `buildEditingContext`, `buildSchemaSummary`, `callAnthropic`, `callOpenAICompat`, `getSkillEngine`, `isThinkModeEnabled`, `push`, `skillEnginePromptNote`, `uid`
- 피호출(영향 전파 경로): `assistCloseOut`, `assistHandleUserMessage`, `autoRegenerateAsVbaFallback`, `autoRegenerateForMissingCode`, `autoRegenerateForStaticSafety`, `autoRepairPipelineStep`, `requestErrorRecovery`, `sendChat`, `showThinkRetryPrompt`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
