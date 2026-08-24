---
type: endpoint
title: runnerAddRequirement
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(map, book, sheet, source)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "drop-handling.js:752-752"

# ── 입출력 ──
inputs:
  - "map"
  - "book"
  - "sheet"
  - "source"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "runnerCleanWorkbookRequirementName"
  - "runnerMappingKey"
calls_external:
  - "String"
  - "has"
  - "set"
  - "trim"
called_by:
  - "runnerAddPairedCodeRequirements"
  - "runnerApplyEnvConfigFilter"
  - "runnerExtractMappingRequirements"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `runnerCleanWorkbookRequirementName`, `runnerMappingKey`
- 피호출(영향 전파 경로): `runnerAddPairedCodeRequirements`, `runnerApplyEnvConfigFilter`, `runnerExtractMappingRequirements`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
