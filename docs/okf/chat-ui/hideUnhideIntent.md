---
type: endpoint
title: hideUnhideIntent
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "[0.5.16] ctx 헬퍼가 결정적으로 처리하는 추가 작업들 — Python 우선 라우팅(헬퍼가 있는데 기본엔진 VBA 로"
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:854-854"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "routingIntentText"
calls_external:
  - "String"
  - "test"
called_by:
  - "ctxHelperPreferredIntent"
  - "sendChat"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[0.5.16] ctx 헬퍼가 결정적으로 처리하는 추가 작업들 — Python 우선 라우팅(헬퍼가 있는데 기본엔진 VBA 로

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `routingIntentText`
- 피호출(영향 전파 경로): `ctxHelperPreferredIntent`, `sendChat`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
