---
type: endpoint
title: openAICompatAuthHeaders
module: config.js
lang: js
extraction: regex   # 정규식 근사
signature: "(apiKey, network)"
role: "openai-compat 호출 인증 헤더. ixi 게이트웨이는 Api-Key 헤더를 보고, dev-vllm(vLLM --api-key)은"
role_source: banner
version: "0.8.1"
loc: "config.js:52-52"

# ── 입출력 ──
inputs:
  - "apiKey"
  - "network"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "trim"
called_by:
  - "callLLMOneShot"
  - "callOpenAICompatOnce"
  - "effectiveDevVllmModel"
  - "openSettingsModal"
  - "runVersionCheck"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
openai-compat 호출 인증 헤더. ixi 게이트웨이는 Api-Key 헤더를 보고, dev-vllm(vLLM --api-key)은

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `callLLMOneShot`, `callOpenAICompatOnce`, `effectiveDevVllmModel`, `openSettingsModal`, `runVersionCheck`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
