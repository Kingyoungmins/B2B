---
type: endpoint
title: assistHandleUserMessage
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(userText, ui, attachImages)"
role: "사용자 발화 1건 처리. UI 콜백으로 진행 상황을 알린다."
role_source: banner
version: "0.8.0"
loc: "assist-core.js:337-337"

# ── 입출력 ──
inputs:
  - "userText"
  - "ui"
  - "attachImages"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: assist"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "armStall"
  - "assistBuildProposal"
  - "assistCallSignature"
  - "assistCloseOut"
  - "assistHasChineseLeak"
  - "assistLooksLikeDanglingAnnouncement"
  - "assistLooksLikeFakeButtonNarration"
  - "assistLooksLikeProseRequestSuggestion"
  - "assistParseAction"
  - "assistProposalIsVerifiable"
  - "assistPushAssistant"
  - "assistRunTool"
  - "assistStripActionBlock"
  - "assistStripPromptEcho"
  - "assistSystemPrompt"
  - "assistVerifyProposal"
  - "callAssistLLM"
  - "callLLM"
  - "push"
  - "say"
calls_external:
  - "AbortController"
  - "RegExp"
  - "Set"
  - "String"
  - "abort"
  - "async"
  - "clear"
  - "clearTimeout"
  - "done"
  - "filter"
  - "final"
  - "handoff"
  - "has"
  - "isArray"
  - "join"
  - "map"
  - "now"
  - "onHandoff"
  - "onProposal"
  - "onReport"
  - "onStatus"
  - "onToolTrace"
  - "read"
  - "reduce"
  - "replace"
  - "request"
  - "setTimeout"
  - "slice"
  - "splice"
  - "split"
  - "steps"
  - "stringify"
  - "toLocaleString"
  - "trim"
called_by:
  - "assistHandleBridgeMessage"
  - "assistSubmit"
reads:
  - "state.assist"
writes:
  - "assist"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
사용자 발화 1건 처리. UI 콜백으로 진행 상황을 알린다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: assist
- 타이머
- 변경 상태 `assist` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `add`, `armStall`, `assistBuildProposal`, `assistCallSignature`, `assistCloseOut`, `assistHasChineseLeak`, `assistLooksLikeDanglingAnnouncement`, `assistLooksLikeFakeButtonNarration`, `assistLooksLikeProseRequestSuggestion`, `assistParseAction`, `assistProposalIsVerifiable`, `assistPushAssistant`, `assistRunTool`, `assistStripActionBlock`, `assistStripPromptEcho`, `assistSystemPrompt`, `assistVerifyProposal`, `callAssistLLM`, `callLLM`, `push`, `say`
- 피호출(영향 전파 경로): `assistHandleBridgeMessage`, `assistSubmit`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
