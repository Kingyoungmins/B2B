---
type: endpoint
title: draftCron
module: scheduler.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "── 스케줄 수정 — cron 규칙만 다룬다 ──────────────────────────────────"
role_source: banner
version: "0.8.2"
loc: "scheduler.js:902-902"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Number"
  - "String"
  - "split"
called_by:
  - "bindList"
  - "viewEditor"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
── 스케줄 수정 — cron 규칙만 다룬다 ──────────────────────────────────

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `bindList`, `viewEditor`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
