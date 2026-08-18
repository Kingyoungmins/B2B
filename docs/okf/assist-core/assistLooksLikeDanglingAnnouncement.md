---
type: endpoint
title: assistLooksLikeDanglingAnnouncement
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "(긴 답변 끝의 \"언제든 도와드리겠습니다\" 같은 맺음 인사는 길이 조건에서 걸러진다)"
role_source: banner
version: "0.7.4"
loc: "assist-core.js:229-229"

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
  - "test"
  - "trim"
called_by:
  - "assistHandleUserMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(긴 답변 끝의 "언제든 도와드리겠습니다" 같은 맺음 인사는 길이 조건에서 걸러진다)

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
