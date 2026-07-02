---
type: endpoint
title: attachChatMessageDeleteButton
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(div, histId)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "chat-ui.js:121-121"

# ── 입출력 ──
inputs:
  - "div"
  - "histId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "toast"
calls_external:
  - "appendChild"
  - "createElement"
  - "findIndex"
  - "querySelector"
  - "remove"
  - "splice"
  - "stopPropagation"
called_by:
  - "bindChatHistoryEntryToMessage"
reads:
  - "state.chatHistory"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `toast`
- 피호출(영향 전파 경로): `bindChatHistoryEntryToMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
