---
type: endpoint
title: columnCopyIntent
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "[0.5.18] 한 열을 다른 열로 (서식째) 복사 → ctx.copy_col(병합 안전, 원본 유지). ctx.copy 로 1행부터 통복사하면"
role_source: banner
version: "0.5.18"
loc: "chat-ui.js:642-642"

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
  - "columnCopyClearIntent"
  - "columnSwapIntent"
  - "copyValuesIntent"
  - "routingIntentText"
calls_external:
  - "String"
  - "test"
called_by:
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
[0.5.18] 한 열을 다른 열로 (서식째) 복사 → ctx.copy_col(병합 안전, 원본 유지). ctx.copy 로 1행부터 통복사하면

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `columnCopyClearIntent`, `columnSwapIntent`, `copyValuesIntent`, `routingIntentText`
- 피호출(영향 전파 경로): `columnMoveIntent`, `ctxHelperPreferredIntent`, `sendChat`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
