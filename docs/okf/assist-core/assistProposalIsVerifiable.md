---
type: endpoint
title: assistProposalIsVerifiable
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(p)"
role: "[Tier2] 격리 검증이 가능한 제안인가 — 단일 코드 수정(replaceLiteral/replaceStepCode)이고, 대상 스텝이"
role_source: banner
version: "0.8.0"
loc: "assist-core.js:990-990"

# ── 입출력 ──
inputs:
  - "p"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "find"
  - "isArray"
  - "test"
  - "toLowerCase"
called_by:
  - "assistCloseOut"
  - "assistHandleUserMessage"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[Tier2] 격리 검증이 가능한 제안인가 — 단일 코드 수정(replaceLiteral/replaceStepCode)이고, 대상 스텝이

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistCloseOut`, `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
