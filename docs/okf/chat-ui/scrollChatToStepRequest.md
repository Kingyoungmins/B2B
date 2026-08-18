---
type: endpoint
title: scrollChatToStepRequest
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step)"
role: "스텝의 원 요청 말풍선을 찾아 스크롤+강조. 못 찾으면 false."
role_source: banner
version: "0.7.4"
loc: "chat-ui.js:242-242"

# ── 입출력 ──
inputs:
  - "step"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
  - "_chatMsgPlainText"
  - "_flashChatMessage"
  - "_matchStepToChatIndex"
  - "stepChatOriginless"
  - "toast"
calls_external:
  - "String"
  - "contains"
  - "find"
  - "findIndex"
  - "from"
  - "map"
  - "querySelector"
  - "querySelectorAll"
called_by:
  - "toggleEditStep"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
스텝의 원 요청 말풍선을 찾아 스크롤+강조. 못 찾으면 false.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `$`, `_chatMsgPlainText`, `_flashChatMessage`, `_matchStepToChatIndex`, `stepChatOriginless`, `toast`
- 피호출(영향 전파 경로): `toggleEditStep`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
