---
type: endpoint
title: hangulLiteralTypoFailures
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code, sourceUserMessage)"
role: "언급) 통과 ③ 토큰 길이 4자 이상만."
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:579-579"

# ── 입출력 ──
inputs:
  - "code"
  - "sourceUserMessage"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "isHangul"
  - "oneHangulEdit"
  - "push"
calls_external:
  - "Set"
  - "String"
  - "abs"
  - "from"
  - "includes"
  - "map"
  - "match"
  - "matchAll"
  - "slice"
  - "test"
called_by:
  - "validateAssistantCodeBeforeApply"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
언급) 통과 ③ 토큰 길이 4자 이상만.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `isHangul`, `oneHangulEdit`, `push`
- 피호출(영향 전파 경로): `validateAssistantCodeBeforeApply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
