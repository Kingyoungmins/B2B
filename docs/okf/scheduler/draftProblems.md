---
type: endpoint
title: draftProblems
module: scheduler.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "주기만 검사한다 — 이 화면이 바꾸는 건 cron.txt 한 줄뿐이고,"
role_source: banner
version: "0.8.1"
loc: "scheduler.js:804-804"

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
calls_external: []
called_by:
  - "bindList"
  - "saveEdit"
  - "viewEditor"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
주기만 검사한다 — 이 화면이 바꾸는 건 cron.txt 한 줄뿐이고,

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `bindList`, `saveEdit`, `viewEditor`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
