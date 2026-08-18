---
type: endpoint
title: runnerAddPairedCodeRequirements
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(map, code, shouldSkip)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "drop-handling.js:1089-1089"

# ── 입출력 ──
inputs:
  - "map"
  - "code"
  - "shouldSkip"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "runnerAddRequirement"
  - "runnerLooksLikeA1Address"
  - "runnerPyBookVarMap"
  - "runnerRecordedActivatePairs"
calls_external:
  - "RegExp"
  - "Sheets"
  - "String"
  - "Windows"
  - "book"
  - "exec"
  - "forEach"
  - "paste_copied"
  - "replace"
  - "shouldSkip"
  - "slice"
called_by:
  - "runnerExtractMappingRequirements"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `runnerAddRequirement`, `runnerLooksLikeA1Address`, `runnerPyBookVarMap`, `runnerRecordedActivatePairs`
- 피호출(영향 전파 경로): `runnerExtractMappingRequirements`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
