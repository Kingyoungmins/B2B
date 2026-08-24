---
type: endpoint
title: runPipelineSuffixFromCheckpoint
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(startIdx, options = {})"
role: "[매핑 보존] '수정 이후 부분만 이어실행'도 매핑본으로 돈다 — 안 그러면 수정 스텝은 새 코드로,"
role_source: banner
version: "0.7.4"
loc: "pipeline.js:4738-4738"

# ── 입출력 ──
inputs:
  - "startIdx"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_runPipelineSuffixFromCheckpointImpl"
  - "beginMappedPipelineRun"
  - "restore"
calls_external: []
called_by:
  - "_runHeldStepsBatchImpl"
  - "runFromCheckpointAfterEdit"
  - "runPipelineWithAutoRepair"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[매핑 보존] '수정 이후 부분만 이어실행'도 매핑본으로 돈다 — 안 그러면 수정 스텝은 새 코드로,

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_runPipelineSuffixFromCheckpointImpl`, `beginMappedPipelineRun`, `restore`
- 피호출(영향 전파 경로): `_runHeldStepsBatchImpl`, `runFromCheckpointAfterEdit`, `runPipelineWithAutoRepair`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
