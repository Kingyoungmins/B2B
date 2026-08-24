---
type: endpoint
title: addAssistantReply
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(fullText, replyContext)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "chat-ui.js:2396-2396"

# ── 입출력 ──
inputs:
  - "fullText"
  - "replyContext"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
  - "applyLogic"
  - "assistantReplyCodeProblems"
  - "autoRegenerateForMissingCode"
  - "bindChatHistoryEntryToMessage"
  - "createReasoningBox"
  - "escapeHtml"
  - "extractCode"
  - "extractDescription"
  - "finalizeActionButtonFromResult"
  - "inferCodeLanguage"
  - "insertLogic"
  - "openInsertPositionDialog"
  - "originHistIdForPrompt"
  - "originHistIdForPromptLoose"
  - "renderEditingBanner"
  - "replaceLogicAt"
  - "replyStepPrompt"
  - "restoreActionButtonsAfterFailure"
  - "runApply"
  - "runEditApply"
  - "runInsert"
  - "scrollChatToBottom"
  - "showCodeGuardBlock"
  - "toast"
  - "traceClientUiEvent"
  - "uid"
  - "validateAssistantCodeBeforeApply"
calls_external:
  - "Number"
  - "String"
  - "appendChild"
  - "click"
  - "createElement"
  - "find"
  - "findIndex"
  - "insertBefore"
  - "isFinite"
  - "join"
  - "replace"
  - "setTimeout"
  - "toLowerCase"
  - "trim"
called_by:
  - "autoRegenerateAsVbaFallback"
  - "autoRegenerateForMissingCode"
  - "autoRegenerateForStaticSafety"
  - "offerMissingDependencySkillCandidate"
  - "requestErrorRecovery"
  - "sendChat"
  - "showThinkRetryPrompt"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 타이머

## 관계
- 호출: `$`, `applyLogic`, `assistantReplyCodeProblems`, `autoRegenerateForMissingCode`, `bindChatHistoryEntryToMessage`, `createReasoningBox`, `escapeHtml`, `extractCode`, `extractDescription`, `finalizeActionButtonFromResult`, `inferCodeLanguage`, `insertLogic`, `openInsertPositionDialog`, `originHistIdForPrompt`, `originHistIdForPromptLoose`, `renderEditingBanner`, `replaceLogicAt`, `replyStepPrompt`, `restoreActionButtonsAfterFailure`, `runApply`, `runEditApply`, `runInsert`, `scrollChatToBottom`, `showCodeGuardBlock`, `toast`, `traceClientUiEvent`, `uid`, `validateAssistantCodeBeforeApply`
- 피호출(영향 전파 경로): `autoRegenerateAsVbaFallback`, `autoRegenerateForMissingCode`, `autoRegenerateForStaticSafety`, `offerMissingDependencySkillCandidate`, `requestErrorRecovery`, `sendChat`, `showThinkRetryPrompt`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
