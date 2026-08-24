---
type: endpoint
title: columnCopyClearIntent
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "[0.5.17] 열(컬럼) 이동/재배치/맞바꾸기 → ctx.move_cols 로 결정적 처리(Python). VBA 로 보내면 모델이 병합"
role_source: banner
version: "0.7.5"
loc: "chat-ui.js:870-870"

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
  - "columnCopyIntent"
  - "columnMoveIntent"
  - "ctxHelperPreferredIntent"
  - "sendChat"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[0.5.17] 열(컬럼) 이동/재배치/맞바꾸기 → ctx.move_cols 로 결정적 처리(Python). VBA 로 보내면 모델이 병합

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `routingIntentText`
- 피호출(영향 전파 경로): `columnCopyIntent`, `columnMoveIntent`, `ctxHelperPreferredIntent`, `sendChat`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
