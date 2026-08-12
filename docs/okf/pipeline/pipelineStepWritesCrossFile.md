---
type: endpoint
title: pipelineStepWritesCrossFile
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step)"
role: "이 스텝이 '다른 파일에 쓰는' 교차파일 스텝인가(dst_book 대상이 알려진 파일로 해석되면)."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:1046-1046"

# ── 입출력 ──
inputs:
  - "step"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "crossWriteDestinationScan"
  - "inferPipelineStepTargetFileId"
  - "stepRuntimeCrossExcelIds"
calls_external: []
called_by:
  - "_handlePipelineStepToggleImpl"
  - "canFastEditLastPipelineStep"
  - "insertLogic"
  - "pipelineSuffixWritesCrossFile"
  - "replaceLogicAt"
  - "runLivePipelineStepSequentially"
  - "stepHasFullRollbackSnapshots"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
이 스텝이 '다른 파일에 쓰는' 교차파일 스텝인가(dst_book 대상이 알려진 파일로 해석되면).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `crossWriteDestinationScan`, `inferPipelineStepTargetFileId`, `stepRuntimeCrossExcelIds`
- 피호출(영향 전파 경로): `_handlePipelineStepToggleImpl`, `canFastEditLastPipelineStep`, `insertLogic`, `pipelineSuffixWritesCrossFile`, `replaceLogicAt`, `runLivePipelineStepSequentially`, `stepHasFullRollbackSnapshots`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
