---
type: endpoint
title: assistBuildDiffHtml
module: assist-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(oldCode, newCode)"
role: "줄 단위 diff. [검토 #10] 같은 줄번호끼리 비교하면 줄 하나만 삽입돼도 이후 전체가 어긋난 diff 로"
role_source: banner
version: "0.7.4"
loc: "assist-ui.js:512-512"

# ── 입출력 ──
inputs:
  - "oldCode"
  - "newCode"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "escapeHtml"
  - "push"
calls_external:
  - "String"
  - "forEach"
  - "join"
  - "slice"
  - "split"
called_by:
  - "_assistProposalCardBody"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
줄 단위 diff. [검토 #10] 같은 줄번호끼리 비교하면 줄 하나만 삽입돼도 이후 전체가 어긋난 diff 로

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `escapeHtml`, `push`
- 피호출(영향 전파 경로): `_assistProposalCardBody`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
