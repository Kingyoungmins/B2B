---
type: endpoint
title: autoRegenerateAsVbaFallback
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code, failures, context)"
role: "Python COM 정적 게이트를 (최초 생성 + 자동 재생성 PYTHON_STATIC_MAX_REGEN 회) 연속으로 통과하지"
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:2066-2066"

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
  - "callLLM"
  - "conditionalRowDeleteVbaHint"
  - "duplicateRowDeleteVbaHint"
  - "escapeHtml"
  - "filterToNewSheetVbaHint"
  - "latestUserRequestForSafety"
  - "scrollChatToBottom"
  - "setupStreamingAssistantMessage"
  - "toast"
calls_external:
  - "String"
  - "flush"
  - "getAiDisplayName"
  - "join"
  - "map"
  - "remove"
  - "setAnswer"
called_by:
  - "validateAssistantCodeBeforeApply"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
Python COM 정적 게이트를 (최초 생성 + 자동 재생성 PYTHON_STATIC_MAX_REGEN 회) 연속으로 통과하지

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `$`, `add`, `addAssistantReply`, `addMessage`, `callLLM`, `conditionalRowDeleteVbaHint`, `duplicateRowDeleteVbaHint`, `escapeHtml`, `filterToNewSheetVbaHint`, `latestUserRequestForSafety`, `scrollChatToBottom`, `setupStreamingAssistantMessage`, `toast`
- 피호출(영향 전파 경로): `validateAssistantCodeBeforeApply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
