---
type: endpoint
title: autoRegenerateForMissingCode
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(fullText, problems, context)"
role: "설명만/주석만 응답을 받았을 때 교정 지시와 함께 자동 재생성한다(최대 NO_CODE_MAX_REGEN 회)."
role_source: banner
version: "0.7.3"
loc: "chat-ui.js:2307-2307"

# ── 입출력 ──
inputs:
  - "fullText"
  - "problems"
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
  - "callLLM"
  - "escapeHtml"
  - "getSkillEngine"
  - "latestUserRequestForSafety"
  - "scrollChatToBottom"
  - "setupStreamingAssistantMessage"
  - "toast"
calls_external:
  - "B2BSkill"
  - "Number"
  - "String"
  - "flush"
  - "getAiDisplayName"
  - "join"
  - "map"
  - "remove"
  - "setAnswer"
  - "transform"
called_by:
  - "addAssistantReply"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
설명만/주석만 응답을 받았을 때 교정 지시와 함께 자동 재생성한다(최대 NO_CODE_MAX_REGEN 회).

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `$`, `add`, `addAssistantReply`, `addMessage`, `callLLM`, `escapeHtml`, `getSkillEngine`, `latestUserRequestForSafety`, `scrollChatToBottom`, `setupStreamingAssistantMessage`, `toast`
- 피호출(영향 전파 경로): `addAssistantReply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
