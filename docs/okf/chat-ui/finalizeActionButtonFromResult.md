---
type: endpoint
title: finalizeActionButtonFromResult
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(button, result, doneText, onFailure, options = {})"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "chat-ui.js:375-375"

# ── 입출력 ──
inputs:
  - "button"
  - "result"
  - "doneText"
  - "onFailure"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "cleanupCancelButton"
  - "setActionButtonPending"
calls_external:
  - "appendChild"
  - "cancel"
  - "createElement"
  - "onFailure"
  - "remove"
  - "resolve"
  - "then"
  - "uB2E4"
  - "uB958"
called_by:
  - "addAssistantReply"
  - "runApply"
  - "runEditApply"
  - "runInsert"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `add`, `cleanupCancelButton`, `setActionButtonPending`
- 피호출(영향 전파 경로): `addAssistantReply`, `runApply`, `runEditApply`, `runInsert`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
