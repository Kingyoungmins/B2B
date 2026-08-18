---
type: endpoint
title: matchFillIntent
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "[0.7.1] 피벗/요약 값을 다른 시트의 '구분명(이름)'에 맞춰 '여러 값 열'을 채우는 붙여넣기 = ctx.match_fill."
role_source: banner
version: "0.7.4"
loc: "chat-ui.js:779-779"

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
  - "sendChat"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[0.7.1] 피벗/요약 값을 다른 시트의 '구분명(이름)'에 맞춰 '여러 값 열'을 채우는 붙여넣기 = ctx.match_fill.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `routingIntentText`
- 피호출(영향 전파 경로): `sendChat`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
