---
type: endpoint
title: swallowable
module: click-recovery.js
lang: js
extraction: regex   # 정규식 근사
signature: "(e)"
role: "진짜 마우스 이벤트만 삼킨다(위 '삼킴 규칙' ①②)."
role_source: banner
version: "0.7.5"
loc: "click-recovery.js:74-74"

# ── 입출력 ──
inputs:
  - "e"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "onRealClick"
  - "onRealDbl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
진짜 마우스 이벤트만 삼킨다(위 '삼킴 규칙' ①②).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `onRealClick`, `onRealDbl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
