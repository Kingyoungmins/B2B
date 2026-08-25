---
type: endpoint
title: sendChat
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "chat-ui.js:3647-3647"

# ── 입출력 ──
inputs: []
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
  - "appendSameFormatSheetsIntent"
  - "assistIsBusy"
  - "augmentUserPromptWithMentions"
  - "bindChatHistoryEntryToMessage"
  - "callLLM"
  - "clarifyVerifierAskIfNeeded"
  - "clearDataIntent"
  - "clearViewerDragSelection"
  - "columnCopyClearIntent"
  - "columnCopyIntent"
  - "columnMoveIntent"
  - "columnSwapIntent"
  - "conditionalRowDeleteIntent"
  - "copyValuesIntent"
  - "ctxHelperPreferredIntent"
  - "dedupeIntent"
  - "duplicateRowDeleteIntent"
  - "escapeHtml"
  - "exactSheetNameReminder"
  - "fillSumColIntent"
  - "filterToNewSheetIntent"
  - "hideUnhideIntent"
  - "isThinkModeEnabled"
  - "lookupJoinIntent"
  - "matchFillIntent"
  - "monthShiftIntent"
  - "multiValueLookupIntent"
  - "pivotIntent"
  - "scrollChatToBottom"
  - "setStatus"
  - "setupStreamingAssistantMessage"
  - "shouldRouteRequestToPython"
  - "shouldRouteRequestToVba"
  - "shouldRouteSimpleStructureEditToPython"
  - "showThinkRetryPrompt"
  - "simpleRangeArithmeticIntent"
  - "splitColumnIntent"
  - "toast"
  - "totalRowIntent"
  - "userExplicitlyRequestsForceProceed"
  - "userExplicitlyRequestsPython"
  - "userExplicitlyRequestsVba"
calls_external:
  - "AbortController"
  - "B2BSkill"
  - "Cells"
  - "Columns"
  - "Len"
  - "Offset"
  - "Resize"
  - "Rows"
  - "SUM"
  - "SpecialCells"
  - "Subtotal"
  - "VBA"
  - "abort"
  - "add_total_row"
  - "append_same_format_sheets"
  - "book"
  - "clear"
  - "copy_col"
  - "copy_sheet"
  - "copy_values"
  - "debug"
  - "dedupe"
  - "fill_sum_col"
  - "filter"
  - "filter_to_sheet"
  - "find_header"
  - "flush"
  - "hide_cols"
  - "join"
  - "lookup"
  - "match_fill"
  - "move_col_clear"
  - "move_cols"
  - "normalize"
  - "pivot"
  - "read"
  - "remove"
  - "rename_sheet"
  - "setAnswer"
  - "setReasoning"
called_by: []
reads:
  - "state.editingStepId"
  - "state.inputs"
  - "state.output"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `$`, `add`, `addAssistantReply`, `addMessage`, `appendSameFormatSheetsIntent`, `assistIsBusy`, `augmentUserPromptWithMentions`, `bindChatHistoryEntryToMessage`, `callLLM`, `clarifyVerifierAskIfNeeded`, `clearDataIntent`, `clearViewerDragSelection`, `columnCopyClearIntent`, `columnCopyIntent`, `columnMoveIntent`, `columnSwapIntent`, `conditionalRowDeleteIntent`, `copyValuesIntent`, `ctxHelperPreferredIntent`, `dedupeIntent`, `duplicateRowDeleteIntent`, `escapeHtml`, `exactSheetNameReminder`, `fillSumColIntent`, `filterToNewSheetIntent`, `hideUnhideIntent`, `isThinkModeEnabled`, `lookupJoinIntent`, `matchFillIntent`, `monthShiftIntent`, `multiValueLookupIntent`, `pivotIntent`, `scrollChatToBottom`, `setStatus`, `setupStreamingAssistantMessage`, `shouldRouteRequestToPython`, `shouldRouteRequestToVba`, `shouldRouteSimpleStructureEditToPython`, `showThinkRetryPrompt`, `simpleRangeArithmeticIntent`, `splitColumnIntent`, `toast`, `totalRowIntent`, `userExplicitlyRequestsForceProceed`, `userExplicitlyRequestsPython`, `userExplicitlyRequestsVba`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
