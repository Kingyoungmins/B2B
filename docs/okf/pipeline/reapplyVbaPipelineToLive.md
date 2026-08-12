---
type: endpoint
title: reapplyVbaPipelineToLive
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(excelId, options = {})"
role: "[매핑 보존] 수정 후 적용 / ON·OFF / 삽입 등 편집발 재적용의 최종 관문. 호출자가 steps 를 명시하지"
role_source: banner
version: "0.7.3"
loc: "pipeline.js:5076-5076"

# ── 입출력 ──
inputs:
  - "excelId"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_reapplyVbaPipelineToLiveImpl"
  - "beginMappedPipelineRun"
  - "markPipelinePendingFromIndex"
  - "restore"
calls_external:
  - "isInteger"
called_by:
  - "_reconcilePipelineSimulationAfterEditImpl"
  - "_runPipelineSuffixFromCheckpointImpl"
  - "insertLogic"
  - "maybeAutoReapplyAfterRecover"
  - "replaceLogicAt"
  - "requestExcelApplyCancel"
  - "runFromCheckpointAfterEdit"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[매핑 보존] 수정 후 적용 / ON·OFF / 삽입 등 편집발 재적용의 최종 관문. 호출자가 steps 를 명시하지

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_reapplyVbaPipelineToLiveImpl`, `beginMappedPipelineRun`, `markPipelinePendingFromIndex`, `restore`
- 피호출(영향 전파 경로): `_reconcilePipelineSimulationAfterEditImpl`, `_runPipelineSuffixFromCheckpointImpl`, `insertLogic`, `maybeAutoReapplyAfterRecover`, `replaceLogicAt`, `requestExcelApplyCancel`, `runFromCheckpointAfterEdit`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
