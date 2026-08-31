---
type: endpoint
title: crossWriteDestinationFileIds
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code, options = {})"
role: "확정된 목적지만 — 리셋 집합·스냅샷 대상처럼 '실제로 파일을 집어야 하는' 곳이 쓴다."
role_source: banner
version: "0.8.2"
loc: "pipeline.js:1058-1058"

# ── 입출력 ──
inputs:
  - "code"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "crossWriteDestinationScan"
calls_external: []
called_by:
  - "_reapplyVbaPipelineToLiveImpl"
  - "_reconcilePipelineSimulationAfterEditImpl"
  - "runVbaPipelinePreferLive"
  - "verifyPrefixRestoreCoverage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
확정된 목적지만 — 리셋 집합·스냅샷 대상처럼 '실제로 파일을 집어야 하는' 곳이 쓴다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `crossWriteDestinationScan`
- 피호출(영향 전파 경로): `_reapplyVbaPipelineToLiveImpl`, `_reconcilePipelineSimulationAfterEditImpl`, `runVbaPipelinePreferLive`, `verifyPrefixRestoreCoverage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
