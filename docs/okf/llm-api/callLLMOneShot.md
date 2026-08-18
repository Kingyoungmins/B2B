---
type: endpoint
title: callLLMOneShot
module: llm-api.js
lang: js
extraction: regex   # 정규식 근사
signature: "(systemPrompt, userPrompt, options)"
role: "[#2] 대화 기록과 무관한 단발 LLM 호출(에러를 사용자 눈높이로 해설할 때 등)."
role_source: banner
version: "0.7.4"
loc: "llm-api.js:118-118"

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
timestamp: "0.7.4-gen"
---

## 역할
[#2] 대화 기록과 무관한 단발 LLM 호출(에러를 사용자 눈높이로 해설할 때 등).

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `applyQwenThinkControl`, `effectiveOpenAICompatBaseUrl`, `fetchOpenAICompat`, `openAICompatAuthHeaders`, `stripThink`
- 피호출(영향 전파 경로): `autoRepairPipelineStep`, `callAssistLLM`, `clarifyVerifierAskIfNeeded`, `explainPipelineErrorForUser`, `llmApplyIntentToStep`, `llmRegroupRecordedSteps`, `llmSplitRecordedVba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
