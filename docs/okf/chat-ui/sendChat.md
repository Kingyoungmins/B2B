---
type: endpoint
title: sendChat
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "chat-ui.js:2924-2924"

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
  - "augmentUserPromptWithMentions"
  - "bindChatHistoryEntryToMessage"
  - "callLLM"
  - "clarifyVerifierAskIfNeeded"
  - "clearViewerDragSelection"
  - "columnCopyClearIntent"
  - "columnMoveIntent"
  - "conditionalRowDeleteIntent"
  - "ctxHelperPreferredIntent"
  - "dedupeIntent"
  - "duplicateRowDeleteIntent"
  - "escapeHtml"
  - "exactSheetNameReminder"
  - "filterToNewSheetIntent"
  - "hideUnhideIntent"
  - "isThinkModeEnabled"
  - "lookupJoinIntent"
  - "monthShiftIntent"
  - "multiValueLookupIntent"
  - "pivotIntent"
  - "scrollChatToBottom"
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
  - "copy_sheet"
  - "debug"
  - "dedupe"
  - "filter"
  - "filter_to_sheet"
  - "find_header"
  - "flush"
  - "hide_cols"
  - "join"
  - "lookup"
  - "move_col_clear"
  - "move_cols"
  - "normalize"
  - "pivot"
  - "read"
  - "remove"
  - "rename_sheet"
  - "setAnswer"
  - "setReasoning"
  - "setStatus"
  - "shift_months"
  - "sort"
  - "split_column"
  - "stopped"
called_by: []
reads:
  - "state.editingStepId"
  - "state.inputs"
  - "state.output"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `$`, `add`, `addAssistantReply`, `addMessage`, `appendSameFormatSheetsIntent`, `augmentUserPromptWithMentions`, `bindChatHistoryEntryToMessage`, `callLLM`, `clarifyVerifierAskIfNeeded`, `clearViewerDragSelection`, `columnCopyClearIntent`, `columnMoveIntent`, `conditionalRowDeleteIntent`, `ctxHelperPreferredIntent`, `dedupeIntent`, `duplicateRowDeleteIntent`, `escapeHtml`, `exactSheetNameReminder`, `filterToNewSheetIntent`, `hideUnhideIntent`, `isThinkModeEnabled`, `lookupJoinIntent`, `monthShiftIntent`, `multiValueLookupIntent`, `pivotIntent`, `scrollChatToBottom`, `setupStreamingAssistantMessage`, `shouldRouteRequestToPython`, `shouldRouteRequestToVba`, `shouldRouteSimpleStructureEditToPython`, `showThinkRetryPrompt`, `simpleRangeArithmeticIntent`, `splitColumnIntent`, `toast`, `totalRowIntent`, `userExplicitlyRequestsForceProceed`, `userExplicitlyRequestsPython`, `userExplicitlyRequestsVba`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
