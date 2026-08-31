---
type: endpoint
title: runnerApplyEnvConfigFilter
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(map, cfg)"
role: "[환경 config 교집합 — 0.6.2 아이디어] 저장 시점의 실제 파일·시트 정본(envConfig)으로 요구를"
role_source: banner
version: "0.8.2"
loc: "drop-handling.js:711-711"

# ── 입출력 ──
inputs:
  - "map"
  - "cfg"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_cfgNames"
  - "findCfg"
  - "norm"
  - "pipelineStableWorkbookKey"
  - "push"
  - "runnerAddRequirement"
  - "runnerCleanWorkbookRequirementName"
  - "runnerMappingKey"
  - "runnerMappingNorm"
  - "stable"
calls_external:
  - "Set"
  - "aliases"
  - "displayName"
  - "entries"
  - "filter"
  - "find"
  - "from"
  - "get"
  - "isArray"
  - "map"
  - "name"
  - "some"
  - "values"
called_by:
  - "runnerExtractMappingRequirements"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
[환경 config 교집합 — 0.6.2 아이디어] 저장 시점의 실제 파일·시트 정본(envConfig)으로 요구를

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_cfgNames`, `findCfg`, `norm`, `pipelineStableWorkbookKey`, `push`, `runnerAddRequirement`, `runnerCleanWorkbookRequirementName`, `runnerMappingKey`, `runnerMappingNorm`, `stable`
- 피호출(영향 전파 경로): `runnerExtractMappingRequirements`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
