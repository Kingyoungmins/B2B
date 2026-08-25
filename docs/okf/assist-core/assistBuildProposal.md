---
type: endpoint
title: assistBuildProposal
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(args)"
role: "LLM 이 낸 제안을 검증해 보관한다. 여기서 통과한 것만 카드로 뜬다."
role_source: banner
version: "0.8.0"
loc: "assist-core.js:779-779"

# ── 입출력 ──
inputs:
  - "args"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_assistGateReplacementCode"
  - "_assistProposalPeek"
  - "_assistStepIndexById"
  - "addField"
  - "assistHashCode"
  - "assistStoreProposal"
  - "isStepEnabled"
  - "norm"
  - "push"
  - "run"
calls_external:
  - "Python"
  - "String"
  - "filter"
  - "fn"
  - "forEach"
  - "includes"
  - "isArray"
  - "join"
  - "map"
  - "replace"
  - "slice"
  - "some"
  - "split"
  - "test"
  - "toLowerCase"
  - "transform"
  - "trim"
called_by:
  - "assistCloseOut"
  - "assistHandleUserMessage"
reads:
  - "state.chatHistory"
  - "state.inputs"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
LLM 이 낸 제안을 검증해 보관한다. 여기서 통과한 것만 카드로 뜬다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_assistGateReplacementCode`, `_assistProposalPeek`, `_assistStepIndexById`, `addField`, `assistHashCode`, `assistStoreProposal`, `isStepEnabled`, `norm`, `push`, `run`
- 피호출(영향 전파 경로): `assistCloseOut`, `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
