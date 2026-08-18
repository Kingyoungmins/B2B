---
type: endpoint
title: assistBuildJiraGuideText
module: assist-report.js
lang: js
extraction: regex   # 정규식 근사
signature: "(meta, extras)"
role: "지라에 그대로 붙여넣을 제보 본문 + 절차 안내."
role_source: banner
version: "0.7.4"
loc: "assist-report.js:21-21"

# ── 입출력 ──
inputs:
  - "meta"
  - "extras"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Date"
  - "String"
  - "filter"
  - "isArray"
  - "join"
  - "map"
  - "net"
  - "slice"
  - "toLocaleString"
  - "trim"
called_by:
  - "assistPrepareReportBundle"
reads:
  - "state.inputsOriginal"
  - "state.logicSaveBaseName"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
지라에 그대로 붙여넣을 제보 본문 + 절차 안내.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistPrepareReportBundle`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
