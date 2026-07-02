---
type: endpoint
title: columnSwapIntent
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "[0.5.18] 인접 두 열 '맞바꿈' → ctx.swap_cols(네이티브 Cut/Insert, 수식 참조 자동보정). move_cols(copy+delete)는"
role_source: banner
version: "0.5.18"
loc: "chat-ui.js:624-624"

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
timestamp: "0.5.18-gen"
---

## 역할
[0.5.18] 인접 두 열 '맞바꿈' → ctx.swap_cols(네이티브 Cut/Insert, 수식 참조 자동보정). move_cols(copy+delete)는

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `routingIntentText`
- 피호출(영향 전파 경로): `columnCopyIntent`, `columnMoveIntent`, `ctxHelperPreferredIntent`, `sendChat`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
