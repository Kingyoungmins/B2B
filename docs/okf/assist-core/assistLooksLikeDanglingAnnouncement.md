---
type: endpoint
title: assistLooksLikeDanglingAnnouncement
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "\"언제든 도와드리겠습니다\")이 아니면 → 예고. 길이와 무관하게 잡는다."
role_source: banner
version: "0.8.1"
loc: "assist-core.js:297-297"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "filter"
  - "map"
  - "pop"
  - "split"
  - "test"
  - "trim"
called_by:
  - "assistHandleUserMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
"언제든 도와드리겠습니다")이 아니면 → 예고. 길이와 무관하게 잡는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
