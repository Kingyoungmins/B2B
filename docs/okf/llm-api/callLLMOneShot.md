---
type: endpoint
title: callLLMOneShot
module: llm-api.js
lang: js
extraction: regex   # 정규식 근사
signature: "(systemPrompt, userPrompt, options)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "llm-api.js:175-175"

# ── 입출력 ──
inputs:
  - "systemPrompt"
  - "userPrompt"
  - "options"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "applyQwenThinkControl"
  - "effectiveDevVllmModel"
  - "effectiveOpenAICompatBaseUrl"
  - "fetchOpenAICompat"
  - "openAICompatAuthHeaders"
  - "stripThink"
calls_external:
  - "Error"
  - "String"
  - "fetch"
  - "json"
  - "replace"
  - "shot"
  - "stringify"
  - "trim"
called_by:
  - "autoRepairPipelineStep"
  - "callAssistLLM"
  - "clarifyVerifierAskIfNeeded"
  - "explainPipelineErrorForUser"
  - "llmApplyIntentToStep"
  - "llmRegroupRecordedSteps"
  - "llmSplitRecordedVba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `applyQwenThinkControl`, `effectiveDevVllmModel`, `effectiveOpenAICompatBaseUrl`, `fetchOpenAICompat`, `openAICompatAuthHeaders`, `stripThink`
- 피호출(영향 전파 경로): `autoRepairPipelineStep`, `callAssistLLM`, `clarifyVerifierAskIfNeeded`, `explainPipelineErrorForUser`, `llmApplyIntentToStep`, `llmRegroupRecordedSteps`, `llmSplitRecordedVba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
