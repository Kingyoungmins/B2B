---
type: endpoint
title: refreshChatState
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "==================================================================="
role_source: banner
version: "0.8.1"
loc: "chat-ui.js:4-4"

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
  - "addMessage"
  - "refreshRunButton"
  - "renderEditingBanner"
  - "toggle"
calls_external:
  - "contains"
called_by:
  - "loadInputFiles"
  - "loadLogic"
  - "loadOutputTemplates"
  - "removeInputFileAt"
  - "removeOutputTemplateAt"
  - "restoreHistorySnapshot"
  - "restoreSoftRefreshSnapshot"
reads:
  - "state.inputs"
  - "state.output"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
===================================================================

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `$`, `addMessage`, `refreshRunButton`, `renderEditingBanner`, `toggle`
- 피호출(영향 전파 경로): `loadInputFiles`, `loadLogic`, `loadOutputTemplates`, `removeInputFileAt`, `removeOutputTemplateAt`, `restoreHistorySnapshot`, `restoreSoftRefreshSnapshot`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
