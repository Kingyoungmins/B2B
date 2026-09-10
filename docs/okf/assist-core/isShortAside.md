---
type: endpoint
title: isShortAside
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(p)"
role: "[실측 2026-09-09] \"…총합을 읽어서 맞춰 볼게요. 원본은 금액 열이에요.\" — 예고 뒤에 짧은 부연이"
role_source: banner
version: "0.8.4"
loc: "assist-core.js:372-372"

# ── 입출력 ──
inputs:
  - "p"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
[실측 2026-09-09] "…총합을 읽어서 맞춰 볼게요. 원본은 금액 열이에요." — 예고 뒤에 짧은 부연이

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
