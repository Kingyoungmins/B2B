---
type: endpoint
title: runnerCanonicalizeRequirementsByEnv
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(map, cfg)"
role: "[역할(안정키) 정규화 — 같은 파일의 다른 달 이름 통합] 스킬 안에는 같은 파일이 시기마다 다른"
role_source: banner
version: "0.8.1"
loc: "drop-handling.js:633-633"

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
  - "add"
  - "cfgOf"
  - "mergeAliases"
  - "pipelineStableWorkbookKey"
  - "push"
  - "runnerMappingKey"
  - "runnerMappingNorm"
  - "sheetCanonOf"
  - "stable"
calls_external:
  - "Map"
  - "Set"
  - "entries"
  - "filter"
  - "from"
  - "get"
  - "has"
  - "isArray"
  - "set"
  - "some"
called_by:
  - "runnerExtractMappingRequirements"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
[역할(안정키) 정규화 — 같은 파일의 다른 달 이름 통합] 스킬 안에는 같은 파일이 시기마다 다른

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `cfgOf`, `mergeAliases`, `pipelineStableWorkbookKey`, `push`, `runnerMappingKey`, `runnerMappingNorm`, `sheetCanonOf`, `stable`
- 피호출(영향 전파 경로): `runnerExtractMappingRequirements`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
