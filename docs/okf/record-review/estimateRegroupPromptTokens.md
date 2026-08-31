---
type: endpoint
title: estimateRegroupPromptTokens
module: record-review.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps)"
role: "재그룹 프롬프트의 실제 토큰 추정치(≈ 요약 문자열 길이 / 4 + 시스템 프롬프트 오버헤드)."
role_source: banner
version: "0.8.2"
loc: "record-review.js:61-61"

# ── 입출력 ──
inputs:
  - "steps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_recordStepsSummary"
calls_external:
  - "ceil"
  - "isArray"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
재그룹 프롬프트의 실제 토큰 추정치(≈ 요약 문자열 길이 / 4 + 시스템 프롬프트 오버헤드).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_recordStepsSummary`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
