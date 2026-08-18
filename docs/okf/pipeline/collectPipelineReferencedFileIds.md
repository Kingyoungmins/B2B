---
type: endpoint
title: collectPipelineReferencedFileIds
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps = state.pipeline)"
role: "스킬이 참조하는 '모든' 파일의 fileId — 쓰기 대상 + 교차 출력 + '읽기 소스'(교차파일)까지."
role_source: banner
version: "0.7.4"
loc: "pipeline.js:1189-1189"

# ── 입출력 ──
inputs:
  - "steps = state.pipeline"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "activePipelineSteps"
  - "add"
  - "crossOutputFileIdsReferencedInCode"
  - "getFile"
  - "inferPipelineStepTargetFileId"
  - "pipelineCollectWorkbookNames"
  - "pipelineFileIdByWorkbookName"
  - "pipelinePythonSourceWorkbookNames"
  - "push"
calls_external:
  - "Workbooks"
  - "book"
  - "filter"
  - "forEach"
  - "includes"
called_by:
  - "ensurePipelineReferencedSessionsOpen"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
스킬이 참조하는 '모든' 파일의 fileId — 쓰기 대상 + 교차 출력 + '읽기 소스'(교차파일)까지.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `activePipelineSteps`, `add`, `crossOutputFileIdsReferencedInCode`, `getFile`, `inferPipelineStepTargetFileId`, `pipelineCollectWorkbookNames`, `pipelineFileIdByWorkbookName`, `pipelinePythonSourceWorkbookNames`, `push`
- 피호출(영향 전파 경로): `ensurePipelineReferencedSessionsOpen`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
