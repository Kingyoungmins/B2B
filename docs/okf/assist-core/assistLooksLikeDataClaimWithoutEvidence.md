---
type: endpoint
title: assistLooksLikeDataClaimWithoutEvidence
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(question, text)"
role: "근거 없는 주장으로 본다 → 루프가 한 번 재촉한다."
role_source: banner
version: "0.8.4"
loc: "assist-core.js:346-346"

# ── 입출력 ──
inputs:
  - "question"
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_assistAllFiles"
  - "push"
calls_external:
  - "String"
  - "forEach"
  - "id"
  - "isArray"
  - "join"
  - "keys"
  - "replace"
  - "sort"
  - "split"
  - "test"
called_by:
  - "assistHandleUserMessage"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
근거 없는 주장으로 본다 → 루프가 한 번 재촉한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_assistAllFiles`, `push`
- 피호출(영향 전파 경로): `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
