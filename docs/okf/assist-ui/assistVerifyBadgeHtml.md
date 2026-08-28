---
type: endpoint
title: assistVerifyBadgeHtml
module: assist-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(v)"
role: "[Tier2] 격리 검증 배지 — 실측 결과를 카드 상단에 붙인다(추측 카드와 구분)."
role_source: banner
version: "0.8.1"
loc: "assist-ui.js:440-440"

# ── 입출력 ──
inputs:
  - "v"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "escapeHtml"
calls_external:
  - "Number"
  - "String"
  - "filter"
  - "join"
  - "map"
  - "slice"
  - "toLocaleString"
called_by:
  - "assistRenderProposalCard"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
[Tier2] 격리 검증 배지 — 실측 결과를 카드 상단에 붙인다(추측 카드와 구분).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `escapeHtml`
- 피호출(영향 전파 경로): `assistRenderProposalCard`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
