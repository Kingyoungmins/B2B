---
type: endpoint
title: showCodeGuardBlock
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(message, context)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "chat-ui.js:1941-1941"

# ── 입출력 ──
inputs:
  - "message"
  - "context"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "addMessage"
  - "escapeHtml"
  - "scrollChatToBottom"
  - "toast"
calls_external:
  - "onForceApply"
  - "querySelector"
  - "warn"
called_by:
  - "addAssistantReply"
  - "validateAssistantCodeBeforeApply"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `addMessage`, `escapeHtml`, `scrollChatToBottom`, `toast`
- 피호출(영향 전파 경로): `addAssistantReply`, `validateAssistantCodeBeforeApply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
