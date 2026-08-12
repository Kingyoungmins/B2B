---
type: endpoint
title: proposalBody
module: assist-popup.js
lang: js
extraction: regex   # 정규식 근사
signature: "(p)"
role: "[Tier1] kind 별 카드 본문(assist-ui.js 와 동형 — 다른 창이라 코드 공유 불가, 의도적 중복)."
role_source: banner
version: "0.7.3"
loc: "assist-popup.js:98-98"

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
  - "buildDiffHtml"
  - "esc"
calls_external:
  - "Number"
  - "String"
  - "isArray"
  - "join"
  - "map"
  - "reduce"
  - "slice"
called_by:
  - "renderProposal"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[Tier1] kind 별 카드 본문(assist-ui.js 와 동형 — 다른 창이라 코드 공유 불가, 의도적 중복).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `buildDiffHtml`, `esc`
- 피호출(영향 전파 경로): `renderProposal`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
