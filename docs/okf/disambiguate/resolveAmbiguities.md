---
type: endpoint
title: resolveAmbiguities
module: disambiguate.js
lang: js
extraction: regex   # 정규식 근사
signature: "(items, contextLabel)"
role: "중간 단계에서 모호하게 매칭된 이름들을 한꺼번에 모아 일괄 해결."
role_source: banner
version: "0.7.4"
loc: "disambiguate.js:72-72"

# ── 입출력 ──
inputs:
  - "items"
  - "contextLabel"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "askUserChoice"
calls_external: []
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
중간 단계에서 모호하게 매칭된 이름들을 한꺼번에 모아 일괄 해결.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `askUserChoice`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
