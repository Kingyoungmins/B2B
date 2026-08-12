---
type: endpoint
title: assistBuildDiagnosticsText
module: assist-report.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "진단 스냅샷 — 개발자가 zip 만 열어도 첫 단서를 얻게."
role_source: banner
version: "0.7.3"
loc: "assist-report.js:89-89"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "dump"
  - "push"
calls_external:
  - "String"
  - "fn"
  - "join"
  - "slice"
  - "stringify"
called_by:
  - "assistPrepareReportBundle"
reads:
  - "state.lastError"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
진단 스냅샷 — 개발자가 zip 만 열어도 첫 단서를 얻게.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `dump`, `push`
- 피호출(영향 전파 경로): `assistPrepareReportBundle`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
