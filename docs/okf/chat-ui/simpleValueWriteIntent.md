---
type: endpoint
title: simpleValueWriteIntent
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "[0.5.17] 단순 '값 채우기/쓰기' — 특정 셀/열/범위에 값을 입력(계산·매칭·조건 없음)은 ctx.write 로"
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:900-900"

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
  - "trim"
called_by:
  - "ctxHelperPreferredIntent"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[0.5.17] 단순 '값 채우기/쓰기' — 특정 셀/열/범위에 값을 입력(계산·매칭·조건 없음)은 ctx.write 로

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `routingIntentText`
- 피호출(영향 전파 경로): `ctxHelperPreferredIntent`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
