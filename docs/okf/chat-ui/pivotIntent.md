---
type: endpoint
title: pivotIntent
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "ctx 헬퍼가 결정적으로 처리하는(=Python 우선) 작업 묶음. 필요 시 안전한 헬퍼 작업을 여기에 더한다."
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:781-781"

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
ctx 헬퍼가 결정적으로 처리하는(=Python 우선) 작업 묶음. 필요 시 안전한 헬퍼 작업을 여기에 더한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `routingIntentText`
- 피호출(영향 전파 경로): `ctxHelperPreferredIntent`, `sendChat`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
