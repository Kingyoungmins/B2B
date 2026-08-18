---
type: endpoint
title: assistHasChineseLeak
module: assist-guard.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "한자(중국어) 혼입 검사 — Qwen 실측 대응. 한글 대비 한자 비율이 높으면 재생성 신호."
role_source: banner
version: "0.7.4"
loc: "assist-guard.js:122-122"

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
  - "match"
called_by:
  - "assistHandleUserMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
한자(중국어) 혼입 검사 — Qwen 실측 대응. 한글 대비 한자 비율이 높으면 재생성 신호.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
