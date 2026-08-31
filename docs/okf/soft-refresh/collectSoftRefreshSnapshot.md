---
type: endpoint
title: collectSoftRefreshSnapshot
module: soft-refresh.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "soft-refresh.js:24-24"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: runnerMappings"
raises: []

# ── 유기적 관계 ──
calls:
  - "buildLogicZipEntries"
  - "defaultLogicBaseNameFromInputs"
  - "runnerCurrentMappingSignature"
  - "timestampedLogicArchiveName"
calls_external:
  - "filter"
  - "map"
  - "now"
  - "parse"
  - "stringify"
  - "warn"
called_by:
  - "softRefreshApp"
reads:
  - "state.activeOutputIndex"
  - "state.currentFileId"
  - "state.inputs"
  - "state.outputTemplates"
  - "state.pipeline"
  - "state.runnerMappingChecked"
  - "state.runnerMappingSignature"
  - "state.runnerMappings"
writes:
  - "runnerMappings"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: runnerMappings
- 변경 상태 `runnerMappings` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `buildLogicZipEntries`, `defaultLogicBaseNameFromInputs`, `runnerCurrentMappingSignature`, `timestampedLogicArchiveName`
- 피호출(영향 전파 경로): `softRefreshApp`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
