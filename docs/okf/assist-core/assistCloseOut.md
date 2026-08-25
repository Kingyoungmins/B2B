---
type: endpoint
title: assistCloseOut
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "반환값 true = 답을 냈다(호출자는 그대로 종료). false 면 예전 안내로 떨어진다."
role_source: banner
version: "0.7.5"
loc: "assist-core.js:398-398"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "assistBuildProposal"
  - "assistHasChineseLeak"
  - "assistParseAction"
  - "assistProposalIsVerifiable"
  - "assistPushAssistant"
  - "assistStripActionBlock"
  - "assistSystemPrompt"
  - "assistVerifyProposal"
  - "callLLM"
  - "push"
  - "say"
calls_external:
  - "RegExp"
  - "String"
  - "filter"
  - "isArray"
  - "join"
  - "map"
  - "onHandoff"
  - "onProposal"
  - "onReport"
  - "replace"
  - "slice"
  - "split"
  - "steps"
  - "trim"
called_by:
  - "assistHandleUserMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
반환값 true = 답을 냈다(호출자는 그대로 종료). false 면 예전 안내로 떨어진다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `assistBuildProposal`, `assistHasChineseLeak`, `assistParseAction`, `assistProposalIsVerifiable`, `assistPushAssistant`, `assistStripActionBlock`, `assistSystemPrompt`, `assistVerifyProposal`, `callLLM`, `push`, `say`
- 피호출(영향 전파 경로): `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
