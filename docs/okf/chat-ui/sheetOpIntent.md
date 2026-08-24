---
type: endpoint
title: sheetOpIntent
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "[사용자 지시] 시트 복사/복사후 이름변경/추가/삭제, 단순 정렬처럼 'ctx 헬퍼가 결정적으로 처리하는' 작업은"
role_source: banner
version: "0.7.5"
loc: "chat-ui.js:708-708"

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
  - "Python"
  - "String"
  - "Workbooks"
  - "X"
  - "test"
called_by:
  - "ctxHelperPreferredIntent"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[사용자 지시] 시트 복사/복사후 이름변경/추가/삭제, 단순 정렬처럼 'ctx 헬퍼가 결정적으로 처리하는' 작업은

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `routingIntentText`
- 피호출(영향 전파 경로): `ctxHelperPreferredIntent`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
