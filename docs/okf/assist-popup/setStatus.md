---
type: endpoint
title: setStatus
module: assist-popup.js
lang: js
extraction: regex   # 정규식 근사
signature: "(s)"
role: "[사용자 요청 2026-08-11] '생각 중'을 창 맨 위 말고 채팅창 아래에 애니메이션으로."
role_source: banner
version: "0.8.1"
loc: "assist-popup.js:50-50"

# ── 입출력 ──
inputs:
  - "s"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "$id"
calls_external:
  - "String"
  - "appendChild"
  - "createElement"
  - "querySelector"
  - "remove"
  - "replace"
  - "setAttribute"
  - "trim"
called_by:
  - "onBridge"
  - "requestErrorRecovery"
  - "send"
  - "sendChat"
  - "setupStreamingAssistantMessage"
  - "submit"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
[사용자 요청 2026-08-11] '생각 중'을 창 맨 위 말고 채팅창 아래에 애니메이션으로.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `$id`
- 피호출(영향 전파 경로): `onBridge`, `requestErrorRecovery`, `send`, `sendChat`, `setupStreamingAssistantMessage`, `submit`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
