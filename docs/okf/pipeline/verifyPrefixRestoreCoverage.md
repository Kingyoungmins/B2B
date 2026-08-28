---
type: endpoint
title: verifyPrefixRestoreCoverage
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(start, restoredExcelIds)"
role: "[적용됨-미반영 수정] prefix(0..start-1) 스텝들이 변형하는 파일의 라이브 세션이 전부"
role_source: banner
version: "0.8.1"
loc: "pipeline.js:4780-4780"

# ── 입출력 ──
inputs:
  - "start"
  - "restoredExcelIds"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "crossOutputFileIdsReferencedInCode"
  - "crossWriteDestinationFileIds"
  - "excelIdForPipelineFileId"
  - "inferPipelineStepTargetFileId"
  - "isStepEnabled"
calls_external:
  - "Set"
  - "forEach"
  - "has"
  - "slice"
called_by:
  - "restorePipelineToCheckpointAndHold"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
[적용됨-미반영 수정] prefix(0..start-1) 스텝들이 변형하는 파일의 라이브 세션이 전부

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `crossOutputFileIdsReferencedInCode`, `crossWriteDestinationFileIds`, `excelIdForPipelineFileId`, `inferPipelineStepTargetFileId`, `isStepEnabled`
- 피호출(영향 전파 경로): `restorePipelineToCheckpointAndHold`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
