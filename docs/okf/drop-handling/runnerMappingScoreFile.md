---
type: endpoint
title: runnerMappingScoreFile
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(requiredName, item)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "drop-handling.js:1377-1377"

# ── 입출력 ──
inputs:
  - "requiredName"
  - "item"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "runnerMappingNorm"
  - "runnerMappingStem"
calls_external:
  - "filter"
  - "includes"
  - "round"
  - "split"
called_by:
  - "runnerFindAutoFile"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `runnerMappingNorm`, `runnerMappingStem`
- 피호출(영향 전파 경로): `runnerFindAutoFile`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
