---
type: endpoint
title: showRunnerPreflightNotice
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(report)"
role: "받는 함수라 재사용하면 \"스킬을 적용하지 못했습니다\"로 잘못 보인다 — 실행 전 경고는 따로."
role_source: banner
version: "0.8.2"
loc: "pipeline.js:8477-8477"

# ── 입출력 ──
inputs:
  - "report"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "escapeHtml"
  - "formatHeaderMismatchNotice"
  - "toast"
calls_external:
  - "getElementById"
  - "join"
  - "map"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
받는 함수라 재사용하면 "스킬을 적용하지 못했습니다"로 잘못 보인다 — 실행 전 경고는 따로.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `escapeHtml`, `formatHeaderMismatchNotice`, `toast`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
