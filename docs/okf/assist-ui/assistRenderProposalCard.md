---
type: endpoint
title: assistRenderProposalCard
module: assist-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(p)"
role: "승인 카드 — 여기 버튼을 눌러야만 스킬이 바뀐다."
role_source: banner
version: "0.7.3"
loc: "assist-ui.js:454-454"

# ── 입출력 ──
inputs:
  - "p"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "_assistProposalCardBody"
  - "assistAddMsg"
  - "assistCommitProposal"
  - "assistVerifyBadgeHtml"
  - "bindActions"
  - "escapeHtml"
calls_external:
  - "Number"
  - "filter"
  - "map"
  - "querySelector"
  - "querySelectorAll"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
승인 카드 — 여기 버튼을 눌러야만 스킬이 바뀐다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `_assistProposalCardBody`, `assistAddMsg`, `assistCommitProposal`, `assistVerifyBadgeHtml`, `bindActions`, `escapeHtml`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
