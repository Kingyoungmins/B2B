---
type: endpoint
title: cycleText
module: scheduler.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "── 2. 스케줄 등록 ──────────────────────────────────────────────────────"
role_source: banner
version: "0.8.1"
loc: "scheduler.js:384-384"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
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
── 2. 스케줄 등록 ──────────────────────────────────────────────────────

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `refreshSummary`, `saveSchedule`, `viewSummary`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
