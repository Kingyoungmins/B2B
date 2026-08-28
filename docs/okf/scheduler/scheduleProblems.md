---
type: endpoint
title: scheduleProblems
module: scheduler.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "등록을 막을 이유들. 비어 있으면 등록 가능하다."
role_source: banner
version: "0.8.1"
loc: "scheduler.js:402-402"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
calls_external:
  - "trim"
called_by:
  - "refreshSummary"
  - "saveSchedule"
  - "viewSummary"
reads:
  - "state.schedule"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
등록을 막을 이유들. 비어 있으면 등록 가능하다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `refreshSummary`, `saveSchedule`, `viewSummary`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
