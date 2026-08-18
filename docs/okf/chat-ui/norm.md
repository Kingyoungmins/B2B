---
type: endpoint
title: norm
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(v)"
role: "공백/_/- 만 다른 경우(모델이 한글 식별자에 공백을 끼우는 흔한 케이스, 예: \"2026년\"→\"2026 년\")는 통과."
role_source: banner
version: "0.7.4"
loc: "chat-ui.js:477-477"

# ── 입출력 ──
inputs:
  - "v"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "assistBuildProposal"
  - "colIdx"
  - "exactReferenceFailures"
  - "promoteStepChatOrigins"
  - "runnerApplyEnvConfigFilter"
  - "runnerSameBookName"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
공백/_/- 만 다른 경우(모델이 한글 식별자에 공백을 끼우는 흔한 케이스, 예: "2026년"→"2026 년")는 통과.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistBuildProposal`, `colIdx`, `exactReferenceFailures`, `promoteStepChatOrigins`, `runnerApplyEnvConfigFilter`, `runnerSameBookName`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
