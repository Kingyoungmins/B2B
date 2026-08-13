---
type: endpoint
title: requestErrorRecovery
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(stepIdx, errorInfo, userNote)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "chat-ui.js:2887-2887"

# ── 입출력 ──
inputs:
  - "stepIdx"
  - "errorInfo"
  - "userNote"
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
  - "buildSchemaSummary"
  - "callLLM"
  - "col"
  - "escapeHtml"
  - "findInputBySheet"
  - "getSkillEngine"
  - "inferPipelineStepLanguage"
  - "isPythonComReadLimitRuntimeError"
  - "isThinkModeEnabled"
  - "latestUserRequestForSafety"
  - "notePythonRuntimeFailure"
  - "resolveErrorRecoveryStepIndex"
  - "scrollChatToBottom"
  - "setStatus"
  - "setupStreamingAssistantMessage"
  - "showThinkRetryPrompt"
  - "toast"
  - "traceClientUiEvent"
  - "userExplicitlyRequestsPython"
  - "userExplicitlyRequestsVba"
calls_external:
  - "AbortController"
  - "B2BSkill"
  - "COM"
  - "Number"
  - "Python"
  - "SpecialCells"
  - "String"
  - "Workbooks"
  - "Worksheets"
  - "abort"
  - "filter"
  - "flush"
  - "indexOf"
  - "isInteger"
  - "join"
  - "map"
  - "remove"
  - "setAnswer"
  - "setReasoning"
  - "slice"
  - "stopped"
  - "test"
  - "transform"
  - "trim"
  - "true"
called_by:
  - "reportPipelineError"
  - "showRunnerPipelineError"
reads:
  - "state.chatHistory"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `$`, `add`, `addAssistantReply`, `addMessage`, `buildSchemaSummary`, `callLLM`, `col`, `escapeHtml`, `findInputBySheet`, `getSkillEngine`, `inferPipelineStepLanguage`, `isPythonComReadLimitRuntimeError`, `isThinkModeEnabled`, `latestUserRequestForSafety`, `notePythonRuntimeFailure`, `resolveErrorRecoveryStepIndex`, `scrollChatToBottom`, `setStatus`, `setupStreamingAssistantMessage`, `showThinkRetryPrompt`, `toast`, `traceClientUiEvent`, `userExplicitlyRequestsPython`, `userExplicitlyRequestsVba`
- 피호출(영향 전파 경로): `reportPipelineError`, `showRunnerPipelineError`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
