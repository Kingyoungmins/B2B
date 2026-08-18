---
type: endpoint
title: _assistProposalCardBody
module: assist-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(p)"
role: "[Tier1] 카드 본문을 kind 별로 구성(공통 헤더/액션은 아래에서 공유). 반환: {headLabel, body}."
role_source: banner
version: "0.7.4"
loc: "assist-ui.js:397-397"

# ── 입출력 ──
inputs:
  - "p"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "assistBuildDiffHtml"
  - "escapeHtml"
calls_external:
  - "Number"
  - "String"
  - "isArray"
  - "join"
  - "map"
  - "reduce"
  - "slice"
called_by:
  - "assistRenderProposalCard"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[Tier1] 카드 본문을 kind 별로 구성(공통 헤더/액션은 아래에서 공유). 반환: {headLabel, body}.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `assistBuildDiffHtml`, `escapeHtml`
- 피호출(영향 전파 경로): `assistRenderProposalCard`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
