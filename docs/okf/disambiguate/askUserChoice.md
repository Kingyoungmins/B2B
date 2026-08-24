---
type: endpoint
title: askUserChoice
module: disambiguate.js
lang: js
extraction: regex   # 정규식 근사
signature: "(question, choices, options)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "disambiguate.js:13-13"

# ── 입출력 ──
inputs:
  - "question"
  - "choices"
  - "options"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "close"
  - "escapeHtml"
calls_external:
  - "Promise"
  - "getElementById"
  - "join"
  - "map"
  - "parseInt"
  - "querySelector"
  - "random"
  - "remove"
  - "resolve"
  - "slice"
  - "toString"
  - "trim"
called_by:
  - "resolveAmbiguities"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `add`, `close`, `escapeHtml`
- 피호출(영향 전파 경로): `resolveAmbiguities`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
