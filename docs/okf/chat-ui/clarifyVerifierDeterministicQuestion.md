---
type: endpoint
title: clarifyVerifierDeterministicQuestion
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "── 검증(명확화) 에이전트 ───────────────────────────────────────────────"
role_source: banner
version: "0.7.3"
loc: "chat-ui.js:3293-3293"

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
  - "clarifyVerifierAskIfNeeded"
  - "clarifyVerifierLikelyUnderspecified"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
── 검증(명확화) 에이전트 ───────────────────────────────────────────────

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `clarifyVerifierAskIfNeeded`, `clarifyVerifierLikelyUnderspecified`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
